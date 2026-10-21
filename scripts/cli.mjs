#!/usr/bin/env node
/**
 * cli.mjs — alipay-mini-program-generator 命令（bin）
 * 注册/移除支付宝小程序开发技能到用户技能根目录。
 * 共用逻辑在 scripts/lib/skill-registrar.mjs。
 */
import { install, uninstall, info, PKG } from './lib/skill-registrar.mjs';

const USAGE = [
  `alipay-mini-program-generator — 注册/移除支付宝小程序开发技能`,
  ``,
  `用法:`,
  `  alipay-mini-program-generator install      注册技能到 ~/.agents/skills/${PKG}（覆盖；等价 postinstall）`,
  `  alipay-mini-program-generator remove       移除技能目录（卸载前先用它清理 ~/.agents/skills 副本）`,
  `  alipay-mini-program-generator where        打印目标根路径与已装/源版本`,
  `  alipay-mini-program-generator --help       显示本帮助`,
  `  （无参数 = install）`,
  ``,
  `环境: ALIPAY_SKILL_ROOT  默认 ~/.agents/skills；可改成 ~/.codex/skills 等。`,
  ``,
  `典型卸载（技能目录由本命令清理，node_modules 由 npm 清理）:`,
  `  npx ${PKG} remove && npm uninstall ${PKG}`,
].join('\n');

const cmd = (process.argv[2] || 'install').toLowerCase();

try {
  if (cmd === 'install' || cmd === 'i' || cmd === 'register' || cmd === 'link') {
    const r = install();
    console.log(`[alipay-mini-program-generator] skill installed → ${r.dest}`);
  } else if (cmd === 'remove' || cmd === 'uninstall' || cmd === 'rm' || cmd === 'delete') {
    const r = uninstall();
    console.log(`[alipay-mini-program-generator] skill removed → ${r.dest}`);
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
