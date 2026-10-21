# 支付宝能力调用（my.* JSAPI）

所有 `my.*` 异步 API 都是回调风格，必须经 Promise 封装后使用；每次调用都要有 `fail` 路径。同步类 API（如 `my.getLaunchOptionsSync`、`my.getSystemInfoSync`、`my.getMenuButtonBoundingClientRect`）直接返回结果，无需 Promise 封装。

## 0 API 白名单与零臆造规则（硬性）

以下是与 `scripts/check-project.mjs` 同步维护的**已核实 API 白名单**。写代码时只能使用其中的 `my.*`：

```text
request  uploadFile  downloadFile
getStorage  setStorage  removeStorage  clearStorage
getStorageSync  setStorageSync  removeStorageSync  clearStorageSync
getAuthCode  authorize  getSetting
tradePay
navigateTo  redirectTo  navigateBack  switchTab
showToast  showLoading  hideLoading  confirm  alert  showActionSheet
setNavigationBar
getSystemInfo  getSystemInfoSync  chooseImage  previewImage
getLocation  scan  canIUse  stopPullDownRefresh
onAppShow  offAppShow  onAppHide  offAppHide
getLaunchOptionsSync  getEnterOptionsSync
getMenuButtonBoundingClientRect  saveImageToPhotosAlbum
```

**查证流程（不确定即触发）**——适用于白名单外的能力（如支付分、芝麻信用、蓝牙、IoT 等），也适用于白名单内 API 的参数/返回值/错误码/版本要求拿不准时：
1. **禁止**凭记忆或从微信小程序类推 `my.xxx` 及其参数 —— 直接写就是臆造，check 脚本只能拦 API 名，拦不住参数臆造。
2. 查官方 API 文档：https://opendocs.alipay.com/mini/api?pathHash=5b4d0c83 （API 总目录，从中进入对应 API 页），确认 API 名、入参、返回结构、错误码、最低基础库版本。
3. **文档读不到时不得放行**：该站是前端渲染页面，抓取工具可能只拿到空壳（2026-10 实测：HTTP 200 但正文无 API 内容）。此时不要改用记忆、搜索摘要或社区文章顶替，而是请用户粘贴该 API 页内容或给出明确签名；拿不到就把该能力列为阻塞项，不写调用代码。
4. 核实后，白名单外 API 同步做两件事：加入 `check-project.mjs` 的 `MY_API_ALLOWLIST` 并更新上方白名单块；然后才写调用代码。交付摘要注明核实来源（官方文档页 / 用户提供）。
5. 参数与返回字段同样以文档为准，不确定的字段不写、不猜。

## 1 统一封装模板

```js
// utils/promisify.js
export function promisify(api, options = {}) {
  return new Promise((resolve, reject) => {
    api({ ...options, success: resolve, fail: (err) => reject(normalizeError(err)) });
  });
}

function normalizeError(err = {}) {
  const e = new Error(err.errorMessage || err.error || '调用失败');
  e.cause = err;
  return e;
}
```

```js
// utils/request.js —— 全项目唯一网络出口
const BASE_URL = 'https://api.example.com';

export function request(path, method = 'GET', data = {}, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    my.request({
      url: `${BASE_URL}${path}`,
      method,                       // GET | POST | PUT | DELETE
      data,
      headers: { 'content-type': 'application/json', ...extraHeaders },
      dataType: 'json',
      success: (res) => {
        if (res.status >= 200 && res.status < 300) {
          const body = res.data;
          // 按项目响应信封统一解包：{ code, message, result }
          if (body && body.code === '0') return resolve(body.result);
          return reject(new Error((body && body.message) || '业务处理失败'));
        }
        reject(new Error(`HTTP ${res.status}`));
      },
      fail: (err) => reject(new Error(err.errorMessage || err.error || '网络异常，请稍后重试')),
    });
  });
}
```

规则：
- URL 必须 `https`，域名必须进开放平台「服务器域名白名单」。模拟器不校验白名单，**真机才校验**——本地联调方案见 devtools.md。
- 登录态 token 只从 storage/统一封装读取注入 header，绝不在页面拼接，更不硬编码。
- 超时在 `app.json networkTimeout` 或请求参数设置，默认值别依赖。

## 2 能力分类速查

### 网络
| API | 说明 |
|---|---|
| `my.request` | HTTP 请求（必须经 utils/request.js） |
| `my.uploadFile` / `my.downloadFile` | 文件上传下载（同受白名单约束） |

### 本地存储
| API | 说明 |
|---|---|
| `my.setStorageSync(key, value)` / `my.getStorageSync(key)` | 同步读写，value 支持对象 |
| `my.removeStorageSync(key)` / `my.clearStorageSync()` | 清理 |

同步 API 包 try/catch（容量满/序列化失败会抛错）。敏感 token 建议带过期时间戳字段，启动时校验。

### 登录与用户信息
```js
// 1. 静默登录：拿 authCode 给服务端换 userId/session
const { authCode } = await promisify(my.getAuthCode, { scopes: 'auth_base' });
// 2. 需要昵称头像等用户信息：auth_user 授权 + 服务端换取
```
- `my.getAuthCode` 的 `authCode` **必须**传给服务端换取信息，前端拿不到用户明细。
- 主动授权场景用 `my.authorize({ scopes: 'scope.userLocation' })`；查询授权态用 `my.getSetting`。

### 支付
```js
// orderStr / tradeNO 必须来自服务端创建订单的返回，禁止前端构造
const res = await promisify(my.tradePay, { orderStr });
// res.resultCode === '9000' 视为支付成功；其余一律走失败分支 + 引导查询订单状态兜底
```
- 支付结果以服务端异步通知/查询为准，客户端回调只做 UI 引导。
- 典型 resultCode：`9000` 成功、`8000` 处理中、`4000`/`6001` 失败/取消。凡非 9000 都别当成功。

### 路由跳转
| API | 行为 |
|---|---|
| `my.navigateTo` | 保留当前页入栈（页面栈上限 10 层，超栈前改用 redirect） |
| `my.redirectTo` | 关闭当前页替换 |
| `my.navigateBack` | 返回（tab 页不可用） |
| `my.switchTab` | 切 tabBar 页（target 必须在 tabBar.items） |

- 跳分包页面 URL 必须带 `root` 前缀全路径。

### UI 反馈
| API | 说明 |
|---|---|
| `my.showToast({ type, content })` | type: success/fail/none/exception/warning |
| `my.showLoading({ content })` / `my.hideLoading()` | 成对出现 |
| `my.confirm({ title, content })` / `my.alert` | 确认/提示，Promise 化后用 |
| `my.setNavigationBar({ title })` | 动态改导航栏标题 |

### 设备与媒体
常用：`my.getSystemInfoSync`（窗口宽做 rpx 换算兜底）、`my.chooseImage`、`my.previewImage`、`my.getLocation`（需 `scope.userLocation` 授权且平台侧声明）、`my.scan`（扫码）。

### 能力探测
调用不确定的新 API 前先用 `my.canIUse('my.xxx')` 判断，低版本客户端走降级路径，不要裸调。

### 应用启动与应用事件

> 框架语义补强 —— 多数场景用 Page `onLoad`/`onShow` 与 App 回调即可；下面 `my.*` 用于「非 page 模块」或「读启动场景」节点。框架层完整生命周期见 [references/framework-lifecycle.md]。

| API | 入参 / 返回 | OpenDocs | 说明 |
|---|---|---|---|
| `my.onAppShow` / `my.offAppShow` | `(cb)` / `()` | [onAppShow](https://opendocs.alipay.com/mini/api/nn7do1) · [offAppShow](https://opendocs.alipay.com/mini/api/tkohmw) | 在 Service 模块/组件中监听应用切回前台；用完必 unlisten |
| `my.onAppHide` / `my.offAppHide` | `(cb)` / `()` | [onAppHide](https://opendocs.alipay.com/mini/api/tv6qvi) · [offAppHide](https://opendocs.alipay.com/mini/api/dldh0a) | 进入后台 |
| `my.getLaunchOptionsSync` | `()` → `{ scene, path, query, referrerInfo, extraData }` | [doc](https://opendocs.alipay.com/mini/api/getLaunchOptionsSync) | 仅 `App.onLaunch` 内一次读 |
| `my.getEnterOptionsSync` | `()` → 同上 | [doc](https://opendocs.alipay.com/mini/api/029i75) | 任意时刻返回最近一次进入参数 |
| `my.getMenuButtonBoundingClientRect` | `()` → `{width,height,top,right,bottom,left}` | [doc](https://opendocs.alipay.com/mini/api/menu) | 自定义头部对位胶囊 |
| `my.saveImageToPhotosAlbum` | `{ filePath }` | [doc](https://opendocs.alipay.com/mini/api/media/image/my.saveImagetophotosalbum) | 写入系统相册；首次调用会自动弹权限授权框（授权后再次调用直接落盘） |

*配 [references/builtin-components.md] 例子 c 用 `canvas` 绘图后调 `my.saveImageToPhotosAlbum`。*


## 3 错误处理约定

1. 网络失败统一提示文案 + 保留可重试入口，禁止静默吞错。
2. 业务失败（code 非成功值）区分「提示型」与「阻断型」；阻断型不要 toast 后继续走成功 UI。
3. 登录态失效：清 storage → 重新静默登录 → 重放原请求（仅一次，防死循环）。
