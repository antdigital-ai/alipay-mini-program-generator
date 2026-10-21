# 微信 → 支付宝小程序迁移规范

迁移是 API 臆造的高发场景（把 `wx.*` 记忆类推成 `my.*`）。红线只有一条：**任何映射都不可盲信，改完必须过 `check-project.mjs` 白名单校验**。

## 1 API 命名空间对照（已核实部分）

| 微信 | 支付宝 | 备注 |
|---|---|---|
| `wx.request` | `my.request` | 支付宝用 headers（复数）；success/fail 回调同构 |
| `wx.getStorageSync` / `wx.setStorageSync` | `my.getStorageSync` / `my.setStorageSync` | 同名同构 |
| `wx.login` | `my.getAuthCode` + 服务端换取 | 支付宝拿 authCode，没有 wx.login 的 code 直换 session 语义 |
| `wx.requestPayment` | `my.tradePay` | 参数完全不同：微信传签名包，支付宝传服务端返回的 `orderStr`/`tradeNO` |
| `wx.navigateTo` / `redirectTo` / `navigateBack` | `my.navigateTo` / `my.redirectTo` / `my.navigateBack` | 同名同构 |
| `wx.switchTab` | `my.switchTab` | 同构 |
| `wx.showToast` | `my.showToast` | 微信 `title`，支付宝 `content` |
| `wx.showModal` | `my.confirm` / `my.alert` | 支付宝拆成两个 API |
| `wx.authorize` / `wx.getSetting` | `my.authorize` / `my.getSetting` | scope 命名有差异，逐个核对文档 |

凡不在此表的 API：先查 opendocs.alipay.com 对应页面核实，再同步白名单与 jsapi.md，最后才写代码。

## 2 配置字段对照（app.json / 组件）

| 微信 | 支付宝 |
|---|---|
| `window.navigationBarTitleText` | `window.defaultTitle` |
| `window.navigationBarBackgroundColor` | `window.titleBarColor` |
| `tabBar.list[].text` | `tabBar.items[].name` |
| `tabBar.list[].selectedIconPath` | `tabBar.items[].activeIcon` |
| 页面 `.wxml` / `.wxss` | `.axml` / `.acss` |
| 组件 `properties` | `props` |
| 组件生命周期 `attached` / `detached` | `didMount` / `didUnmount` |
| `Component observers` | `didUpdate(prevProps, prevData)` 对比实现 |
| 组件 `triggerEvent` | `on` 前缀回调 props（AXML 传方法名） |
| 指令 `wx:if` / `wx:for` | `a:if` / `a:for` |
| 事件 `bindtap` / `catchtap` | `onTap` / `catchTap` |
| `app.wxss` | `app.acss` |
| `project.config.json` | `mini.project.json`（IDE 维护，字段体系不同，勿手改） |

## 3 迁移流程

1. 结构迁移：`.wxml→.axml`、`.wxss→.acss` 改后缀 + 指令/事件前缀替换（`wx:`→`a:`、`bindtap`→`onTap`）
2. 配置迁移：app.json 按上表逐字段映射（逐个改防止漏，不要删了重写）
3. API 迁移：按第 1 节对照表改命名空间；**改完立即跑 `check-project.mjs`**——白名单外的 `wx.*` 类推残留会全部现形
4. `triggerEvent` 组件改 props 回调；`properties` 改 `props`；生命周期改名
5. Gate E 全量走：确定性检查 → 模拟器 → 真机（重点回归支付/授权链路，两端行为差异最大就在这里）

## 4 高频坑

- 微信 `showToast({title})` 迁过来不报错但**不显示内容**——支付宝要 `content`
- 组件样式隔离默认值两端不同，微信迁过来的组件样式突然失效时，先查 `styleIsolation`
- 微信 `subpackages`（小写 p）支付宝虽兼容，但规范写法是 `subPackages`
