# ModPack 市场网页

DSH 整合包平台的静态市场页：浏览、搜索、分类筛选整合包，安装命令一键复制。

## 运行

```bash
npx serve .            # 任意静态服务器即可
# 或直接用浏览器打开 index.html（本地数据演示）
```

## 数据源

- 默认读取 `./index.json`（部署副本，来自 `index/index.json`）
- 用 `?index=<url>` 指向远端索引仓库：`https://your-host/modpack-market/?index=https://raw.githubusercontent.com/org/modpack-index/main/index.json`
- 详情页会按条目的 `id`（`<owner>.<repo>`）懒加载 `./packs/<owner>.<repo>/manifest.json` 与 `README.md`

数据契约见 `index/index.json`（schemaVersion 2，精简指针制）。

## 设计

- 设计系统"纸墨朱砂"：暖纸底 + 卡片 + 朱砂红强调，深色模式自适应
- **设计灵感：[awesome-dsh-plugin.com](https://awesome-dsh-plugin.com)（CC0 1.0）**，页脚已署名
- 纯静态（HTML/CSS/JS），无构建步骤

## 部署：Cloudflare Pages（免费）

### 方式一：Git 集成（推荐，push 即自动部署）

1. 推送到 GitHub：

```bash
git remote add origin git@github.com:<你的用户名>/ModPack-Web.git
git push -u origin main
```

2. [dash.cloudflare.com](https://dash.cloudflare.com) → 登录 → **Workers & Pages → Create → Pages → Connect to Git**
3. 授权并选择 `ModPack-Web` 仓库
4. **Build settings**（纯静态，无构建）：
   - 构建命令：**留空**
   - 输出目录：`/`（文件在仓库根目录）
5. **Save and Deploy** → 得到 `https://<项目名>.pages.dev`

### 方式二：直接上传（无需 GitHub）

Dashboard → **Pages → Create → Upload assets** → 把 `index.html`、`market.css`、`market.js`、`index.json` 一起拖进去 → 部署。

### 上线后指向真实索引

页面默认读 `./index.json`（演示副本）。指向真实索引仓库：

```
https://<项目名>.pages.dev/?index=https://raw.githubusercontent.com/<org>/ModPack-Index/main/index.json
```

也可修改 `market.js` 顶部的 `DEFAULT_SOURCE` 改为远端地址作为默认值。

## 许可证

[MIT](LICENSE)
