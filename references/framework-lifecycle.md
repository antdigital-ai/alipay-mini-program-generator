# 小程序框架语义与生命周期（depth）

> 权威来源：[OpenDocs mini/framework 总览](https://opendocs.alipay.com/mini/framework/overview)。函数签名/回调顺序若与 OpenDocs 不一致，以 OpenDocs 为准。本 references 不替代 [references/architecture.md]（目录结构/app.json 字段表），不替代 [references/coding-standards.md]（自定义组件写法），只补「语义层」与「生命周期触发序列」。
>
> 本 references 引入并允许调用的 `my.*` 见 §6；写代码时仍受 `scripts/check-project.mjs` 的 `MY_API_ALLOWLIST` 约束。

## 1. 运行机制（用于排查"为什么不触发"类问题）

- App / Page / Component 是同一运行时下的三层抽象。
- **双线程模型**：渲染层（WebView）+ 逻辑层（JS 引擎）。逻辑层只能通过 `setData` 把数据推到渲染层；事件回调用 `e.currentTarget.dataset` 等带上去。
- **基础库版本**决定能力上限：`my.getSystemInfoSync().SDKVersion` 拿到当前基础库；过低的版本要么走兼容，要么做版本兜底。
- 总览 [overview](https://opendocs.alipay.com/mini/framework/overview) · 运行机制 [operating-mechanism](https://opendocs.alipay.com/mini/framework/operating-mechanism) · 基础库 [basic-library](https://opendocs.alipay.com/mini/framework/basic-library) · 兼容表 [compatibility](https://opendocs.alipay.com/mini/framework/compatibility)

## 2. App 应用级生命周期

权威源 [OpenDocs/mini/framework/app](https://opendocs.alipay.com/mini/framework/app) · app.json 字段表见 [architecture.md] · app.acss 见 [app-acss](https://opendocs.alipay.com/mini/framework/app-acss)

注册：`App({ ...callbacks, globalData })`，整个小程序只能调 1 次 `App()`。

| 回调 | 触发时机 | 用途 |
|---|---|---|
| `onLaunch(options)` | 冷启动 1 次 | 全局只此一次初始化、preload（`app.json.preloadRule`）触发分包预下载、上报启动场景值 |
| `onShow(options)` | 进入前台（含 onLaunch 之后） | 刷新临时态、扫"被唤醒"场景 |
| `onHide()` | 进入后台 | 暂停定时器 |
| `onError(err)` | 抛出未捕获 JS 错误 | 上报到监控 |
| `onShareAppMessage` | 用户触发分享（页面未定义 `onShareAppMessage` 时兜底） | 全局分享默认卡片 |
| `onUnhandledRejection({reason,promise})` | Promise reject 未捕获（基础库 1.24.1+） | 同上 |
| `onPageNotFound({path,query})` | 访问到不存在的页面（基础库 2.7.2+） | 兜底重定向到首页 |

> `options = { scene, path, query, referrerInfo: { appId, extraData } }`，与 `my.getLaunchOptionsSync()` 返回结构一致；`referrerInfo.extraData` 为来源小程序透传数据；`scene`/`query` 都已 decode 好，**不要二次 decode**。

### 应用级事件（`app.json.events` 字段，独立于 App() 的 my.* 调用）

某行为要被"在 page 以外、Service 模块、各种组件内"监听时，用 `my.onAppShow / my.offAppShow / my.onAppHide / my.offAppHide` 动态注册/卸载，比 page lifecycle 粒度更宽；可重复注册多个 callback 但必须用对应 `my.offApp*` 卸载，否则内存泄露。

OpenDocs：[my.onAppShow](https://opendocs.alipay.com/mini/api/nn7do1) · [my.offAppShow](https://opendocs.alipay.com/mini/api/tkohmw) · [my.onAppHide](https://opendocs.alipay.com/mini/api/tv6qvi) · [my.offAppHide](https://opendocs.alipay.com/mini/api/dldh0a)。

启动参数专用 API：[my.getLaunchOptionsSync](https://opendocs.alipay.com/mini/api/getLaunchOptionsSync)（仅适用 onLaunch 一次读取）、[my.getEnterOptionsSync](https://opendocs.alipay.com/mini/api/029i75)（每次进入都返回最新一次进入参数）。

胶囊按钮位置/尺寸（自定义头部对位胶囊)：[my.getMenuButtonBoundingClientRect](https://opendocs.alipay.com/mini/api/menu)

## 3. Page 页面级生命周期

权威源 [OpenDocs/mini/framework/page](https://opendocs.alipay.com/mini/framework/page) · 页面默认样式 [page-detail](https://opendocs.alipay.com/mini/framework/page-detail) · page.axml [page-axml](https://opendocs.alipay.com/mini/framework/page-axml) · page.acss [page-acss](https://opendocs.alipay.com/mini/framework/page-acss)

注册：`Page({ onLoad, onShow, onReady, onHide, onUnload, onShareAppMessage, onPullDownRefresh, onReachBottom, onPageScroll, onTitleClick, onOptionMenuClick, ... })`。

触发顺序（典型冷启动进入 Page-A，再 navigateTo 到 Page-B 又回退的场景）：

```text
App.onLaunch → App.onShow → Page-A.onLoad(query) → Page-A.onShow → Page-A.onReady
被 Page-B 覆盖：Page-A.onHide → Page-B.onLoad → Page-B.onShow → Page-B.onReady
回退到 Page-A：Page-A.onShow     ← 注意没有 onLoad！
进后台：Page-A.onHide → App.onHide → 切回前台：App.onShow → Page-A.onShow
Page-A 出栈：Page-A.onUnload
```

| 回调 | 参数 | 触发时机 | 用途 |
|---|---|---|---|
| `onLoad(query)` | query(已 decode) | 创建 1 次 | 拉首页列表/详情、初始化栈数据 |
| `onShow` | – | 每次显示（含切回） | 刷新计时、刷"按 onShow 重读"型数据 |
| `onReady` | – | 首次渲染完成 | 测节点尺寸 / 启动入场动画 |
| `onHide` | – | 失显 | 暂停定时器 |
| `onUnload` | – | 卸载 | 清引用、clear timers |
| `onShareAppMessage` | `{ from, target }` | 用户点顶部 Share | 返回 { title, desc, path, imageUrl } |
| `onPullDownRefresh` | – | 用户下拉 | 拉最新数据 → 必须 `my.stopPullDownRefresh()` |
| `onReachBottom` | – | 触底 | 分页下一页 |
| `onPageScroll` | `{ scrollTop }` | 滚动中（高频，请节流） | 反返回顶部按钮 / 头部吸顶 |
| `onTitleClick` | – | 默认标题栏点击 | 标题双击回顶 |
| `onOptionMenuClick` | – | 右上胶囊按钮 | 自定义菜单项 |

⚠️ 陷阱：
- query 已 decode，**不要二次 decode**；URL 分隔用 `&`，参数值里别含 `&`
- `onLoad` 只触发一次；切回前台只触发 `onShow`，所以"用户切 tab 回来想重拉"必须在 `onShow` 写，不是 `onLoad`
- `onShareAppMessage` 不返回对象时分享面板不显示
- `onPullDownRefresh` 完成必须 `my.stopPullDownRefresh()`，否则 loading 一直转

## 4. Component 自定义组件生命周期

权威源 [component-lifecycle](https://opendocs.alipay.com/mini/framework/component-lifecycle) · 总览 [custom-component-overview](https://opendocs.alipay.com/mini/framework/custom-component-overview) · props/方法 [component_object](https://opendocs.alipay.com/mini/framework/component_object) · ref [component-ref](https://opendocs.alipay.com/mini/framework/component-ref)

注册：组件目录下 `.js` 调 `Component({ props, data, methods, didMount, didUpdate, didUnmount, mixins, deriveDataFromProps, ... })`。

```text
created（lifecycle 字段触发，多数情况不用）
   ↓
didMount   ← 首次渲染完成（类 page.onReady）
   ↓
didUpdate(prevProps, prevData)   ← 每次 setData/props 变更后
   ↓
didUnmount  ← 组件销毁
```

| 回调 | 参数 | 触发时机 | 用途 |
|---|---|---|---|
| `didMount` | – | 首次渲染完成 | 测节点 selector、绑一次 onLoad 中不需要的事件监听 |
| `didUpdate(prevProps, prevData)` | 改前的快照 | 数据更新后 | 对齐派生数据（如 prop 变了要重算 list） |
| `didUnmount` | – | 销毁 | 解绑 `my.offX` 监听、clear timers |

与 page 不同：
- 组件**没有 onLoad/onShow**：路由触发不进组件；想按 onShow 重置，用 `my.onAppShow` 全局事件 + didMount 桥接
- `props` 不可直接 mutate；派生数据存 `data`，在 `didUpdate` 里改
- 父→子通信走 props；子→父走 `props.onX` 回调 或 `selectComponent('ref').method()`

## 5. 跨层通讯与"无状态管理库"的数据共享

OpenDocs：[getApp](https://opendocs.alipay.com/mini/framework/get-app) · [getCurrentPages](https://opendocs.alipay.com/mini/framework/getcurrentpages)

何时用：本 skill **不引入 Minifish Signals 这类状态管理库**（minifish 用 Signals，本 skill 走 native）。原生方案三档：

| 场景 | 方案 | 例 |
|---|---|---|
| 全局小状态（用户资料、未读数、登录态） | `getApp().globalData` | `getApp().globalData.unread = 3; this.setData({ unread: getApp().globalData.unread })` |
| 跨 page 即时触发 | `getCurrentPages()` 拿 page stack 引用调方法 | `getCurrentPages().find(p => p.route === 'pages/index/index').refresh()` |
| 父→子 / 子→父双向 | `selectComponent` + props | `this.selectComponent('#child').sync(...)` |

⚠️ 与 [coding-standards.md §1] 一致：`getApp()` 不是"随便堆数据的袋子"，page 间互改 `globalData.x` 算"禁止挂 getApp() 上随意互改"。

## 6. 本 references 引入的 my.* 白名单条目（已同步 check-project.mjs）

| API | OpenDocs（已核实 URL，2026-10） | 用途 |
|---|---|---|
| `my.onAppShow` | [/mini/api/nn7do1](https://opendocs.alipay.com/mini/api/nn7do1) | 注册切回前台监听 |
| `my.offAppShow` | [/mini/api/tkohmw](https://opendocs.alipay.com/mini/api/tkohmw) | 卸载 my.onAppShow 注册的回调 |
| `my.onAppHide` | [/mini/api/tv6qvi](https://opendocs.alipay.com/mini/api/tv6qvi) | 注册进入后台 |
| `my.offAppHide` | [/mini/api/dldh0a](https://opendocs.alipay.com/mini/api/dldh0a) | 卸载 my.onAppHide |
| `my.getLaunchOptionsSync` | [/mini/api/getLaunchOptionsSync](https://opendocs.alipay.com/mini/api/getLaunchOptionsSync) | 冷启动一次读 scene |
| `my.getEnterOptionsSync` | [/mini/api/029i75](https://opendocs.alipay.com/mini/api/029i75) | 任意时刻进入参数 |
| `my.getMenuButtonBoundingClientRect` | [/mini/api/menu](https://opendocs.alipay.com/mini/api/menu) | 胶囊位置 |
| `my.saveImageToPhotosAlbum` | [/mini/api/...save-ImageToPhotosAlbum](https://opendocs.alipay.com/mini/api/media/image/my.saveImagetophotosalbum) | 保存图片到系统相册（与 builtin-components.md 例子 c 配套）|

## 7. 典型业务例子

### 例子 a：冷启动按 scene 路由（onLaunch + getLaunchOptionsSync）

```js
// app.js
App({
  onLaunch(options) {
    const opt = options.scene ? options : my.getLaunchOptionsSync();
    if (opt.scene === '1037' && opt.query && opt.query.orderId) {
      my.navigateTo({ url: `/pages/order/detail?orderId=${opt.query.orderId}` });
    }
  }
});
```

### 例子 b：onShow 同步"未读数"（App + Page.onShow + globalData）

```js
// app.js
App({
  globalData: { unread: 0 },
  onShow() { fetchUnread().then(n => { this.globalData.unread = n; }); }
});

// pages/index/index.js
Page({
  onShow() { this.setData({ unread: getApp().globalData.unread }); }
});
```

### 例子 c：自定义组件用 didUpdate 在 props 变更后对齐派生数据

```js
// components/tag-input/index.js
Component({
  props: { active: false, onConfirm: () => {} },
  data: { _activeList: [] },
  didUpdate(prevProps) {
    if (prevProps.active !== this.props.active && this.props.active) {
      // active 由 off 切到 on 时重置选中项
      this.setData({ _activeList: [] });
    }
  },
  methods: {
    onTagTap(e) {
      const newItems = [...this.data._activeList, e.currentTarget.dataset.tag];
      this.setData({ _activeList: newItems });
      this.props.onConfirm(newItems);
    }
  }
});
```

### 例子 d：Service 模块（非 page）跨组件监听"前台进入"

```js
// services/foreground-listener.js
let onShowCb = null;
let registered = false;

export function startForegroundListening(cb) {
  onShowCb = cb;
  if (!registered) { my.onAppShow(() => onShowCb && onShowCb()); registered = true; }
}

export function stopForegroundListening() {
  if (registered) { my.offAppShow(); registered = false; onShowCb = null; }
}
```

## 8. 反模式

- ❌ `onLaunch` 里 `await my.request(...)`：阻塞冷启动数 100~300 ms。改首页 `onLoad` 拉，或后台预拉 + 加 skeleton
- ❌ `onShow` 里 `setData` 大数组：tab 之间频繁切会卡。只 `setData` 差分量
- ❌ `onLoad` 里二次 decode query：破坏 `%` 字符
- ❌ 写 `my.onAppShow` 但不写配对 `my.offAppShow` / `my.onAppHide` 不 `my.offAppHide`：必成内存泄露
- ❌ 直接修改 `this.props` / page 间互改 `getApp().globalData.x` —— 见 [coding-standards.md §1 / §3]
