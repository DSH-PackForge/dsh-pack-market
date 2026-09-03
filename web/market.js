// DSH 整合包市场页：读取 index.json → 渲染整合包卡片（搜索 / 分类 / 安装复制）
// 数据源：默认 ./index.json（由 CI 从 ../index/index.json 同步的部署副本）；可用 ?index=<url> 指向远端索引
//
// 索引是「精简指针制」（schemaVersion 2）：只含列表/搜索/安装必需字段；
// 完整 manifest 与 README 放在 packs/<owner>.<repo>/ 下，详情页点开时懒加载。

const DEFAULT_SOURCE = './index.json';

/** 内置演示数据（fetch 失败时兜底展示） */
const FALLBACK = {
  schemaVersion: 2,
  modpacks: [
    {
      manifestVersion: 4,
      type: 'profile',
      name: 'web',
      displayName: '网页开发助手',
      version: '1.0.0',
      description: 'DSH 官方 web 预设整合包，含 dsh-pack-market 与 dsh-tui。安装后 dsh --profile web 启动 Web 界面。',
      author: 'hxh230802',
      category: 'coding',
      dshVersion: '>=0.1.0',
      profileName: 'web',
      downloadUrl: 'https://github.com/your-org/dsh-pack-market/releases/download/web-1.0.0/web-1.0.0.tgz',
      sha256: 'c53f18814e8912dc045e9da61ccef0afa92d54f57df9d2ddf08db19476e9b2c2',
      size: 10916,
      updatedAt: '2026-08-15',
      id: 'your-org.dsh-pack-market',
      owner: 'your-org',
      repo: 'dsh-pack-market',
      bundleCount: 4,
      depCount: 2,
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

// 一键安装：唤起本地协议 dspack://install?url=<downloadUrl>（桌面端 dsh-packforge-app）。
// 浏览器无法直接检测协议是否注册，用「失焦 / visibilitychange」启发式判断是否唤起成功；
// 超时未失焦 → 判定未装桌面端，回退复制命令。
function installViaProtocol(url, cmd) {
  if (!url) return;
  const protocolUrl = `dspack://install?url=${encodeURIComponent(url)}`;
  let opened = false;
  const markOpened = () => { opened = true; };
  window.addEventListener('blur', markOpened, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) markOpened(); }, { once: true });
  try {
    location.href = protocolUrl;
  } catch {
    /* 某些环境设置 location.href 可能抛错，直接走兜底 */
  }
  setTimeout(() => {
    window.removeEventListener('blur', markOpened);
    if (opened) return;
    const text = cmd || `dspack install ${url}`;
    navigator.clipboard.writeText(text).then(
      () => toast('未检测到桌面端 dsh-packforge-app，已复制安装命令'),
      () => toast('未检测到桌面端，请先安装 dsh-packforge-app'),
    );
  }, 1500);
}

// 轻量 toast 提示（右下角，自动消失）。
let toastEl = null;
let toastTimer = null;
function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

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
  const hay = [m.name, pickLang(m.displayName), pickLang(m.description), m.author, m.category]
    .join(' ').toLowerCase();
  return hay.includes(query);
}

function cardHTML(m) {
  const size = m.size ? `${(m.size / 1024).toFixed(1)} KB` : '';
  const cmd = `dspack install ${m.downloadUrl}`;
  const unitChip = m.type === 'dshhome'
    ? `${m.profileCount ?? 0} 个 profile`
    : `${m.bundleCount ?? 0} 个 bundle`;
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
        <span class="chip">${unitChip}</span>
        <span class="chip">${m.depCount ?? 0} 个依赖</span>
        ${m.author ? `<span class="chip">${esc(m.author)}</span>` : ''}
        ${size ? `<span class="chip">${size}</span>` : ''}
        ${m.updatedAt ? `<span class="chip">${esc(m.updatedAt)}</span>` : ''}
      </div>
      <div class="foot">
        <span class="sha" title="${esc(m.sha256)}">sha256 ${esc((m.sha256 || '').slice(0, 12))}…</span>
        <span class="foot-right">
          <a class="detail-link" href="#/pack/${encodeURIComponent(m.name)}">详情 →</a>
          <button class="oneclick" type="button" data-url="${esc(m.downloadUrl)}" data-cmd="${esc(cmd)}">一键安装</button>
          <details class="inst">
          <summary>复制命令</summary>
          <div class="menu">
            <b>安装到本机 Profile</b>
            <small>需要 dspack CLI：npm install -g @dsh-packforge/cli</small>
            <div class="mi-cli">
              <b>命令</b>
              <span class="cli">
                <input readonly value="${esc(cmd)}" spellcheck="false">
                <button class="copy" type="button">复制</button>
              </span>
            </div>
            <small>装完后启动：<code>dsh --profile ${esc(m.profileName || m.name)}</code>（可用 --name 改名）</small>
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

// —— 详情页：懒加载完整 manifest + README ——

function currentName() {
  const m = location.hash.match(/^#\/pack\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// 合并精简索引条目 + 懒加载到的完整 manifest（完整 manifest 覆盖同名重字段，指针字段保留）
function mergeDetail(entry, full) {
  return { ...entry, ...(full || {}) };
}

function showList() {
  document.querySelector('.hero').hidden = false;
  document.querySelector('main').hidden = false;
  $('#detail').hidden = true;
  window.scrollTo(0, 0);
}

async function showDetail(name) {
  const entry = index.modpacks.find((x) => x.name === name);
  document.querySelector('.hero').hidden = true;
  document.querySelector('main').hidden = true;
  const d = $('#detail');
  d.hidden = false;
  window.scrollTo(0, 0);

  if (!entry) {
    d.innerHTML = `<div class="detail"><a class="back" href="#">← 返回市场</a><p class="d-desc">未找到整合包「${esc(name)}」。</p></div>`;
    return;
  }

  d.innerHTML = `<div class="detail"><a class="back" href="#">← 返回市场</a><p class="d-loading">正在加载完整清单…</p></div>`;

  let full = null;
  let readme = '';
  if (entry.id && entry.owner && entry.repo) {
    const base = `packs/${entry.id}/`;
    try {
      [full, readme] = await Promise.all([
        fetchJson(base + 'manifest.json').catch(() => null),
        fetchText(base + 'README.md').catch(() => ''),
      ]);
    } catch {
      /* 懒加载失败则降级为仅用索引条目渲染 */
    }
  }

  d.innerHTML = detailHTML(mergeDetail(entry, full), readme, Boolean(full));
}

function detailHTML(m, readme, hasFull) {
  const size = m.size ? `${(m.size / 1024).toFixed(1)} KB` : '';
  const cmd = `dspack install ${m.downloadUrl}`;
  const type = m.type === 'dshhome' ? 'dshhome' : 'profile';

  // profile 形态：bundles + dependencies；dshhome 形态：profiles/presets/skills/instructions
  let contentBlock = '';
  if (type === 'dshhome') {
    const profiles = m.profiles && typeof m.profiles === 'object' ? m.profiles : {};
    const pnames = Object.keys(profiles);
    contentBlock = `
      <section class="d-block">
        <h3>内容（DSH_HOME 快照）</h3>
        ${m.defaultProfile ? `<p class="d-line">默认启动：<code>${esc(m.defaultProfile)}</code></p>` : ''}
        <div class="d-grid">
          <div>
            <h4>Profiles（${pnames.length}）</h4>
            <ul class="d-list">
              ${pnames.map((k) => {
                const p = profiles[k] || {};
                const b = (p.bundles || []).map((x) => `<li><code>${esc(x)}</code></li>`).join('');
                const deps = Object.entries(p.dependencies || {})
                  .map(([kk, vv]) => `<li><span class="dk">${esc(kk)}</span><span class="arrow">→</span><code>${esc(vv)}</code></li>`).join('');
                return `<li class="d-prof"><b>${esc(k)}</b><ul>${b || deps || '<li class="none">（空）</li>'}</ul></li>`;
              }).join('') || '<li class="none">（无）</li>'}
            </ul>
          </div>
          <div>
            <h4>Presets（${Object.keys(m.presets || {}).length}）</h4>
            <ul class="d-list">
              ${Object.entries(m.presets || {}).map(([k, v]) => `<li><span class="dk">${esc(k)}</span><span class="arrow">→</span><code>${esc((v && v.path) || k)}</code></li>`).join('') || '<li class="none">（无）</li>'}
            </ul>
            <h4>Skills（${(m.skills || []).length}）</h4>
            <ul class="d-list">
              ${(m.skills || []).map((s) => `<li><code>${esc(typeof s === 'string' ? s : s.path)}</code></li>`).join('') || '<li class="none">（无）</li>'}
            </ul>
            ${m.instructions ? `<h4>全局指令</h4><ul class="d-list"><li><code>${esc(m.instructions)}</code></li></ul>` : ''}
          </div>
        </div>
      </section>`;
  } else {
    const bundles = (m.bundles || []).map((b) => `<li><code>${esc(b)}</code></li>`).join('') || '<li class="none">（无）</li>';
    const deps = Object.entries(m.dependencies || {})
      .map(([k, v]) => `<li><span class="dk">${esc(k)}</span><span class="arrow">→</span><code>${esc(v)}</code></li>`).join('') || '<li class="none">（无）</li>';
    contentBlock = `
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
        ${(m.files || []).length ? `<div><h4>按需拉取 files[]（${m.files.length}）</h4><ul class="d-list">${(m.files || []).map((f) => `<li><code>${esc(f.path)}</code><span class="arrow">·</span><span>${Math.round((f.size || 0) / 1024)} KB · ${esc((f.sha256 || '').slice(0, 12))}…</span></li>`).join('')}</ul></div>` : ''}
      </section>`;
  }

  const readmeBlock = readme
    ? `<section class="d-block"><h3>README</h3><div class="d-readme">${renderMarkdown(readme)}</div></section>`
    : '';

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
          <span class="chip">${type === 'dshhome' ? 'DSH_HOME 快照' : '单 Profile'}</span>
          ${m.author ? `<span class="chip">作者 ${esc(m.author)}</span>` : ''}
          ${m.dshVersion ? `<span class="chip">DSH ${esc(m.dshVersion)}</span>` : ''}
          <span class="chip">manifest v${esc(m.manifestVersion ?? 3)}</span>
          ${m.updatedAt ? `<span class="chip">更新 ${esc(m.updatedAt)}</span>` : ''}
          ${size ? `<span class="chip">${size}</span>` : ''}
        </div>
      </header>

      <p class="d-desc">${esc(pickLang(m.description) || '（无描述）')}</p>

      ${hasFull ? '' : '<p class="d-warn">完整清单加载失败，以下仅显示索引摘要。</p>'}

      <section class="d-block">
        <h3>安装</h3>
        <div class="d-install">
          <div class="mi-cli">
            <b>命令（需 dspack CLI）</b>
            <span class="cli">
              <input readonly value="${esc(cmd)}" spellcheck="false">
              <button class="copy" type="button">复制</button>
            </span>
          </div>
          <div class="d-install-row">
            <button class="d-oneclick" type="button" data-url="${esc(m.downloadUrl)}" data-cmd="${esc(cmd)}">一键安装</button>
            <a class="d-dl" href="${esc(m.downloadUrl)}" target="_blank" rel="noopener">直接下载包</a>
            <small>装完启动：<code>dsh --profile ${esc(m.profileName || m.name)}</code></small>
          </div>
        </div>
      </section>

      ${contentBlock}
      ${readmeBlock}

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

// —— 最小 Markdown 渲染器（无外部依赖，覆盖标题/列表/代码块/链接/表格/行内强调）——

function renderMarkdown(src) {
  const s = String(src ?? '').replace(/\r\n?/g, '\n');
  const lines = s.split('\n');
  const out = [];
  let i = 0;

  const inline = (t) =>
    esc(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  const flushParagraph = (buf) => {
    if (buf.length) { out.push(`<p>${buf.join('<br>')}</p>`); buf.length = 0; }
  };

  let para = [];
  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    if (/^\s*```/.test(line)) {
      flushParagraph(para);
      const lang = line.trim().slice(3).trim();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++; // 跳过闭合 ```
      out.push(`<pre class="md-code"><code${lang ? ` class="lang-${esc(lang)}"` : ''}>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushParagraph(para);
      const lv = h[1].length;
      out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
      i++;
      continue;
    }
    // 表格（下一行是 |---| 分隔）
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:\-|]+\|\s*$/.test(lines[i + 1])) {
      flushParagraph(para);
      const head = line.trim().split('|').slice(1, -1).map((c) => inline(c.trim()));
      i += 2; // 跳表头分隔
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim().split('|').slice(1, -1).map((c) => inline(c.trim())));
        i++;
      }
      const thead = `<thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead>`;
      const tbody = rows.length ? `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>` : '';
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }
    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph(para);
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    // 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushParagraph(para);
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    // 空行结束段落
    if (/^\s*$/.test(line)) {
      flushParagraph(para);
      i++;
      continue;
    }
    // 普通段落行
    para.push(inline(line.trim()));
    i++;
  }
  flushParagraph(para);
  return out.join('\n');
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
  const oneclick = e.target.closest('button.oneclick, button.d-oneclick');
  if (oneclick) {
    installViaProtocol(oneclick.dataset.url, oneclick.dataset.cmd);
    return;
  }
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
