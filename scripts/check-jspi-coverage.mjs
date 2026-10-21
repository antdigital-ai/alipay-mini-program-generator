#!/usr/bin/env node
/**
 * 漂移对账脚本：skill allowlist ⇄ OpenDocs 双向校验
 *
 * 用法：
 *   node scripts/check-jspi-coverage.mjs                       # 基线：校验 allowlist 中的 my.* 在 OpenDocs 还有官方文档
 *   node scripts/check-jspi-coverage.mjs --with-gap-candidates # 同时输出"已知常见但未加白名单"的候选 API
 *   node scripts/check-jspi-coverage.mjs --offline             # 跳过网络（仅打印 allowlist 体积、不发请求）
 *   node scripts/check-jspi-coverage.mjs /path/to/skill-root   # 显式指定 skill 根
 *
 * 退出码：
 *   0 = allowlist 中全部 API 在 OpenDocs 都命中（无漂移）
 *   1 = 发现漂移（allowlist 中至少 1 个 API 在 OpenDocs 找不到专属迷你版文档，或被官方废弃）
 *   2 = 参数/解析错（如：MY_API_ALLOWLIST 解析失败、check-project.mjs 找不到 等）
 *
 * 设计原则：本脚本不写任何文件；漂移打印机 -> 让人在 check-project.mjs / jsapi.md §0 同步改。
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const withGaps = argv.includes('--with-gap-candidates');
const offline = argv.includes('--offline');
const userRoot = argv.find(a => !a.startsWith('--') && !a.endsWith('.mjs'));
const ROOT = userRoot ? path.resolve(userRoot) : path.resolve(import.meta.dirname, '..');
const CHECK_PROJECT = path.join(ROOT, 'scripts', 'check-project.mjs');
const SEARCH_ENDPOINT = 'https://opendocs.alipay.com/api/search';

if (!fs.existsSync(CHECK_PROJECT)) {
  console.error(`✘ 找不到 check-project.mjs：${CHECK_PROJECT}`);
  process.exit(2);
}

const src = fs.readFileSync(CHECK_PROJECT, 'utf8');

// 解析 MY_API_ALLOWLIST = new Set([ 'a', 'b', ... ]);
const m = src.match(/MY_API_ALLOWLIST\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
if (!m) {
  console.error('✘ 无法从 check-project.mjs 解析 MY_API_ALLOWLIST（Set 形式变了）');
  process.exit(2);
}
const allowset = new Set([...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));

// 同步解析 check-project.mjs 自有的 BUILTIN_TAGS（组件名），避免本地副本与原脚本失同步
const tagM = src.match(/BUILTIN_TAGS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
const BUILTIN_TAGS = tagM
  ? new Set([...tagM[1].matchAll(/'([^']+)'/g)].map(x => x[1]))
  : new Set([
    'view','text','image','button','input','textarea','checkbox','checkbox-group',
    'radio','radio-group','switch','slider','picker','picker-view','picker-view-column',
    'form','label','icon','progress','swiper','swiper-item','scroll-view','rich-text',
    'canvas','map','video','audio','web-view','camera','live-player','block',
    'movable-view','movable-area','cover-view','cover-image','slot','template','import','include'
  ]);

const jsapis = [...allowset].filter(n => !BUILTIN_TAGS.has(n));

// 已知"常见的强使用率但 allowlist 缺"候选（用户走 Q1=a 广度扩 JSAPI 时按这条 + OpenDocs 自动校对）
const GAP_CANDIDATES = [
  'connectSocket', 'requestSubscribeMessage', 'getNetworkType', 'onNetworkStatusChange',
  'pageScrollTo', 'createSelectorQuery', 'createIntersectionObserver',
  'setTabBarStyle', 'setTabBarItem', 'hideTabBar', 'showTabBar',
  'setBackgroundColor', 'setEnableDebug',
  'saveImageToPhotosAlbum', 'saveFile', 'getFileInfo', 'openDocument',
  'onUserCaptureScreen', 'onMemoryWarning', 'vibrate', 'offWindowResize', 'onWindowResize'
];

function stripTags(s) { return (s || '').replace(/<[^>]+>/g, ''); }

async function searchDocs(word) {
  const url = SEARCH_ENDPOINT + '?' + new URLSearchParams({ word, page: '1' });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return j.success && j.data ? j.data : null;
  } finally { clearTimeout(t); }
}

async function verifyApi(name) {
  const word = 'my.' + name;
  const data = await searchDocs(word);
  if (!data) return { name, ok: false, reason: 'search-fail-or-empty' };
  const items = data.data || [];
  // 优先：title 去掉 font 标签后正好 == "my.X"，且 sitePath 是 mini 系列
  const hit = items.find(it =>
    (it.sitePath === 'mini' || it.sitePath === 'mini-game') && stripTags(it.title).trim() === word
  );
  if (hit) return { name, ok: true, url: hit.url };
  // 宽松：title 包含 "my.X"（避免大小写/换行问题）
  const semi = items.find(it =>
    (it.sitePath === 'mini' || it.sitePath === 'mini-game') && stripTags(it.title).includes(word)
  );
  if (semi) return { name, ok: true, url: semi.url, weak: true };
  // 兜底 3：URL 末段 slug 含 API 名（容纳 OpenDocs 把多 API 合并到同一页，如 my.authorize 合到 openapi-authorize 页、title 渲染成 my.getAuthCode 的场景）
  const slugHit = items.find(it => {
    if (!(it.sitePath === 'mini' || it.sitePath === 'mini-game') || !it.url) return false;
    try {
      const slug = new URL(it.url).pathname.split('/').pop().toLowerCase();
      return slug.includes(name.toLowerCase());
    } catch { return false; }
  });
  if (slugHit) return { name, ok: true, url: slugHit.url, weak: true, weakReason: 'url-slug-match' };
  return {
    name, ok: false, reason: 'no-mini-doc-match',
    samples: items.slice(0, 3).map(x => ({ t: stripTags(x.title), u: x.url, p: x.sitePath }))
  };
}

async function verifyComponent(name) {
  const data = await searchDocs(name);
  if (!data) return { name, ok: false, reason: 'search-fail', kind: 'component' };
  const items = data.data || [];
  const hit = items.find(it => it.url && it.url.includes('/mini/component/' + name));
  if (hit) return { name, ok: true, url: hit.url, kind: 'component' };
  return {
    name, ok: false, reason: 'no-component-doc', kind: 'component',
    samples: items.slice(0, 3).map(x => ({ t: stripTags(x.title), u: x.url }))
  };
}

async function main() {
  console.log('# Skill ⇄ OpenDocs 漂移对账');
  console.log(`skill-root:           ${ROOT}`);
  console.log(`allowlist 总条目:     ${allowset.size}`);
  console.log(`  - JSAPI（去 BUILTIN_TAGS 后）: ${jsapis.length}`);
  console.log(`  - 同时出现在 allowlist 中的组件: ${[...BUILTIN_TAGS].filter(n => allowset.has(n)).length}`);
  if (offline) { console.log('\n⚠ --offline，跳过实际请求。'); return; }

  console.log('\n## JSAPI 校验（allowlist ⇄ OpenDocs）');
  const drift = [];
  for (const name of jsapis) {
    const r = await verifyApi(name);
    const flag = r.ok ? (r.weak ? 'OK~' : 'OK ') : 'DRIFT';
    console.log(`  [${flag}] my.${r.name}${r.url ? '  -> ' + r.url : ''}`);
    if (!r.ok && r.samples) console.log(`      首批其它命中：${JSON.stringify(r.samples)}`);
    if (!r.ok) drift.push('my.' + r.name);
  }

  // 顺便：对 allowlist 里"形似组件名"的条目（与 BUILTIN_TAGS 同时出现）做组件维度校验
  const dupComponents = [...BUILTIN_TAGS].filter(n => allowset.has(n));
  if (dupComponents.length) {
    console.log('\n## 组件校验（allowlist 同时含的内置组件 ⇄ OpenDocs/mini/component/）');
    for (const name of dupComponents) {
      const r = await verifyComponent(name);
      const flag = r.ok ? 'OK ' : 'DRIFT';
      console.log(`  [${flag}] <${r.name}>${r.url ? '  -> ' + r.url : ''}`);
      if (!r.ok) drift.push('<' + r.name + '>');
    }
  }

  if (withGaps) {
    console.log('\n## "已知常见但未加白名单"候选（用户走 Q1=a 广度时按这条补）');
    let added = 0, doced = 0;
    for (const name of GAP_CANDIDATES) {
      if (allowset.has(name)) { added++; continue; }
      const r = await verifyApi(name);
      const flag = r.ok ? 'DOC ' : '?   ';
      console.log(`  [${flag}] my.${name}${r.url ? '  -> ' + r.url : ''}`);
      if (r.ok) doced++;
    }
    console.log(`\n  已加白名单 ${added}/${GAP_CANDIDATES.length} · 文档现存且未加 ${doced}（可补；走 Q1=a 时再开）`);
  }

  console.log('\n=== result ===');
  if (drift.length === 0) { console.log('✓ 全部一致，无漂移'); process.exit(0); }
  console.log(`✘ 漂移 ${drift.length} 项：${drift.join(', ')}`);
  console.log('  修复路径：在 scripts/check-project.mjs 的 MY_API_ALLOWLIST 与 references/jsapi.md §0 白名单 code block 同步增/删，再删/加对应 references 中的引用。');
  process.exit(1);
}

main().catch(e => { console.error('❌ uncaught', e); process.exit(2); });
