// dsh-pack-market 采集器：扫描 GitHub 上打了 topic `dsh-pack` 的仓库，
// 读取各仓库根 manifest.json（manifest v3/v4/v5 兼容）+ README.md（若有），
// 汇总产出：
//   1) index/packs/<owner>.<repo>/   —— manifest.json + README.md（+ stats.json 下载量快照）
//   2) index/index.json              —— 精简索引（schemaVersion 2，仅列表/搜索/安装必需字段）
//
// 约定：
//   - 仓库 About 打 topic `dsh-pack`；
//   - 根放 `manifest.json`（manifest v3/v4/v5 契约），推荐再放 README.md；
//   - 清单可选 `downloadUrl`：有则直连 + `<url>.sha256` 侧车；无则默认最新 GitHub Release 资产 + 同名 `.sha256` 侧车。
//
// 可靠性约定（重要）：
//   - **瞬时失败绝不删数据**：网络错误 / 403 / 429 / 5xx 视为瞬时可重试，本轮沿用上一轮条目与 packs/ 文件；
//     只有「确定不存在」（404/410/451）才按「不是整合包 / 作者已撤下」处理；
//   - **目录只在撤出 topic 时清理**：仓库仍命中 topic 但抓取失败 → 保留旧目录；
//   - **熔断**：topic 命中数或最终收录数跌破上轮的 70% 时，本轮直接不写入并非零退出
//     （宁可这一轮不更新，也不发一个残缺索引）。确认是有意收缩可设 ALLOW_SHRINK=1 绕过。
//
// 用法：node scripts/collect.mjs   （可选环境变量 GH_TOKEN 提升 API 限额）
// 每轮对 api.github.com 的请求数 ≈ 1（搜索）+ 1 × 包数（Release 列表，与下载量统计共用）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'index', 'index.json');
const PACKS_DIR = path.join(ROOT, 'index', 'packs');
const TOPIC = 'dsh-pack';
const UA = { 'user-agent': 'dsh-pack-market-collector' };
const CONCURRENCY = 5;      // 包级并发（I/O 密集；远低于 GitHub 建议的并发上限）
const SHRINK_GUARD = 0.7;   // 熔断阈值：跌破上轮的 70% 就不写

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// —— HTTP 层：区分「瞬时失败」与「确定不存在」——
// 404/410/451 = 确定不存在（不是整合包 / 作者撤下）；其余（网络错误、403、429、5xx）= 瞬时，可重试、可沿用旧数据。
const DEFINITIVE_STATUS = new Set([404, 410, 451]);

class HttpError extends Error {
  constructor(status, what, detail = '') {
    super(`HTTP ${status} ${what}${detail ? ' :: ' + detail : ''}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

const isDefinitive = (e) => e instanceof HttpError && DEFINITIVE_STATUS.has(e.status);

async function withRetry(fn, attempts = 2) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (isDefinitive(e) || i === attempts - 1) throw e;
      await sleep(700 * (i + 1));
    }
  }
  throw last;
}

async function gh(apiPath) {
  const headers = { accept: 'application/vnd.github+json', ...UA };
  if (process.env.GH_TOKEN) headers.authorization = `Bearer ${process.env.GH_TOKEN}`;
  const res = await fetch('https://api.github.com' + apiPath, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new HttpError(res.status, `api.github.com${apiPath}`, body.slice(0, 160));
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { ...UA }, redirect: 'follow' });
  if (!res.ok) throw new HttpError(res.status, url);
  return res.text();
}

async function headSize(url) {
  const res = await fetch(url, { method: 'HEAD', headers: { ...UA }, redirect: 'follow' });
  const len = res.headers.get('content-length');
  return len ? parseInt(len, 10) : 0;
}

async function readSidecar(url) {
  const txt = await fetchText(url);
  return txt.trim().split(/\s+/)[0];
}

function pickAsset(assets) {
  for (const ext of ['.dspack', '.tgz', '.zip']) {
    const hit = assets.find((a) => a.name.toLowerCase().endsWith(ext) && !/\.sha256$/i.test(a.name));
    if (hit) return hit;
  }
  return assets.find((a) => !/\.(sha256|txt|md)$/i.test(a.name)) || assets[0];
}

// —— 下载量统计（GitHub Release 资产）——
// 口径：只算包资产（.dspack/.tgz，无则回退 .zip），**不含** .sha256 侧车与说明文件
//（侧车是校验用的，实测能占到包资产的 10%~25%，混进去会虚高）。
// 注意：来源是 download_count 累计值，含重复下载与自动化拉取，不等于安装量。
const META_ASSET = /\.(sha256|txt|md)$/i;

function hostOf(u) {
  try { return new URL(u).host; } catch { return u; }
}

function pickPackageAssets(assets) {
  const clean = (assets || []).filter((a) => a && typeof a.name === 'string' && !META_ASSET.test(a.name));
  const primary = clean.filter((a) => /\.(dspack|tgz)$/i.test(a.name));
  return primary.length ? primary : clean.filter((a) => /\.zip$/i.test(a.name));
}

// 由 Release 列表算出下载量快照（纯函数，不发请求 —— 列表已在本轮抓过）。
// 返回 null = 该仓库的 Release 里没有包资产，索引里就不放 stats.json。
function buildStats(releases, m, src, warnings) {
  const versions = [];
  let total = 0;
  for (const r of releases || []) {
    const assets = pickPackageAssets(r.assets);
    if (!assets.length) continue;
    const downloads = assets.reduce((s, a) => s + (a.download_count || 0), 0);
    total += downloads;
    versions.push({
      version: String(r.tag_name || '').replace(/^v/i, ''),
      tag: r.tag_name || '',
      downloads,
      publishedAt: String(r.published_at || r.created_at || '').slice(0, 10),
    });
  }
  if (!versions.length) return null;
  if ((releases || []).length >= 100) warnings.push(`[stats] ${src}: Release 数达 100，更早版本可能未统计（需分页）`);

  versions.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const since = versions[versions.length - 1].publishedAt;
  const current = String(m.version || '').replace(/^v/i, '');
  const currentHit = versions.find((v) => v.version === current);

  // 刻意**不做**"日均"：它等于 累计 ÷ 发布以来天数，是个终身平均速率，
  // 结构上只会随发布初期那一波下载的稀释而单调下降——包没变差数字却在跌，
  // 对作者是没必要的压力；真要热度榜应当用"近 7 天增量"这类窗口指标。
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'github-releases',
    repo: src,
    total,
    since,
    current,
    currentDownloads: currentHit ? currentHit.downloads : null,
    versions,
  };
}

// 归一化 manifest 类型：v5 显式声明 profile|dshhome；v3/v4 缺省按 profile。
function inferType(m, manifestVersion) {
  if (m.type === 'dshhome' || m.type === 'profile') return m.type;
  return 'profile';
}

// 统计卡片用计数（只进索引、不进懒加载文件）：
// profile 形态 = bundles/dependencies 各自数量；dshhome 形态 = profile 数 + 合计 bundle/依赖数。
function countUnits(m, type) {
  if (type === 'dshhome') {
    const profiles = m.profiles && typeof m.profiles === 'object' ? m.profiles : {};
    const names = Object.keys(profiles);
    let bundles = 0;
    let deps = 0;
    for (const k of names) {
      const p = profiles[k] || {};
      if (Array.isArray(p.bundles)) bundles += p.bundles.length;
      if (p.dependencies && typeof p.dependencies === 'object') deps += Object.keys(p.dependencies).length;
    }
    return { profileCount: names.length, bundleCount: bundles, depCount: deps };
  }
  return {
    bundleCount: Array.isArray(m.bundles) ? m.bundles.length : 0,
    depCount: m.dependencies && typeof m.dependencies === 'object' ? Object.keys(m.dependencies).length : 0,
  };
}

// —— 单个仓库的采集结果（三态）——
const okResult = (p) => ({ status: 'ok', ...p });
const skipResult = (id, reason, detail = '') => ({ status: 'skip', id, reason, detail });        // 确定不是整合包 / 已撤下
const transientResult = (id, reason, detail = '') => ({ status: 'transient', id, reason, detail }); // 瞬时失败 → 沿用旧数据

async function collectRepo(repo, warnings) {
  const [owner, name] = repo.full_name.split('/');
  const id = `${owner}.${name}`;
  const branch = repo.default_branch || 'main';
  const rawBase = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/`;

  // 1) manifest：404 → 打了 topic 但不是整合包（或无 manifest）；其他失败 → 瞬时
  let rawManifest;
  try {
    rawManifest = await withRetry(() => fetchText(rawBase + 'manifest.json'));
  } catch (e) {
    if (isDefinitive(e)) return skipResult(id, 'no-manifest', e.message);
    return transientResult(id, 'manifest-fetch-failed', e.message);
  }

  let m;
  try {
    m = JSON.parse(rawManifest);
  } catch {
    warnings.push(`${id}: manifest.json 不是有效 JSON（跳过）`);
    return skipResult(id, 'bad-manifest-json');
  }
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    warnings.push(`${id}: manifest.json 不是对象（跳过）`);
    return skipResult(id, 'bad-manifest-shape');
  }

  // 2) README：可选，缺了就跳过（不告警）；瞬时失败就不再试其它文件名
  let rawReadme = '';
  for (const f of ['README.md', 'readme.md', 'README.MD', 'Readme.md']) {
    try {
      rawReadme = await fetchText(rawBase + f);
      break;
    } catch (e) {
      if (!isDefinitive(e)) break;
    }
  }

  const manifestVersion = m.manifestVersion ?? 4;
  const type = inferType(m, manifestVersion);

  let downloadUrl = typeof m.downloadUrl === 'string' ? m.downloadUrl : '';
  let size = 0;
  let sha256 = '';
  let updatedAt = m.updatedAt || repo.pushed_at || '';
  let releases = null;        // 已抓到的 Release 列表（与下载量统计共用，避免重复请求）
  let releaseSrc = '';        // Release 所属仓库（清单直连时可能不是本仓库）
  let statsKind = 'na';       // ok = 写 stats.json；na = 本来就没有；error = 瞬时失败（保留旧文件）
  let stats = null;

  if (downloadUrl) {
    // 清单直连：HEAD 取大小 + 侧车取哈希
    try {
      size = await headSize(downloadUrl);
    } catch {
      warnings.push(`${id}: HEAD ${downloadUrl} 失败`);
    }
    try {
      sha256 = await readSidecar(downloadUrl + '.sha256');
    } catch {
      warnings.push(`${id}: 缺 sha256 侧车 ${downloadUrl}.sha256`);
    }
    const parsed = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\//.exec(downloadUrl);
    if (parsed) {
      releaseSrc = `${parsed[1]}/${parsed[2]}`;
      try {
        releases = await withRetry(() => gh(`/repos/${releaseSrc}/releases?per_page=100`));
      } catch (e) {
        statsKind = 'error';
        warnings.push(`[stats] ${releaseSrc}: ${e.message}`);
      }
    } else {
      warnings.push(`[stats] ${id}: 下载源非 GitHub Release（${hostOf(downloadUrl)}），跳过下载量统计`);
    }
  } else {
    // 默认 GitHub Release：**一次**列表请求同时拿到最新资产与全部版本下载量
    try {
      releases = await withRetry(() => gh(`/repos/${owner}/${name}/releases?per_page=100`));
    } catch (e) {
      if (isDefinitive(e)) return skipResult(id, 'no-release', e.message);
      return transientResult(id, 'releases-fetch-failed', e.message);
    }
    releaseSrc = `${owner}/${name}`;
    // 与 /releases/latest 同义：最近一个非 draft、非 prerelease 的 Release
    const latest = (releases || []).find((r) => !r.draft && !r.prerelease);
    if (!latest) return skipResult(id, 'no-release', '无正式 Release（draft/prerelease 不算）');
    const asset = pickAsset(latest.assets || []);
    if (!asset) {
      warnings.push(`${id}: 最新 Release 无 .dspack/.tgz 资产（跳过）`);
      return skipResult(id, 'no-asset');
    }
    downloadUrl = asset.browser_download_url;
    size = asset.size || 0;
    updatedAt = latest.published_at || updatedAt;
    const sidecar = (latest.assets || []).find((a) => a.name === asset.name + '.sha256');
    // 优先用资产元数据里的 digest（零请求，且不会刷高作者的 .sha256 侧车下载计数）
    const digestHex = String(asset.digest || '').replace(/^sha256:/i, '').toLowerCase();
    if (/^[0-9a-f]{64}$/.test(digestHex)) {
      sha256 = digestHex;
    } else if (sidecar) {
      try {
        sha256 = await readSidecar(sidecar.browser_download_url);
      } catch (e) {
        warnings.push(`${id}: 读取 ${asset.name}.sha256 失败`);
      }
    } else {
      warnings.push(`${id}: Release 缺 ${asset.name}.sha256（置空）`);
    }
  }

  // 3) 下载量快照（复用上面的 Release 列表）
  if (releases) {
    stats = buildStats(releases, m, releaseSrc, warnings);
    statsKind = stats ? 'ok' : 'na';
  }

  const counts = countUnits(m, type);

  return okResult({
    id,
    owner,
    repo: name,
    rawManifest: rawManifest.trim() + '\n',
    rawReadme: rawReadme.trim(),
    stats,
    statsKind,
    entry: {
      manifestVersion,
      type,
      name: m.name || name,
      version: m.version || '',
      displayName: m.displayName,
      description: m.description,
      author: m.author,
      category: m.category || 'uncategorized',
      dshVersion: m.dshVersion,
      profileName: m.profileName,
      downloadUrl,
      sha256: sha256 || '',
      size: size || 0,
      updatedAt: String(updatedAt || '').slice(0, 10),
      id,
      owner,
      repo: name,
      ...counts,
    },
  });
}

// 有界并发（I/O 密集，包之间互不依赖）
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  };
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

function readPrevIndex() {
  try {
    const raw = fs.readFileSync(OUT, 'utf8');
    const j = JSON.parse(raw);
    const list = Array.isArray(j.modpacks) ? j.modpacks.filter((m) => m && typeof m.id === 'string') : [];
    return { count: list.length, list, byId: new Map(list.map((m) => [m.id, m])) };
  } catch {
    return { count: 0, list: [], byId: new Map() };
  }
}

function assertNoShrink(what, current, prev, hint) {
  if (process.env.ALLOW_SHRINK === '1') return;
  if (prev.count < 5) return;                       // 样本太小，阈值没有意义
  if (current >= prev.count * SHRINK_GUARD) return;
  console.error(
    `[collect] 熔断：${what} ${current} 个，低于上轮收录 ${prev.count} 个的 ${Math.round(SHRINK_GUARD * 100)}%。\n` +
    `          为避免误删，本轮不写入任何文件。${hint}\n` +
    `          确认是有意收缩（作者批量撤包）请设 ALLOW_SHRINK=1 重跑。`
  );
  process.exit(1);
}

async function main() {
  const warnings = [];
  const prev = readPrevIndex();

  const search = await withRetry(() => gh(`/search/repositories?q=topic:${TOPIC}&per_page=100&sort=updated`));
  const repos = (search.items || []).filter((r) => !r.archived);
  console.log(`[collect] topic:${TOPIC} 命中 ${repos.length} 个仓库（已排除 archived；上轮收录 ${prev.count} 个）`);

  // 熔断 1：搜索命中骤降（接口异常 / 结果被截断）→ 直接退出，别把市场清空
  assertNoShrink('topic 命中', repos.length, prev, '可能是搜索接口异常或结果被截断。');

  const results = await mapLimit(repos, CONCURRENCY, async (repo) => {
    try {
      return await collectRepo(repo, warnings);
    } catch (e) {
      const id = repo.full_name.replace('/', '.');
      warnings.push(`${repo.full_name}: ${e.message}`);
      return transientResult(id, 'unexpected', String(e && e.message).slice(0, 120));
    }
  });

  // 先算出最终集合（不落盘），再决定是否写入
  const aliveIds = new Set();
  const entries = [];
  const okPackages = [];
  const carried = [];
  const skipped = [];
  const failed = [];

  for (const r of results) {
    if (r.status === 'ok') {
      aliveIds.add(r.id);
      entries.push(r.entry);
      okPackages.push(r);
      continue;
    }
    // skip / transient：仓库仍在 topic 里 → 绝不删数据，沿用上一轮条目与 packs/ 文件
    const prevEntry = prev.byId.get(r.id);
    if (prevEntry) {
      aliveIds.add(r.id);
      entries.push(prevEntry);
      carried.push(`${r.id}（${r.status}:${r.reason}${r.detail ? ' · ' + String(r.detail).slice(0, 80) : ''}）`);
      continue;
    }
    if (r.status === 'skip') skipped.push(`${r.id}（${r.reason}）`);
    else failed.push(`${r.id}（${r.reason}${r.detail ? ' · ' + String(r.detail).slice(0, 80) : ''}）`);
  }

  // 熔断 2：最终收录数骤降
  assertNoShrink('最终收录', entries.length, prev, '多数包抓取失败时会走到这里。');

  // —— 落盘：packs/<id>/（manifest + README + stats），并清理已撤出 topic 的目录 ——
  fs.mkdirSync(PACKS_DIR, { recursive: true });
  for (const p of okPackages) {
    const dir = path.join(PACKS_DIR, p.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), p.rawManifest, 'utf8');
    if (p.rawReadme) fs.writeFileSync(path.join(dir, 'README.md'), p.rawReadme + '\n', 'utf8');
    else fs.rmSync(path.join(dir, 'README.md'), { force: true });
    if (p.statsKind === 'ok') {
      fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify(p.stats, null, 2) + '\n', 'utf8');
    } else if (p.statsKind === 'na') {
      fs.rmSync(path.join(dir, 'stats.json'), { force: true }); // 本来就不适用：清掉旧快照
    }
    // statsKind === 'error' → 保留上一轮 stats.json，不被失败覆盖
  }
  for (const d of fs.readdirSync(PACKS_DIR)) {
    if (d.startsWith('.') || !fs.statSync(path.join(PACKS_DIR, d)).isDirectory()) continue;
    if (!aliveIds.has(d)) {
      fs.rmSync(path.join(PACKS_DIR, d), { recursive: true, force: true });
      console.log(`[collect] 清理已撤出 topic 的目录 packs/${d}`);
    }
  }

  entries.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  // 条目没变就不重写索引：否则 generatedAt 每次都会变，CI 每轮都会产生一次空提交
  const unchanged = JSON.stringify(prev.list) === JSON.stringify(entries);
  if (unchanged) {
    console.log('[collect] 索引内容无变化，保留原有 index.json（不制造空提交）');
  } else {
    const index = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      modpacks: entries,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n', 'utf8');
    console.log(
      `[collect] 写出 ${entries.length} 个整合包（新采集 ${okPackages.length} · 沿用上轮 ${carried.length}）` +
      ` → index/index.json + index/packs/`
    );
  }

  if (carried.length) {
    console.warn(`[collect] 沿用上一轮快照 ${carried.length} 个（本轮未成功刷新）:\n  - ${carried.join('\n  - ')}`);
  }
  if (skipped.length) {
    console.log(`[collect] 跳过 ${skipped.length} 个（命中 topic 但不是整合包 / 无正式 Release）:\n  - ${skipped.join('\n  - ')}`);
  }
  if (failed.length) {
    console.warn(`[collect] 采集失败且无历史快照可沿用 ${failed.length} 个:\n  - ${failed.join('\n  - ')}`);
  }
  if (warnings.length) {
    console.warn(`[collect] ${warnings.length} 条警告:\n  - ${warnings.join('\n  - ')}`);
  }
}

main().catch((e) => {
  console.error('[collect] 致命错误:', e);
  process.exit(1);
});
