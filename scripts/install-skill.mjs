#!/usr/bin/env node
/**
 * install-skill.mjs — npm 生命周期入口（postinstall/preuninstall）
 * 实际逻辑在 scripts/lib/skill-registrar.mjs（与 bin scripts/cli.mjs 共用）。
 *   postinstall  → 注册技能（覆盖写入技能根目录）
 *   preuninstall → 移除技能目录（兜底；npm 10 卸载依赖不触发，见 README Uninstall）
 *
 * 手动调用：node scripts/install-skill.mjs install|uninstall
 */
import { install, uninstall, PKG } from './lib/skill-registrar.mjs';

const ev = process.env.npm_lifecycle_event || '';
const arg = process.argv[2];
const isUninstall = ev === 'preuninstall' || ev === 'uninstall' || arg === 'uninstall' || arg === 'remove';

try {
  if (isUninstall) {
    const r = uninstall();
    console.log(`\n[${PKG}] skill removed → ${r.dest}\n`);
  } else {
    const r = install();
    console.log(`\n[${PKG}] skill installed → ${r.dest}\n`);
  }
} catch (e) {
  // 生命周期脚本失败不应阻断用户的 npm install：仅告警并给出手动注册命令
  console.warn(`\n[${PKG}] skill lifecycle '${ev || 'manual'}' failed (non-fatal): ${(e && e.message) || e}\n  可手动注册: npx ${PKG} install   (或 node node_modules/${PKG}/scripts/install-skill.mjs install)\n`);
  process.exitCode = 0;
}
