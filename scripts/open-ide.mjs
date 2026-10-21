#!/usr/bin/env node
/**
 * 主动唤起「小程序开发者工具」并打开项目模拟器
 * 用法: node open-ide.mjs <project-path> [--appid <id>] [--qr] [--ide-path <IDE 安装路径>]
 * 支持平台: macOS / Windows（IDE 路径自动探测，规则见 lib/platform.mjs；也可用 ALIPAY_IDE_PATH 指定）
 *
 * 机制（实测验证，minidev 2.2.5 + IDE 3.9.91）：
 * - 官方 CLI minidev 的 `ide start-sim` 子命令 = 启动 IDE + 打开项目 + 展示模拟器；
 * - 首次被 CLI 控制时，IDE 需开启服务端口（设置 → 安全设置 → 服务端口），
 *   未开启时 CLI 停在「Wait for IDE Service Host Ready」，脚本会给出授权指引；
 * - 直接带项目路径启动 IDE 二进制不会打开项目（只开欢迎窗），不使用该方式。
 * - 受限执行环境（沙箱/由后台进程树发起）实测两个坑（2026-10 实录，详见 references/devtools.md）：
 *   1) 直接 spawn 的 IDE 进程 GPU 初始化失败（exit_code=6）约 40 秒内整体崩溃——
 *      脚本先用 `open -a` 经 Launch Services 在 GUI 登录会话预拉起 IDE，
 *      存活 GUI 实例作为 Chromium 单例主进程接收 minidev 的转发命令（✔ Connected to IDE）；
 *   2) 对真实 HOME 的 access(W_OK) 返回 EPERM 时 minidev 直接崩溃（未捕获非 EACCES）——
 *      脚本用「稳定目录」而非每跑一次新建的临时目录兜底 HOME：npx 依赖缓存可复用
 *      （冷装 50s+ → 复跑秒级），CLI 的 IDE 服务记录（$TMPDIR/minidev/ide-control/rec）跨次一致。
 * 退出码: 0 = 唤起流程完成（或等待一次性授权）, 1 = 无法唤起（未安装等）
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { MINIDEV, locateIDE, ideArgFromArgv, npxSpawn, IDE_DOWNLOAD_HINT } from './lib/platform.mjs';

const projectPath = process.argv[2];
if (!projectPath || !fs.existsSync(path.join(projectPath, 'app.json'))) {
  console.error('用法: node open-ide.mjs <project-path> [--appid <id>] [--qr] [--ide-path <IDE 安装路径>]');
  process.exit(1);
}
const absProject = path.resolve(projectPath);

// —— appId 解析：--appid / --qr <appId> 参数优先，其次项目 mini.project.json ——
const valAfter = (flag) => {
  const i = process.argv.indexOf(flag);
  const v = i !== -1 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith('-') ? v : null;
};
let appId = valAfter('--appid') || valAfter('--qr');
let appIdSource = appId ? '命令行参数' : null;
if (!appId) {
  const mp = path.join(absProject, 'mini.project.json');
  if (fs.existsSync(mp)) {
    try {
      const j = JSON.parse(fs.readFileSync(mp, 'utf8'));
      appId = j.appid || j.appId || null;
      if (appId) appIdSource = 'mini.project.json';
    } catch (_) { /* 配置解析失败按无 appId 处理 */ }
  }
}

// —— 真机预览模式：--qr <appId>（内部走 minidev preview -a，二维码直接打在本终端） ——
const QR_IDX = process.argv.indexOf('--qr');

// 稳定兜底 HOME：固定目录而非每次 mkdtemp —— npx 依赖缓存可复用（冷装 50s+ → 复跑秒级），
// 且 CLI 的 IDE 服务记录（$TMPDIR/minidev/ide-control/rec）跨次保持一致，不再每跑错位一次。
function stableSafeHome() {
  const dir = path.join(os.tmpdir(), 'alipay-minidev-home');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

if (QR_IDX !== -1) {
  if (!appId) {
    console.error('[FAIL] 真机预览需要 appId：传 --appid <id>，或在项目 mini.project.json 配置 appid（开放平台控制台查看）');
    process.exit(1);
  }
  console.log(`真机预览: minidev preview -a ${appId}（来源: ${appIdSource}）`);
  console.log(`项目路径: ${absProject}`);
  console.log(`[前置] 需要本机完成过 npx -y ${MINIDEV} login 授权；未授权时会失败并提示登录。`);
  const previewArgs = ['-y', MINIDEV, 'preview', '-p', absProject, '-a', appId];
  let pout = '';
  let pc = npxSpawn(previewArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  pc.stdout.on('data', (d) => { pout += d.toString(); process.stdout.write(d); });
  pc.stderr.on('data', (d) => { pout += d.toString(); process.stderr.write(d); });
  pc.on('close', (code) => {
    if (code === 0) { console.log('[DONE] 真机预览二维码已在上方输出，支付宝扫码验证。'); process.exit(0); }
    if (/EPERM: operation not permitted/.test(pout)) {
      const safeHome = stableSafeHome();
      console.log('[INFO] 当前环境访问用户 HOME 受限，改用稳定兜底 HOME 重试…');
      pout = '';
      const pc2 = npxSpawn(previewArgs, { env: { ...process.env, HOME: safeHome }, stdio: ['ignore', 'pipe', 'pipe'] });
      pc2.stdout.on('data', (d) => { pout += d.toString(); process.stdout.write(d); });
      pc2.stderr.on('data', (d) => { pout += d.toString(); process.stderr.write(d); });
      pc2.on('close', (c2) => {
        console.log(c2 === 0 ? '[DONE] 真机预览二维码已输出。' : `[FAIL] preview 退出码 ${c2}——常见原因：未 minidev login、appId 无权限。`);
        process.exit(c2 === 0 ? 0 : 1);
      });
      return;
    }
    console.error(`[FAIL] preview 退出码 ${code}——常见原因：未 minidev login、appId 无效或无权限。`);
    process.exit(1);
  });
}

// —— 模拟器模式（默认）：仅当非 --qr 时执行 ——
if (QR_IDX === -1) {
const ide = locateIDE({ explicit: ideArgFromArgv() });
const ideApp = ide.appPath;
ide.invalidExplicit.forEach((p) => console.log(`[WARN] 指定的 IDE 路径无效，已忽略: ${p}`));
if (!ideApp) {
  if (ide.unsupported) {
    console.error(`[BLOCKED] 当前平台 ${process.platform} 无官方小程序开发者工具（仅 macOS / Windows），无法唤起模拟器。`);
    console.error(`请在 macOS / Windows 上手动打开项目：${absProject}`);
    process.exit(1);
  }
  console.error('[BLOCKED] 未找到小程序开发者工具，已查找：');
  ide.tried.forEach((t) => console.error(`  - ${t}`));
  console.error(`下载安装：${IDE_DOWNLOAD_HINT}`);
  console.error('装在其他位置：加 --ide-path <IDE 安装路径>，或设置环境变量 ALIPAY_IDE_PATH');
  console.error('  （macOS 填 .app 路径，如 /Applications/小程序开发者工具.app；Windows 填安装目录，如 C:\\Program Files\\小程序开发者工具）');
  console.error(`安装后重跑本脚本，或手动在 IDE 打开项目：${absProject}`);
  process.exit(1);
}

// —— 受限执行环境兜底（2026-10 实测）：先经 Launch Services 在 GUI 登录会话预拉起 IDE ——
// 由本进程树直生的 IDE 在无 WindowServer/GPU 权限的环境里约 40 秒内崩溃（gpu exit_code=6），
// 用户又看不见这种实例里的任何窗口/授权操作；`open -a` 拉起的实例由用户会话托管，可长期存活，
// minidev 随后经 Chromium 单例机制把「打开项目 + 模拟器」转发给存活实例（输出 ✔ Connected to IDE）。
// 仅 macOS 执行；用 .app 绝对路径（兼容非默认安装位置）。失败不阻塞（minidev 仍会自行 spawn 兜底）。
// Windows 无 Launch Services 概念，由 minidev 直接拉起 IDE。
if (process.platform === 'darwin') {
  try {
    spawnSync('open', ['-a', ideApp], { stdio: 'ignore' });
    console.log(`[INFO] 已在 GUI 会话预启动 IDE（open -a），确保有存活实例接收 CLI 转发…`);
  } catch (_) { /* 预启动失败不阻塞主流程 */ }
}

console.log('唤起方式: minidev ide start-sim（官方 CLI）');
console.log(`项目路径: ${absProject}`);
console.log(`IDE: ${ideApp}（v${ide.version}，${ide.source}）`);
if (appId) console.log(`appId: ${appId}（来源: ${appIdSource}）`);
else console.log('[WARN] 未提供 appId（--appid 或 mini.project.json）——IDE 可能无法完整预览小程序，建议补上');

const args = [
  '-y', MINIDEV, 'ide', 'start-sim',
  '-p', absProject,
  '--app-path', ideApp,
  '-n', 'alipay-mini-program-generator',
];
if (appId) args.push('-a', appId);

let out = '';
let child = null;
let retried = false;

function launch(env) {
  const c = npxSpawn(args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  c.stdout.on('data', (d) => { out += d.toString(); });
  c.stderr.on('data', (d) => { out += d.toString(); });
  c.on('error', (e) => { out += `\n${e.message}`; });
  return c;
}

child = launch({});
child.on('close', (code) => {
  if (code !== 0 && !retried && /EPERM: operation not permitted/.test(out)) {
    retryWithSafeHome();
    return;
  }
  // CLI 以 0 退出 = 模拟器流程完成（IDE 常驻）
  if (code === 0) finish('[DONE] minidev 正常退出：项目与模拟器已在 IDE 中打开。');
  else finish(`[FAIL] minidev 退出码 ${code}，最后输出：\n${out.trim().slice(-400)}\n` +
    '  常见原因：IDE 未登录（先在 IDE 登录支付宝）、服务端口未开启（设置 → 安全设置）、\n' +
    '  或输出含 APP_ID_CANNOT_BE_SELECTED_<appId>（IDE 登录账号对该 appId 无使用权限，\n' +
    '  换拥有该小程序的账号登录 IDE；本地模拟器不受此影响，可去掉 -a/mini.project.json 的 appid 先预览）。', 1);
});

function retryWithSafeHome() {
  retried = true;
  const safeHome = stableSafeHome();
  console.log('[INFO] 当前环境访问用户 HOME 受限，改用稳定兜底 HOME 重试 CLI…');
  child = launch({ HOME: safeHome });
  child.on('close', (code) => {
    if (code === 0) finish('[DONE] minidev 正常退出：项目与模拟器已在 IDE 中打开。');
    else finish(`[FAIL] minidev 退出码 ${code}，最后输出：\n${out.trim().slice(-400)}\n` +
      '  常见原因：IDE 未登录、服务端口未开启（IDE → 设置 → 安全设置）、\n' +
      '  或 APP_ID_CANNOT_BE_SELECTED（登录账号对该 appId 无使用权限）。', 1);
  });
}

const t0 = Date.now();
// npx 冷装依赖实测 50s+（npm 元数据 + 依赖下载），45 秒会把正常安装误判成 [WAIT]，放宽到 180s；
// 稳定兜底 HOME 生效后仅首次冷装慢，之后秒级命中缓存。
const WAIT_MS = 180000;
const timer = setInterval(() => {
  // 受限执行环境对真实 HOME 的 accessSync 会 EPERM，换可写 HOME 重试一次
  if (!retried && /EPERM: operation not permitted/.test(out)) { retryWithSafeHome(); return; }
  // 「✔ 启动成功」只代表 IDE 进程起来了，随后若出现 Wait for IDE Service Host Ready，
  // 说明还差 IDE 侧一次性授权，授权优先级高于一切“成功”词
  if (/Wait for IDE Service Host Ready/.test(out) && Date.now() - t0 > 20000) {
    finish('[AUTH] IDE 已启动，CLI 正在等待 IDE 服务端口（一次性授权）：\n' +
      '  1. 打开 IDE → 设置 → 安全设置 → 开启「服务端口」（若弹出 CLI 授权确认窗请点击允许）\n' +
      '  2. 重新运行本脚本，之后模拟器会随项目自动打开并常驻后台');
  } else if (/模拟器|simulator|编译成功|compile.*(success|finish)/i.test(out)) {
    finish('[OK] 模拟器已在 IDE 窗口中打开，可在模拟器与 Console/Network 面板查看运行效果。');
  } else if (Date.now() - t0 > WAIT_MS) {
    finish(out.trim()
      ? `[WAIT] CLI 仍在后台执行，最后输出：\n${out.trim().slice(-400)}\n` +
        '  若长时间停在 Wait for IDE Service Host Ready，请到 IDE → 设置 → 安全设置 开启服务端口后重跑。'
      : `[TIMEOUT] ${WAIT_MS / 1000} 秒内无输出。可手动在 IDE 打开项目：${absProject}`);
  }
}, 1000);

function finish(msg, code = 0) {
  clearInterval(timer);
  if (msg.startsWith('[OK]') && child?.unref) {
    try { child.unref(); child.stdout.destroy?.(); child.stderr.destroy?.(); } catch (_) {}
  } else {
    try { child.kill(); } catch (_) {}
  }
  console.log(msg);
  process.exit(code);
}
}
