# NOTICE —— 来源、许可与本 fork 的改动范围

## 1. 这个仓库是什么

本仓库（`TuWeiZhi/dsh-pet`，npm 包名 `@tuweizhi/dsh-pet`）是

> **上游：[`PC2005-cloud/dsh-pet`](https://github.com/PC2005-cloud/dsh-pet) v0.3.8**

的**增强 fork**。上游是 MIT 许可，本 fork **沿用 MIT**，完整许可全文见 [`LICENSE`](LICENSE)（与上游一致）。

- 上游作者与版权：`Copyright (c) 2025 PC2005-cloud`（及 README 中列出的贡献者）
- 本 fork 追加的改动：`Copyright (c) 2026 TuWeiZhi`
- 素材（`assets/webm` 全部动画、`assets/memes`、`assets/fonts`、`assets/pic`、`assets/logo.png`）来自上游，版权归上游作者；本 fork 未重新制作，也未改变其许可。

包名与仓库地址：

| | 上游 | 本 fork |
|---|---|---|
| npm 包名 | `dsh-pet` | `@tuweizhi/dsh-pet` |
| 仓库 | `github.com/PC2005-cloud/dsh-pet` | `github.com/TuWeiZhi/dsh-pet` |
| 版本基线 | `0.3.8` | `0.4.0`（从 0.3.8 起算） |
| 配置树 entry id | `dsh-pet` | `dsh-pet`（**故意同上**，见 §4） |
| 用户数据目录 | `$DSH_HOME/dsh-pet` | `$DSH_HOME/dsh-pet`（**同上**，宠物状态原样复用） |
| HTTP 路由前缀 | `/dsh-pet-7340` | `/dsh-pet-7340`（**同上**，前端/独立模式都按这个前缀找宿主） |

两个包可以同时存在于 npm 上、互不覆盖；但**同时装进同一个 profile 会抢同一个挂载行**，二选一。

## 2. 发布的是"构建产物快照"，不是上游构建链

本 fork 的改动落在**打包后的运行时代码**里，而不是上游的 TypeScript 源码：

```
lib/index.js                      宿主半侧（Cordis 插件）
lib/client.js                     浏览器半侧（overlay 宠物 UI + 设置页）
lib/standalone.js                 独立模式 CLI（把宿主半边跑在伪 ctx 上）
runtime/electron-helper/*.js      桌面模式（透明置顶窗）的 Electron 辅助进程
assets/config.jsonc               出厂默认配置
```

`src/` 里躺的是**上游 v0.3.8 的 TypeScript 原文**，随包/随仓库发布只为对照与将来移植之用；**改 `src/` 不会自动生效**，也不会重新构建 `lib/`（本 fork 不携带上游的构建链与素材生成链）。`src/FORK-NOTE.md` 说明，唯一的权威改动清单就是 [`patches/`](patches/) 与 [`CHANGELOG.md`](CHANGELOG.md)。

## 3. 相对上游 0.3.8 改动到的文件（共 6 个）

| 文件 | 行数变化 | patch |
|---|---|---|
| `lib/index.js` | +215 / −39 | [`patches/02-lib-index-js.patch`](patches/02-lib-index-js.patch) |
| `lib/client.js` | +436 / −39 | [`patches/03-lib-client-js.patch`](patches/03-lib-client-js.patch) |
| `runtime/electron-helper/shared-core.js` | +6 / −2 | [`patches/04-runtime-shared-core-js.patch`](patches/04-runtime-shared-core-js.patch) |
| `runtime/electron-helper/sprite.js` | +3 / −0 | [`patches/05-runtime-sprite-js.patch`](patches/05-runtime-sprite-js.patch) |
| `assets/config.jsonc` | +31 / −11 | [`patches/01-assets-config-jsonc.patch`](patches/01-assets-config-jsonc.patch) |
| `README.md` / `package.json` / `cordis.patch.yml` | — | 文档与清单改写，不入 patch（见 §1、§4） |

除此之外的 `lib/`、`runtime/`、`assets/webm`、`src/` 与上游 0.3.8 **逐字节相同**。

## 4. 为什么 entry id 仍是 `dsh-pet`

`cordis.patch.yml` 里 `id: dsh-pet`（不带作用域），`name: '@tuweizhi/dsh-pet'`。原因：

1. 插件内部常量沿用了上游（`PET_CALL_IDENTITY`、`ROUTE_PREFIX = "/dsh-pet-7340"`、`join(dshHome, "dsh-pet")`），换包名**不影响**已有宠物状态、`main-config.jsonc`、`memory.json` 的读取；
2. entry id 与上游一致 → 用本 fork 替换上游安装时对齐的是同一行，配置树里不会多出一行重复挂载；
3. 与同作者的 `@tuweizhi/dsh-translator` 写法一致（id 裸名 + name 作用域名）。

> ⚠️ 若将来要提交到 DSH STORE，商城预检要求 entry id 与**包名逐字一致**，届时须改成 `id: '@tuweizhi/dsh-pet'` 并重跑预检。

## 5. 如何与上游同步

```sh
# 1) 拿上游新版（例：0.3.9）
npm pack dsh-pet@0.3.9 --pack-destination .
mkdir -p /tmp/up && tar -xzf dsh-pet-0.3.9.tgz -C /tmp/up

# 2) 比对：patch 只覆盖上面那 5 个文件
diff -u /tmp/up/package/lib/index.js lib/index.js

# 3) 上游若改了同一批函数，按 patches/ 里的 hunk 手工重放
#    重点看这几处锚点（都在 patches/README.md 里列了）：
#      lib/index.js   : automaticWhisperSchedule / publishWhisper / GLOBAL_DEFAULT_KEYS / 校验器
#      lib/client.js  : flattenConfigPets / whisperBubbleView / bubbleCss / triggerWhisper / clampPetBox / 设置页
#      shared-core.js : anchorPixel 的 marginX 扣减
```

同步后务必跑一遍自检：

```sh
npm run verify        # = node tools/verify-package.mjs
```

它会检查包结构、清单字段、entry 行写法、**`assets/config.jsonc` 是否仍是出厂默认值**、fork 改动标记是否还在（防上游同名文件覆盖回去）、以及有没有把本机路径/账号/令牌带进仓库。

## 6. 反馈

- 本 fork 的改动有问题：提到 [`TuWeiZhi/dsh-pet` issues](https://github.com/TuWeiZhi/dsh-pet/issues)
- 宠物/动画/上游功能本身的问题：请到上游 [`PC2005-cloud/dsh-pet`](https://github.com/PC2005-cloud/dsh-pet) 反馈
