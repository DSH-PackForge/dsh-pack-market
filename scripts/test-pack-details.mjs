import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../web/market.js', import.meta.url), 'utf8');
const idle = { addEventListener() {} };
const listeners = {};
const browser = vm.createContext({
  URL, URLSearchParams, location: {search:''}, navigator:{language:'zh-CN'},
  window:idle, document:{addEventListener:(event,listener)=>{listeners[event]=listener;}, querySelector:()=>idle}, fetch:()=>new Promise(()=>{}),
});
vm.runInContext(source,browser);

test('图标缓存接受大小写混合的 SHA-256，拒绝不匹配和缺失的摘要', () => {
  const digest = 'aBcD'.repeat(16);
  const cache = {sha256:digest.toLowerCase(),icons:{}};
  assert.equal(browser.matchingIconCache(digest,cache),cache);
  assert.equal(browser.matchingIconCache('0'.repeat(64),cache),null);
  assert.equal(browser.matchingIconCache(undefined,{}),null);
  assert.equal(browser.matchingIconCache('',{sha256:''}),null);
});

test('多配置档插件按浏览器语言显示，图片只来自安全的 HTTPS 或已验证图标缓存', () => {
  const icon = 'assets/plugins/example.png';
  const manifest = {type:'dshhome', profiles:{
    work:{plugins:{foo:{name:{en:'English',zh:'中文'},desc:'<example>',icon}},dependencies:{foo:'1.0.0'}},
    other:{plugins:{bar:{name:'Bar',icon:'javascript:example'}}},
  }};
  const html=browser.packageDetails(manifest,{icons:{[icon]:'data:image/png;base64,AA=='}});
  for (const text of ['work','other','中文','&lt;example&gt;','foo@1.0.0','data:image/png;base64,AA==']) {
    assert.ok(html.includes(text));
  }
  assert.doesNotMatch(html,/javascript:|<example>|English/);
  assert.equal(browser.pluginIcon('https://user:password@example.org/icon.png',null),'');
  assert.equal(browser.pluginIcon('https://example.org/icon.png',null),'https://example.org/icon.png');
  assert.equal(browser.packageDetails({bundles:['legacy']},null),'');
  const image={src:'https://cdn.jsdelivr.com/npm/example@1.0.0/icon.svg',classList:{contains:()=>true}};
  listeners.error({target:image});
  assert.equal(image.src,'https://cdn.jsdelivr.net/npm/example@1.0.0/icon.svg');
  listeners.error({target:image});
  assert.equal(image.hidden,true);
});

test('仅展示资源摘要中可公开的标识、说明、插件、作用域与 Git 引用', () => {
  const html=browser.resourceDetails({'path.json':[{id:'0',plugin:'foo',name:'配置',scope:'profile:work'}],
    'skill.json':[{id:'example',desc:{zh:'本地说明'},ref:'main',commit:'abc',secret:'should stay hidden'}]});
  for (const text of ['配置','foo','profile:work','本地说明','main','abc']) {
    assert.ok(html.includes(text));
  }
  assert.doesNotMatch(html,/should stay hidden/);
  assert.equal(browser.resourceDetails(undefined),'');
});
