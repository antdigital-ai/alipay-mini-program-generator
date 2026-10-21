/**
 * skill-registrar.mjs — 把技能注册到用户技能根目录的共享逻辑
 * 被 scripts/install-skill.mjs（npm 生命周期 postinstall/preuninstall）与 scripts/cli.mjs（bin）共用。
 * 仅导出函数，import 不产生副作用。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const PKG = 'alipay-mini-program-generator';
// payload 与 npm 发布 tarball 的 files 一致；不含 evals/ 与 release.mjs 等开发期文件
export const PAYLOAD = ['SKILL.md', 'package.json', '.claude-skill.json', 'README.md', 'LICENSE', 'references', 'scripts'];

export function skillsRoot() {
  return process.env.ALIPAY_SKILL_ROOT || path.join(os.homedir(), '.agents', 'skills');
}
export function dest(root = skillsRoot()) {
  return path.join(root, PKG);
}
export function src() {
  // 本文件在 <pkg>/scripts/lib/skill-registrar.mjs，包根 = ../..
  return path.resolve(import.meta.dirname, '..', '..');
}

function rmRecursive(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* 忽略：不存在或无权 */ }
}

export function install() {
  const root = skillsRoot();
  const d = dest(root);
  const s = src();
  if (!fs.existsSync(path.join(s, 'SKILL.md'))) {
    throw new Error(`source package missing SKILL.md: ${s}`);
  }
  fs.mkdirSync(root, { recursive: true });
  rmRecursive(d);            // 覆盖更新：先清旧目录，避免已删除文件残留
  fs.mkdirSync(d, { recursive: true });
  for (const rel of PAYLOAD) {
    const sp = path.join(s, rel);
    if (!fs.existsSync(sp)) continue;       // 容忍裁剪包缺文件
    fs.cpSync(sp, path.join(d, rel), { recursive: true, force: true });
  }
  return { root, dest: d, source: s };
}

export function uninstall() {
  const d = dest();
  rmRecursive(d);
  return { dest: d };
}

export function info() {
  const root = skillsRoot();
  const d = dest(root);
  const s = src();
  const installed = fs.existsSync(d);
  let installedVersion = null;
  let sourceVersion = null;
  try { installedVersion = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')).version; } catch {}
  try { sourceVersion = JSON.parse(fs.readFileSync(path.join(s, 'package.json'), 'utf8')).version; } catch {}
  return { skillsRoot: root, dest: d, installed, installedVersion, sourceVersion, source: s };
}
