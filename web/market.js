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
  const hay = [m.name, m.displayName, m.description, m.author, m.category, ...(m.bundles || [])]
    .join(' ').toLowerCase();
  return hay.includes(query);
}

function cardHTML(m) {
  const size = m.size ? `${(m.size / 1024).toFixed(1)} KB` : '';
  const cmd = `modpack install ${m.downloadUrl}`;
  return `
    <li class="card">
      <div class="top">
        <span class="title">${esc(m.displayName || m.name)}</span>
        <span class="ver">${esc(m.version)}</span>
      </div>
      <div class="pkg">${esc(m.name)}</div>
      <p class="desc">${esc(m.description || '（无描述）')}</p>
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

function render() {
  renderStats();
  renderCats();
  renderCards();
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

load();
