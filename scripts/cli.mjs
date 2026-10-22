#!/usr/bin/env node
/**
 * cli.mjs — alipay-mini-program-generator 命令（bin）
 * 注册/移除支付宝小程序开发技能到用户技能根目录。共用逻辑在 scripts/lib/skill-registrar.mjs。
 *
 * 一键卸载（推荐）：
 *   npx alipay-mini-program-generator uninstall
 *   → 先清技能目录，再自动 npm uninstall 自身，一行无残留。
 *
 * 背景：npm 10「卸载依赖」时不触发依赖自身的 preuninstall（registry 安装与本地 tarball 均已实测），
 *      所以 `npm uninstall` 单条命令无法清掉 ~/.agents/skills 下的技能副本——由本命令兜底。
 */
import { install, uninstall, info, PKG } from './lib/skill-registrar.mjs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url);

const USAGE = [
  `alipay-mini-program-generator — 注册/移除支付宝小程序开发技能`,
  ``,
  `用法:`,
  `  alipay-mini-program-generator install            注册技能到 ~/.agents/skills/${PKG}（覆盖；等价 postinstall）`,
  `  alipay-mini-program-generator uninstall          一键卸载：清技能目录 + 自动 npm uninstall 自身（推荐）`,
  `  alipay-mini-program-generator uninstall --skills-only   只清技能目录、保留 node_modules 包（开发/恢复）`,
  `  alipay-mini-program-generator where              打印目标根路径与已装/源版本`,
  `  alipay-mini-program-generator --help             显示本帮助`,
  `  （无参数 = install）`,
  ``,
  `环境:`,
  `  ALIPAY_SKILL_ROOT        默认 ~/.agents/skills；可改成 ~/.codex/skills 等。`,
  `  ALIPAY_NO_SELF_UNINSTALL=1   跳过自动 npm uninstall（等价 --skills-only）。`,
  ``,
  `典型用法:`,
  `  npm install alipay-mini-program-generator         # 注册技能`,
  `  npx   alipay-mini-program-generator uninstall     # 一键卸载，无残留`,
].join('\n');

// 判断是否全局安装（决定自动 npm uninstall 是否带 -g）
function isGlobalInstall() {
  try {
    const rootG = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim();
    if (!rootG) return false;
    const rel = path.relative(rootG, HERE);
    return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch {
    return false;
  }
}

// 一键卸载：先清技能目录，再自动 npm uninstall 自身
function selfUninstall(skillsOnly) {
  // 1) 清技能目录 ~/.agents/skills/<pkg>（或 ALIPAY_SKILL_ROOT）
  const r = uninstall();
  console.log(`[${PKG}] skill removed → ${r.dest}`);

  if (skillsOnly || process.env.ALIPAY_NO_SELF_UNINSTALL === '1') {
    console.log(`[${PKG}] --skills-only：保留 node_modules 包，未触发 npm uninstall。`);
    return;
  }

  // 2) 自动卸载 npm 包（全局则带 -g）
  const g = isGlobalInstall();
  const args = g ? ['uninstall', '-g', PKG] : ['uninstall', PKG];
  console.log(`[${PKG}] running: npm ${args.join(' ')}${g ? ' (global)' : ''}`);
  const res = spawnSync('npm', args, { stdio: 'inherit' });
  if (res.error) {
    console.warn(`[${PKG}] npm uninstall 失败: ${(res.error && res.error.message) || res.error}\n  技能目录已清；可手动执行: npm ${args.join(' ')}`);
    return;
  }
  if (res.status && res.status !== 0) {
    console.warn(`[${PKG}] npm uninstall 非 0 退出 (rc=${res.status})；技能目录已清，请按提示处理 npm 端。`);
    process.exitCode = res.status;
    return;
  }
  console.log(`[${PKG}] ✓ 一键卸载完成：技能目录与 npm 包均已清。`);
}

const rawArgs = process.argv.slice(2);
const cmd = (rawArgs[0] || 'install').toLowerCase();
const skillsOnly = rawArgs.some(a => a === '--skills-only' || a === '--keep-package');

try {
  if (cmd === 'install' || cmd === 'i' || cmd === 'register' || cmd === 'link') {
    const r = install();
    console.log(`[${PKG}] skill installed → ${r.dest}`);
  } else if (cmd === 'uninstall' || cmd === 'remove' || cmd === 'rm' || cmd === 'delete') {
    selfUninstall(skillsOnly);
  } else if (cmd === 'where' || cmd === 'info' || cmd === 'list') {
    const i = info();
    console.log(`skillsRoot     : ${i.skillsRoot}`);
    console.log(`dest           : ${i.dest}`);
    console.log(`installed      : ${i.installed} (${i.installedVersion ?? '—'})`);
    console.log(`sourceVersion  : ${i.sourceVersion}`);
    console.log(`source         : ${i.source}`);
  } else if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(USAGE);
  } else {
    console.error(`unknown command: ${cmd}\n\n${USAGE}`);
    process.exit(1);
  }
} catch (e) {
  console.error(`failed: ${(e && e.message) || e}\n\n${USAGE}`);
  process.exit(1);
}
