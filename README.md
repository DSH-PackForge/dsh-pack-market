# dsh-pack-market

DSH 整合包平台 · 市场仓库（**索引 + 市场网页，同仓库，GitHub Pages 部署**）。

> 由 `ModPack-Index`（索引）与 `ModPack-Web`（市场网页）合并而来，数据与站点同仓库，不再需要跨仓库同步。

## 目录结构

```
dsh-pack-market/
├── scripts/
│   └── collect.mjs             # 采集器：扫 topic `dsh-pack` → 生成 index/index.json + index/packs/
├── index/
│   ├── index.json              # 精简索引（schemaVersion 2，仅列表/搜索/安装必需字段，采集器生成，勿手改）
│   └── packs/
│       └── <owner>.<repo>/     # 每个整合包一个目录（懒加载源）
│           ├── manifest.json    # 完整 manifest（v3/v4/v5，原始文本）
│           └── README.md        # 源仓库 README（若有）
├── web/
│   ├── index.html              # 市场页
│   ├── market.css / market.js  # 样式与渲染逻辑
│   ├── LICENSE                 # CC0 1.0（网页代码）
│   ├── index.json              # 本地预览快照（线上由 CI 实时生成）
│   └── packs/                  # 懒加载快照（线上由 CI 从 index/packs 复制）
├── .github/workflows/
│   └── deploy-pages.yml        # 采集 dsh-pack 标签 → 部署 GitHub Pages
└── README.md
```

## 索引从哪来（自动收录）

- **事实源 = 各整合包仓库的 `manifest.json`**：作者给仓库打 topic `dsh-pack`、根放 `manifest.json`、建 Release 放 `.dspack`/`.tgz`（或在清单里写 `downloadUrl`）。
- **`index/index.json` 与 `index/packs/` 由采集器自动生成**：`deploy-pages.yml` 每天定时 / 手动 / 推送时运行 `scripts/collect.mjs`，**不要在这里手改**。
- **索引是精简指针制（schemaVersion 2）**：`index.json` 只保留列表卡片 / 搜索 / 安装命令需要的字段（`name`/`version`/`displayName`/`description`/`author`/`category`/`dshVersion`/`profileName`/`downloadUrl`/`sha256`/`size`/`updatedAt` + `id`/`owner`/`repo` + 计数）。完整 `manifest.json` 与 `README.md` 拆到 `index/packs/<owner>.<repo>/`，市场详情页点开时懒加载。
- `web/index.json`、`web/packs/` 是部署时从 `index/` 复制的快照，仅用于本地 `npx serve web/` 预览，**也不要手改**。

## 如何发布（让整合包被收录）

1. 仓库 **About → Topics** 加 `dsh-pack`；
2. 根放 `manifest.json`（支持 manifest v3/v4/v5 契约；v5 为 `manifestVersion: 5` + `type: "profile" | "dshhome"`，详见 `DSH-PackForge/specs/manifest/`），**推荐**再放一份 `README.md`；
3. 分发方式二选一：
   - **清单直连**：在 `manifest.json` 里写 `downloadUrl`，并在 `<downloadUrl>.sha256` 放 64 位 sha256（侧车文件）；
   - **默认 GitHub Release**：不写 `downloadUrl`，建一个 Release，挂上 `<name>-<version>.dspack`（或过渡期 `.tgz`），再挂一个 `<name>-<version>.dspack.sha256` 侧车文件；
4. 采集器会自动收录；想立刻刷新，去 Actions 手动跑「自动收录 dsh-pack 并部署」。

## GitHub Pages 部署

部署用 GitHub Actions（`deploy-pages.yml`），站点输出目录是 `web/`。

一次性设置（仓库 Settings → Pages）：

1. **Build and deployment → Source** 选 **GitHub Actions**（不是 branch）。
2. 之后每次 push 到 `main`，`deploy-pages.yml` 自动：
   - 复制 `index/index.json` → `web/index.json`
   - `upload-pages-artifact` 上传 `web/` → `deploy-pages` 发布
3. 可选自定义域：`Settings → Pages → Custom domain`（会写入 CNAME）。

## 数据契约

`index/index.json`（schemaVersion 2）的字段与提交规范见：
- `DSH-PackForge/specs/publishing/`（发布与注册）
- 规范文档仓库 `DSH-PackForge/specs/`（manifest / pack-structure）

## CI

| workflow | 触发 | 作用 |
|---|---|---|
| `deploy-pages.yml` | 每天定时 / push 到 main / 手动 | 扫 `dsh-pack` 标签 → 生成索引 + packs → 提交 → 复制 → 部署 Pages |