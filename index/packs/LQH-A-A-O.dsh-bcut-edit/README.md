# bcut-edit —— 用代码剪辑视频（必剪 + ffmpeg）

给 DSH 用的技能包。**直接读写必剪(Bcut)的草稿工程**，也**能绕过必剪用 ffmpeg 直接出片** ——
同一份「剪辑方案」喂两个后端。

作者：涟崎桦 · MIT

---

## 它能干什么

| 后端 | 命令 | 特点 |
|---|---|---|
| **必剪草稿** | `bcut.py build plan.json` | 生成一个必剪工程，你在必剪里看效果、微调、导出。**转场是必剪原版效果** |
| **ffmpeg 直出** | `bcut.py render plan.json -o out.mp4` | 全自动出片，不需要开必剪。转场用 ffmpeg 的 xfade |

能做的：多轨道拼接、精确裁剪、转场、字幕（含中文）、配 BGM / 音效、图片推拉摇、
片头片尾卡、变速、逐段调音量。

---

## 环境要求

| | |
|---|---|
| 系统 | Windows（技能依赖必剪和 Windows 字体/注册表） |
| **必剪** | 已安装，**3.10.x**（草稿格式是逆向出来的，版本差太多可能要重抽模板） |
| Python | 3.9+（用 DSH 自带的那个就行） |
| 第三方库 | `requests`、`Pillow`、`numpy`（`pip install requests pillow numpy`） |
| ffmpeg | **完整版**（要有 libx264 + libass + 图片解码器）。技能自带 `get_ffmpeg.py` 一键下载（约 190MB） |

### 装 ffmpeg

```cmd
python <技能目录>\get_ffmpeg.py
```

下到 `<技能目录>\bin\`，技能会自动找到它。也可以用环境变量指向现成的：

```cmd
set BCUT_FFMPEG=D:\ffmpeg\bin\ffmpeg.exe
```

> ⚠️ **录屏软件自带的 ffmpeg 通常不够用**：常见缺 `libx264`、缺 `subtitles`/`drawtext` 滤镜，
> 有的连 `png`/`jpeg` **解码器**都砍了 —— 结果是"能跑但剪不了图、烧不了字幕"。
> 跑 `bcut.py doctor` 会把实际能力探测出来，别猜。

---

## 安装

### 方式一：导入 .dspack（推荐）

DSH 里导入 `dsh-bcut-edit-1.0.0.dspack`，技能会自动落到 `DSH_HOME\skills\bcut-edit\`。

### 方式二：手动

把 `home\skills\bcut-edit\` 整个目录拷到 `DSH_HOME\skills\` 下即可（`SKILL.md` 必须在这一层）。

装完先跑一次体检：

```cmd
python "%DSH_HOME%\skills\bcut-edit\bcut.py" doctor
```

它会报告：必剪装在哪、草稿目录、素材库、ffmpeg 能力、本机装了哪些转场。
**有 ❌ 就先解决它，别急着剪。**

---

## 快速上手

```cmd
set S=%DSH_HOME%\skills\bcut-edit

python "%S%\bcut.py" doctor            :: 体检（先跑这个）
python "%S%\bcut.py" drafts            :: 列出必剪里现有的草稿
python "%S%\bcut.py" show <GUID>       :: 打印某草稿的骨架（不开必剪也能看清）
python "%S%\bcut.py" transitions       :: 本机装了哪些转场
python "%S%\bcut.py" builtins          :: 内置素材（片头/片尾/黑场）
python "%S%\bcut.py" probe D:\a.mp4    :: 探测素材时长/分辨率/帧率

python "%S%\bcut.py" demo -o plan.json :: 生成一份示例方案，照着改
python "%S%\bcut.py" check  plan.json
python "%S%\bcut.py" build  plan.json  :: → 必剪草稿
python "%S%\bcut.py" render plan.json -o out.mp4 --gpu
```

### 在代码里用

```python
import sys; sys.path.insert(0, r'<技能目录>')
import bcut_draft as bd, edit_plan as ep

# A) 直接搭时间线
tl = bd.Timeline(1920, 1080, 30)
tl.add_clip(r'D:\素材\a.mp4', trim_in=1000, trim_out=5000)   # 截 1~5 秒
tl.add_clip(r'D:\素材\b.mp4')                                 # 接在后面
tl.add_transition(1, '折叠翻页', 800)                         # 片段 0/1 之间
tl.add_caption('第一句话', 0, 2000, y=-0.76)
tl.add_audio(r'D:\音乐\bgm.mp3', volume_db=-6, fade_out=2000)
guid = tl.save('我的片子')                                     # 必剪里就能看到

# B) 走方案（两条后端共用）
plan = ep.load(r'plan.json')
ep.to_bcut(plan)                                              # 生成必剪草稿
ep.to_mp4(plan, r'out.mp4', gpu=True)                          # 或直接出片
```

### 方案（plan）格式

时间一律毫秒。

```json
{
  "name": "片子名",
  "width": 1920, "height": 1080, "fps": 30,
  "keep_original_audio": true, "original_volume_db": -3,
  "subtitle_size": 54,
  "clips": [
    {"path": "D:/素材/a.mp4", "trim_in": 0, "trim_out": 3000, "gain_db": -14},
    {"path": "D:/素材/封面.png", "kind": "image", "duration_ms": 4000, "motion": "zoom_in"},
    {"path": "D:/素材/b.mp4", "transition": {"name": "折叠翻页", "xffade": "wipeleft", "dur": 800}}
  ],
  "captions": [{"text": "第一句", "start": 0, "end": 2000, "x": 0.0, "y": -0.76}],
  "audio": [{"path": "D:/音乐/bgm.mp3", "start": 0, "volume_db": -6, "fade_out": 3000}]
}
```

- `motion`：`none` / `zoom_in` / `zoom_out` / `pan_left` / `pan_right`（**只对 ffmpeg 直出生效**，
  必剪草稿里图片是静止的）
- `transaction.name`：必剪的转场名（`bcut.py transitions` 看有哪些）
- `captions` 的 `x`/`y` 是相对画面中心的位移（-1..1），`y=-0.76` ≈ 画面下方
- 第一段的 `transition` 会被忽略（前面没东西可转）
- 方案的时间轴 = **观众看到的时间轴**（转场处两段重叠、总时长被压缩）。
  生成必剪草稿时会自动换算成必剪的"首尾相接"时间轴，不用你操心

---

## 要知道的现实

**1. 必剪没有命令行、没有 API。** 它是 Qt 应用。
所以"生成工程"能全自动，**"点导出"那一下要么人手点，要么用 GUI 自动化去点**（脆弱，只当兜底）。

**2. 必剪的工程就是明文 JSON。**

```
C:\Users\<你>\Documents\Bcut Drafts\<GUID>\<时分秒-毫秒>--{uuid}.bjson
```

无加密无压缩。必剪每 15 秒自动存一份快照。**"必剪有没有真的接收这个工程"有个零成本判据：
看快照数有没有变多。**

**3. 必剪加载外来工程后会做两件事**（实测）：
在 `videoTracks[0]` 插一条空轨把内容挪到轨道 1；以及每 15 秒自动存快照。

**4. 转场素材是"用过才有"。** 必剪只把你在界面里用过的转场下到本地。
所以 `bcut.py transitions` 显示"已装 = 否"的那些是**本机没有**，用之前先去必剪里手动用一次。
内置素材（片头/片尾/黑场）同理。

**5. 安全约定。** 本工具 `save()` **永远新建一个 GUID 文件夹**，绝不改动你已有的草稿。
自己创建的草稿会写 `.dsh-created` 标记，只有带标记的才允许被覆盖。

---

## 排错

| 症状 | 原因 / 解法 |
|---|---|
| `Decoder (codec png) not found` | 用的是精简版 ffmpeg，装完整版：`python get_ffmpeg.py` |
| 没有可用的 H.264 编码器 | 同上 |
| 转场加不上 / 「本机没装」 | 必剪里手动用过一次那个转场，它才会下到本地 |
| 内置素材「片头/片尾」不在本机 | 同上，先在必剪里用一次 |
| 生成的草稿在必剪里看不到 | 检查 `draftInfo.json` 里有没有这条记录 |
| 必剪里片段显示"素材丢失" | `sourcePath` 是绝对路径，素材移动过就会丢 |
| 转场被换成了别的 | 转场对象里 `assetInfo` 和顶层字段必须一致，必剪**认 assetInfo**。别只改顶层 |
| 生成的草稿打开是空的 | 必剪版本变了。对照一份手改过的草稿重抽模板 |
| 字幕时间整体错位 | 两条后端时间轴不一样（ffmpeg 压缩 / 必剪不压缩），必须走 `edit_plan` 的时间映射 |

---

## 文件

```
bcut.py            命令行入口
bcut_draft.py      草稿读写：Timeline / list_drafts / load / summarize / probe
ffmpeg_edit.py     ffmpeg 底座：cut / concat / xfade_concat / make_still / 字幕 / 混音 / render_plan
edit_plan.py       方案 schema + check + to_bcut / to_mp4 + 时间轴映射
env_paths.py       路径发现（必剪安装目录 / 草稿目录 / 素材库 / ffmpeg）
selftest.py        自检（在临时沙箱里跑，不碰你的真实草稿）
get_ffmpeg.py      下载完整版 ffmpeg
templates/         从真实草稿抽出来的原型对象（片段/转场/字幕/音频/素材表项/画布配置）
catalog/           transitions.json（转场目录）、builtin_materials.json（片头/片尾/黑场）
```

`templates/` 和 `catalog/` 里的本机路径是**占位符**（`__LOCAL_RES__` / `__BCUT_FONT__` /
`__CACHE_COVER__`），运行时由 `env_paths` 还原。想加别的转场/内置素材，
在必剪里用一次，然后把对应的 json 加进 `catalog/`。

---

## 授权

MIT。必剪是哔哩哔哩的产品，本技能只是读写它自己的工程文件，不含必剪的任何代码或素材。
