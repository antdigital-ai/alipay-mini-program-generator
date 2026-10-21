#!/usr/bin/env node
/**
 * 支付宝小程序工程确定性检查
 * 指标 1 零语法错误：.js 过 node --check；AXML 标签配平；a:for 必带 key
 * 指标 2 API 零臆造：my.* 命中白名单（与 jsapi.md 单一事实源自动比对）；http:// 拦截；硬编码密钥拦截
 * 指标 3 编码规范执法：my.request 仅限 utils/；AXML 事件处理器必须存在；自定义标签必须注册；ESM 具名导入必须存在
 * 用法: node check-project.mjs <project-path>
 * 退出码: 0 = 通过, 1 = 存在错误
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const root = process.argv[2];
const errors = [];
const warnings = [];

// —— API 白名单（本脚本持有；与 references/jsapi.md 白名单代码块自动比对防双源漂移） ——
// 新增 API 的唯一合法途径：先在官方文档核实签名，再同步更新此处与 jsapi.md
const MY_API_ALLOWLIST = new Set([
  'request', 'uploadFile', 'downloadFile',
  'getStorage', 'setStorage', 'removeStorage', 'clearStorage',
  'getStorageSync', 'setStorageSync', 'removeStorageSync', 'clearStorageSync',
  'getAuthCode', 'authorize', 'getSetting',
  'tradePay',
  'navigateTo', 'redirectTo', 'navigateBack', 'switchTab',
  'showToast', 'showLoading', 'hideLoading', 'confirm', 'alert',
  'showActionSheet', 'setNavigationBar',
  'getSystemInfo', 'getSystemInfoSync', 'chooseImage', 'previewImage',
  'getLocation', 'scan', 'canIUse', 'stopPullDownRefresh',
  'onAppShow', 'offAppShow', 'onAppHide', 'offAppHide',
  'getLaunchOptionsSync', 'getEnterOptionsSync',
  'getMenuButtonBoundingClientRect', 'saveImageToPhotosAlbum',
]);

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function relOf(full) { return path.relative(root, full).split(path.sep).join('/'); }
function readJson(rel) {
  const file = path.join(root, rel);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(`${rel} JSON 解析失败: ${e.message}`);
    return null;
  }
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// —— 防漂移：与 references/jsapi.md 的白名单代码块比对 ——
function checkAllowlistSync() {
  const mdPath = path.join(import.meta.dirname, '..', 'references', 'jsapi.md');
  if (!fs.existsSync(mdPath)) return;
  const md = fs.readFileSync(mdPath, 'utf8');
  const m = md.match(/## 0 API 白名单[\s\S]*?```text([\s\S]*?)```/);
  if (!m) return;
  const declared = new Set(m[1].trim().split(/\s+/).filter((t) => /^[a-zA-Z]/.test(t)));
  const miss = [...MY_API_ALLOWLIST].filter((a) => !declared.has(a));
  const extra = [...declared].filter((a) => !MY_API_ALLOWLIST.has(a));
  if (miss.length) err(`白名单漂移：jsapi.md 缺少 ${miss.join(', ')}（两处必须同步修改）`);
  if (extra.length) err(`白名单漂移：jsapi.md 多出 ${extra.join(', ')}（两处必须同步修改）`);
}

// —— 内置组件标签（支付宝基础组件 + 模板机制标签） ——
const BUILTIN_TAGS = new Set([
  'view', 'text', 'image', 'button', 'input', 'textarea', 'checkbox', 'checkbox-group',
  'radio', 'radio-group', 'switch', 'slider', 'picker', 'picker-view', 'picker-view-column',
  'form', 'label', 'icon', 'progress', 'swiper', 'swiper-item', 'scroll-view', 'rich-text',
  'canvas', 'map', 'video', 'audio', 'web-view', 'camera', 'live-player', 'block',
  'movable-view', 'movable-area', 'cover-view', 'cover-image', 'slot', 'template', 'import', 'include',
]);

function checkPageFiles(page, where) {
  const base = path.join(root, page);
  for (const ext of ['axml', 'js', 'json']) {
    if (!fs.existsSync(`${base}.${ext}`)) err(`${where} 页面 ${page} 缺少 ${page}.${ext}`);
  }
  if (!fs.existsSync(`${base}.acss`)) warn(`${where} 页面 ${page} 缺少 ${page}.acss（样式可选，请确认）`);
}

// —— ESM 导出索引 + 导入存在性 ——
const exportIndex = new Map(); // relFile -> Set(导出名，含 default)
function indexExports(rel, src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+class\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const seg = part.trim();
      if (seg) names.add(seg.split(/\s+as\s+/).pop().trim());
    }
  }
  if (/export\s+default\b/.test(src)) names.add('default');
  exportIndex.set(rel, names);
}

function checkImports(rel, src) {
  // 相对路径导入才校验（npm 包视作外部依赖，跳过）
  const specs = [];
  for (const m of src.matchAll(/import\s+(?:([A-Za-z0-9_$]+)\s*,\s*)?\{([^}]*)\}\s+from\s+['"](\.[^'"]+)['"]/g)) {
    specs.push({ named: m[2], single: m[1] || null, from: m[3] });
  }
  for (const m of src.matchAll(/import\s+([A-Za-z0-9_$]+)\s+from\s+['"](\.[^'"]+)['"]/g)) {
    if (!m[1]) continue;
    specs.push({ named: null, single: m[1], from: m[2] });
  }
  for (const s of specs) {
    let target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), s.from));
    let targetJs = target.endsWith('.js') ? target : `${target}.js`;
    if (!fs.existsSync(path.join(root, targetJs)) && fs.existsSync(path.join(root, `${target}/index.js`))) {
      targetJs = `${target}/index.js`;
    }
    if (!fs.existsSync(path.join(root, targetJs))) {
      err(`${rel} 导入的模块不存在: ${s.from}`);
      continue;
    }
    const exp = exportIndex.get(targetJs);
    if (!exp || !exp.size) continue; // 导出无法静态解析则跳过，避免误报
    if (s.named) {
      for (const part of s.named.split(',')) {
        const seg = part.trim();
        if (!seg) continue;
        const imported = seg.split(/\s+as\s+/)[0].trim();
        if (!exp.has(imported)) err(`${rel} 具名导入 { ${imported} } 未在 ${targetJs} 中导出`);
      }
    } else if (s.single && !exp.has(s.single)) {
      err(`${rel} 导入 ${s.single} 未在 ${targetJs} 中导出`);
    }
  }
}

// —— 单文件检查器 ——
function checkJsSyntax(full) {
  const rel = relOf(full);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alipay-syntax-'));
  const tmp = path.join(tmpDir, 's.mjs');
  fs.copyFileSync(full, tmp);
  const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  if (r.status !== 0) {
    const detail = (r.stderr || '').split('\n').filter(Boolean).slice(0, 3).map((l) => l.trim()).join(' | ');
    err(`JS 语法错误 ${rel}: ${detail}`);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function checkMyApis(rel, src) {
  const seen = new Set();
  for (const m of src.matchAll(/\bmy\.([A-Za-z0-9_]+)/g)) seen.add(m[1]);
  for (const name of seen) {
    if (!MY_API_ALLOWLIST.has(name)) {
      err(`未核实的 API ${rel}: my.${name} —— 不在白名单内（见 references/jsapi.md；新增须先查官方文档 https://opendocs.alipay.com/mini/api?pathHash=5b4d0c83 并同步白名单）`);
    }
  }
}

function checkScatteredRequest(rel, src) {
  if (rel.startsWith('utils/')) return; // 统一封装层豁免
  if (/\bmy\.request\b/.test(src)) {
    err(`${rel} 散写 my.request —— 所有请求必须走 utils/request.js 统一封装`);
  }
}

function checkHardcodedSecrets(rel, src) {
  const re = /(appKey|privateKey|secretKey|accessToken|apiKey|mchKey|appSecret)\s*[:=]\s*['"]([^'"]{8,}?)['"]/gi;
  for (const m of src.matchAll(re)) {
    if (/^(your|xxx|test|placeholder|mock|<)/i.test(m[2])) continue; // 占位符豁免
    err(`${rel} 疑似硬编码密钥：${m[1]}（凭据只允许来自 storage/服务端下发）`);
  }
}

function checkHttpUrls(rel, src) {
  for (const m of src.matchAll(/http:\/\/([^'"\s)]+)/g)) {
    const host = m[1].split('/')[0];
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(host)) {
      warn(`${rel} 含 http:// 本地地址（${host}）——仅限本地调试，上线前必须 https`);
    } else {
      err(`${rel} 含明文 http:// 地址（${m[0]}）——my.request 只允许 https`);
    }
  }
}

const pagesSet = new Set();
const appUsingComponents = new Set();

function checkAxml(full) {
  const rel = relOf(full);
  const base = rel.replace(/\.axml$/, '');
  const src = fs.readFileSync(full, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const jsSrc = fs.existsSync(path.join(root, `${base}.js`))
    ? fs.readFileSync(path.join(root, `${base}.js`), 'utf8') : '';
  const json = readJson(`${base}.json`) || {};
  const allowed = new Set([
    ...BUILTIN_TAGS,
    ...Object.keys(json.usingComponents || {}),
    ...appUsingComponents,
  ]);

  const stack = [];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
  for (const m of src.matchAll(tagRe)) {
    const closing = m[1] === '/';
    const tag = m[2];
    const attrs = m[3] || '';
    const selfClosing = attrs.trim().endsWith('/');
    if (!allowed.has(tag)) {
      err(`${rel} 使用了未注册的组件标签 <${tag}> —— 请在 ${base}.json 的 usingComponents 中注册`);
    }
    if (closing || selfClosing) {
      if (closing) {
        const top = stack.pop();
        if (!top) err(`AXML 多余闭合标签 </${tag}> @ ${rel}`);
        else if (top !== tag) {
          err(`AXML 标签错配 @ ${rel}: <${top}> 被 </${tag}> 闭合`);
          while (stack.length && stack[stack.length - 1] !== tag) stack.pop();
          if (stack.length) stack.pop();
        }
      }
      continue;
    }
    stack.push(tag);
    if (/a:for\s*=/.test(attrs) && !/\bkey\s*=/.test(attrs)) {
      err(`${rel} 的 <${tag}> 含 a:for 但缺少 key —— a:for 必须配套稳定 key`);
    }
  }
  for (const t of stack) err(`AXML 标签未闭合 @ ${rel}: <${t}>`);

  // 事件处理器存在性（动态绑定 {{...}} 跳过）
  if (jsSrc) {
    for (const m of src.matchAll(/\b(?:on|catch)[A-Za-z]+\s*=\s*["']([^"'{}]+)["']/g)) {
      const handler = m[1].trim();
      if (!new RegExp(`\\b${escapeRe(handler)}\\s*[(:]`).test(jsSrc)) {
        err(`${rel} 事件处理器「${handler}」未在 ${base}.js 中定义`);
      }
    }
  }
}

// —— 主流程 ——
if (!root || !fs.existsSync(path.join(root, 'app.json'))) {
  console.error('用法: node check-project.mjs <project-path>（目录需含 app.json）');
  process.exit(1);
}

checkAllowlistSync();

function checkUsingComponents(map, owner) {
  if (!map) return;
  for (const tag of Object.keys(map)) {
    const ref = map[tag];
    const target = ref.startsWith('/') ? ref.slice(1) : ref;
    if (!exists(`${target}.json`)) err(`${owner} usingComponents[${tag}] 目标不存在: ${ref}`);
    else {
      const compJson = readJson(`${target}.json`);
      if (compJson && compJson.component !== true) err(`${target} 组件 json 缺少 "component": true`);
    }
  }
}

const appJson = readJson('app.json');
if (appJson) {
  const pages = appJson.pages;
  if (!Array.isArray(pages) || pages.length === 0) err('app.json pages 为空或缺失');
  else pages.forEach((p) => { pagesSet.add(p); checkPageFiles(p, '主包'); });

  if (appJson.tabBar) {
    const items = appJson.tabBar.items || appJson.tabBar.list || [];
    if (items.length < 2 || items.length > 5) err(`tabBar 项数量应为 2-5，当前 ${items.length}`);
    items.forEach((it) => {
      if (!it.pagePath) err('tabBar 项缺少 pagePath');
      else if (Array.isArray(pages) && !pages.includes(it.pagePath)) err(`tabBar pagePath ${it.pagePath} 未在 pages 声明`);
      if (!it.name) warn(`tabBar 项 ${it.pagePath || '?'} 缺少 name（支付宝字段，非微信 text）`);
      for (const k of ['icon', 'activeIcon']) {
        if (it[k] && !exists(it[k])) err(`tabBar ${k} 文件不存在: ${it[k]}`);
        if (it[k] && exists(it[k])) {
          const kb = fs.statSync(path.join(root, it[k])).size / 1024;
          if (kb > 40) err(`tabBar ${k} ${it[k]} ${kb.toFixed(0)}KB 超过 40KB 限制`);
        }
      }
    });
  }

  const subPackages = appJson.subPackages || appJson.subpackages || [];
  subPackages.forEach((sp) => {
    if (!sp.root) { err('subPackages 项缺少 root'); return; }
    if (!fs.existsSync(path.join(root, sp.root))) err(`分包目录不存在: ${sp.root}`);
    (sp.pages || []).forEach((p) => {
      const full = path.posix.join(sp.root, p);
      if (Array.isArray(pages) && pages.includes(full)) err(`${full} 同时出现在主包 pages 与分包，重复注册`);
      checkPageFiles(full, `分包 ${sp.root}`);
    });
  });

  if (appJson.preloadRule) {
    const subRoots = new Set(subPackages.map((sp) => sp.root));
    for (const [trigger, rule] of Object.entries(appJson.preloadRule)) {
      if (!pagesSet.has(trigger) && !subRoots.has(trigger)) err(`preloadRule 触发页 ${trigger} 未在 pages/subPackages 声明`);
      for (const pkg of rule.packages || []) {
        if (!subRoots.has(pkg)) err(`preloadRule 包 ${pkg} 未在 subPackages 的 root 中声明`);
      }
    }
  }

  if (appJson.component2 !== true) warn('app.json 未开启 component2（自定义组件新生命周期）');
  if (appJson.lazyCodeLoading !== 'requiredComponents') warn('app.json 未配置 lazyCodeLoading: requiredComponents（按需注入）');

  Object.keys(appJson.usingComponents || {}).forEach((k) => appUsingComponents.add(k));
  checkUsingComponents(appJson.usingComponents, 'app.json');
}

// —— 体积预算：主包/分包 ≤ 2MB（ERROR）；单图 > 200KB（WARNING）；输出 top10 大文件 ——
function checkBudget(subRoots) {
  const KB = 1024, MB = 1024 * KB;
  let mainSize = 0;
  const pkgSize = new Map();
  const sizes = [];
  walk(root, (full) => {
    const rel = relOf(full);
    const st = fs.statSync(full, { throwIfNoEntry: false });
    if (!st || !st.isFile()) return;
    sizes.push({ rel, size: st.size });
    const pkg = subRoots.find((r) => rel === r || rel.startsWith(r + '/'));
    if (pkg) pkgSize.set(pkg, (pkgSize.get(pkg) || 0) + st.size);
    else mainSize += st.size;
    if (/\.(png|jpe?g|gif|webp)$/i.test(rel) && st.size > 200 * KB) {
      warn(`${rel} 图片 ${(st.size / KB).toFixed(0)}KB > 200KB —— 压缩或改走 CDN`);
    }
  });
  if (mainSize > 2 * MB) err(`主包体积 ${(mainSize / MB).toFixed(2)}MB 超过 2MB 上限 —— 资源移入分包或精简`);
  for (const [pkg, size] of pkgSize) {
    if (size > 2 * MB) err(`分包 ${pkg} 体积 ${(size / MB).toFixed(2)}MB 超过 2MB 上限`);
  }
  sizes.sort((a, b) => b.size - a.size);
  const top = sizes.slice(0, 10).map((s) => `${s.rel}(${(s.size / KB).toFixed(0)}KB)`).join('  ');
  console.log(`  [INFO] 体积: 主包 ${(mainSize / KB).toFixed(0)}KB${pkgSize.size ? ` | 分包 ${[...pkgSize].map(([p, s]) => `${p}(${(s / KB).toFixed(0)}KB)`).join(' ')}` : ''} | Top大文件: ${top}`);
}

// 两轮扫描：先建导出索引，再全量校验
function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else cb(full);
  }
}
const jsFiles = [];
walk(root, (full) => { if (full.endsWith('.js')) jsFiles.push(full); });
for (const full of jsFiles) indexExports(relOf(full), fs.readFileSync(full, 'utf8'));

checkBudget((appJson && (appJson.subPackages || appJson.subpackages || []).map((sp) => sp.root)) || []);

walk(root, (full) => {
  const rel = relOf(full);
  if (rel.endsWith('.js')) {
    const src = fs.readFileSync(full, 'utf8');
    checkJsSyntax(full);
    checkMyApis(rel, src);
    checkScatteredRequest(rel, src);
    checkHardcodedSecrets(rel, src);
    checkHttpUrls(rel, src);
    checkImports(rel, src);
  } else if (rel.endsWith('.axml')) {
    checkAxml(full);
  } else if (rel.endsWith('.json') && rel !== 'app.json' && rel !== 'mini.project.json') {
    const j = readJson(rel);
    if (!j) return;
    if (j.component === true) {
      const base = rel.replace(/\.json$/, '');
      for (const ext of ['axml', 'js', 'acss']) {
        if (!exists(`${base}.${ext}`)) err(`组件 ${base} 缺少 ${base}.${ext}`);
      }
    } else {
      checkUsingComponents(j.usingComponents, rel);
    }
  }
});

console.log(`检查完成: ${errors.length} 错误, ${warnings.length} 警告`);
errors.forEach((m) => console.error(`  [ERROR] ${m}`));
warnings.forEach((m) => console.warn(`  [WARN]  ${m}`));
process.exit(errors.length > 0 ? 1 : 0);
