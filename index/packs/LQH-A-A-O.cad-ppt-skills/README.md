# AutoCAD 出图 + PPT 制作 · DSH 技能整合包

一个 DSH 整合包（`.dspack`），装上就往你的 DSH 里补两个**能真正干活**的 Windows 原生技能：

| 技能 | 干什么 | 硬性依赖 |
|---|---|---|
| **autocad-draw** | 用 pywin32 COM 驱动本机 AutoCAD：出图、改图、查询模型空间图元、导出 PNG 自检、存 DWG、撤销 | Windows + **Autodesk AutoCAD**（2020 及以上，实测 2025）+ Python 3.9+ |
| **pptx-editor** | 生成 / 读取 / 编辑 / 预览 `.pptx`；内置 7 套主题 × 11 种版式的宣传风排版引擎；单页或全部页导出 PNG 自检 | Windows + **Microsoft PowerPoint**（预览用其 COM，实测 16.0）+ Python 3.9+ |

两个技能都自带 CLI，**不需要 API key**，也不依赖任何在线服务。

---

## 安装

### 方式一：DSHL 导入（推荐）

1. 打开 **DSHL（PCL-Deepseek-Harness-Launcher）**
2. 左侧进 **下载 → 整合包 → 选择整合包文件并安装**
3. 选 `release/cad-ppt-skills-1.1.0.dspack`
4. 导入完成后，会多出一个名为 **cad-ppt-skills** 的 profile；两个技能落在你的 DSH_HOME 的 `skills/` 下

### 方式二：手动复制（不用 DSHL）

把 `home/skills/` 下的 `autocad-draw`、`pptx-editor` 两个目录整体复制到：

- Windows 原生 DSH：`%USERPROFILE%\.dsh\skills\`（或你的 `$DSH_HOME\skills\`）
- 或者任意工作区的 `.dsh\skills\` 下

然后对每个技能各跑一次安装脚本：

```powershell
cd <DSH_HOME>\skills\autocad-draw
powershell -ExecutionPolicy Bypass -File .\install.ps1

cd ..\pptx-editor
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

脚本会自动找 Python、在技能目录内建 `.venv`、装 `requirements.txt` 里的依赖，最后跑 `doctor` 自检。
国内网络慢加镜像：`-PipIndex https://pypi.tuna.tsinghua.edu.cn/simple`

---

## 装完怎么验证（两条命令）

```powershell
# 1) 环境自检：Python / pywin32 / AutoCAD 或 PowerPoint 的 COM 是否就绪
& .\autocad-draw\.venv\Scripts\python.exe .\autocad-draw\cad_cli.py doctor
& .\pptx-editor\.venv\Scripts\python.exe  .\pptx-editor\pptx_cli.py  doctor

# 2) 真跑一次最小用例
& .\pptx-editor\.venv\Scripts\python.exe .\pptx-editor\pptx_cli.py themes
& .\pptx-editor\.venv\Scripts\python.exe .\pptx-editor\pptx_cli.py create --file .\pptx-editor\examples\minimal-outline.json
```

AutoCAD 那边需要**先手动打开 AutoCAD**（COM 起不来时脚本会提示；不要指望它替你冷启动，实测偶发失败）。

### 打包前的实测记录（2026-09-23）

本包是解包后从零装一遍验过的，不是"应该能用"：

| 步骤 | 结果 |
|---|---|
| 解包 → 结构 | `manifest.json / dspack.json / package.json / pnpm-*.yaml / overrides/ / home/skills/` 齐全 |
| 清单校验 | manifestVersion 5 / type=profile / name 合法 / bundles 正确 |
| `autocad-draw\install.ps1` | 自动找到 `py -3.12` → 建 .venv → 装 openai/pywin32/Pillow/PyYAML/dotenv → **doctor 全部通过**，并成功连上运行中的 AutoCAD 25.0s |
| `pptx-editor\install.ps1` | 同上 → 装 python-pptx/pywin32 等 → **doctor 全部通过** |
| pptx-editor 冒烟 | `themes` 列出 7 主题 + 11 版式；`create examples\minimal-outline.json` 生成 `out\minimal-outline.pptx`（3 页，midnight 主题） |
| autocad-draw 冒烟 | `status` 读到当前图纸与 109 个图元 |
| 包体积 | **66 KB**（依赖靠 install.ps1 现装，不进包） |

### 两个 Windows PowerShell 的坑（已避开，但你改脚本时要注意）

1. **必须用 `-ExecutionPolicy Bypass` 跑**：多数机器默认禁止执行 `.ps1`，直接双击/`.\install.ps1` 会报"禁止运行脚本"。
2. **脚本存成 UTF-8 with BOM**：Windows PowerShell 5.1 会把**无 BOM 的 UTF-8** 当 ANSI 读，中文注释直接导致语法错误。改脚本请用 VSCode（选 UTF-8 with BOM），别用记事本另存为 ANSI。

---


## 已知限制（务必先看）

1. **平台锁死**：两个技能都走 Windows COM，**Linux / macOS / WSL 里跑不了**。装到 WSL profile 里不会报错，但一调用就失败。
2. **依赖本机软件**：没有 AutoCAD，`autocad-draw` 只能自检通过、干活全废；没有 PowerPoint，`pptx-editor` 的 `create/read/edit` 能用，但 `preview`（导出 PNG）会失败（它靠 PowerPoint COM 出图）。
3. **`.venv` 不进包**：整合包只有几百 KB，依赖靠 `install.ps1` 在目标机现装（首次 1–2 分钟）。
4. **中文文字**：AutoCAD 里要正常显示中文，文字样式得用 SHX 大字体（`gbenor.shx` + `gbcbig.shx`）；直接用宋体 TTF 会渲染成 `?`。技能文档里写了这条。
5. **PPT 预览的坑**：带图片的 pptx 用 `WithWindow=False` 打不开（PowerPoint 16 的行为），技能里已自动退到带窗口导出——预览时 PowerPoint 窗口会闪一下。
6. **导入会覆盖同名文件**：整合包往 `skills/<同名>` 里写文件，如果你本地已有 `autocad-draw` 或 `pptx-editor`，导入前先备份。

---

## 导入报错怎么办

| 报错 | 原因 / 处理 |
|---|---|
| `安装 dsh 0.1.5-rc.2 失败 → 无法获取 dsh 最新版本号，请检查网络后重试`（堆栈含 `WinDshInstallRun`） | 启动器在联网解析 dsh 版本号（要访问 `api.github.com` / `registry.npmjs.org`）时失败。**本包从 1.0.1 起把 `manifest.json` 的 `dshVersion` 置空**，不再触发"自动安装指定版本 dsh"。若仍报错，说明它还要联网装 profile 依赖：把 dsh 上游 / npm 源换成国内镜像（如 `https://registry.npmmirror.com`）后重试，或直接用下面的手动安装 |
| `已存在名为「cad-ppt-skills」的实例` | 上次导入失败留下的残留实例：到 **实例 → 总览** 先删掉它再重试 |
| 双击 / 直接 `.\install.ps1` 报"禁止运行脚本" | 用 `powershell -ExecutionPolicy Bypass -File .\install.ps1` |
| `doctor` 里 AutoCAD / PowerPoint 项失败 | 没装对应软件，或软件没开着。AutoCAD 必须先手动打开 |

## 目录结构

```
manifest.json              # 清单 v5（type=profile）
dspack.json                # {"format":"dspack","version":3}
package.json               # profile 定义（bundles: dsh-base + dsh-web-app）
pnpm-workspace.yaml
pnpm-lock.yaml
overrides/.dshpkcfg        # 导出信息（includeSkills: true）
overrides/cordis.patch.yml
home/skills/autocad-draw/  # 技能本体（含 install.ps1、SKILL.md、代码）
home/skills/pptx-editor/
```

## 版本

- 整合包版本：1.1.0
- 作者：涟崎桦
- 许可：MIT（见 `LICENSE`）
- DSH 版本要求：**不声明**（`manifest.json` 的 `dshVersion` 置空）—— 用导入方现有环境，
  避免启动器联网解析 dsh 版本号失败卡住导入。原因见上面「导入报错怎么办」第一行。

## 出处与许可

两个技能都是从实际项目里长出来的：`autocad-draw` 由一份 Word 版 skill 说明书还原并修掉 4 处致命缺陷；
`pptx-editor` 由另一份说明书还原并重做，主题/版式引擎是本项目新增。技能文档里保留了这些来历与踩坑记录，
方便后来者少走弯路。
