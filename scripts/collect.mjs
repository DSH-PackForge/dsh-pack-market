// dsh-pack-market 采集器：扫描 GitHub 上打了 topic `dsh-pack` 的仓库，
// 读取各仓库根 manifest.json + 最新 Release（或清单里的 downloadUrl），
// 汇总生成 index/index.json（schemaVersion 1）。
//
// 约定：
//   - 仓库 About 打 topic `dsh-pack`；
//   - 根放 `manifest.json`（manifest v4 契约），推荐再放 README.md；
//   - 清单可选 `downloadUrl`：有则直连 + `<url>.sha256` 侧车；无则默认最新 GitHub Release 资产 + 同名 `.sha256` 侧车。
//
// 用法：node scripts/collect.mjs   （可选环境变量 GH_TOKEN 提升 API 限额）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'index', 'index.json');
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

async function collectRepo(repo, warnings) {
  const [owner, name] = repo.full_name.split('/');
  const branch = repo.default_branch || 'main';
  const raw = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/manifest.json`;

  let m;
  try {
    m = JSON.parse(await fetchText(raw));
  } catch (e) {
    warnings.push(`${repo.full_name}: 根无 manifest.json（${e && e.message ? e.message.slice(0, 120) : e}）`);
    return null;
  }
  if (!m || typeof m !== 'object') {
    warnings.push(`${repo.full_name}: manifest.json 不是对象（跳过）`);
    return null;
  }

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

  return {
    manifestVersion: m.manifestVersion ?? 4,
    name: m.name || name,
    version: m.version || '',
    displayName: m.displayName,
    description: m.description,
    author: m.author,
    icon: m.icon,
    dshVersion: m.dshVersion,
    profileName: m.profileName,
    bundles: Array.isArray(m.bundles) ? m.bundles : [],
    dependencies: m.dependencies && typeof m.dependencies === 'object' ? m.dependencies : {},
    category: m.category || 'uncategorized',
    downloadUrl,
    sha256: sha256 || '',
    size: size || 0,
    updatedAt: String(updatedAt || '').slice(0, 10),
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

  packs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  const index = { schemaVersion: 1, generatedAt: new Date().toISOString(), modpacks: packs };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`[collect] 写出 ${packs.length} 个整合包 → index/index.json`);

  if (warnings.length) {
    console.warn(`[collect] ${warnings.length} 条警告:\n  - ${warnings.join('\n  - ')}`);
  }
}

main().catch((e) => {
  console.error('[collect] 致命错误:', e);
  process.exit(1);
});