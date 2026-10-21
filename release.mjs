#!/usr/bin/env node
/**
 * release.mjs — 一键发布维护脚本：
 *   1) 校验工作树干净
 *   2) npm version <patch|minor|major> --no-git-tag-version
 *   3) git add package.json + commit + push origin main
 *   4) npm publish --registry=https://registry.npmjs.org/
 *      (依赖 ~/.npmrc 中 //registry.npmjs.org/:_authToken 的 granular access token with bypass 2FA；
 *       若改用 OTP-at-publish 路线，手动跑 `npm publish --registry=https://registry.npmjs.org/ --otp=NNNNNN` 代替脚本第 4 步)
 *   5) 等 12 秒 + npm view 校验
 *
 * 用法（从仓库根目录）：
 *   npm run release-patch   # = node release.mjs patch
 *   npm run release-minor
 *   npm run release-major
 *
 * 注：首次发新包名可能走 npm staged-release 流程（0.0.0-stage 占位 → 真版本 ≈2 分钟后切 latest）；
 * 后续同包新版本不走 staged-release。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const pkgPath = path.join(cwd, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const name = pkg.name;
const oldVersion = pkg.version;

const KIND = process.argv[2] || 'patch';
if (!['patch','minor','major'].includes(KIND)) {
  console.error(`✗ Unsupported release kind: ${KIND}. Use  patch  /  minor  /  major.`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const capture = opts.capture === true;
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: capture ? ['ignore','pipe','pipe'] : 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    if (capture) console.error(`✗ failed (rc=${r.status})\n${r.stderr}`);
    process.exit(r.status || 1);
  }
  return capture ? r.stdout.trim() : '';
}

console.log(`=== Release ${KIND} for ${pkg.name} (from v${oldVersion}) ===`);

// 1) clean tree check
const dirty = run('git', ['status','--porcelain'], { capture: true });
if (dirty) {
  console.error(`✗ Working tree not clean — 先 commit 或 stash 这些 changes:\n${dirty}`);
  process.exit(1);
}

// 2) npm version (no git tag; just rewrite package.json)
run('npm', ['version', KIND, '--no-git-tag-version']);
const newPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const newVersion = newPkg.version;
console.log(`→ Bumped ${KIND}  v${oldVersion}  →  v${newVersion}`);

// 3) stage + commit + push
run('git', ['add', 'package.json']);
run('git', ['commit', '-m', `chore(release): ${pkg.name}@${newVersion}`]);
run('git', ['push', 'origin', 'main']);

// 4) publish (uses bypass-2FA granular token in ~/.npmrc)
run('npm', ['publish', '--registry=https://registry.npmjs.org/']);

// 5) verify after CDN propagation
console.log('\n=== Verifying publish (wait 12 s) ===');
await new Promise(r => setTimeout(r, 12000));
const view = spawnSync('npm', ['view', `${name}@${newVersion}`, '--registry=https://registry.npmjs.org/'], { cwd, encoding: 'utf8' });
if (view.status === 0) {
  console.log(`✓ npm view ${name}@${newVersion} OK`);
} else {
  console.warn(`! npm view not yet OK (rc=${view.status})；可能是 CDN 缓存延迟 (5-10 min) 或 npm 的 staged-release 未放行。\n  稍后再看：\n  npm view ${name}@${newVersion} --registry=https://registry.npmjs.org/`);
}

console.log(`\n🎉 Released ${pkg.name}@${newVersion} to npmjs.org.`);
