// 徽章生成器：读 index/plugins.json，为每个带 essential 标记的插件生成 SVG 徽章。
//
// 产出：
//   web/badges/plugins/<owner>-<repo>-zh.svg   —— 中文「整合包 · 必备」(+ 领域) + 勾
//   web/badges/plugins/<owner>-<repo>-en.svg   —— 英文「Essential for packs」(+ 领域) + 勾
//   web/plugins.json                            —— 插件清单副本（站点数据源）
//
// 布局（自左向右）：[ 文字 ] [ 领域(可选) ] [ 勾 ]。勾用 <path> 画，不是文字字符。
// 用法：node scripts/build-badges.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index', 'plugins.json');
const OUT_DIR = path.join(ROOT, 'web', 'badges', 'plugins');
const OUT_JSON = path.join(ROOT, 'web', 'plugins.json');

// 徽章配色与常量
const BG = '#c0392b';          // 朱砂红
const FG = '#ffffff';          // 白字
const PAD_X = 10;              // 左右内边距
const PAD_SEG = 8;             // 文字与领域/勾之间的间隙
const HEIGHT = 20;             // 徽章高
const FONT = 11;               // 字号
const RADIUS = 4;              // 圆角

// 估算文本渲染宽度（px）：CJK 全角按字号、ASCII 半角按 ~0.6 字号。
function textWidth(s) {
  let w = 0;
  for (const ch of String(s)) {
    w += ch.charCodeAt(0) > 0x2e80 ? FONT : FONT * 0.6;
  }
  return w;
}

function escXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

// 画一个徽章：label 为主文字，cat 为可选领域，check 是否带勾。
function badgeSvg(label, cat, check = true) {
  const segW = cat ? PAD_SEG + textWidth(cat) + PAD_SEG : 0;
  const checkW = check ? PAD_SEG + 12 + PAD_X : PAD_X;
  const totalW = PAD_X + textWidth(label) + segW + checkW;

  const labelX = PAD_X;
  const catX = PAD_X + textWidth(label) + PAD_SEG;
  const checkX = totalW - PAD_X - 10; // 勾的锚点

  let catSeg = '';
  if (cat) {
    const catW = textWidth(cat);
    catSeg = `
    <rect x="${(catX - 4).toFixed(1)}" y="${(HEIGHT - 14) / 2}" width="${(catW + 8).toFixed(1)}" height="14" rx="7" fill="rgba(255,255,255,.18)"/>
    <text x="${catX.toFixed(1)}" y="14.5" font-size="${FONT}" fill="${FG}" font-family="Segoe UI, Arial, sans-serif">${escXml(cat)}</text>`;
  }

  const checkPath = check
    ? `<path d="M ${(checkX - 4).toFixed(1)} 10 l 3 3 l 6 -7" fill="none" stroke="${FG}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(1)}" height="${HEIGHT}" role="img">
  <rect width="100%" height="100%" rx="${RADIUS}" fill="${BG}"/>
  <text x="${labelX.toFixed(1)}" y="14.5" font-size="${FONT}" font-weight="600" fill="${FG}" font-family="Segoe UI, Arial, sans-serif">${escXml(label)}</text>${catSeg}
  ${checkPath}
</svg>`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const plugins = Array.isArray(data.plugins) ? data.plugins : [];
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let badgeCount = 0;
  const seen = new Set();

  // 清理旧徽章（避免改名/下架后残留）
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.svg')) fs.rmSync(path.join(OUT_DIR, f), { force: true });
  }

  for (const p of plugins) {
    if (!p || typeof p.id !== 'string') continue;
    const ownerRepo = p.id.replace(/\//g, '-');
    const hasEssential = Array.isArray(p.badges) && p.badges.includes('essential');
    if (!hasEssential) continue;
    if (seen.has(p.id)) { console.warn(`[badge] 重复 id 跳过：${p.id}`); continue; }
    seen.add(p.id);

    const cat = typeof p.category === 'string' && p.category ? p.category : '';
    fs.writeFileSync(path.join(OUT_DIR, `${ownerRepo}-zh.svg`), badgeSvg('整合包 · 必备', cat), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, `${ownerRepo}-en.svg`), badgeSvg('Essential for packs', cat), 'utf8');
    badgeCount++;
  }

  // 复制清单到 web/plugins.json（站点数据源）
  fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`[badge] 生成 ${badgeCount} 个插件的徽章 → web/badges/plugins/`);
  console.log(`[badge] 复制插件清单 → web/plugins.json`);
}

main();
