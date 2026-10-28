#!/usr/bin/env node
// ============================================================================
// @tuweizhi/dsh-pet 发版自检（scripts/verify、scripts/check、prepublishOnly）
// ============================================================================
//
// 【为什么需要它】
//   本 fork 发布的是"构建产物快照"：lib/ 与 runtime/ 是被改过的打包结果，
//   没有可重跑的上游构建链。发版前能自动兜住的退化只有几类硬事实检查：
//     1) 包结构完整（入口、图标、语言资源、patch、许可与变更记录都在）
//     2) package.json 的清单字段自洽（包名、图标、files、peer、publishConfig）
//     3) cordis.patch.yml 的挂载行没被写坏（id 行不带行尾注释、name 指向本包）
//     4) assets/config.jsonc 仍是"出厂默认值"——绝不把用户改过的配置带上天
//     5) 本 fork 的改动标记还在（防止误用上游 0.3.8 同名文件覆盖回去）
//     6) 包里没有本机路径、账号、令牌等私密内容混入
//
// 【怎么跑】
//   npm run verify        （= npm run check = prepublishOnly）
//   退出码 0 通过，1 有失败项；输出 ✗ 行即为失败原因
//
// 【它不做什么】
//   不做类型检查、不跑构建、不联网、不改任何文件。纯只读体检。
// ============================================================================

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

const fail = (msg) => failures.push(msg);
const ok = (msg) => notes.push(msg);
const abs = (rel) => join(ROOT, rel);
const rel2 = (rel) => rel.split('\\').join('/');

// ---------------------------------------------------------------- 1. 包结构
const REQUIRED_FILES = [
  'package.json',
  'cordis.patch.yml',
  'README.md',
  'NOTICE.md',
  'CHANGELOG.md',
  'LICENSE',
  'assets/logo.png',
  'assets/config.jsonc',
  'lib/index.js',
  'lib/client.js',
  'lib/standalone.js',
  'lib/types/index.d.ts',
  'lib/types/client/index.d.ts',
  'runtime/electron-helper/shared-core.js',
  'runtime/electron-helper/sprite.js',
  'scripts/ensure-electron.mjs',
];
const REQUIRED_DIRS = ['assets/webm', 'assets/memes', 'assets/fonts', 'assets/pic'];

for (const rel of REQUIRED_FILES) {
  if (!existsSync(abs(rel))) fail(`缺少必需文件：${rel}`);
}
for (const rel of REQUIRED_DIRS) {
  if (!existsSync(abs(rel)) || !statSync(abs(rel)).isDirectory()) fail(`缺少必需目录：${rel}/`);
}

// 用户数据绝不能出现在仓库/包里
const FORBIDDEN_PATHS = ['main-config.jsonc', 'memory.json', 'node_modules', '.env', 'dsh-pet.log'];
for (const rel of FORBIDDEN_PATHS) {
  if (existsSync(abs(rel))) fail(`不该出现的文件/目录：${rel}（用户数据或依赖或机密）`);
}

// ------------------------------------------------------- 2. package.json 清单
let pkg = null;
try {
  pkg = JSON.parse(readFileSync(abs('package.json'), 'utf8'));
} catch (err) {
  fail(`package.json 解析失败：${err.message}`);
}

if (pkg) {
  if (pkg.name !== '@tuweizhi/dsh-pet') fail(`包名应为 @tuweizhi/dsh-pet，实际 ${pkg.name}`);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(pkg.version ?? ''))) {
    fail(`version 不是合法 semver：${pkg.version}`);
  }
  if (pkg.type !== 'module') fail('type 应为 module（本包是 ESM）');
  if (pkg.main !== 'lib/index.js') fail(`main 应为 lib/index.js，实际 ${pkg.main}`);
  if (pkg.license !== 'MIT') fail(`license 应为 MIT（上游同许可），实际 ${pkg.license}`);
  if (pkg.publishConfig?.access !== 'public') fail('publishConfig.access 应为 public（作用域包必须显式公开）');

  // 图标：只认 svg/png/jpg/jpeg/webp，≤256 KiB，必须在包目录内
  const icon = pkg.icon;
  if (!icon) fail('缺少 icon 字段（插件管理页图标）');
  else {
    const iconAbs = abs(icon);
    if (!existsSync(iconAbs)) fail(`icon 指向的文件不存在：${icon}`);
    else {
      const size = statSync(iconAbs).size;
      if (!['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(extname(icon).toLowerCase())) {
        fail(`icon 类型不被支持：${icon}`);
      }
      if (size > 256 * 1024) fail(`icon 体积 ${size} B 超过 256 KiB 上限`);
      else ok(`icon ${icon}（${(size / 1024).toFixed(1)} KiB）`);
    }
  }

  // files：白名单必须覆盖真正要发的入口/资源
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  for (const need of ['lib', 'assets/webm', 'assets/config.jsonc', 'cordis.patch.yml', 'NOTICE.md', 'CHANGELOG.md']) {
    if (!files.includes(need)) fail(`files 白名单漏了 ${need}（publish 会缺文件）`);
  }
  for (const bad of ['assets/preview', 'patches', 'tools', '.github']) {
    if (files.includes(bad)) fail(`files 白名单不该包含 ${bad}（展示/开发用，不入包）`);
  }

  // 入口映射
  const exportsMap = pkg.exports ?? {};
  const dotDefault = exportsMap['.']?.default ?? exportsMap['.'];
  if (dotDefault !== './lib/index.js') fail("exports['.'] 应指向 ./lib/index.js");
  if ((exportsMap['./client']?.default ?? exportsMap['./client']) !== './lib/client.js') {
    fail("exports['./client'] 应指向 ./lib/client.js（浏览器半侧入口）");
  }

  // DSH 插件元数据
  if (!pkg.dsh?.bundle?.patch) fail('缺少 dsh.bundle.patch（bundle 挂载声明）');
  else if (!existsSync(abs(pkg.dsh.bundle.patch))) fail(`dsh.bundle.patch 指向的文件不存在：${pkg.dsh.bundle.patch}`);
  if (pkg.dsh?.client?.platform !== 'web') fail('dsh.client.platform 应为 web');
  if (!Array.isArray(pkg.dsh?.client?.inject) || pkg.dsh.client.inject.length === 0) {
    fail('dsh.client.inject 不应为空');
  }

  // bin 文件必须存在且可读
  for (const [binName, binPath] of Object.entries(pkg.bin ?? {})) {
    if (!existsSync(abs(binPath))) fail(`bin ${binName} 指向的文件不存在：${binPath}`);
  }

  // 宿主提供的模块必须留在 peerDependencies，不能进 dependencies
  const peer = Object.keys(pkg.peerDependencies ?? {});
  const deps = Object.keys(pkg.dependencies ?? {});
  const mustBePeer = ['@deepseek-ai/cordis', 'react', 'react-dom'];
  for (const name of mustBePeer) {
    if (!peer.includes(name)) fail(`peerDependencies 漏了 ${name}`);
    if (deps.includes(name)) fail(`${name} 应由宿主提供，不能写进 dependencies`);
  }
}

// ------------------------------------------------------ 3. cordis.patch.yml
if (existsSync(abs('cordis.patch.yml'))) {
  const yml = readFileSync(abs('cordis.patch.yml'), 'utf8');
  const idLine = yml.split(/\r?\n/).find((l) => /^\s*-\s*id:\s*\S/.test(l) || /^\s+id:\s*\S/.test(l));
  if (!idLine) fail('cordis.patch.yml 里找不到 entry id 行');
  else {
    if (!/^\s*-?\s*id:\s*[^\s#]+\s*$/.test(idLine)) {
      fail(`entry id 行不能带行尾注释或缺值（商城预检抓不到）：${idLine.trim()}`);
    }
    if (!/-?\s*id:\s*dsh-pet\s*$/.test(idLine)) {
      fail(`entry id 应为 dsh-pet（与上游配置行对齐），实际：${idLine.trim()}`);
    }
  }
  if (!/name:\s*'@tuweizhi\/dsh-pet'/.test(yml)) {
    fail("cordis.patch.yml 的 name 应为 '@tuweizhi/dsh-pet'（本包入口）");
  }
  if (!/-\s*insert:/.test(yml)) fail('cordis.patch.yml 缺少 insert 段');
}

// ------------------------------------------- 4. 出厂默认配置（config.jsonc）
function stripJsonc(text) {
  let out = '';
  let inStr = false;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') { out += text[i + 1]; i++; continue; }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; quote = c; out += c; continue; }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

if (existsSync(abs('assets/config.jsonc'))) {
  const raw = readFileSync(abs('assets/config.jsonc'), 'utf8');
  let conf = null;
  try {
    conf = JSON.parse(stripJsonc(raw));
  } catch (err) {
    fail(`assets/config.jsonc 解析失败（JSONC 也要能解析）：${err.message}`);
  }
  if (conf) {
    const eq = (label, actual, expected) => {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      if (a !== e) fail(`默认配置 ${label} 应为 ${e}，实际 ${a}`);
    };
    eq('whisperLines', conf.whisperLines, []);
    eq('whisperBubbleSec', conf.whisperBubbleSec, 10);
    eq('whisperTextScale', conf.whisperTextScale, 1.35);
    eq('whisperImageEnabled', conf.whisperImageEnabled, true);
    eq('eventsRefreshSec', conf.eventsRefreshSec, { balance: 1800, whisper: 300, action: 0 });
    eq('chatMemoryRounds', conf.chatMemoryRounds, 5);
    eq('whisperModel', conf.whisperModel, { provider: '', model: '' });
    eq('chatModel', conf.chatModel, { provider: '', model: '' });
    if (!Array.isArray(conf.pets) || conf.pets.length === 0) fail('默认配置 pets 应为非空数组');
    if (typeof conf.physics !== 'object' || conf.physics === null) fail('默认配置缺少 physics 段');

    // 配置里不许带本机路径/账号（占位写法如 C:\Users\<你>、%USERPROFILE% 不算）
    const LOCAL_PATH_PATTERNS = [
      ['Windows 本机路径', /[A-Za-z]:\\+Users\\+(?!<|%|\$|\{)/i],
      ['用户主目录路径', /\/(?:home|Users)\/(?!<|%|\$|\{)[^\s"']+/],
    ];
    for (const [label, pattern] of LOCAL_PATH_PATTERNS) {
      if (pattern.test(raw)) fail(`assets/config.jsonc 里混入了${label}，请清成默认值`);
    }
  }
}

// -------------------------------------- 5. 本 fork 的改动标记（防上游覆盖）
const FORK_MARKERS = [
  ['lib/index.js', ['WHISPER_LINES_BUILTIN', 'pickWhisperLine', 'whisperLinesValid', 'text-too-long', 'whisperImageEnabled']],
  ['lib/client.js', ['whisperBubbleSec', 'dsh-pet-whisper-scale', 'sideAllow', 'bubbleDismissTip', 'invalidWhisperPool']],
  ['runtime/electron-helper/shared-core.js', ['sideAllow']],
  ['runtime/electron-helper/sprite.js', ['sideAllow']],
];
for (const [rel, markers] of FORK_MARKERS) {
  if (!existsSync(abs(rel))) continue;
  const text = readFileSync(abs(rel), 'utf8');
  for (const marker of markers) {
    if (!text.includes(marker)) fail(`${rel} 里找不到 fork 改动标记 ${marker}（是否被上游同名文件覆盖？）`);
  }
}

// ------------------------------------------------- 6. 私密内容扫描（文本件）
//
// 分两组：
//   A. 令牌/密钥：任何文件都不许有（src/ 也照扫）；
//   B. 本机绝对路径：**跳过 src/**——那里是上游原文，自带测试夹具
//      （如 storage-paths.test.ts 里的 Windows 绝对路径样例），报出来是误报。
//      也跳过本脚本自己：下面这些模式与说明本身就是"路径长什么样"的例子。
// 注意：本脚本刻意**不**写死"本机用户名/邮箱"来查——把要防的东西写进要发布的文件里本身就是泄漏。
// 真正的路径泄漏由 B 组直接抓到。
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.json', '.jsonc', '.yml', '.yaml', '.md', '.txt', '.html', '.css', '.patch']);
const SCAN_EXEMPT_FILES = new Set(['tools/verify-package.mjs']);
const SECRET_PATTERNS = [
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/, 'GitHub 令牌'],
  [/\bnpm_[A-Za-z0-9]{32,}/, 'npm 令牌'],
  [/\bsk-[A-Za-z0-9]{20,}/, 'API Key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '私钥'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS Access Key'],
];
const LOCAL_PATH_PATTERNS = [
  [/[A-Za-z]:\\+Users\\+(?!<|%|\$|\{)/i, 'Windows 用户目录绝对路径'],
  [/\/(?:home|Users)\/(?!<|%|\$|\{)[^\s"']+/, '用户主目录路径'],
];
const SECRET_SKIP_DIRS = new Set(['node_modules', '.git', 'assets']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const relPath = full.slice(ROOT.length + 1);
    if (entry.isDirectory()) {
      if (SECRET_SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (TEXT_EXT.has(extname(entry.name).toLowerCase())) {
      out.push(relPath);
    }
  }
  return out;
}

let scanned = 0;
for (const rel of walk(ROOT)) {
  const text = readFileSync(abs(rel), 'utf8');
  scanned++;
  const relPosix = rel2(rel);
  const patterns = relPosix.startsWith('src/') || SCAN_EXEMPT_FILES.has(relPosix)
    ? SECRET_PATTERNS
    : [...SECRET_PATTERNS, ...LOCAL_PATH_PATTERNS];
  for (const [pattern, label] of patterns) {
    const hit = text.match(pattern);
    if (hit) fail(`${relPosix} 疑似混入${label}：${String(hit[0]).slice(0, 60)}`);
  }
}

// --------------------------------------------------------------- 汇总输出
const version = pkg?.version ?? '?';
console.log(`\n@tuweizhi/dsh-pet v${version} 发版自检`);
console.log(`扫描文本文件 ${scanned} 个；结构检查项 ${REQUIRED_FILES.length + REQUIRED_DIRS.length} 个\n`);

for (const note of notes) console.log(`  ✓ ${note}`);
if (failures.length === 0) {
  console.log('\n全部通过：可以发布。\n');
  process.exit(0);
}
console.log('');
for (const f of failures) console.log(`  ✗ ${f}`);
console.log(`\n${failures.length} 项未通过，已中止发布。\n`);
process.exit(1);
