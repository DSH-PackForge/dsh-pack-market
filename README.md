# dsh-pack-market

DSH 整合包平台 · 市场仓库（**索引 + 市场网页，同仓库**）。

> 由 `ModPack-Index`（索引）与 `ModPack-Web`（市场网页）合并而来，不再需要跨仓库同步。

## 目录结构

```
dsh-pack-market/
├── index/
│   └── index.json              # 索引数据（唯一事实源，schemaVersion 1）
├── web/
│   ├── index.html              # 市场页
│   ├── market.css / market.js  # 样式与渲染逻辑
│   ├── LICENSE                 # MIT（网页代码）
│   └── index.json              # 部署副本（由 CI 从 index/index.json 同步）
├── .github/workflows/
│   ├── validate-index.yml      # PR / push 校验 index/index.json
│   └── sync-web.yml            # index/index.json → web/index.json + 触发部署
└── README.md
```

## 一条数据，两份位置

- **事实源**：`index/index.json` —— 修改索引请只改这里。
- **网页读取**：`web/index.json`（`market.js` 默认 `./index.json`）。

`sync-web.yml` 在 `index/index.json` 变更时：先跑 `modpack-cli index validate` 校验，再复制到 `web/index.json` 并提交，随后静态托管自动部署。**不要手动改 `web/index.json`**，它由 CI 生成。

## 数据契约

`index/index.json`（schemaVersion 1）的字段与提交规范见：
- `ModPack-CLI/docs/publishing.md`（发布与注册）
- 规范文档仓库 `DSH-PackForge/specs/`（manifest / pack-structure）

## CI

| workflow | 触发 | 作用 |
|---|---|---|
| `validate-index.yml` | PR + push（index 变更） | 跑 `npx -y modpack-cli@latest index validate index/index.json` |
| `sync-web.yml` | push 到 main（index 变更）/ 手动 | 校验 → 复制到 `web/index.json` → 回写并触发部署 |

## 部署

市场页托管（Cloudflare Pages / GitHub Pages）连接本仓库，静态输出指向 `web/`。`sync-web.yml` 回写的 push 即触发自动部署，部署无需额外 secret。