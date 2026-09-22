# 宝可梦风格整合包

加入了宝可梦宠物已经宝可梦玩法，可以 /mon start 启动

> 由 DSH PackForge 生成 · manifest v5 · type=profile

## 元信息

| 字段 | 值 |
| --- | --- |
| 整合包 | `pokemon` v`1.0.0` |
| DSH 版本 | 0.1.5-alpha.2 |
| 作者 | HXH |
| 层栈 | 4 个 bundle |
| 依赖 | 2 个 |

## 层栈（bundles）

- `@deepseek-ai/dsh-base`
- `@deepseek-ai/dsh-web-app`
- `dsh-wildmon`
- `@hellosz/dsh-pets`

## 依赖（坐标 → 固定版本）

- `@hellosz/dsh-pets` @ `0.3.1`
- `github:swaylq/dsh-wildmon` @ `a2c7df00b27c2de9f2b0915d3bd5f1acc4d02c68`

## 文件清单

源 Profile 共 5 个文件。
打包时机器文件进根目录，其余进 overrides/。

## 使用

- 重打包生成 .dspack（产物输出到 release/）
- 安装：`dspack install release/pokemon-1.0.0.dspack`
