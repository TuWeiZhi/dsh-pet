# patches/ —— 本 fork 相对上游 dsh-pet 0.3.8 的逐条差异

这里放的是**构建产物级的 patch**（`lib/`、`runtime/`、`assets/config.jsonc`），不是上游 TypeScript 源码的 patch：本 fork 不发构建链，改动就是在打包结果上做的（原因见 [`../NOTICE.md`](../NOTICE.md) §2）。

每个 patch 只对应上游 tarball 里的**同一个文件**，路径按包根目录（`-p1` 可直用）。

## 清单

| patch | 目标文件 | 行数 | 改了什么 |
|---|---|---|---|
| `01-assets-config-jsonc.patch` | `assets/config.jsonc` | +31 / −11 | 出厂默认配置：新增 `whisperLines` / `whisperBubbleSec` / `whisperTextScale`，`eventsRefreshSec` 增 `action`，`whisperModel` 标停用、`whisperPrompt` 注释改为"仅对话用" |
| `02-lib-index-js.patch` | `lib/index.js` | +215 / −39 | 宿主半侧：碎碎念改全本地语句池（`WHISPER_LINES_BUILTIN` / `pickWhisperLine` / `publishWhisper`）、按概率出图（`WHISPER_IMAGE_CHANCE`）、`POST /whisper?text=`、新校验器与 `GLOBAL_DEFAULT_KEYS`、调度去掉 `ctx.standaloneAi` 依赖 |
| `03-lib-client-js.patch` | `lib/client.js` | +436 / −39 | 浏览器半侧：可点击收起的气泡、停留时长/文字倍率、动作间隔（`eventsRefreshSec.action`）、`clampPetBox` 全面夹框、`sideAllow` 边距扣减、设置页两张新卡片与全部中英文案 |
| `04-runtime-shared-core-js.patch` | `runtime/electron-helper/shared-core.js` | +6 / −2 | 桌面模式：`anchorPixel` 按 `sideAllow` 扣掉画布左右透明留白，边距只算角色本体 |
| `05-runtime-sprite-js.patch` | `runtime/electron-helper/sprite.js` | +3 / −0 | 桌面模式：把 `sideAllow` 一路传给 `anchorPixel` |

## 怎么用

```sh
# 以上游 0.3.8 的 tarball 为基准，在包根目录重放全部改动
npm pack dsh-pet@0.3.8 --pack-destination /tmp
mkdir -p /tmp/up && tar -xzf /tmp/dsh-pet-0.3.8.tgz -C /tmp/up
cd /tmp/up/package
git init -q . && git add -A && git commit -qm base

for p in /path/to/dsh-pet/patches/*.patch; do git apply -p1 "$p" || echo "冲突：$p"; done
```

只重放某一个文件也可以：`git apply -p1 patches/03-lib-client-js.patch`。

## 与上游同步时的锚点

上游若在这些函数里也做了改动，patch 会冲突，按下面的锚点手工合并（都是本 fork 动过的位置）：

- `lib/index.js`
  - `automaticWhisperSchedule(petEnabled, configuredPeriodSec)` —— 旧签名是 `(policy, petEnabled, configuredPeriodSec)`
  - `publishWhisper(petId, forcedText)` —— 旧的 `whisperTick` 里 `await generateWhisper(...)` 那一段被替换
  - `GLOBAL_DEFAULT_KEYS`、`topFieldValid`、`eventsRefreshSecValid`、`saveUserConfig`
  - 路由处理里的 `POST /whisper`（新增 `?text=` 分支）与 `schedule` 构造处
  - 常量 `WHISPER_IMAGE_CHANCE`、`whisperMeme()`、`WHISPER_LINES_BUILTIN`、`pickWhisperLine()`
- `lib/client.js`
  - `flattenConfigPets`（多带 `whisperBubbleSec` / `whisperTextScale`）
  - `whisperBubbleView` / `bubbleCss` / `makeWhisperBubble`（`onDismiss`、`is-clickable`、`--dsh-pet-whisper-scale`）
  - `throwBounds` / `clampPetBox` / `startThrow` / 拖拽 pointermove & pointerup / `customPos` 渲染
  - `PetCard` 的 `triggerWhisper`（停留 0 的处理）与 `pickNext`（动作间隔）、`PetMulti` 的 `dismissTip` 透传
  - `makePetConfigSection` 的两张新卡片（「自动行为间隔」「碎碎念：语句池与气泡」）与 `zh` / `en` 文案表
- `runtime/electron-helper/shared-core.js`：`anchorPixel` 里 `const left = a.x + o.marginX` 那几行
- `runtime/electron-helper/sprite.js`：调用 `anchorPixel` 时补 `sideAllow`

改完跑 `npm run verify` —— 它会检查 fork 改动标记（`WHISPER_LINES_BUILTIN`、`dsh-pet-whisper-scale`、`sideAllow` 等）是否还在，防止上游同名文件被整份覆盖回去而不自知。

## 重新生成 patch

```sh
# a/ = 上游解包目录，b/ = 本仓库；逐个文件对比
git -c core.autocrlf=false diff --no-index --no-prefix -- a/lib/index.js b/lib/index.js > patches/02-lib-index-js.patch
```

`--no-prefix` 让 patch 头保持 `--- a/lib/index.js` / `+++ b/lib/index.js`，正好是 `-p1` 的形态。
