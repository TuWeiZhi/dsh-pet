# Changelog

本 fork 从上游 [`PC2005-cloud/dsh-pet`](https://github.com/PC2005-cloud/dsh-pet) **v0.3.8** 起算，版本号按本仓库自己的节奏走（首个版本 `0.4.0`）。上游的版本历史见上游仓库。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

---

## [0.4.1] —— 修复：client bundle 的模块 id 与包名不一致导致装不上

一句话：**0.4.0 在 DSH 0.2.1-rc.3 上装完报 `could not load "@tuweizhi/dsh-pet"`，这个版本修掉了。**

### 修复 · client 半侧注册 id 改为包名

- `lib/client.js` 里 `window.__ModuleLoader__.load({ id })` 从上游留下的 `"dsh-pet"` 改为 `"@tuweizhi/dsh-pet"`（`src/client/index.ts` 同步）。
- 原因：DSH 的 **client-modules 用包名当模块 id** 去 `graphRows` / `factories` 里查 factory，查不到就抛
  `could not load "@tuweizhi/dsh-pet": bundle ... loaded without registering "@tuweizhi/dsh-pet" via __ModuleLoader__.load`。
  0.4.0 改了包名却没跟着改注册 id，于是**宿主侧正常、界面侧整个插件加载失败**（宠物不出现）。
- 影响面：仅客户端模块注册名。**数据目录 `$DSH_HOME/dsh-pet`、路由 `/dsh-pet-7340`、cordis entry id `dsh-pet`、locale 命名空间都没动**，已装的配置与状态照旧。
- 自检补闸：`tools/verify-package.mjs` 新增第 5b 项——`lib/client.js` 注册的 id 必须与 `package.json` 的 `name` **逐字一致**，不一致直接拦住发布。

### 升级

```bash
dsh plugin add @tuweizhi/dsh-pet@0.4.1
```

装完刷新界面即可（无需清数据）。

---

## [0.4.0] —— 首个 fork 版本（基线：上游 dsh-pet 0.3.8）

一句话：**碎碎念彻底本地化（一个模型都不调）、气泡能点掉且能调大小停留、随机动作之间能留白、宠物再也不会被拖出屏幕**。

### 新增 · 碎碎念改为全本地语句池（零请求、零 token）

- 设置页新增「**碎碎念：语句池与气泡**」卡片：一个大文本框维护语句池，**一行一条**，空行不算数据，单行 ≤ 2000 字；卡片里实时显示「共 N 条」。
- 语句池留空时用**插件内置的 40 句保底**（`WHISPER_LINES_BUILTIN`，同样纯本地，不联网）。
- 到点从池子里**随机抽一句**，并**避开紧邻的上一句**（`pickWhisperLine` 按宠物记 `lastWhisperLine`），避免连着说同一句。
- 配图改为**按概率出图**：`whisperImageEnabled` 打开时约 **50%** 概率（`WHISPER_IMAGE_CHANCE = 0.5`）从本地 `memes` 池抽一张随文字一起显示；没抽中就是纯文字。图片与描述都是本地文件，**不再进任何请求**。
- 卡片里自带两个试播按钮：
  - 「**随机试一条**」——就地抽一句显示在卡片里（字号跟着「文字倍率」走，预览即所见）；
  - 「**让宠物说这句**」——`POST /dsh-pet-7340/whisper?...&text=<句子>`，屏幕上的宠物立刻说这句。
- 宿主侧 `POST /whisper` 支持 `?text=` 直接指定句子（≤ 200 字，超长返回 `{ok:false, reason:"text-too-long"}`）。
- **不再依赖"当前对话是否配了模型"**：`automaticWhisperSchedule(petEnabled, configuredPeriodSec)` 去掉了 `ctx.standaloneAi` 参数，以前"没配模型 → 碎碎念静默不跑"的情况不复存在。
- 旧的模型生成路径（`generateWhisper`）标记为**已停用**保留（不再被调用），`whisperModel` 配置项保留兼容但设置页不再展示/上报。
- 设置页文案同步改写：`whisperEnabledHint`、`whisperImageToggleHint`、`modelHint` 都明确说明"碎碎念不调模型、token 为 0"。

### 新增 · 碎碎念气泡：可点击收起、停留时长与文字倍率可调

- **点一下就收起**：碎碎念气泡与工作状态气泡加上 `is-clickable` + `onClick` + `title="点一下收起"`（`bubbleDismissTip`），点击只收气泡、不打断正在播的动画；不传 `onDismiss` 时气泡保持 `pointer-events:none` 穿透，不挡拖拽热区。
- **气泡停留时长** `whisperBubbleSec`（秒，默认 `10`，范围 `0–600`）：`0` = **不自动消失**，留到下一句碎碎念或被别的气泡/手动清掉。
- **文字倍率** `whisperTextScale`（默认 `1.35`，范围 `0.8–3`）：只放大文字（同时带动内边距/圆角/尾巴/宽度上限），配图尺寸单独压在原来的量级（`.pet-bub-img { --m: calc(var(--f0)*0.9) }`）。碎碎念气泡还加了 `font-weight:600` 与更深字色 `#1f1f1f`，短句一眼看清。
- 两个参数都写进 CSS 变量（`--dsh-pet-whisper-scale` / 停留毫秒），客户端再夹一次范围，宿主漏校验或手改配置文件写歪也不会把气泡撑爆。

### 新增 · 自动行为间隔：随机动作之间可以留白

- `eventsRefreshSec` 新增 `action`（秒，默认 `0`）：每个随机动作播完后先播待机、歇这么久再抽下一个动作。`0` = 不歇（旧行为），填 `20` 就是"动一下、歇 20 秒"。
- 设置页新增「**自动行为间隔**」卡片，可调碎碎念间隔（`≥60` 秒，默认 `300`）与动作间隔（`≥0`，默认 `0`）；`balance` 值原样读入回写，不会被"整段替换"字段冲掉。
- 校验口径统一：`eventsRefreshSec` 里 `action` 允许 `>= 0`，其余键仍要求 `> 0`。

### 修复 · 宠物再也不出屏幕

- 新增 `clampPetBox()`：拖拽跟随、甩抛起点、松手落点、**存档坐标渲染**全部经过它夹进视口——历史版本写进配置的越界坐标也会在渲染时被夹回来。
- 拖到边界时把该轴速度**清零**（手感是"顶住了"而不是弹回来），甩抛起点先夹再算轨迹（不会一抛就从屏外飞进来）。
- 边距只算**角色本体**：`HIT_BOX` 两侧的透明留白允许贴到屏幕边缘外（浏览器侧 `--dsh-pet-sl/--dsh-pet-sr` 从 `margin` 里扣掉；桌面侧 `anchorPixel` 按 `sideAllow` 扣减），`marginX = 0` 时角色真的贴边，而不是差半个身位。

### 新增 · 默认配置项（`assets/config.jsonc` 仍为出厂默认值）

```jsonc
"whisperLines": [],          // 本地语句池（一行一条）；空 = 用内置 40 句保底
"whisperBubbleSec": 10,      // 气泡停留秒数；0 = 不自动消失
"whisperTextScale": 1.35,    // 文字倍率（0.8–3）
"whisperImageEnabled": true, // 配图：约一半概率出图，不再消耗 token
"eventsRefreshSec": { "balance": 1800, "whisper": 300, "action": 0 }
```

`whisperModel` 保留原字段（`{"provider":"","model":""}`）但已停用；`whisperPrompt` 注释改为"仅对话用"。

### 兼容性与迁移

- **无需迁移**：不改包内路由前缀（`/dsh-pet-7340`）、不改用户数据目录（`$DSH_HOME/dsh-pet`），已有 `main-config.jsonc` / `memory.json` 原样读取；旧配置里没有新键时按上面的默认值走。
- 以前配了 `whisperModel` 的用户：该字段不再被读取，碎碎念改由本地语句池提供，设置页也不再显示这个下拉框（值仍留在文件里，可手动删）。
- 以前依赖"AI 按人设现编句子"的用法：请把人设里希望的句子写进语句池，或直接在对话里聊（对话仍走模型）。
- entry id 仍为 `dsh-pet`（与上游一致，替换安装不会多出一行）；包名变为 `@tuweizhi/dsh-pet`，可与上游并存于 npm，但同一 profile 二选一，详见 [NOTICE.md](NOTICE.md) §4。

### 本版本改动到的文件

`lib/index.js`、`lib/client.js`、`runtime/electron-helper/shared-core.js`、`runtime/electron-helper/sprite.js`、`assets/config.jsonc`（逐条 diff 见 [`patches/`](patches/)）。
