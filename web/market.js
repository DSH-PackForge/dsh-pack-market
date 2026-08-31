// ModPack 市场页：读取 index.json → 渲染整合包卡片（搜索 / 分类 / 安装复制）
// 数据源：默认 ./index.json（由 CI 从 ../index/index.json 同步的部署副本）；可用 ?index=<url> 指向远端索引

const DEFAULT_SOURCE = './index.json';

/** 内置演示数据（fetch 失败时兜底展示） */
const FALLBACK = {
  schemaVersion: 1,
  modpacks: [
    {
      name: 'web',
      displayName: '网页开发助手',
      version: '1.0.0',
      description: 'DSH 官方 web 预设整合包，含 dshmarket 与 dsh-tui。安装后 dsh --profile web 启动 Web 界面。',
      author: 'hxh230802',
      dshVersion: '>=0.1.0',
      bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dshmarket', '@deepseek-harness-tui/dsh-tui'],
      dependencies: { '@deepseek-harness-tui/dsh-tui': '^0.6.1', dshmarket: '^1.3.0' },
      category: 'coding',
      downloadUrl: 'https://github.com/your-org/modpack-index/releases/download/web-1.0.0/web-1.0.0.tgz',
      sha256: 'c53f18814e8912dc045e9da61ccef0afa92d54f57df9d2ddf08db19476e9b2c2',
      size: 10916,
      updatedAt: '2026-08-15',
    },
  ],
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 多语言字段取值：字符串原样返回；对象按 当前语言 → 语言基座 → en-US → zh-CN → 首个值 兜底（v3 起 displayName/description 可为 map）
function pickLang(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  const lang = (navigator.language || 'zh-CN').toLowerCase();
  if (v[lang]) return v[lang];
  const base = lang.split('-')[0];
  const baseHit = Object.keys(v).find((k) => k.toLowerCase().startsWith(base));
  if (baseHit) return v[baseHit];
  return v['en-US'] || v['zh-CN'] || Object.values(v)[0] || '';
}

let index = null;
let activeCat = 'all';
let query = '';

async function load() {
  const url = new URLSearchParams(location.search).get('index') || DEFAULT_SOURCE;
  $('#data-src').textContent = url;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    index = await res.json();
  } catch {
    console.warn(`加载 ${url} 失败，使用内置演示数据`);
    index = FALLBACK;
  }
  render();
}

function distinctCategories() {
  const set = new Set(index.modpacks.map((m) => m.category).filter(Boolean));
  return [...set].sort();
}

function renderCats() {
  const cats = distinctCategories();
  const wrap = $('#cats');
  wrap.innerHTML = '';
  const mk = (label, key) => {
    const b = document.createElement('button');
    b.className = 'cat' + (key === activeCat ? ' active' : '');
    b.textContent = label;
    b.onclick = () => { activeCat = key; renderCats(); renderCards(); };
    wrap.appendChild(b);
  };
  mk(`全部 ${index.modpacks.length}`, 'all');
  cats.forEach((c) => mk(c, c));
}

function renderStats() {
  $('#stat-count').textContent = index.modpacks.length;
  $('#stat-cats').textContent = distinctCategories().length || 0;
  $('#stat-authors').textContent = new Set(index.modpacks.map((m) => m.author).filter(Boolean)).size;
}

function matches(m) {
  if (activeCat !== 'all' && m.category !== activeCat) return false;
  if (!query) return true;
  const hay = [m.name, pickLang(m.displayName), pickLang(m.description), m.author, m.category, ...(m.bundles || [])]
    .join(' ').toLowerCase();
  return hay.includes(query);
}

function cardHTML(m) {
  const size = m.size ? `${(m.size / 1024).toFixed(1)} KB` : '';
  const cmd = `modpack install ${m.downloadUrl}`;
  return `
    <li class="card">
      <div class="top">
        <a class="title" href="#/pack/${encodeURIComponent(m.name)}">${esc(pickLang(m.displayName) || m.name)}</a>
        <span class="ver">${esc(m.version)}</span>
      </div>
      <div class="pkg">${esc(m.name)}</div>
      <p class="desc">${esc(pickLang(m.description) || '（无描述）')}</p>
      <div class="meta">
        ${m.category ? `<span class="chip tag">${esc(m.category)}</span>` : ''}
        <span class="chip">${(m.bundles || []).length} 个 bundle</span>
        <span class="chip">${Object.keys(m.dependencies || {}).length} 个依赖</span>
        ${m.author ? `<span class="chip">${esc(m.author)}</span>` : ''}
        ${size ? `<span class="chip">${size}</span>` : ''}
        ${m.updatedAt ? `<span class="chip">${esc(m.updatedAt)}</span>` : ''}
      </div>
      <div class="foot">
        <span class="sha" title="${esc(m.sha256)}">sha256 ${esc(m.sha256.slice(0, 12))}…</span>
        <span class="foot-right">
          <a class="detail-link" href="#/pack/${encodeURIComponent(m.name)}">详情 →</a>
          <details class="inst">
          <summary>安装 ▾</summary>
          <div class="menu">
            <b>安装到本机 Profile</b>
            <small>需要 modpack-cli：npm install -g modpack-cli</small>
            <div class="mi-cli">
              <b>命令</b>
              <span class="cli">
                <input readonly value="${esc(cmd)}" spellcheck="false">
                <button class="copy" type="button">复制</button>
              </span>
            </div>
            <small>装完后启动：<code>dsh --profile ${esc(m.name)}</code>（可用 --name 改名）</small>
          </div>
        </details>
        </span>
      </div>
    </li>`;
}

function renderCards() {
  const list = $('#cards');
  const filtered = index.modpacks.filter(matches);
  $('#empty').hidden = filtered.length > 0;
  $('#hint').textContent = filtered.length
    ? `共 ${filtered.length} 个整合包` : '没有匹配结果，试试换个关键词或分类。';
  list.innerHTML = filtered.map(cardHTML).join('');
}

function detailHTML(m) {
  const size = m.size ? `${(m.size / 1024).toFixed(1)} KB` : '';
  const cmd = `modpack install ${m.downloadUrl}`;
  const bundles = (m.bundles || [])
    .map((b) => `<li><code>${esc(b)}</code></li>`).join('') || '<li class="none">（无）</li>';
  const deps = Object.entries(m.dependencies || {})
    .map(([k, v]) => `<li><span class="dk">${esc(k)}</span><span class="arrow">→</span><code>${esc(v)}</code></li>`).join('') || '<li class="none">（无）</li>';
  const files = (m.files || [])
    .map((f) => `<li><code>${esc(f.path)}</code><span class="arrow">·</span><span>${Math.round((f.size || 0) / 1024)} KB · ${esc((f.sha256 || '').slice(0, 12))}…</span></li>`).join('');

  return `
    <div class="detail">
      <a class="back" href="#">← 返回市场</a>
      <header class="d-head">
        <div>
          <h2>${esc(pickLang(m.displayName) || m.name)}</h2>
          <div class="d-sub">${esc(m.name)}<span class="dot">·</span>v${esc(m.version)}</div>
        </div>
        <div class="d-chips">
          ${m.category ? `<span class="chip tag">${esc(m.category)}</span>` : ''}
          ${m.author ? `<span class="chip">作者 ${esc(m.author)}</span>` : ''}
          ${m.dshVersion ? `<span class="chip">DSH ${esc(m.dshVersion)}</span>` : ''}
          <span class="chip">manifest v${esc(m.manifestVersion ?? 3)}</span>
          ${m.updatedAt ? `<span class="chip">更新 ${esc(m.updatedAt)}</span>` : ''}
          ${size ? `<span class="chip">${size}</span>` : ''}
        </div>
      </header>

      <p class="d-desc">${esc(pickLang(m.description) || '（无描述）')}</p>

      <section class="d-block">
        <h3>安装</h3>
        <div class="d-install">
          <div class="mi-cli">
            <b>命令（需 modpack-cli）</b>
            <span class="cli">
              <input readonly value="${esc(cmd)}" spellcheck="false">
              <button class="copy" type="button">复制</button>
            </span>
          </div>
          <div class="d-install-row">
            <a class="d-dl" href="${esc(m.downloadUrl)}" target="_blank" rel="noopener">直接下载包</a>
            <small>装完启动：<code>dsh --profile ${esc(m.profileName || m.name)}</code></small>
          </div>
        </div>
      </section>

      <section class="d-block">
        <h3>内容</h3>
        <div class="d-grid">
          <div>
            <h4>Bundles（${(m.bundles || []).length}）</h4>
            <ul class="d-list">${bundles}</ul>
          </div>
          <div>
            <h4>依赖（${Object.keys(m.dependencies || {}).length}）</h4>
            <ul class="d-list">${deps}</ul>
          </div>
        </div>
        ${files ? `<div><h4>按需拉取 files[]（${(m.files || []).length}）</h4><ul class="d-list">${files}</ul></div>` : ''}
      </section>

      <section class="d-block">
        <h3>校验信息</h3>
        <dl class="d-info">
          <dt>sha256</dt><dd><code class="mono">${esc(m.sha256 || '')}</code></dd>
          <dt>大小</dt><dd>${size || '–'}</dd>
          <dt>下载地址</dt><dd><code class="mono break">${esc(m.downloadUrl || '')}</code></dd>
          ${m.profileName ? `<dt>Profile</dt><dd><code class="mono">${esc(m.profileName)}</code></dd>` : ''}
          ${m.icon ? `<dt>图标</dt><dd><code class="mono break">${esc(m.icon)}</code></dd>` : ''}
        </dl>
      </section>
    </div>`;
}

function currentName() {
  const m = location.hash.match(/^#\/pack\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function showList() {
  document.querySelector('.hero').hidden = false;
  document.querySelector('main').hidden = false;
  $('#detail').hidden = true;
  window.scrollTo(0, 0);
}

function showDetail(name) {
  const m = index.modpacks.find((x) => x.name === name);
  document.querySelector('.hero').hidden = true;
  document.querySelector('main').hidden = true;
  const d = $('#detail');
  d.innerHTML = m
    ? detailHTML(m)
    : `<div class="detail"><a class="back" href="#">← 返回市场</a><p class="d-desc">未找到整合包「${esc(name)}」。</p></div>`;
  d.hidden = false;
  window.scrollTo(0, 0);
}

function route() {
  if (!index) return;
  const name = currentName();
  if (name) showDetail(name); else showList();
}

function render() {
  renderStats();
  renderCats();
  renderCards();
  route();
}

$('#search').addEventListener('input', (e) => {
  query = e.target.value.trim().toLowerCase();
  renderCards();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button.copy');
  if (!btn) return;
  const input = btn.closest('.cli').querySelector('input');
  navigator.clipboard.writeText(input.value).then(() => {
    btn.textContent = '已复制 ✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('copied'); }, 1500);
  }).catch(() => {
    input.select();
    document.execCommand('copy');
  });
});

window.addEventListener('hashchange', route);

load();
