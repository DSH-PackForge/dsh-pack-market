# DSH 整合包市场网页

DSH 整合包平台的静态市场页：浏览、搜索、分类筛选整合包，安装命令一键复制。

## 运行

```bash
npx serve .            # 任意静态服务器即可
# 或直接用浏览器打开 index.html（本地数据演示）
```

## 数据源

- 默认读取 `./index.json`（部署副本，来自 `index/index.json`）
- 用 `?index=<url>` 指向远端索引仓库：`https://your-host/dsh-pack-market/?index=https://raw.githubusercontent.com/org/dsh-pack-market/main/index.json`
- 详情页会按条目的 `id`（`<owner>.<repo>`）懒加载 `./packs/<owner>.<repo>/manifest.json` 与 `README.md`

数据契约见 `index/index.json`（schemaVersion 2，精简指针制）。

## 设计

- 设计系统"纸墨朱砂"：暖纸底 + 卡片 + 朱砂红强调，深色模式自适应
- **设计灵感：[awesome-dsh-plugin.com](https://awesome-dsh-plugin.com)（CC0 1.0）**，页脚已署名
- 纯静态（HTML/CSS/JS），无构建步骤

## 部署：GitHub Pages

部署由仓库根目录的 `.github/workflows/deploy-pages.yml` 完成（采集 `dsh-pack` 标签 → 生成索引 + packs → 复制到 `web/` → 部署 Pages）。站点输出目录是 `web/`。

一次性设置（仓库 Settings → Pages）：

1. **Build and deployment → Source** 选 **GitHub Actions**；
2. 之后每次 push 到 `main`（或定时/手动触发），workflow 自动：
   - 复制 `index/index.json` → `web/index.json`、`index/packs` → `web/packs`
   - `upload-pages-artifact` 上传 `web/` → `deploy-pages` 发布

### 本地预览

```bash
npx serve .            # 任意静态服务器即可
# 或直接浏览器打开 index.html（本地数据演示）
```

### 指向真实索引

页面默认读 `./index.json`（部署副本）。也可用 `?index=<url>` 指向其它索引源，或修改 `market.js` 顶部的 `DEFAULT_SOURCE`。

## 许可证

[CC0 1.0](LICENSE)
