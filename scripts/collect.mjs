// dsh-pack-market 采集器：扫描 GitHub 上打了 topic `dsh-pack` 的仓库，
// 读取各仓库根 manifest.json（manifest v3/v4/v5 兼容）+ README.md（若有），
// 汇总产出两份数据：
//   1) index/packs/<owner>.<repo>/   —— 完整 manifest.json + README.md（懒加载源，原始文本）
//   2) index/index.json              —— 精简索引（schemaVersion 2，仅列表/搜索/安装必需字段）
//
// 约定：
//   - 仓库 About 打 topic `dsh-pack`；
//   - 根放 `manifest.json`（manifest v3/v4/v5 契约），推荐再放 README.md；
//   - 清单可选 `downloadUrl`：有则直连 + `<url>.sha256` 侧车；无则默认最新 GitHub Release 资产 + 同名 `.sha256` 侧车。
//
// 用法：node scripts/collect.mjs   （可选环境变量 GH_TOKEN 提升 API 限额）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'index', 'index.json');
const PACKS_DIR = path.join(ROOT, 'index', 'packs');
const TOPIC = 'dsh-pack';
const UA = { 'user-agent': 'dsh-pack-market-collector' };

async function gh(apiPath) {
  const headers = { accept: 'application/vnd.github+json', ...UA };
  if (process.env.GH_TOKEN) headers.authorization = `Bearer ${process.env.GH_TOKEN}`;
  const res = await fetch('https://api.github.com' + apiPath, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub ${res.status} ${apiPath} :: ${body.slice(0, 160)}`);
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { ...UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
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

async function collectRepo(repo, warnings) {
  const [owner, name] = repo.full_name.split('/');
  const branch = repo.default_branch || 'main';
  const rawBase = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/`;

  let rawManifest;
  try {
    rawManifest = await fetchText(rawBase + 'manifest.json');
  } catch (e) {
    warnings.push(`${repo.full_name}: 根无 manifest.json（${e && e.message ? e.message.slice(0, 120) : e}）`);
    return null;
  }

  let m;
  try {
    m = JSON.parse(rawManifest);
  } catch (e) {
    warnings.push(`${repo.full_name}: manifest.json 不是有效 JSON（跳过）`);
    return null;
  }
  if (!m || typeof m !== 'object') {
    warnings.push(`${repo.full_name}: manifest.json 不是对象（跳过）`);
    return null;
  }

  // README：可选，缺了就跳过（不告警）。
  let rawReadme = '';
  for (const f of ['README.md', 'readme.md', 'README.MD', 'Readme.md']) {
    try {
      rawReadme = await fetchText(rawBase + f);
      break;
    } catch {
      /* try next case */
    }
  }

  const manifestVersion = m.manifestVersion ?? 4;
  const type = inferType(m, manifestVersion);

  let downloadUrl = typeof m.downloadUrl === 'string' ? m.downloadUrl : '';
  let size = 0;
  let sha256 = '';
  let updatedAt = m.updatedAt || repo.pushed_at || '';

  if (downloadUrl) {
    try {
      size = await headSize(downloadUrl);
    } catch (e) {
      warnings.push(`${owner}/${name}: HEAD ${downloadUrl} 失败`);
    }
    try {
      sha256 = await readSidecar(downloadUrl + '.sha256');
    } catch (e) {
      warnings.push(`${owner}/${name}: 缺 sha256 侧车 ${downloadUrl}.sha256`);
    }
  } else {
    let rel;
    try {
      rel = await gh(`/repos/${owner}/${name}/releases/latest`);
    } catch (e) {
      warnings.push(`${owner}/${name}: ${e.message}`);
      return null;
    }
    const asset = pickAsset(rel.assets || []);
    if (!asset) {
      warnings.push(`${owner}/${name}: 最新 Release 无 .tgz/.dspack 资产（跳过）`);
      return null;
    }
    downloadUrl = asset.browser_download_url;
    size = asset.size || 0;
    updatedAt = rel.published_at || updatedAt;
    const sidecar = (rel.assets || []).find((a) => a.name === asset.name + '.sha256');
    if (sidecar) {
      try {
        sha256 = await readSidecar(sidecar.browser_download_url);
      } catch (e) {
        warnings.push(`${owner}/${name}: 读取 ${asset.name}.sha256 失败`);
      }
    } else {
      warnings.push(`${owner}/${name}: Release 缺 ${asset.name}.sha256（置空）`);
    }
  }

  const id = `${owner}.${name}`;
  const counts = countUnits(m, type);

  return {
    id,
    owner,
    repo: name,
    rawManifest: rawManifest.trim() + '\n',
    rawReadme: rawReadme.trim(),
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
  };
}

async function main() {
  const warnings = [];
  const search = await gh(`/search/repositories?q=topic:${TOPIC}&per_page=100&sort=updated`);
  const repos = (search.items || []).filter((r) => !r.archived);
  console.log(`[collect] topic:${TOPIC} 命中 ${repos.length} 个仓库（已排除 archived）`);

  const packs = [];
  for (const repo of repos) {
    try {
      const entry = await collectRepo(repo, warnings);
      if (entry) packs.push(entry);
    } catch (e) {
      warnings.push(`${repo.full_name}: ${e.message}`);
    }
  }

  // 写懒加载目录 index/packs/<owner>.<repo>/（manifest.json + README.md）
  const aliveIds = new Set();
  fs.mkdirSync(PACKS_DIR, { recursive: true });
  for (const p of packs) {
    aliveIds.add(p.id);
    const dir = path.join(PACKS_DIR, p.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), p.rawManifest, 'utf8');
    if (p.rawReadme) fs.writeFileSync(path.join(dir, 'README.md'), p.rawReadme + '\n', 'utf8');
    else fs.rmSync(path.join(dir, 'README.md'), { force: true });
  }
  // 清理已不在扫描结果里的过期目录
  for (const d of fs.readdirSync(PACKS_DIR)) {
    if (d.startsWith('.') || !fs.statSync(path.join(PACKS_DIR, d)).isDirectory()) continue;
    if (!aliveIds.has(d)) {
      fs.rmSync(path.join(PACKS_DIR, d), { recursive: true, force: true });
      console.log(`[collect] 清理过期目录 packs/${d}`);
    }
  }

  packs.sort((a, b) => String(b.entry.updatedAt).localeCompare(String(a.entry.updatedAt)));

  const index = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    modpacks: packs.map((p) => p.entry),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`[collect] 写出 ${packs.length} 个整合包 → index/index.json + index/packs/`);

  if (warnings.length) {
    console.warn(`[collect] ${warnings.length} 条警告:\n  - ${warnings.join('\n  - ')}`);
  }
}

main().catch((e) => {
  console.error('[collect] 致命错误:', e);
  process.exit(1);
});
