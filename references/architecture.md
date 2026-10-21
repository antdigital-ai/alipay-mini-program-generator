# 架构与配置规范

## 1 标准目录结构

```
project/
├── app.js                 # 应用入口：App({ onLaunch, onShow, onHide, ... })
├── app.json               # 全局配置
├── app.acss               # 全局样式（可选，但建议保留公共样式）
├── mini.project.json      # 开发者工具项目配置（由 IDE 维护，勿手写乱改）
├── pages/                 # 主包页面
│   └── index/
│       ├── index.axml
│       ├── index.js
│       ├── index.json
│       └── index.acss
├── packageA/              # 分包（root 即目录名）
│   └── pages/
│       └── detail/
│           └── （同上四件套）
├── components/            # 自定义组件
│   └── goods-card/
│       ├── index.axml
│       ├── index.js
│       ├── index.json     # 必须含 "component": true
│       └── index.acss
├── utils/
│   ├── request.js         # 唯一的网络出口
│   ├── storage.js         # storage 读写封装
│   └── format.js          # 纯函数工具
└── services/              # 按业务域组织接口层
    ├── order.js
    └── user.js
```

分层原则：页面（视图编排）→ services（业务接口语义）→ utils/request.js（唯一 HTTP 出口）。页面禁止 import services 之外的底层细节，组件禁止直接发请求（数据由页面传入 props）。

## 2 app.json 配置

字段名与微信小程序**不同**，按下面这份为准：

```json
{
  "pages": ["pages/index/index"],
  "window": {
    "defaultTitle": "小程序名称",
    "titleBarColor": "#1677ff",
    "pullRefresh": false,
    "allowsBounceVertical": "YES"
  },
  "tabBar": {
    "textColor": "#999999",
    "selectedColor": "#1677ff",
    "backgroundColor": "#ffffff",
    "items": [
      { "pagePath": "pages/index/index", "name": "首页", "icon": "assets/tab/home.png", "activeIcon": "assets/tab/home-active.png" }
    ]
  },
  "subPackages": [
    { "root": "packageA", "pages": ["pages/detail/detail"] }
  ],
  "preloadRule": {
    "pages/index/index": { "network": "all", "packages": ["packageA"] }
  },
  "component2": true,
  "lazyCodeLoading": "requiredComponents"
}
```

关键差异与规则：

| 项 | 支付宝 | 备注 |
|---|---|---|
| 窗口标题 | `window.defaultTitle` | 微信是 `navigationBarTitleText`，别抄错 |
| 导航栏颜色 | `window.titleBarColor` | 运行时可用 `my.setNavigationBar` 改 |
| tabBar 项 | `items[].pagePath / name / icon / activeIcon` | 2-5 个；`pagePath` 必须先在 `pages` 声明；icon 为 ≤40KB 本地图片 |
| 分包 | `subPackages` | 单个主包/分包 ≤ 2MB，总包上限以开放平台当期规则为准 |
| 组件体系 | `component2: true` | 开启后组件走 `didMount` 等新生命周期 |
| 按需注入 | `lazyCodeLoading: "requiredComponents"` | 只注入页面实际用到的组件代码，改善启动耗时 |

分包注意：
1. 分包页面路径 = `root + 分包内相对路径`，跳转 URL 写全：`/packageA/pages/detail/detail?id=1`。
2. 分包可以引用主包 `components/` 与 `utils/`，主包**不能**引用分包内资源（否则编译报错/隐式打进主包）。
3. `preloadRule` 的 key 是触发页全路径，`packages` 是分包 `root` 数组；`network` 取 `all` 或 `wifi`。

## 3 app.js 与页面注册

```js
// app.js
App({
  onLaunch(options) { /* 全局仅一次：可做静默登录预取 */ },
  onShow(options) { /* 从后台切回；可读 options.query 处理唤起参数 */ },
  onHide() {},
  globalData: { theme: 'light' },
});
```

页面获取全局数据用 `getApp().globalData`。`onLaunch` 里不要做耗时同步操作，会阻塞首屏。

## 4 启动性能基线

按优先级执行：
1. `lazyCodeLoading` + 只在页面级 `usingComponents` 声明实际用到的组件，全局 `usingComponents` 只留真正全站组件。
2. 首页数据在 `onLoad` 发起（依赖全局登录态时先在 `app.js onLaunch` 预取，页面侧等待复用，避免双请求）。
3. 首屏静态大图走 CDN；tabBar icon 保持小体积。
4. 非首屏业务全部移分包，并按动线配置 `preloadRule`。

## 5 mini.project.json

由小程序开发者工具生成与维护（含基础库/编译选项等）。约定：
- 不手写、不提交仓库里的本地差异化配置；由 IDE「新建项目」产出基线后只增改可共享字段。
- 唯一需要人工确认的是：app 的 appid 在 IDE 项目设置/开放平台侧一致，真机预览依赖它。
