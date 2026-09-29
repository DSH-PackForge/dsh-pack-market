# 丝滑的DSH

【推荐官方桌面端安装】你的DSH——比想象的更丝滑！本整合包添加了dsh-smooth-stream插件使流式输出更丝滑，添加dsh-client-ui-task-board插件添加方便的任务看板，添加底部信息栏插件、小鯨鱼插件为工作区增添趣味，以及dsh-pack-plugin管理整合包。添加20个skill用于优化以及编码指导。

> 由 DSH PackForge 生成 · manifest v5 · type=profile

## 元信息

| 字段 | 值 |
| --- | --- |
| 整合包 | `smoother-deepseek-harness` v`1.0.1` |
| DSH 版本 | 未钉定（安装端兜底） |
| 作者 | HXH |
| 层栈 | 7 个 bundle |
| 依赖 | 5 个 |

## 层栈（bundles）

- `@deepseek-ai/dsh-base`
- `@deepseek-ai/dsh-web-app`
- `@dsh-packforge/dsh-pack-plugin`
- `dsh-plugin-whale-pet`
- `dsh-smooth-stream`
- `@linxin666/dsh-client-ui-task-board`
- `dsh-bottom-info-bar`

## 依赖（坐标 → 固定版本）

- `@dsh-packforge/dsh-pack-plugin` @ `0.3.5`
- `@linxin666/dsh-client-ui-task-board` @ `0.4.3`
- `dsh-bottom-info-bar` @ `1.20.8`
- `dsh-plugin-whale-pet` @ `0.2.8`
- `dsh-smooth-stream` @ `0.6.1`

## 文件清单

源 Profile 共 19 个文件（排除 3 个命中规则项）。
打包时机器文件（`package.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml`）进根目录，其余进 `overrides/`。

## 使用

- 分发：重打包生成 `.dspack`（产物输出到 `release/`）
- 安装：`dspack install release/smoother-deepseek-harness-1.0.1.dspack`
