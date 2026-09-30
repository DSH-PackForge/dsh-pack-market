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
│   ├── launchers.json          # 启动器 canonical ID 认领表（对齐 DSH-PackForge/specs/launcher-registry.md，规范仓库 PR 后手动同步）
│   └── packs/
│       └── <owner>.<repo>/     # 每个整合包一个目录（懒加载源）
│           ├── manifest.json    # 完整 manifest（v3/v4/v5，原始文本）
│           ├── README.md        # 源仓库 README（若有）
│           └── stats.json       # 下载量快照（GitHub Release 资产；详情页懒加载）
├── web/
│   ├── index.html              # 市场页
│   ├── market.css / market.js  # 样式与渲染逻辑
│   ├── LICENSE                 # CC0 1.0（网页代码）
│   ├── index.json              # 本地预览快照（线上由 CI 实时生成）
│   └── packs/                  # 懒加载快照（线上由 CI 从 index/packs 复制）
├── .github/workflows/
│   └── deploy-pages.yml        # 采集 dsh-pack 标签 → 部署 GitHub Pages
├── LICENSE                      # CC0 1.0（全仓库）
└── README.md
```

## 索引从哪来（自动收录）

- **事实源 = 各整合包仓库的 `manifest.json`**：作者给仓库打 topic `dsh-pack`、根放 `manifest.json`、建 Release 放 `.dspack`/`.tgz`（或在清单里写 `downloadUrl`）。
- **`index/index.json` 与 `index/packs/` 由采集器自动生成**:`deploy-pages.yml` 每 6 小时定时 / 手动 / 推送时运行 `scripts/collect.mjs`,**不要在这里手改**。
- **索引是精简指针制（schemaVersion 2）**：`index.json` 只保留列表卡片 / 搜索 / 安装命令需要的字段（`name`/`version`/`displayName`/`description`/`author`/`category`/`dshVersion`/`profileName`/`downloadUrl`/`sha256`/`size`/`updatedAt` + `id`/`owner`/`repo` + 计数）。完整 `manifest.json` 与 `README.md` 拆到 `index/packs/<owner>.<repo>/`，市场详情页点开时懒加载。
- `web/index.json`、`web/packs/` 是部署时从 `index/` 复制的快照，仅用于本地 `npx serve web/` 预览，**也不要手改**。

## 采集器的可靠性约定

采集是「扫描 + 抓取 + 写回 + 提交」的自动化流水线，因此**宁可这一轮不更新，也不发一个残缺索引**：

| 情况 | 处理 |
| --- | --- |
| 网络错误 / 403 / 429 / 5xx（**瞬时失败**） | 本轮**沿用上一轮**的索引条目与 `packs/` 文件，不删任何东西（失败信息打在日志里） |
| 404 / 410 / 451（**确定不存在**） | 视为「不是整合包 / 作者已撤下」，按 topic 命中但不收录处理 |
| 仓库仍命中 topic，但抓取失败 | 保留旧目录（**只有撤出 topic / 归档 / 删库才会清理目录**） |
| topic 命中数或最终收录数跌破上轮的 70% | **熔断**：本轮直接不写入任何文件并非零退出（CI 因此不会提交）。确认是有意收缩时设 `ALLOW_SHRINK=1` 重跑 |
| 索引条目与上轮完全一致 | 不重写 `index.json`（避免只改 `generatedAt` 的空提交） |

其他实现细节：包级并发 5（I/O 密集）；每轮对 `api.github.com` 的请求数 ≈ `1 + 包数`（Release 列表一次拿到最新资产与全部版本下载量）；`sha256` 优先取 GitHub 资产元数据的 `digest` 字段，省一次请求，也避免采集器自己刷高作者的 `.sha256` 侧车下载计数。

### 下载量口径（`stats.json`）

- 来源：GitHub Releases API 的 `assets[].download_count`（**累计值**，GitHub 侧本身有刷新延迟）；
- **只统计包资产**（`.dspack` / `.tgz`，无则回退 `.zip`），**不含** `.sha256` 侧车与说明文件（侧车实测能占包资产的 10%~25%，混进去会虚高）；
- 含重复下载与自动化拉取，**不等于安装量**；
- **刻意不做「日均」**：`累计 ÷ 发布以来天数` 是终身平均速率，结构上会随发布初期那波下载被稀释而单调下降——包没变差数字却在跌，对作者是没必要的压力。真要做热度榜，应当用「近 7 天增量」这类窗口指标（需要历史快照），而不是终身平均；
- 下载源不是 GitHub Release（清单直连到自有 CDN / jsDelivr 等）的包**没有该文件**，详情页不显示下载量——用「无数据」而不是「0」表示。

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
| `deploy-pages.yml` | 每 6 小时定时 / push 到 main / 手动 | 扫 `dsh-pack` 标签 → 生成索引 + packs → 提交 → 复制 → 部署 Pages |