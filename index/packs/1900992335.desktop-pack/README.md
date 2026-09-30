# 桌面端整合包

DeepSeek Harness 桌面端整合包：packforge 打包 + 上下文管理 + 插件市场 + 模型代理

> 由 DSH PackForge 生成 · manifest v5 · type=profile

## 元信息

| 字段 | 值 |
| --- | --- |
| 整合包 | `desktop-pack` v`1.0.0` |
| DSH 版本 | `0.2.0-rc.2` |
| 作者 | 1900992335 |
| 层栈 | 7 个 bundle |
| 依赖 | 4 个 |

## 层栈（bundles）

- `@deepseek-ai/dsh-base`
- `@deepseek-ai/dsh-web-app`
- `@deepseek-ai/dsh-experimental-auto-review`
- `dsh-context`
- `dsh-plugin-marketplace`
- `dsh-plugin-model-proxy`
- `@dsh-packforge/dsh-pack-plugin`

## 依赖（坐标 → 固定版本）

- `@dsh-packforge/dsh-pack-plugin` @ `0.3.5`
- `dsh-context` @ `0.61.0`
- `dsh-plugin-marketplace` @ `0.4.0`
- `dsh-plugin-model-proxy` @ `0.1.6`

## 文件清单

源 Profile 共 12 个文件（排除 2 个命中规则项）。
打包时机器文件（`package.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml`）进根目录，其余进 `overrides/`。

## 使用

- 分发：重打包生成 `.dspack`（产物输出到 `release/`）
- 安装：`dspack install release/desktop-pack-1.0.0.dspack`
