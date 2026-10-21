/**
 * 跨平台公共能力（macOS / Windows）：IDE 安装定位 + npx 调用 + minidev 版本固定
 *
 * IDE 定位依据（来自 minidev 2.2.5 源码 possibleInstallations / findIDEInstallation，非臆测）：
 * - 默认候选：darwin → /Applications/小程序开发者工具.app；win32 → C:\Program Files\小程序开发者工具
 * - 有效安装判据：macOS `<app>/Contents/Resources/app/package.json`，Windows `<dir>/resources/app/package.json`
 * 本模块在此基础上补充常见的用户级/自定义安装位置，并以同一判据校验，读出 IDE 版本。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

// 固定 minidev 版本：本技能文档中的全部 CLI 参数均按此版本 --help 实测核实。
// 升级流程：改此常量 → 逐条复核 devtools.md 中命令的 --help → 跑 evals 15/15 → 再发布。
export const MINIDEV = 'minidev@2.2.5';

const IDE_NAME = '小程序开发者工具';

/** 生成候选安装路径（按优先级）。显式指定（参数/环境变量）排在最前。 */
export function ideCandidates({ platform = process.platform, env = process.env, home = os.homedir(), explicit } = {}) {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const list = [];
  if (explicit) list.push({ path: explicit, source: '--ide-path 参数' });
  if (env.ALIPAY_IDE_PATH) list.push({ path: env.ALIPAY_IDE_PATH, source: 'ALIPAY_IDE_PATH 环境变量' });
  if (platform === 'darwin') {
    list.push({ path: `/Applications/${IDE_NAME}.app`, source: '默认位置' });
    if (home) list.push({ path: p.join(home, 'Applications', `${IDE_NAME}.app`), source: '用户 Applications' });
  } else if (platform === 'win32') {
    const roots = [
      'C:\\Program Files',
      env.ProgramFiles,
      env['ProgramFiles(x86)'],
      env.LOCALAPPDATA && p.join(env.LOCALAPPDATA, 'Programs'),
    ].filter(Boolean);
    for (const r of [...new Set(roots)]) list.push({ path: p.join(r, IDE_NAME), source: '默认位置' });
  }
  return list;
}

/** 有效安装判据（与 minidev 一致） */
export function idePackageJson(appPath, platform = process.platform) {
  return platform === 'darwin'
    ? path.posix.join(appPath, 'Contents', 'Resources', 'app', 'package.json')
    : path.win32.join(appPath, 'resources', 'app', 'package.json');
}

/**
 * 定位 IDE。返回 { appPath, version, source } 或 { appPath: null, tried: [...] }。
 * exists/readFile 可注入，便于在非目标平台上做逻辑自测。
 */
export function locateIDE(opts = {}) {
  const platform = opts.platform || process.platform;
  const exists = opts.exists || fs.existsSync;
  const readFile = opts.readFile || ((f) => fs.readFileSync(f, 'utf8'));
  const tried = [];
  const invalidExplicit = [];
  for (const c of ideCandidates({ ...opts, platform })) {
    const pkg = idePackageJson(c.path, platform);
    tried.push(c.path);
    if (!exists(pkg)) {
      // 用户显式指定却无效：不能静默回落，调用方需提示
      if (c.source !== '默认位置' && c.source !== '用户 Applications') invalidExplicit.push(`${c.path}（${c.source}）`);
      continue;
    }
    let version = '未知';
    try { version = JSON.parse(readFile(pkg)).version || version; } catch (_) { /* 版本读不到不影响定位 */ }
    return { appPath: c.path, version, source: c.source, invalidExplicit };
  }
  return { appPath: null, tried, invalidExplicit, unsupported: !['darwin', 'win32'].includes(platform) };
}

/** 从 argv 取 --ide-path 的值 */
export function ideArgFromArgv(argv = process.argv) {
  const i = argv.indexOf('--ide-path');
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
}

// —— npx 跨平台调用 ——
// Windows 上 npx 是 npx.cmd；Node ≥18.20.2/20.12.2 起 spawn .cmd 必须 shell:true（CVE-2024-27980），
// 走 shell 时含空格/中文的参数（如 C:\Program Files\小程序开发者工具）必须加引号。
const IS_WIN = process.platform === 'win32';
function winQuote(a) {
  return /[\s"&|<>^()%!]/.test(a) ? `"${String(a).replace(/"/g, '""')}"` : a;
}
export function npxSpawn(args, opts = {}) {
  if (!IS_WIN) return spawn('npx', args, opts);
  return spawn('npx.cmd', args.map(winQuote), { ...opts, shell: true, windowsHide: true });
}
export function npxSpawnSync(args, opts = {}) {
  if (!IS_WIN) return spawnSync('npx', args, opts);
  return spawnSync('npx.cmd', args.map(winQuote), { ...opts, shell: true, windowsHide: true });
}

// 下载页深链在前端路由站点上无法自动核实（任意路径都返回 200），只给文档中心首页 + 搜索指引，不编造菜单路径
export const IDE_DOWNLOAD_HINT = '支付宝文档中心 https://opendocs.alipay.com/mini/ 搜索「小程序开发者工具」下载对应平台（macOS / Windows）版本';
