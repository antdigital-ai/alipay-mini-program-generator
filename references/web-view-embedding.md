# web-view 嵌入 H5 开发指南（depth）

> 当任务是把一段 H5 网页嵌入支付宝小程序并做双向通信时用本节。要点速记与可运行例子见 [references/builtin-components.md] 例子 d；本指南给完整嵌入步骤、H5 域名配置、生命周期/分享/版本、受限排错与真机调试。
>
> 权威：[web-view H5 页面承载](https://opendocs.alipay.com/mini/component/web-view) · [my.createWebViewContext](https://opendocs.alipay.com/mini/api/webview-context) · [配置 H5 域名](https://opendocs.alipay.com/mini/component/idfvg6) · [页面访问受限处理](https://opendocs.alipay.com/mini/component/access) · [支付宝小程序内嵌 H5 页面](https://opendocs.alipay.com/mini/tool/h5) · [小程序内嵌&外跳能力导航](https://opendocs.alipay.com/mini/0090ty)

## 0 适用边界

- 本节给出 **小程序 ↔ H5 通信契约** 与原生 HTML H5 参考；H5 用 React/Vue SPA 时，其框架内部构建/部署属前端框架侧，不在此列——只要产物是部署在白名单域名上的 **HTTPS** 站点并按下面注入小程序脚本即可。
- 与「独立 H5 JSBridge」区分：网页&移动应用（网页支付/身份认证等独立网页）用的 `window.AlipayJSBridge` 是另一套体系，**不是** web-view 内嵌场景；web-view 嵌入用的是下文的 `my.*`。
- 小程序**不直接支持外跳 H5**；web-view 是内嵌 H5 的唯一组件途径（外跳能力导航见 [小程序内嵌&外跳能力导航](https://opendocs.alipay.com/mini/0090ty)）。

## 1 前置约束（先确认可用性再动手）

- 仅**企业小程序**；不支持个人小程序、不支持在插件内使用。
- 每个页面**只能一个 web-view**，且**占满 page、遮盖其它组件**；不能塞进小 `view`、不支持横屏 / 全屏。
- **不支持多页面 web-view 间通讯**，也不支持同一页面多 web-view 互连。
- 版本：客户端 **10.1.35+**；基本库 **2.7.17+** 才支持 Native 渲染引擎。先 `my.canIUse('web-view')` 兜底判断。

## 2 H5 域名配置（web-view 必须先配白名单，否则真机必被拦）

> 注意：这是**「开发设置 > H5 域名配置」**，与 `my.request` 用的「服务器域名白名单」是**两个不同的设置**，各配各的。

步骤：

1. 开放平台控制台 → 目标小程序「详情」→ **开发设置 → H5 域名配置**。
2. 下载平台提供的**校验文件**，放到该 H5 域名站点**根目录**（使其可被 `https://<域名>/<校验文件>` 访问），再在控制台登记域名。
3. 规则：
   - 仅 **https**；总数 **≤ 20** 个；
   - 主文档 URL、iframe 里的主文档 URL、后续重定向跳转的主文档 URL **都要**在白名单内；
   - **不支持阿里域名**（taobao/tmall/alipay 等官方域名另走对应能力，不能塞 web-view）；
   - 只支持商家**自有域名**，第三方域名（bilibili/baidu/weixin 等）会被拦。
4. **白名单变更后必须发版**，新的白名单仅对新版本小程序生效（老版本用户仍按旧白名单）。

受限错误码速查（详见 [/component/access](https://opendocs.alipay.com/mini/component/access)）：

| errorNo | 现象/原因 | 处理 |
|---|---|---|
| `040001006` | 访问域名不在白名单 | 按上一步加白名单（发版后生效） |
| `040001007` | http 域名（小程序强制 https） | 升级为 https 再加白名单 |
| `040001002` | 非 https scheme（`weixin://`、`tbopen://`、`alipays://` 等做 src 重定向） | 用 https 域名；跳自有 App 用其它方案 |

`src` 必须是标准 H5 链接，**不可**含 `alipays://` 等内容，否则即使 `https://render.alipay.com` 开头也会重定向失败。

## 3 双向通信契约

完整可运行例子见 [references/builtin-components.md] 例子 d。机制梗概：

```
小程序(逻辑层)  <web-view onMessage>          ← H5  my.postMessage({...})     （H5→小程序，实时、无时机限制）
小程序(逻辑层)  webViewContext.postMessage({...}) → H5  my.onMessage = fn     （小程序→H5）
小程序(逻辑层)  onLoad 内 my.createWebViewContext('web-view-id') 建通道
```

- `e.detail = { data }`：小程序 `onMessage` 收到的 `e.detail.data` 即 H5 `postMessage` 传入的对象。
- 反向（小程序→H5）：`Page.onLoad` 内 `this.webViewContext = my.createWebViewContext('web-view-id')`（id 对应 AXML `<web-view id="web-view-id">`，基础库 1.8.0+ / 客户端 10.10+；**Native 渲染引擎不支持**，`my.canIUse('createWebViewContext')` 兜底），再 `this.webViewContext.postMessage({...})`；H5 侧 `my.onMessage = function(e){...}` 收。
- 事件属性是 `onMessage`（**不是** 微信 `bindmessage`）。

## 4 H5 侧脚本注入

在 H5 页面 `<head>` 注入小程序专用桥（仅支付宝客户端内可访问，UA 含 `AliApp` 再引以避免非支付宝环境 404）：

```html
<script type="text/javascript">if (navigator.userAgent.indexOf('AliApp') > -1) {
  document.writeln('<script src="https://appx/web-view.min.js"' + '>' + '<' + '/script>');
}</script>
```

UA 口径（不要混用）：

- **`AliApp`**：在支付宝客户端内 → 决定**要不要注入** `web-view.min.js`；
- **`MiniProgram`**：UA 含 `MiniProgram` 表示当前在**小程序 web-view 环境**里 → H5 用来分支小程序逻辑；
- `my.getEnv(function(res){ console.log(res.miniprogram); /* true */ })`：小程序桥就绪后最稳的环境判别。

## 5 H5 内可直接调的 `my.*` 受控子集

web-view 内嵌的 H5 只能用下面的 `my.*`（其余请用原生 JS / 走服务端）：

- 导航：`navigateTo` / `navigateBack` / `switchTab` / `reLaunch` / `redirectTo`
- 图片：`chooseImage` / `previewImage`
- 位置：`getLocation` / `openLocation`
- 反馈：`alert` / `showLoading` / `hideLoading`
- 网络：`getNetworkType`
- 分享：`startShare`
- 支付：`tradePay`（**支付只能走 `my.tradePay`，禁止 H5 原生支付**）
- 环境：`getEnv`
- 消息：`postMessage`（→小程序）/ `my.onMessage = fn`（←小程序）

## 6 生命周期事件与分享

web-view 组件事件（小程序侧）：

| 事件 | 触发 | `e.detail` |
|---|---|---|
| `onMessage` | H5 调 `my.postMessage` 时（实时） | `{ data }` |
| `onLoad` | 网页加载成功（基本库 2.7.3+） | `{ src }` |
| `onError` | 网页加载失败（基本库 2.7.3+） | `{ src }` |

`onLoad`/`onError` 用于「加载中 / 加载失败 + 重试」UI：

```js
Page({
  data: { state: 'loading' },
  onLoad() { this.webViewContext = my.createWebViewContext('web-view-1'); },
  onWebViewLoad(e) { this.setData({ state: 'ok' }); },
  onWebViewError(e) { this.setData({ state: 'fail', failSrc: e.detail.src }); },
});
```
```xml
<web-view id="web-view-1" src="{{embedUrl}}"
  onMessage="onH5Message" onLoad="onWebViewLoad" onError="onWebViewError"></web-view>
```

分享当前 H5 URL——用户点小程序分享菜单时，可在 `onShareAppMessage` 里返回 `web-view` 字段让分享打开对应网页：

```js
Page({
  onShareAppMessage(options) {
    return { title: '活动页', path: 'pages/web/index', 'web-view': options.webViewUrl };
  },
});
```

H5 侧主动唤起小程序分享面板用 `my.startShare()`。

## 7 真机调试 × web-view

- **模拟器可能不校验 H5 域名白名单，真机必校验**：常表现为「模拟器一切正常、真机页面受限 `040001006`」→ 回到 §2 核对白名单（含 iframe/重定向域名）并确认已发版生效。
- 调试以真机为准；真机调试模式（IDE「真机调试」回传日志/断点）排查授权、支付、H5 内 `my.*` 调用最直接。
- `my.tradePay` 支付链路必须在真机 + 沙箱/测试商家账号验证，模拟器无法完整还原。
- 详细模拟器/真机/白名单联调见 [references/devtools.md] §3「域名白名单本地联调」+「真机预览」。

## 8 反模式速查

- ❌ 事件属性写 `bindmessage`（支付宝是 `onMessage`）
- ❌ 以为 `postMessage` 仅在 navigateBack/分享/复制链接时推送（微信规则，支付宝每次实时触发）
- ❌ `src` 用非白名单 / `http` / `alipays://`（真机受限 `040001006`/`007`/`002`）
- ❌ 期望 web-view 嵌进小 `view`、个人小程序/插件内用、多 web-view 间通讯、横屏全屏
- ❌ 在 H5 调白名单外 `my.*` 或走 H5 原生支付
- ❌ 把 `http`/`weixin://`/`tbopen://`/`alipays://` 当 src
- ❌ 把独立网页的 `window.AlipayJSBridge` 套到 web-view 内嵌 H5（用 `my.*`）
