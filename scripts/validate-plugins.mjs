// 插件清单校验器：CI 在 PR 时运行，确保 index/plugins.json 结构合法。
// 用法：node scripts/validate-plugins.mjs
// 校验项：
//   - JSON 可解析，顶层 plugins 是数组，schemaVersion 存在
//   - 每个条目 id 必填、唯一、格式 owner/repo
//   - url / name 必填；description 为 string 或 {zh,en} map；install 可选
//   - badges 为字符串数组，取值在允许集合内（当前仅 essential）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index', 'plugins.json');

const ALLOWED_BADGES = new Set(['essential']);

const errors = [];

function fail(msg) {
  errors.push(msg);
}

function main() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  } catch (e) {
    console.error(`✗ 插件清单不是有效 JSON：${e.message}`);
    process.exit(1);
  }

  if (!data || typeof data !== 'object') fail('顶层必须是对象');
  if (typeof data.schemaVersion !== 'number') fail('缺少 schemaVersion（number）');
  if (!Array.isArray(data.plugins)) fail('缺少 plugins 数组');

  const ids = new Set();
  for (const [i, p] of (data.plugins || []).entries()) {
    const at = `plugins[${i}]`;
    if (!p || typeof p !== 'object') { fail(`${at} 必须是对象`); continue; }

    if (typeof p.id !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.id)) {
      fail(`${at}.id 必填且格式为 owner/repo（got: ${JSON.stringify(p.id)}）`);
    } else if (ids.has(p.id)) {
      fail(`${at}.id 重复：${p.id}`);
    } else {
      ids.add(p.id);
    }

    if (typeof p.name !== 'string' || !p.name) fail(`${at}.name 必填`);
    if (typeof p.url !== 'string' || !/^https?:\/\//.test(p.url)) fail(`${at}.url 必填且为 http(s)`);

    if (p.description != null && typeof p.description !== 'string' && typeof p.description !== 'object') {
      fail(`${at}.description 必须是 string 或 {zh,en} map`);
    }
    if (p.category != null && typeof p.category !== 'string' && typeof p.category !== 'object') {
      fail(`${at}.category 必须是 string 或 {zh,en} map`);
    }

    if (p.badges != null) {
      if (!Array.isArray(p.badges)) fail(`${at}.badges 必须是字符串数组`);
      else for (const b of p.badges) if (!ALLOWED_BADGES.has(b)) fail(`${at}.badges 含非法值：${JSON.stringify(b)}（允许：${[...ALLOWED_BADGES].join(', ')}）`);
    }
  }

  if (errors.length) {
    console.error(`✗ 插件清单校验失败（${errors.length} 处）：`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ 插件清单校验通过（${data.plugins.length} 个插件）`);
}

main();
