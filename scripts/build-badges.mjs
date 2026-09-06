// 徽章生成器：读 index/plugins.json，为每个带 essential 标记的插件生成 SVG 徽章。
//
// 产出：
//   web/badges/plugins/<owner>-<repo>-zh.svg   —— 中文「整合包 | 必备」(+ 领域) + 勾
//   web/badges/plugins/<owner>-<repo>-en.svg   —— 英文「Packs | Essential」(+ 领域) + 勾
//   web/plugins.json                            —— 插件清单副本（站点数据源）
//
// 三段式布局（自左向右）：
//   [ 整合包/Packs ]（深红） [ 必备/Essential ]（橙红） [ 领域+勾 ]（墨色）
//   勾用 <path> 画，不是文字字符。领域可省略（省略时第三段只留勾）。
// 用法：node scripts/build-badges.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index', 'plugins.json');
const OUT_DIR = path.join(ROOT, 'web', 'badges', 'plugins');
const OUT_JSON = path.join(ROOT, 'web', 'plugins.json');

// 配色（纸墨朱砂体系）
const C1 = '#a12f22';          // 深红 —— 「整合包 / Packs」
const C2 = '#d35400';          // 橙红 —— 「必备 / Essential」
const C3 = '#2b2620';          // 墨色 —— 领域 + 勾
const FG = '#ffffff';          // 白字
const PAD_X = 10;              // 每段左右内边距
const PAD_SEG = 8;             // 领域与勾之间间隙
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

// category 为 string 或 {zh,en} map；按语言取，回退到字符串或空。
function pickCategory(cat, locale) {
  if (cat == null) return '';
  if (typeof cat === 'string') return cat;
  if (typeof cat === 'object') {
    if (typeof cat[locale] === 'string') return cat[locale];
    const first = Object.values(cat).find((v) => typeof v === 'string');
    if (first) return first;
  }
  return '';
}

// 画一个三段式徽章。
//   labels = [段1文字, 段2文字]（中文 ['整合包','必备']，英文 ['Packs','Essential']）
//   cat    = 领域（可选，显示在勾前）
//   id     = 唯一 id 前缀（避免同一文档多枚 inline 时 clip id 冲突）
function badgeSvg(id, labels, cat) {
  const [l1, l2] = labels;
  const w1 = PAD_X + textWidth(l1) + PAD_X;
  const w2 = PAD_X + textWidth(l2) + PAD_X;
  const catW = cat ? textWidth(cat) : 0;
  const w3 = PAD_X + (cat ? catW + PAD_SEG : 0) + 12 + PAD_X; // 领域 + 勾
  const totalW = w1 + w2 + w3;

  // 各段文字起始 x（居中于本段）
  const x1 = (w1 - textWidth(l1)) / 2;
  const x2 = w1 + (w2 - textWidth(l2)) / 2;
  const catX = w1 + w2 + PAD_X;
  const checkX = totalW - PAD_X - 10; // 勾锚点（靠右）

  const catSeg = cat
    ? `<text x="${catX.toFixed(1)}" y="14.5" font-size="${FONT}" font-weight="500" fill="${FG}" font-family="Segoe UI, Arial, sans-serif">${escXml(cat)}</text>`
    : '';

  const checkPath = `<path d="M ${(checkX - 4).toFixed(1)} 10 l 3 3 l 6 -7" fill="none" stroke="${FG}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

  const clipId = `c-${id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(1)}" height="${HEIGHT}" role="img">
  <defs><clipPath id="${clipId}"><rect width="${totalW.toFixed(1)}" height="${HEIGHT}" rx="${RADIUS}"/></clipPath></defs>
  <g clip-path="url(#${clipId})">
    <rect x="0" y="0" width="${w1.toFixed(1)}" height="${HEIGHT}" fill="${C1}"/>
    <rect x="${w1.toFixed(1)}" y="0" width="${w2.toFixed(1)}" height="${HEIGHT}" fill="${C2}"/>
    <rect x="${(w1 + w2).toFixed(1)}" y="0" width="${w3.toFixed(1)}" height="${HEIGHT}" fill="${C3}"/>
  </g>
  <text x="${x1.toFixed(1)}" y="14.5" font-size="${FONT}" font-weight="600" fill="${FG}" font-family="Segoe UI, Arial, sans-serif">${escXml(l1)}</text>
  <text x="${x2.toFixed(1)}" y="14.5" font-size="${FONT}" font-weight="600" fill="${FG}" font-family="Segoe UI, Arial, sans-serif">${escXml(l2)}</text>${catSeg}
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

    const catZh = pickCategory(p.category, 'zh');
    const catEn = pickCategory(p.category, 'en');
    fs.writeFileSync(path.join(OUT_DIR, `${ownerRepo}-zh.svg`), badgeSvg(`${ownerRepo}-zh`, ['整合包', '必备'], catZh), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, `${ownerRepo}-en.svg`), badgeSvg(`${ownerRepo}-en`, ['Packs', 'Essential'], catEn), 'utf8');
    badgeCount++;
  }

  // 复制清单到 web/plugins.json（站点数据源）
  fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`[badge] 生成 ${badgeCount} 个插件的徽章 → web/badges/plugins/`);
  console.log(`[badge] 复制插件清单 → web/plugins.json`);
}

main();
