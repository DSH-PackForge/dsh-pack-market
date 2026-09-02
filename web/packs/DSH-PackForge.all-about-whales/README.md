# All About Whales 🐳

让 DSH 充满大肥鱼的味道 —— 用 DeepSeek 吉祥物主题美化 webUI 的 DSH 整合包（profile：`all-about-whales`）。

> 这是 `all-about-whales` 整合包的**专属源仓库**，遵循 DSH-PackForge 最新契约：manifest v4 + pack-structure v2（`.dspack`）。

## 一键安装

```bash
npm install -g modpack-cli
modpack install <本包的下载链接>    # 或 install git+https://github.com/DSH-PackForge/all-about-whales
dsh --profile all-about-whales
```

## 装了什么

<b>Bundles（层栈）</b>

- `@deepseek-ai/dsh-base`
- `@deepseek-ai/dsh-web-app`
- `dafy-whale-theme`（大肥鱼主题）
- `dsh-whale-widget`
- `dsh-reasoning-effort`
- `dsh-pet`

<b>固定依赖（可复现）</b>

| 坐标 | 版本 |
|---|---|
| `github:DViridescent/dafy-whale-theme` | `99e8c57` |
| `dsh-pet` | `0.2.0` |
| `github:HanaAyane/dsh-reasoning-effort` | `83bc8c5` |
| `github:MeteorNOX/DeepSeek-Balance-Whale-Widget` | `4448c61` |

运行环境：DSH `0.1.0-rc.8`。

## 仓库布局（pack-structure v2）

```
all-about-whales/
├── manifest.json           # 索引（根，manifest v4）
├── dspack.json             # 容器标记（format: dspack, version: 2）
├── package.json            # 安装快照（可选，与 pnpm-lock 对应）
├── pnpm-lock.yaml / pnpm-workspace.yaml
├── overrides/              # 用户文件：安装时覆盖进 profile 根
│   └── cordis.patch.yml
├── pack.mjs                # 打包脚本：打成 <name>-<version>.dspack
└── README.md
```

> `manifest.json` 里的 `category` 是市场收录用的可选提示字段，非 manifest v4 正式字段。

## 打包

```bash
node pack.mjs
# → all-about-whales-1.0.0.dspack
```

`.dspack` 容器（pack-structure v2）：**纯 ZIP**，根目录含 `dspack.json`（容器标记）+ `manifest.json` + `overrides/**`。WinRAR / 7-Zip 等压缩软件可直接打开。

## 发布（被市场收录）

1. 本仓库 About 已打 topic `dsh-pack`；
2. 建一个 GitHub Release，挂上 `all-about-whales-1.0.0.dspack`；
3. 在 Release 里再挂侧车文件 `all-about-whales-1.0.0.dspack.sha256`（64 位 sha256，一行文本）。

市场 `dsh-pack-market` 的采集器会按 `dsh-pack` 标签自动收录本包。

生成 sha256（Windows）：

```powershell
Get-FileHash .\all-about-whales-1.0.0.dspack -Algorithm SHA256
```