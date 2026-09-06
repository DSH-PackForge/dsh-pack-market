// 徽章生成器：读 index/plugins.json，为每个带 essential 标记的插件生成 SVG 徽章。
//
// 产出：
//   web/badges/plugins/<owner>-<repo>-zh.svg   —— 中文「整合包 · 必备」(+ 领域) + 勾
//   web/badges/plugins/<owner>-<repo>-en.svg   —— 英文「Essential for packs」(+ 领域) + 勾
//   web/plugins.json                            —— 插件清单副本（站点数据源）
//
// 两段式布局（自左向右）：
//   [ 整合包 · 必备 / Essential for packs ]（左色） [ 领域+勾 ]（右色）
//   勾用 <path> 画，不是文字字符。领域可省略（省略时右段只留勾）。
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
const C_LEFT = '#a12f22';      // 左段 —— 「整合包 · 必备 / Essential for packs」
const C_RIGHT = '#2b2620';     // 右段 —— 领域 + 勾
const FG = '#ffffff';          // 白字
const PAD_X = 10;              // 每段左右内边距
const PAD_SEG = 8;             // 领域与勾之间间隙
const HEIGHT = 20;             // 徽章高
const FONT = 11;               // 字号
const RADIUS = 4;              // 圆角

// 估算文本渲染宽度（px）：
//   CJK 全角按字号；空格/中点等窄字符按 ~0.32 字号；其余 ASCII 半角按 ~0.6 字号。
function textWidth(s) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.charCodeAt(0);
    if (c > 0x2e80) w += FONT;
    else if (c === 0x20 || c === 0xb7) w += FONT * 0.32; // 空格 / ·（中点）
    else w += FONT * 0.6;
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

// 画一个两段式徽章。
//   label = 左段文字（中文「整合包 · 必备」，英文「Essential for packs」）
//   cat   = 领域（可选，显示在勾前）
//   id    = 唯一 id 前缀（避免同一文档多枚 inline 时 clip id 冲突）
function badgeSvg(id, label, cat) {
  const leftW = PAD_X + textWidth(label) + PAD_X;
  const catW = cat ? textWidth(cat) : 0;
  const rightW = PAD_X + (cat ? catW + PAD_SEG : 0) + 12 + PAD_X; // 领域 + 勾
  const totalW = leftW + rightW;

  const labelX = (leftW - textWidth(label)) / 2;
  const catX = leftW + PAD_X;
  const checkX = totalW - PAD_X - 10; // 勾锚点（靠右）

  const catSeg = cat
    ? `<text x="${catX.toFixed(1)}" y="14.5" font-size="${FONT}" font-weight="500" fill="${FG}" font-family="Segoe UI, Arial, sans-serif">${escXml(cat)}</text>`
    : '';

  const checkPath = `<path d="M ${(checkX - 4).toFixed(1)} 10 l 3 3 l 6 -7" fill="none" stroke="${FG}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

  const clipId = `c-${id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(1)}" height="${HEIGHT}" role="img">
  <defs><clipPath id="${clipId}"><rect width="${totalW.toFixed(1)}" height="${HEIGHT}" rx="${RADIUS}"/></clipPath></defs>
  <g clip-path="url(#${clipId})">
    <rect x="0" y="0" width="${leftW.toFixed(1)}" height="${HEIGHT}" fill="${C_LEFT}"/>
    <rect x="${leftW.toFixed(1)}" y="0" width="${rightW.toFixed(1)}" height="${HEIGHT}" fill="${C_RIGHT}"/>
  </g>
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

    const catZh = pickCategory(p.category, 'zh');
    const catEn = pickCategory(p.category, 'en');
    fs.writeFileSync(path.join(OUT_DIR, `${ownerRepo}-zh.svg`), badgeSvg(`${ownerRepo}-zh`, '整合包 · 必备', catZh), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, `${ownerRepo}-en.svg`), badgeSvg(`${ownerRepo}-en`, 'Essential for packs', catEn), 'utf8');
    badgeCount++;
  }

  // 复制清单到 web/plugins.json（站点数据源）
  fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`[badge] 生成 ${badgeCount} 个插件的徽章 → web/badges/plugins/`);
  console.log(`[badge] 复制插件清单 → web/plugins.json`);
}

main();
