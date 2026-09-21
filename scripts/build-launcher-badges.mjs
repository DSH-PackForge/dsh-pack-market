// 启动器徽章生成器：产出「支持 DSH-PackForge 整合包」徽章 + 各版本徽章（纯静态，无数据源）。
//
// 产出：
//   web/badges/launchers/dsh-packforge-support-{zh,en}.svg   —— 支持徽章（挂启动器 README）
//   web/badges/versions/manifest-v{1..5}-{zh,en}.svg          —— 清单（manifest）版本徽章
//   web/badges/versions/pack-v{1..3}-{zh,en}.svg              —— 结构（pack）版本徽章
//
// 两段式布局（自左向右，与插件徽章同款）：
//   [ 支持 DSH-PackForge 整合包 / Supports DSH-PackForge packs ]（左色） [ 启动器/launcher + 勾 ]（右色）
//   [ 清单 / manifest ]（左色） [ v5 ]（右色）
//
// 用法：node scripts/build-launcher-badges.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SUPPORT_DIR = path.join(ROOT, 'web', 'badges', 'launchers');
const VERSION_DIR = path.join(ROOT, 'web', 'badges', 'versions');

// 配色（纸墨朱砂体系，与插件徽章一致）
const C_LEFT = '#c0392b';      // 左段 —— 品牌朱砂红
const C_RIGHT = '#2b2620';     // 右段 —— 墨色
const FG = '#ffffff';          // 白字
const PAD_X = 10;              // 每段左右内边距
const PAD_SEG = 8;             // 右段文字与勾之间间隙
const HEIGHT = 20;             // 徽章高
const FONT = 11;               // 字号
const RADIUS = 4;              // 圆角

// 估算文本渲染宽度（px），按字符宽度逐字估算（与 build-badges.mjs 同款）。
const CHAR_W = {
  i: 0.28, l: 0.28, I: 0.30, j: 0.30, t: 0.40, f: 0.38, r: 0.42,
  ' ': 0.28, '.': 0.28, ',': 0.28, ':': 0.28, ';': 0.28, "'": 0.25, '|': 0.30, '!': 0.30, '·': 0.32,
  w: 0.82, m: 0.82, W: 0.85, M: 0.85, '@': 0.90, '%': 0.85,
};
function textWidth(s) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c > 0x2e80) { w += FONT; continue; }            // CJK 全角
    if (Object.hasOwn(CHAR_W, ch)) { w += FONT * CHAR_W[ch]; continue; }
    if (ch >= 'A' && ch <= 'Z') w += FONT * 0.62;
    else if (ch >= 'a' && ch <= 'z') w += FONT * 0.52;
    else if (ch >= '0' && ch <= '9') w += FONT * 0.55;
    else w += FONT * 0.5;
  }
  return w;
}

function escXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

// 画一个两段式徽章。
//   leftText  = 左段文字（支持徽章：中文/英文标题；版本徽章：清单/结构）
//   rightText = 右段文字（支持徽章：启动器/launcher；版本徽章：v1..v5 / v1..v3）
//   check     = 是否在右段文字后画勾（支持徽章画，版本徽章不画）
function badgeSvg(id, leftText, rightText, { check = true } = {}) {
  const leftW = PAD_X + textWidth(leftText) + PAD_X;
  const rightTextW = textWidth(rightText);
  const rightW = PAD_X + rightTextW + (check ? PAD_SEG + 12 : 0) + PAD_X;
  const totalW = leftW + rightW;

  const labelX = (leftW - textWidth(leftText)) / 2;
  const rightX = leftW + PAD_X;         // 右段文字锚点（无勾时即居中）
  const checkX = totalW - PAD_X - 10;    // 勾锚点（靠右）

  const checkPath = check
    ? `<path d="M ${(checkX - 4).toFixed(1)} 10 l 3 3 l 6 -7" fill="none" stroke="${FG}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';

  const clipId = `c-${id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(1)}" height="${HEIGHT}" role="img">
  <defs><clipPath id="${clipId}"><rect width="${totalW.toFixed(1)}" height="${HEIGHT}" rx="${RADIUS}"/></clipPath></defs>
  <g clip-path="url(#${clipId})">
    <rect x="0" y="0" width="${leftW.toFixed(1)}" height="${HEIGHT}" fill="${C_LEFT}"/>
    <rect x="${leftW.toFixed(1)}" y="0" width="${rightW.toFixed(1)}" height="${HEIGHT}" fill="${C_RIGHT}"/>
  </g>
  <text x="${labelX.toFixed(1)}" y="14.5" font-size="${FONT}" font-weight="600" fill="${FG}" font-family="Segoe UI, Arial, sans-serif">${escXml(leftText)}</text>
  <text x="${rightX.toFixed(1)}" y="14.5" font-size="${FONT}" font-weight="500" fill="${FG}" font-family="Segoe UI, Arial, sans-serif">${escXml(rightText)}</text>${check ? '\n  ' + checkPath : ''}
</svg>`;
}

function writeBadge(file, svg) {
  fs.writeFileSync(file, svg + '\n', 'utf8');
  console.log(`  ${path.relative(ROOT, file)}`);
}

function main() {
  fs.mkdirSync(SUPPORT_DIR, { recursive: true });
  fs.mkdirSync(VERSION_DIR, { recursive: true });

  // 清理旧徽章（避免版本下架后残留）
  for (const dir of [SUPPORT_DIR, VERSION_DIR]) {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.svg')) fs.rmSync(path.join(dir, f), { force: true });
    }
  }

  console.log('[badge] 支持徽章 → web/badges/launchers/');
  writeBadge(path.join(SUPPORT_DIR, 'dsh-packforge-support-zh.svg'),
    badgeSvg('dsh-packforge-support-zh', '支持 DSH-PackForge 整合包', '启动器', { check: true }));
  writeBadge(path.join(SUPPORT_DIR, 'dsh-packforge-support-en.svg'),
    badgeSvg('dsh-packforge-support-en', 'Supports DSH-PackForge packs', 'launcher', { check: true }));

  console.log('[badge] 版本徽章 → web/badges/versions/');
  const versions = [
    { kind: 'manifest', zh: '清单', en: 'manifest', list: [1, 2, 3, 4, 5] },
    { kind: 'pack', zh: '结构', en: 'pack', list: [1, 2, 3] },
  ];
  for (const v of versions) {
    for (const n of v.list) {
      writeBadge(path.join(VERSION_DIR, `${v.kind}-v${n}-zh.svg`),
        badgeSvg(`${v.kind}-v${n}-zh`, v.zh, `v${n}`, { check: false }));
      writeBadge(path.join(VERSION_DIR, `${v.kind}-v${n}-en.svg`),
        badgeSvg(`${v.kind}-v${n}-en`, v.en, `v${n}`, { check: false }));
    }
  }
}

main();
