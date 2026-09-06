# 收录插件（CONTRIBUTING）

本仓库的插件清单 `index/plugins.json` 由社区通过 PR 维护。作者给**自己的插件**提 PR 申请**收录**；收录之后，符合条件的插件由维护者**配发**「整合包必备」徽章。

## 如何提 PR 收录

1. **Fork** 本仓库；
2. 编辑 `index/plugins.json`，在 `plugins` 数组里加你的插件条目：
   ```jsonc
   {
     "id": "owner/repo",              // GitHub owner/仓库名，唯一
     "name": "repo",
     "url": "https://github.com/owner/repo",
     "category": "tools",             // 领域，可省略
     "description": { "zh": "…", "en": "…" },
     "install": "dsh plugin add github:owner/repo"
     // 不要自己填 badges —— 徽章由维护者收录后配发
   }
   ```
3. 提 PR。CI 会自动跑 `scripts/validate-plugins.mjs` 校验结构；
4. 维护者 review 后合并，插件即被收录，出现在精选插件页。

## 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | `owner/repo`，全局唯一键 |
| `name` | ✅ | 插件名 |
| `url` | ✅ | 插件仓库 http(s) 地址 |
| `category` | 否 | 领域（显示在徽章文字与勾之间），字符串或 `{zh,en}` 多语言 map |
| `description` | 否 | 描述，字符串或 `{zh,en}` 多语言 map |
| `install` | 否 | 安装命令（站点展示用） |
| `badges` | 否 | 徽章数组（**维护者配发，作者不要自己填**） |

## 徽章「整合包必备」（essential）

插件**被收录后**，满足条件的由维护者配发 essential 徽章。徽章贴在插件 README 上，读作「**这个插件是整合包必备插件**」。它代表「**强烈推荐**」：打造 DSH 整合包时，这个插件是我们十分推荐放进包里的——不是「离了它就不能用」的硬性必需，而是推荐度很高的意思。

中文徽章：`整合包 · 必备` · 英文徽章：`Essential for packs`。

### 配发门槛（当前）

满足**其一**即可：

1. **被 ≥1 个已收录整合包引用** —— 即该插件出现在某个整合包 manifest 的 `dependencies` 坐标里；
2. **维护者主观判断** —— 维护者认为这个插件值得强烈推荐。

> 后期平台规模变大后，将改为按引用量自动判定。

## 徽章用法（配发后）

配发后，徽章 URL：

```
https://dsh-packforge.github.io/dsh-pack-market/badges/plugins/<owner>-<repo>-zh.svg   # 中文
https://dsh-packforge.github.io/dsh-pack-market/badges/plugins/<owner>-<repo>-en.svg   # 英文
```

挂到你插件 README（点徽章跳插件详情页）：

```markdown
[![整合包必备](https://dsh-packforge.github.io/dsh-pack-market/badges/plugins/owner-repo-zh.svg)](https://dsh-packforge.github.io/dsh-pack-market/#/plugin/owner%2Frepo)
```
