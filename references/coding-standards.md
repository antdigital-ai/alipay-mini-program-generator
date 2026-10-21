# 编码规范（Page / Component / AXML / ACSS）

## 1 Page 结构

```js
// pages/order/list.js
import { fetchOrderList } from '../../../services/order';

Page({
  data: {
    list: [],
    loading: false,
    pageNum: 1,
    hasMore: true,
  },

  onLoad(query) {
    // query 为跳转参数对象，如 /pages/order/list?type=2 → { type: '2' }
    this.setData({ type: query.type || 'all' });
    this.fetchList(true);
  },

  onShow() {},
  onReady() {},
  onHide() {},
  onUnload() { /* 释放定时器 */ },
  onPullDownRefresh() { this.fetchList(true).finally(() => my.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore) this.fetchList(false); },
  onShareAppMessage() { return { title: '订单列表', path: 'pages/order/list' }; },

  // 事件处理函数：Page 顶层
  onTapItem(e) {
    const { id } = e.currentTarget.dataset;
    my.navigateTo({ url: `/packageA/pages/detail/detail?id=${id}` });
  },
});
```

规则：
- 生命周期顺序固定书写：`onLoad → onShow → onReady → onHide → onUnload`，再写交互事件，最后写私有方法。
- 页面间传参只走 URL query（`onLoad` 接收）；复杂数据走 storage 或全局状态，禁止挂 `getApp()` 上随意互改。
- 下拉刷新需要页面 `.json`/`app.json` 开 `pullRefresh: true`，结束必须 `my.stopPullDownRefresh()`。

## 2 setData 规范

1. 只提交变化路径：`this.setData({ 'list[3].status': 'paid' })`，不要整列表回传。
2. 单次数据量控制在 100KB 内；超长列表分页追加并配合 `a:for` 的 `key`。
3. 视图层与逻辑层通信是异步序列化的——循环里高频 setData 会阻塞渲染，合并为一次提交。
4. data 命名全 camelCase，布尔用 is/has 前缀。

## 3 自定义组件

```js
// components/goods-card/index.js
Component({
  data: { liked: false },
  props: {
    item: {},           // 支付宝用 props，不是 properties
    onSelect: null,     // 回调通过 props 传入
  },
  didMount() {},        // 挂载（对应微信 attached）
  didUpdate(prevProps) {
    if (prevProps.item.id !== this.props.item.id) this.setData({ liked: false });
  },
  didUnmount() {},
  methods: {
    onTap() { this.props.onSelect && this.props.onSelect(this.props.item); },
  },
});
```

```xml
<!-- 页面中使用：回调写页面方法名，框架绑定为函数 -->
<goods-card item="{{item}}" onSelect="handleSelect" />
```

```json
// 组件 index.json
{ "component": true }
```

页面 `.json` 注册：`{ "usingComponents": { "goods-card": "/components/goods-card/index" } }`

规则：
- 组件对外通信用 `on` 前缀回调 props；不要尝试 `triggerEvent`（那是微信体系）。
- 组件不发请求、不读 URL 参数；数据全部由 props 进、事件回调出，保持可复用。
- `props` 不可直接修改；需要派生状态放 `data`，在 `didUpdate` 里对齐。

## 4 AXML 模板

指令（均带 `a:` 前缀）：

```xml
<view class="list">
  <block a:for="{{list}}" a:for-item="item" a:for-index="idx" key="item.id">
    <goods-card a:if="{{item.status !== 'hidden'}}" item="{{item}}" onSelect="handleSelect" />
  </block>
  <view a:elif="{{list.length === 0}}" class="empty">暂无数据</view>
  <view a:else class="loading-more">加载中…</view>
</view>
```

- 条件：`a:if` / `a:elif` / `a:else`；循环：`a:for`，配套 `a:for-item`/`a:for-index`，**`key` 必写**（用稳定 id，别用数组下标）。
- 事件：`onTap`（冒泡）/ `catchTap`（阻断冒泡）；input 用 `onInput`；取数据 `e.currentTarget.dataset.x`（AXML 里 `data-x` 驼峰映射）。
- 插值 `{{ }}` 支持简单表达式与三元，不支持函数调用与复杂计算——逻辑放 JS。
- 受控 input：`<input value="{{text}}" onInput="onTextChange" />`，handler 里回写 `this.setData({ text: e.detail.value })`。
- 常用基础组件：`view` `text` `image` `button` `input` `scroll-view`（纵向滚动必须显式 `scroll-y`）`swiper` `rich-text`。文本内容必须包在 `text` 内。

## 5 ACSS 规范

- 单位体系：`rpx`（750rpx = 屏宽，响应式）为主；1px 物理边框等用 `px`。
- 布局优先 flex；页面级样式尽量只写 class 选择器，避免深层后代选择器（小程序样式匹配成本高）。
- 全局公共样式（按钮、间距）集中在 `app.acss`；`@import` 支持相对路径。
- 组件样式默认隔离；确需页面样式渗入组件时在组件 `.json` 配 `"styleIsolation": "apply-shared"`。
- 颜色/间距收敛为有限 token 集，不要满屏魔法值。

## 6 services 层写法

```js
// services/order.js
import { request } from '../utils/request';

export function fetchOrderList(params) {
  return request('/order/list', 'GET', params);
}
export function createOrder(payload) {
  return request('/order/create', 'POST', payload);
}
```

接口层只做「语义命名 + 参数透传 + 响应解包」，不做 UI 反馈；错误提示统一由 request 封装或页面层决定。
