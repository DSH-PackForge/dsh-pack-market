# dsh-pack-market

DSH 整合包平台 · 市场仓库（**索引 + 市场网页，同仓库，GitHub Pages 部署**）。

> 由 `ModPack-Index`（索引）与 `ModPack-Web`（市场网页）合并而来，数据与站点同仓库，不再需要跨仓库同步。

## 目录结构

```
dsh-pack-market/
├── index/
│   └── index.json              # 索引数据（唯一事实源，schemaVersion 1）
├── web/
│   ├── index.html              # 市场页
│   ├── market.css / market.js  # 样式与渲染逻辑
│   ├── LICENSE                 # MIT（网页代码）
│   └── index.json              # 本地预览快照（线上由 CI 实时从 index/index.json 生成）
├── .github/workflows/
│   ├── validate-index.yml      # PR 校验 index/index.json
│   └── deploy-pages.yml        # 校验 → 复制索引 → 部署 GitHub Pages
└── README.md
```

## 一条数据，两份位置

- **事实源**：`index/index.json` —— 修改索引请只改这里。
- **网页读取**：`web/index.json`（`market.js` 默认 `./index.json`）。

`deploy-pages.yml` 在部署时**实时**把 `index/index.json` 复制到 `web/index.json`，所以线上站点永远与事实源一致；仓库里提交的那份 `web/index.json` 只是「本地 `npx serve web/` 预览」用的快照，不保证实时。**不要手动改 `web/index.json`。**

## GitHub Pages 部署

部署用 GitHub Actions（`deploy-pages.yml`），站点输出目录是 `web/`。

一次性设置（仓库 Settings → Pages）：

1. **Build and deployment → Source** 选 **GitHub Actions**（不是 branch）。
2. 之后每次 push 到 `main`，`deploy-pages.yml` 自动：
   - 校验 `index/index.json`
   - 复制 `index/index.json` → `web/index.json`
   - `upload-pages-artifact` 上传 `web/` → `deploy-pages` 发布
3. 可选自定义域：`Settings → Pages → Custom domain`（会写入 CNAME）。

## 数据契约

`index/index.json`（schemaVersion 1）的字段与提交规范见：
- `ModPack-CLI/docs/publishing.md`（发布与注册）
- 规范文档仓库 `DSH-PackForge/specs/`（manifest / pack-structure）

## CI

| workflow | 触发 | 作用 |
|---|---|---|
| `validate-index.yml` | PR + push（index 变更） | 跑 `npx -y modpack-cli@latest index validate index/index.json` |
| `deploy-pages.yml` | push 到 main / 手动 | 校验 → 复制索引 → 部署到 GitHub Pages |