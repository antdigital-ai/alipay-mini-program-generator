# 内置组件目录与速查（depth）

> 权威来源：[mini/component 概览](https://opendocs.alipay.com/mini/component/overview-info)。本 references 只覆盖 **内置 AXML 标签**（小程序运行时提供，无需注册即可用）。自定义组件写法见 [references/coding-standards.md §3]，不在此重复。
>
> 官方目录随时间增删可能漂移：维护者跑 `node scripts/check-jspi-coverage.mjs`（含组件校验分支）刷新本目录。

## 1. 三类组件

| | 内置组件 | 自定义组件 | 第三方组件 |
|---|---|---|---|
| 注册 | 无需任何配置 | 在 `.js` 调 `Component({...})` + `.json` 写 `"component": true` | 来自 npm / 插件 / 资产 |
| 使用 | `<tag />` 直接用 | `.json` `usingComponents` 注册后 `<my-tag />` | 同自定义，import 路径不同 |
| 参考 | 本文（速查表 + 例子）+ [OpenDocs 概览](https://opendocs.alipay.com/mini/component/overview-info) | [coding-standards.md §3] | 各自文档 |

## 2. 内置组件目录（按 OpenDocs sitemap，2026-10 全测）

### 容器 / 布局

| 组件 | OpenDocs | 速记 |
|---|---|---|
| `view` | [/component/view](https://opendocs.alipay.com/mini/component/view) | 块容器（默认行流） |
| `text` | [/component/text](https://opendocs.alipay.com/mini/component/text) | 行内文字 |
| `scroll-view` | [/component/scroll-view](https://opendocs.alipay.com/mini/component/scroll-view) | 可滚容器（横/竖，bindscroll） |
| `swiper` / `swiper-item` | [/component/swiper](https://opendocs.alipay.com/mini/component/swiper) | 轮播 |
| `movable-area` / `movable-view` | [/component/movable-area](https://opendocs.alipay.com/mini/component/movable-area) · [/component/movable-view](https://opendocs.alipay.com/mini/component/movable-view) | 拖拽 / 双指缩放 |
| `cover-view` / `cover-image` | [/component/cover-view](https://opendocs.alipay.com/mini/component/cover-view) · [/component/cover-image](https://opendocs.alipay.com/mini/component/cover-image) | 覆盖原生组件（map/video/canvas 等）上方 |
| `rich-text` | [/component/rich-text](https://opendocs.alipay.com/mini/component/rich-text) | 富文本 HTML（白名单 tag/attr） |
| `navigator` | [/component/navigator](https://opendocs.alipay.com/mini/component/navigator) | 内嵌路由跳转 |

### 表单

| 组件 | OpenDocs |
|---|---|
| `form` | [/component/form](https://opendocs.alipay.com/mini/component/form) |
| `input` | [/component/input](https://opendocs.alipay.com/mini/component/input) |
| `textarea` | [/component/textarea](https://opendocs.alipay.com/mini/component/textarea) |
| `button` | [/component/button](https://opendocs.alipay.com/mini/component/button) |
| `label` | [/component/label](https://opendocs.alipay.com/mini/component/label) |
| `checkbox` / `checkbox-group` | [/component/checkbox](https://opendocs.alipay.com/mini/component/checkbox) · [/component/checkbox-group](https://opendocs.alipay.com/mini/component/checkbox-group) |
| `radio` / `radio-group` | [/component/radio](https://opendocs.alipay.com/mini/component/radio) · [/component/radio-group](https://opendocs.alipay.com/mini/component/radio-group) |
| `switch` | [/component/switch](https://opendocs.alipay.com/mini/component/switch) |
| `slider` | [/component/slider](https://opendocs.alipay.com/mini/component/slider) |
| `picker` | [/component/picker](https://opendocs.alipay.com/mini/component/picker) |
| `picker-view` / `picker-view-column` | [/component/picker-view](https://opendocs.alipay.com/mini/component/picker-view) · [/component/picker-view-column](https://opendocs.alipay.com/mini/component/picker-view-column) |

### 媒体

| 组件 | OpenDocs |
|---|---|
| `image` | [/component/image](https://opendocs.alipay.com/mini/component/image) |
| `canvas` | [/component/canvas](https://opendocs.alipay.com/mini/component/canvas) |
| `video` | [/component/video](https://opendocs.alipay.com/mini/component/video) |
| `audio` | [/component/audio](https://opendocs.alipay.com/mini/component/audio)（已废弃，建议用 `my.createInnerAudioContext`） |
| `camera` | [/component/camera](https://opendocs.alipay.com/mini/component/camera) |
| `map` | [/component/map](https://opendocs.alipay.com/mini/component/map) |
| `lottie` | [/component/lottie](https://opendocs.alipay.com/mini/component/lottie) |

### 嵌入 / 路由 / 状态

| 组件 | OpenDocs |
|---|---|
| `web-view` | [/component/web-view](https://opendocs.alipay.com/mini/component/web-view) |
| `pagemeta` | [/component/pagemeta](https://opendocs.alipay.com/mini/component/pagemeta) |
| `icon` | [/component/icon](https://opendocs.alipay.com/mini/component/icon) |
| `progress` | [/component/progress](https://opendocs.alipay.com/mini/component/progress) |
| `accessibility` | [/component/accessibility](https://opendocs.alipay.com/mini/component/accessibility) |
| `access` | [/component/access](https://opendocs.alipay.com/mini/component/access) |
| `contact-button` | [/component/contact-button](https://opendocs.alipay.com/mini/component/contact-button) |
| `lifestyle` | [/component/lifestyle](https://opendocs.alipay.com/mini/component/lifestyle) |
| `error-view` | [/component/error-view](https://opendocs.alipay.com/mini/component/error-view) |

## 3. 高频组件 props/events 速查

> 仅凭速查可能漏字段；不常见的 prop/事件以 [OpenDocs 对应文档页](https://opendocs.alipay.com/mini/component/overview-info) 实测为准。

### `scroll-view`

`scroll-y` / `scroll-x`（bool） · `scroll-into-view`（子孙元素 id，自动滚到） · `upper-threshold` / `lower-threshold` · `bindscroll`（`{scrollTop, scrollHeight, deltaX, deltaY}`） · `bindscrolltolower`（典型：拉下一页）

### `swiper` + `swiper-item`

`autoplay` · `interval` · `circular` · `current` · `indicator-dots` · `indicator-color` · `indicator-active-color` · `bindchange`（`{current, source}`，区分 autoplay/用户滑） · `bindanimationfinish`

### `picker`（mode 分类）

- `mode="selector"`：`range` `range-key` `value` `bindchange`
- `mode="multiSelector"`：`range` 二维数组 + `bindcolumnchange` 联动
- `mode="region"`：`value=["省","市","区"]` · `custom-item`
- `mode="date"`/`mode="time"`：`start` `end` `value`

### `picker-view`

`indicator-style`/`mask-style` · `value` 是每列 index 数组 · `bindchange` `bindpickstart` `bindpickend`

### `canvas`（新代码用 `type="2d"`）

旧：`id` + `my.createCanvasContext(id)` → `...fillText` → `ctx.draw(false, cb)` → `my.canvasToTempFilePath`
保存到相册：拿到 tempFilePath 后调 `my.saveImageToPhotosAlbum`（见 framework-lifecycle.md §6 新白名单）

### `image`

`mode`：`scaleToFill`/`aspectFit`/`aspectFill`/`widthFix`/... · `lazy-load` · `binderror`/`bindload` · 事件 `onTap`/`catchTap`

### `map`

`longitude`/`latitude` · `scale`（默认 16） · `markers`/`polyline`/`polygon`/`include-points`（自动缩放包含点） · 事件 `bindmarkertap`/`bindcallouttap`/`bindregionchange`/`bindcontroltap` · 上面要覆盖 DOM 用 `cover-view` / `cover-image`

### `web-view`

`src` 必须先在开放平台"内嵌网页白名单"配置；H5 侧 `my.postMessage(...)` → 小程序 `bindmessage` 收（只在 navigateBack/分享/复制链接等特定时机）；反向用 query 字符串或 H5 SDK API 实现

### `video`

`src`/`poster`/`controls`/`autoplay`/`loop`/`muted` · 事件 `bindplay`/`bindpause`/`bindended`/`bindtimeupdate`/`bindfullscreenchange`/`binderror`

## 4. 典型业务例子

### 例子 a：`scroll-view` 无限滚动 + 下拉刷新

```xml
<scroll-view scroll-y="{{true}}" lower-threshold="80" bindscrolltolower="onReachLower" style="height:100vh;">
  <view a:for="{{list}}" a:for-item="row" key="row.id">
    <text>{{row.title}}</text>
  </view>
  <view a:if="{{loading}}">载入中…</view>
</scroll-view>
```

```js
Page({
  data: { list: [], loading: false, page: 1 },
  onReachLower() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    fetchNextPage(this.data.page).then(rows => {
      this.setData({ list: this.data.list.concat(rows), page: this.data.page + 1, loading: false });
    });
  },
  onPullDownRefresh() {
    this.setData({ list: [], page: 1 });
    fetchNextPage(1).then(rows => {
      this.setData({ list: rows });
      my.stopPullDownRefresh();
    });
  }
});
```

### 例子 b：`picker-view` 自定义省市两列联动

```xml
<picker-view value="{{value}}" bindchange="onChange" indicator-style="height: 50px;" style="height: 240px;">
  <picker-view-column>
    <view a:for="{{provinceList}}" key="{{index}}">{{item.name}}</view>
  </picker-view-column>
  <picker-view-column>
    <view a:for="{{cityList}}" key="{{index}}">{{item.name}}</view>
  </picker-view-column>
</picker-view>
```

```js
Page({
  data: { provinceList: [], cityList: [], value: [0, 0] },
  onChange(e) {
    const [pi, ci] = e.detail.value;
    if (pi !== this.data.value[0]) {
      // 切省则重置市
      this.setData({ cityList: getCitiesOf(this.data.provinceList[pi]), value: [pi, 0] });
    } else {
      this.setData({ value: [pi, ci] });
    }
  }
});
```

### 例子 c：拿到本地图片路径后保存到相册

首先用 Canvas 2D 新 API（`type="2d"`）把内容画到 canvas，再调实例方法 `toTempFilePath()` 获得本地图片路径，最后用 `my.saveImageToPhotosAlbum` 落相册：

```js
// canvas 2D 新 API；旧 `my.createCanvasContext` / `my.canvasToTempFilePath` 已迁出官方文档，不在 allowlist，禁用（与本文 §6 反模式一致）
// 取 canvas node：需 `my.createSelectorQuery`，未在白名单内；首次接通前按 §0 查证流程同步扩白名单后再写代码
const query = my.createSelectorQuery();
query.select('#poster').fields({ node: true, size: true }).exec((res) => {
  const canvas = res[0].node;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 300, 480);
  ctx.font = '20px sans-serif'; ctx.fillText('我的海报', 60, 100);
  // 实例方法，非 my.* API；saveImageToPhotosAlbum 在白名单
  canvas.toTempFilePath({
    success: (r) => {
      my.saveImageToPhotosAlbum({
        filePath: r.tempFilePath,
        success: () => my.showToast({ title: '已保存' }),
        fail: (e) => my.showToast({ title: '保存失败：' + (e.error || e.errorMessage || '') })
      });
    }
  });
});
```

> Canvas 2D 总览见 [OpenDocs/Canvas 概览](https://opendocs.alipay.com/mini/01vzqv)；`Canvas.toTempFilePath` 见 [/mini/api/toTempFilePath](https://opendocs.alipay.com/mini/api/toTempFilePath)；canvas 组件 props 见 [/component/canvas](https://opendocs.alipay.com/mini/component/canvas)。

### 例子 d：`web-view` 嵌入 H5 + postMessage 双向通讯

```xml
<web-view src="{{embedUrl}}" bindmessage="onH5Message"></web-view>
```

H5 侧（需引入小程序脚本）：
```js
my.postMessage({ action: 'PAY', payload: { orderId: '123' } });
```

小程序 page 侧：
```js
Page({
  onH5Message(e) {
    const { action, payload } = e.detail;
    if (action === 'PAY') { /* 走 my.tradePay */ }
  }
});
```

> 双向细节以 [/component/web-view](https://opendocs.alipay.com/mini/component/web-view) 为准；postMessage 受时机约束（navigateBack/复制链接/分享 时才推送）。

## 5. 嵌套 / 原生层级限制

- `canvas` / `video` / `map` / `camera` / `live-player` / `live-pusher` 是**原生组件**，渲染层级是 native 层；想在上面叠加 DOM 元素时必须用 `cover-view` / `cover-image`，否则被原生盖
- `form` 内 `button` 必须带 `form-type="submit"` 才会触发 `form` 的 `bindsubmit`；普通 button 不触发
- `web-view` 占满 page；不能在小 `view` 内嵌一部分
- `text` 不支持 SVG；`rich-text` 仅支持白名单 tag/attr

## 6. 反模式

- ❌ 没给 `scroll-view` 设高度就想要滚动：会撑爆出 page 必须给固定/可视高度
- ❌ 用 `canvas` 旧 API 写新代码：新项目用 `type="2d"`，绘制更流畅
- ❌ `map.markers` 一次塞上千个：渲染卡；做 visible-range 虚拟化
- ❌ `web-view src` 用非白名单域名：真机一定加载失败
- ❌ 在 `picker-view` 期望 `disabled` 锁列：官方无此字段
