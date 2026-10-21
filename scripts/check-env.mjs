#!/usr/bin/env node
/**
 * 支付宝小程序开发环境探针（Gate A 第一步）
 * 用法: node check-env.mjs [project-path] [--ide-path <IDE 安装路径>]
 * 支持平台: macOS / Windows（IDE 路径自动探测，也可用 --ide-path 或环境变量 ALIPAY_IDE_PATH 指定）
 * 检查: Node 版本、IDE 安装、minidev 可达性（含受限 HOME 自动重试）、项目 appId
 * 退出码: 0 = 环境就绪（可有 WARN）, 1 = 存在阻断项（ERROR）
 */
import fs from 'node:fs';
import path from 'node:path';
import { MINIDEV, locateIDE, ideArgFromArgv, npxSpawnSync, IDE_DOWNLOAD_HINT } from './lib/platform.mjs';

const projectPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : undefined;
const errors = [];
const warnings = [];
const oks = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const ok = (m) => oks.push(m);

// —— 1. Node 版本（minidev/脚本都要求 ≥18；ESM 语法检查在老版本不可用） ——
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= 18) ok(`Node.js v${process.versions.node}`);
else err(`Node.js v${process.versions.node} 低于 18 —— 升级后重试（node --check 的 ESM 校验与 minidev 均需要 ≥18）`);

// —— 2. 小程序开发者工具安装 ——
const ide = locateIDE({ explicit: ideArgFromArgv() });
ide.invalidExplicit.forEach((p) => warn(`指定的 IDE 路径无效: ${p}（缺 resources/app/package.json；macOS 应指向 .app，Windows 应指向安装目录）`));
if (ide.appPath) ok(`小程序开发者工具 ${ide.version}：${ide.appPath}（${ide.source}）`);
else if (ide.unsupported) err(`当前平台 ${process.platform} 无官方小程序开发者工具（仅 macOS / Windows）—— 可做开发与静态检查，模拟器/预览需换 macOS 或 Windows`);
else err(`未找到小程序开发者工具（已查: ${ide.tried.join(' ; ')}）—— 下载: ${IDE_DOWNLOAD_HINT}；装在其他位置用 --ide-path <路径> 或环境变量 ALIPAY_IDE_PATH 指定`);

// —— 3. minidev 可达性（npx 拉取 + 运行；受限 HOME 自动换安全 HOME 重试） ——
function probeMinidev(env) {
  return npxSpawnSync(['-y', MINIDEV, '--version'], {
    encoding: 'utf8', timeout: 90000, env: { ...process.env, ...env },
  });
}
let r = probeMinidev({});
let out = `${r.stdout || ''}\n${r.stderr || ''}`;
if (r.status === 0) {
  ok(`${MINIDEV}（固定版本）${String(r.stdout).trim().slice(0, 20)}`);
} else if (/EPERM: operation not permitted/.test(out)) {
  // EPERM 发生在 minidev 自身的 getRootDir：说明 npx 拉取与运行都已成功，仅本环境 HOME 受限
  ok(`${MINIDEV} 可用（本环境 HOME 受限，open-ide.mjs 会自动换安全 HOME 运行）`);
} else if (r.error && r.error.code === 'ENOENT') {
  err('找不到 npx —— 请先安装 Node.js（含 npm）');
} else if (r.error && r.error.code === 'ETIMEDOUT') {
  err(`npx 拉取 minidev 超时 —— 检查 npm 源/网络（可先手动 \`npx -y ${MINIDEV} --version\` 预热缓存）`);
} else {
  const tail = out.trim().split('\n').filter(Boolean).slice(-3).join(' | ');
  warn(`minidev 探测异常（退出码 ${r.status}）—— ${tail.slice(-160)}`);
}

// —— 4. 项目 appId（可选，传项目路径才检查；无 app.json 视为新建项目，同样需要 appId） ——
if (projectPath) {
  const mp = path.join(projectPath, 'mini.project.json');
  let appId = null;
  if (fs.existsSync(mp)) {
    try { appId = JSON.parse(fs.readFileSync(mp, 'utf8')).appid || null; } catch (_) { /* 忽略 */ }
  }
  if (!fs.existsSync(path.join(projectPath, 'app.json'))) ok('未发现 app.json —— 按新建项目处理');
  if (appId) ok(`项目 appId: ${appId}（mini.project.json）`);
  else warn('未配置 appId —— 请向用户索取并写入 mini.project.json 的 appid（没有可前往 open.alipay.com 创建）');
}

console.log('===== 环境就绪清单 =====');
oks.forEach((m) => console.log(`  [OK]    ${m}`));
warnings.forEach((m) => console.log(`  [WARN]  ${m}`));
errors.forEach((m) => console.error(`  [ERROR] ${m}`));
console.log(`结果: ${errors.length ? '存在阻断项，先处理 ERROR' : '环境就绪'}`);
process.exit(errors.length ? 1 : 0);
