#!/usr/bin/env node
/**
 * Skill 自带回归夹具：正例全绿 + 负例逐项注入必须被拦截
 * 用法: node evals/run-evals.mjs
 * 退出码: 0 = 全部通过, 1 = 存在失败
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const skillDir = path.join(import.meta.dirname, '..');
const CHECK = path.join(skillDir, 'scripts', 'check-project.mjs');

// —— 正例工程模板 ——
function buildPositive(dir) {
  const P = (...ps) => path.join(dir, ...ps);
  fs.mkdirSync(P('pages', 'index'), { recursive: true });
  fs.mkdirSync(P('pages', 'order'), { recursive: true });
  fs.mkdirSync(P('utils'), { recursive: true });
  fs.mkdirSync(P('services'), { recursive: true });
  fs.writeFileSync(P('app.json'), JSON.stringify({
    pages: ['pages/index/index', 'pages/order/order'],
    window: { defaultTitle: '回归夹具', titleBarColor: '#1677ff' },
    tabBar: { items: [
      { pagePath: 'pages/index/index', name: '首页' },
      { pagePath: 'pages/order/order', name: '订单' },
    ] },
    component2: true,
    lazyCodeLoading: 'requiredComponents',
  }, null, 2));
  fs.writeFileSync(P('app.js'), "App({ onLaunch() {}, globalData: {} });");
  fs.writeFileSync(P('app.acss'), '.empty{color:#999}');
  fs.writeFileSync(P('pages', 'index', 'index.json'), '{"usingComponents":{}}');
  fs.writeFileSync(P('pages', 'index', 'index.axml'),
    '<view><text>首页</text><button class="go" onTap="onGoOrders">查看订单</button></view>');
  fs.writeFileSync(P('pages', 'index', 'index.js'),
    'Page({ onGoOrders() { my.switchTab({ url: \'/pages/order/order\' }); } });');
  fs.writeFileSync(P('pages', 'index', 'index.acss'), '.go{margin:40rpx}');
  fs.writeFileSync(P('pages', 'order', 'order.json'), '{"usingComponents":{}}');
  fs.writeFileSync(P('pages', 'order', 'order.axml'),
    '<view class="wrap">\n  <view a:for="{{list}}" a:for-item="item" key="item.id"><text>{{item.name}}</text></view>\n  <button class="pay" onTap="onPay">支付</button>\n</view>');
  fs.writeFileSync(P('pages', 'order', 'order.js'),
    "import { fetchOrderList } from '../../services/order';\n" +
    "Page({\n  data: { list: [] },\n  onLoad() { this.refresh(); },\n" +
    "  async refresh() {\n    try { const r = await fetchOrderList({}); this.setData({ list: r.list || [] }); }\n" +
    "    catch (e) { my.showToast({ type: 'fail', content: e.message || '加载失败' }); }\n  },\n" +
    "  onPay() { my.showToast({ type: 'none', content: '演示' }); },\n});");
  fs.writeFileSync(P('pages', 'order', 'order.acss'), '.wrap{padding:24rpx}');
  fs.writeFileSync(P('utils', 'request.js'),
    "const BASE_URL = 'https://api.example.com';\n" +
    "export function request(path, method = 'GET', data = {}) {\n" +
    "  return new Promise((resolve, reject) => {\n    my.request({\n" +
    "      url: `${BASE_URL}${path}`, method, data,\n" +
    "      headers: { 'content-type': 'application/json' }, dataType: 'json',\n" +
    "      success: (res) => resolve(res.data),\n      fail: (err) => reject(new Error(err.errorMessage || '网络异常')),\n    });\n  });\n}");
  fs.writeFileSync(P('services', 'order.js'),
    "import { request } from '../utils/request';\nexport function fetchOrderList(params) { return request('/order/list', 'GET', params); }");
}

// —— 负例注入：每项 { name, expect(正则), apply(dir) } ——
const CASES = [
  { name: '语法错误', expect: /JS 语法错误/,
    apply: (d) => fs.writeFileSync(path.join(d, 'pages/order/order.js'), "Page({ data: { a: 'broken\n });") },
  { name: '臆造API(类推微信)', expect: /my\.requestPayment —— 不在白名单/,
    apply: (d) => fs.writeFileSync(path.join(d, 'pages/order/order.js'), "Page({ onPay() { my.requestPayment({}); } });") },
  { name: '凭空API', expect: /my\.syncMoonPhase —— 不在白名单/,
    apply: (d) => fs.writeFileSync(path.join(d, 'pages/order/order.js'), "Page({ onX() { my.syncMoonPhase(); } });") },
  { name: 'AXML未闭合', expect: /标签未闭合/,
    apply: (d) => fs.writeFileSync(path.join(d, 'pages/order/order.axml'), '<view><text>a</text>\n<view>') },
  { name: 'a:for缺key', expect: /a:for 但缺少 key/,
    apply: (d) => fs.writeFileSync(path.join(d, 'pages/order/order.axml'), '<view a:for="{{list}}" a:for-item="item"><text>{{item.name}}</text></view>') },
  { name: '事件处理器缺失', expect: /handleGone.*未在.*定义/,
    apply: (d) => fs.writeFileSync(path.join(d, 'pages/order/order.axml'), '<view><button onTap="handleGone">x</button></view>') },
  { name: '未注册组件标签', expect: /未注册的组件标签 <goods-cardxxx>/,
    apply: (d) => fs.writeFileSync(path.join(d, 'pages/order/order.axml'), '<view><goods-cardxxx item="{{item}}" /></view>') },
  { name: '散写my.request', expect: /散写 my\.request/,
    apply: (d) => fs.appendFileSync(path.join(d, 'pages/order/order.js'), '\n// x\nmy.request({ url: "https://a.com" });') },
  { name: '硬编码密钥', expect: /硬编码密钥/,
    apply: (d) => fs.appendFileSync(path.join(d, 'pages/order/order.js'), "\nconst appSecret = 'sk_live_1234567890';") },
  { name: '明文http地址', expect: /含明文 http/,
    apply: (d) => fs.appendFileSync(path.join(d, 'pages/order/order.js'), "\nconst u = 'http://api.example.com/x';") },
  { name: '幽灵导入', expect: /具名导入 \{ ghostOrderApi \} 未在/,
    apply: (d) => fs.writeFileSync(path.join(d, 'pages/order/order.js'),
      "import { fetchOrderList, ghostOrderApi } from '../../services/order';\nPage({ onLoad() { this.x = ghostOrderApi; this.refresh = () => {}; } });") },
  { name: '主包超2MB', expect: /主包体积.*超过 2MB/,
    apply: (d) => { fs.mkdirSync(path.join(d, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(d, 'assets', 'big.png'), Buffer.alloc(2.2 * 1024 * 1024)); } },
  { name: 'tabBar图标超40KB', expect: /超过 40KB 限制/,
    apply: (d) => { fs.mkdirSync(path.join(d, 'assets', 'tab'), { recursive: true });
      fs.writeFileSync(path.join(d, 'assets', 'tab', 'home.png'), Buffer.alloc(50 * 1024));
      const p = path.join(d, 'app.json');
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      j.tabBar.items.forEach((it) => { it.icon = 'assets/tab/home.png'; });
      fs.writeFileSync(p, JSON.stringify(j, null, 2)); } },
  { name: '页面未注册(app.json)', expect: /缺少 pages\/ghost\/ghost\.axml/,
    apply: (d) => { const p = path.join(d, 'app.json');
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      j.pages.push('pages/ghost/ghost');
      fs.writeFileSync(p, JSON.stringify(j, null, 2)); } },
];

function runCheck(dir) {
  const r = spawnSync(process.execPath, [CHECK, dir], { encoding: 'utf8' });
  return { code: r.status, output: `${r.stdout}\n${r.stderr}` };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alipay-evals-'));
const results = [];

// Phase 1: 正例
const posDir = path.join(tmp, 'positive');
fs.mkdirSync(posDir);
buildPositive(posDir);
const pos = runCheck(posDir);
results.push({ name: '正例全绿', ok: pos.code === 0, detail: pos.output.trim().split('\n').filter((l) => l.includes('检查完成'))[0] || pos.output.slice(0, 200) });

// Phase 2: 负例逐项
for (const c of CASES) {
  const dir = path.join(tmp, 'neg-' + c.name);
  fs.mkdirSync(dir);
  buildPositive(dir);
  c.apply(dir);
  const r = runCheck(dir);
  const ok = r.code === 1 && c.expect.test(r.output);
  results.push({ name: c.name, ok, detail: ok ? (r.output.match(c.expect) || [''])[0] : `未命中: ${r.output.slice(0, 300)}` });
}

// Phase 3: IDE 跨平台定位（注入虚拟文件系统，macOS 上也能校验 Windows 逻辑；判据与 minidev 源码一致）
const { locateIDE } = await import(path.join(skillDir, 'scripts', 'lib', 'platform.mjs'));
const fakeFs = (files) => ({ exists: (f) => files.includes(f), readFile: () => '{"version":"3.9.91"}' });
const PLATFORM_CASES = [
  { name: '定位 macOS 默认安装', platform: 'darwin', env: {}, home: '/Users/u',
    files: ['/Applications/小程序开发者工具.app/Contents/Resources/app/package.json'],
    expect: '/Applications/小程序开发者工具.app' },
  { name: '定位 macOS 用户级 ~/Applications', platform: 'darwin', env: {}, home: '/Users/u',
    files: ['/Users/u/Applications/小程序开发者工具.app/Contents/Resources/app/package.json'],
    expect: '/Users/u/Applications/小程序开发者工具.app' },
  { name: '定位 Windows Program Files', platform: 'win32', env: { ProgramFiles: 'C:\\Program Files' }, home: 'C:\\Users\\u',
    files: ['C:\\Program Files\\小程序开发者工具\\resources\\app\\package.json'],
    expect: 'C:\\Program Files\\小程序开发者工具' },
  { name: '定位 Windows 非 C 盘/LOCALAPPDATA', platform: 'win32', env: { ProgramFiles: 'D:\\Program Files', LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' }, home: 'C:\\Users\\u',
    files: ['C:\\Users\\u\\AppData\\Local\\Programs\\小程序开发者工具\\resources\\app\\package.json'],
    expect: 'C:\\Users\\u\\AppData\\Local\\Programs\\小程序开发者工具' },
  { name: '显式路径优先(ALIPAY_IDE_PATH)', platform: 'win32', env: { ALIPAY_IDE_PATH: 'E:\\Tools\\IDE', ProgramFiles: 'C:\\Program Files' }, home: 'C:\\Users\\u',
    files: ['E:\\Tools\\IDE\\resources\\app\\package.json', 'C:\\Program Files\\小程序开发者工具\\resources\\app\\package.json'],
    expect: 'E:\\Tools\\IDE' },
  { name: '空壳目录不算安装(缺 package.json)', platform: 'darwin', env: {}, home: '/Users/u',
    files: ['/Applications/小程序开发者工具.app'], expect: null },
];
for (const c of PLATFORM_CASES) {
  const r = locateIDE({ platform: c.platform, env: c.env, home: c.home, ...fakeFs(c.files) });
  const ok = r.appPath === c.expect;
  results.push({ name: c.name, ok, detail: ok ? `→ ${r.appPath ?? '未找到（正确）'}` : `期望 ${c.expect}，实际 ${r.appPath}` });
}

let failed = 0;
console.log('===== alipay-mini-program-generator 回归夹具 =====');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? ` — ${r.detail}` : ''}`);
  if (!r.ok) { failed++; console.log(`      ${r.detail}`); }
}
console.log(`结果: ${results.length - failed}/${results.length} 通过`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
