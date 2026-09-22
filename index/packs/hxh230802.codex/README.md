# CodeX风格整合包

CodeX风格整合包，包含5个插件与20个skill。特别感谢MichengAI提供的思路与灵感。

> 由 DSH PackForge 生成 · manifest v5 · type=profile

## 元信息

| 字段 | 值 |
| --- | --- |
| 整合包 | `codex` v`1.0.0` |
| DSH 版本 | 0.1.5-alpha.2 |
| 作者 | — |
| 层栈 | 6 个 bundle |
| 依赖 | 5 个 |

## 层栈（bundles）

- `@deepseek-ai/dsh-base`
- `@deepseek-ai/dsh-web-app`
- `@michengai/dsh-codex-ui`
- `dsh-skills-manager-plus`
- `@michengai/dsh-agency-agents`
- `@michengai/dsh-automation`

## 依赖（坐标 → 固定版本）

- `@michengai/dsh-agency-agents` @ `1.0.1`
- `@michengai/dsh-automation` @ `0.1.45`
- `@michengai/dsh-codex-ui` @ `1.1.15`
- `@michengai/dsh-im-connect` @ `0.1.51`
- `dsh-skills-manager-plus` @ `0.1.1`

## 文件清单

源 Profile 共 5 个文件。
打包时机器文件进根目录，其余进 overrides/。
附带 home 级内容 25 个文件（skills / agent 预设，进 home/）。

## 使用

- 重打包生成 .dspack（产物输出到 release/）
- 安装：`dspack install release/codex-1.0.0.dspack`
