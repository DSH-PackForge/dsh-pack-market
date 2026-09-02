# 更好的侧边栏

为DSH提供更好的侧边栏

> 由 DSH PackForge 生成 · manifest v4 · type=profile

## 元信息

| 字段 | 值 |
| --- | --- |
| 整合包 | `better-sidebar` v`1.0.0` |
| DSH 版本 | 未钉定（安装端兜底） |
| 作者 | HXH |
| 层栈 | 4 个 bundle |
| 依赖 | 2 个 |

## 层栈（bundles）

- `@deepseek-ai/dsh-base`
- `@deepseek-ai/dsh-web-app`
- `@dsh-plugin/dsh-loader`
- `@dsh-plugin/dsh-better-sidebar-loader`

## 依赖（坐标 → 固定版本）

- `@dsh-plugin/dsh-better-sidebar-loader` @ `0.14.4`
- `@dsh-plugin/dsh-loader` @ `1.3.3-dev.33218986978`

## 文件清单

源 Profile 共 4 个文件（排除 5 个命中规则项）。
打包时机器文件（`package.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml`）进根目录，其余进 `overrides/`。

## 使用

- 分发：重打包生成 `.dspack`（产物输出到 `release/`）
- 安装：`dspack install release/better-sidebar-1.0.0.dspack`
