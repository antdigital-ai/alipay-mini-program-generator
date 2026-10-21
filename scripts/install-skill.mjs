#!/usr/bin/env node
/**
 * install-skill.mjs — npm 生命周期脚本（把本技能注册到用户技能根目录）
 *
 *   postinstall  : 覆盖写入技能根目录（默认 ~/.agents/skills/alipay-mini-program-generator）
 *   preuninstall : 移除该目录（使 `npm uninstall` 同步清掉技能注册）
 *
 * 由 npm 在 `npm install` / `npm uninstall` 时自动触发；也可手动跑：
 *   node scripts/install-skill.mjs install      # 等价 postinstall
 *   node scripts/install-skill.mjs uninstall    # 等价 preuninstall
 *
 * 环境变量：
 *   ALIPAY_SKILL_ROOT  技能根目录（默认 ~/.agents/skills）；本技能落在其下 alipay-mini-program-generator/
 *
 * 设计约束：
 *   - 仅写本技能专属目录，失败不阻断 npm install（catch 后保持 exit code 0，仅告警并给出手动注册命令）。
 *   - payload 与 npm 发布 tarball 的 files 一致（SKILL.md / package.json / .claude-skill.json /
 *     README.md / LICENSE / references / scripts），不含 evals/ 与 release.mjs 等开发期文件。
 *   - 源路径用 import.meta.dirname 解析（绝对路径），不依赖 npm 执行脚本时的 cwd。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PKG = 'alipay-mini-program-generator';
const skillsRoot = process.env.ALIPAY_SKILL_ROOT || path.join(os.homedir(), '.agents', 'skills');
const dest = path.join(skillsRoot, PKG);
const src = path.resolve(import.meta.dirname, '..'); // 包根（node_modules/.../alipay-mini-program-generator）

const PAYLOAD = ['SKILL.md', 'package.json', '.claude-skill.json', 'README.md', 'LICENSE', 'references', 'scripts'];

function rm(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* 忽略：不存在或无权 */ }
}

function copyPayload() {
  if (!fs.existsSync(path.join(src, 'SKILL.md'))) {
    throw new Error(`source package missing SKILL.md: ${src}`);
  }
  fs.mkdirSync(skillsRoot, { recursive: true });
  rm(dest); // 覆盖更新：先清旧目录，避免已删除文件在 dest 残留
  fs.mkdirSync(dest, { recursive: true });
  for (const rel of PAYLOAD) {
    const s = path.join(src, rel);
    if (!fs.existsSync(s)) continue; // 容忍裁剪包缺文件
    fs.cpSync(s, path.join(dest, rel), { recursive: true, force: true });
  }
}

function main() {
  const ev = process.env.npm_lifecycle_event || '';
  const arg = process.argv[2];
  const isUninstall = ev === 'preuninstall' || ev === 'uninstall' || arg === 'uninstall';
  if (isUninstall) {
    rm(dest);
    console.log(`\n[alipay-mini-program-generator] skill removed → ${dest}\n`);
    return;
  }
  // postinstall / install / 手动 install / 无参数默认 = 安装
  copyPayload();
  console.log(`\n[alipay-mini-program-generator] skill installed → ${dest}\n`);
}

try {
  main();
} catch (e) {
  // 生命周期脚本失败不应阻断用户的 npm install；仅告警并给出手动注册命令
  const manual = `node ${path.join('node_modules', PKG, 'scripts', 'install-skill.mjs')} install`;
  console.warn(`\n[alipay-mini-program-generator] skill lifecycle '${process.env.npm_lifecycle_event || 'manual'}' failed (non-fatal): ${(e && e.message) || e}\n  可手动注册: ${manual}\n`);
  process.exitCode = 0;
}
