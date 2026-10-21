---
name: alipay-mini-program-generator
description: 支付宝小程序（原生框架）工程级开发技能：覆盖架构与目录规范、app.json/分包配置、AXML/ACSS 页面与组件编码、my.* JSAPI 能力调用（网络、存储、授权、支付、路由、UI）、小程序开发者工具的模拟器调试与真机预览，以及微信小程序到支付宝的迁移对照。当用户要新建或修改支付宝小程序项目、编写页面/组件、配置分包或 tabBar、封装请求或调用支付宝能力、把微信小程序迁移/双端对齐到支付宝、排查小程序报错或做真机调试时，必须使用本技能。不适用于微信小程序自身开发，也不适用于 Taro/uni-app 跨端项目（编译型框架，规则不同）。
---

# 支付宝小程序工程级开发

## 0 职责边界

本技能服务于**支付宝小程序原生开发**的完整工程链路：架构 → 编码 → 能力调用 → 调试验证 → 交付。

不处理的事项（明确告知用户另寻方案）：
- 把存量小程序改造成 AI 可调用的原子接口/原子组件 → 用官方 `alipay-skills-generate`
- 微信/抖音/百度等其他平台小程序 → API 命名空间（`wx.*`/`tt.*`）、配置字段（如 `navigationBarTitleText`）与支付宝不同，不可混用
- Taro/uni-app 跨端项目 → 编译产物结构与原生工程不同

## 1 核心工作流（按 Gate 顺序执行）

每个 Gate 的产出完整后才进入下一个；发现上层决策错误时回退对应 Gate，不要带病前进。

### Gate A — 状态判定与需求澄清

1. **环境探针（必跑第一步）**：`node <skill>/scripts/check-env.mjs [project-path]`——30 秒出「环境就绪清单」（Node ≥18、IDE 安装位置与版本、minidev 可达、项目 appId）。有 ERROR 先处理或明确列入待办再继续。
   - 支持 macOS / Windows，IDE 路径自动探测；用户装在非默认位置时让其提供路径，用 `--ide-path <路径>`（或环境变量 `ALIPAY_IDE_PATH`）传给 check-env.mjs / open-ide.mjs，不要猜路径。Linux 无官方 IDE，只做开发与静态检查并如实告知。
   - **appId 直接引导输入**：探针报 appId 缺失（或新建项目）时，直接请用户输入 appId，不要问「是否已有 appId」、不要给「有/没有」选项、不要解释 appId 的用途（使用者是有经验的开发者）。用提问工具时只给自由输入框，提示语固定为：
     > 请输入小程序 appId（16 位数字）。还没有可前往 [开放平台](https://open.alipay.com) 创建小程序获取。
   - 拿到后写入 `mini.project.json` 的 `appid` 字段（open-ide.mjs 自动读取透传）；不是 16 位数字时请用户核对一次，不反复追问。
   - 用户跳过：照常开发与静态检查，「appId 待补（模拟器完整预览/真机/上传依赖）」一句话列入交付待办。
   - 存量项目 `mini.project.json` 已有 appid：直接沿用并在摘要中回显，不再询问。
2. 判断项目状态：**新建**（无 `app.json`）/ **存量**（已有 `app.json` 与 `pages/`）。存量项目先读 `app.json`、`app.js` 和目标页面四件套，禁止假设其结构。
3. 澄清需求到「页面级/组件级/能力级」粒度。用户只说「做个下单功能」时，先问清：涉及哪些页面、是否新页面、是否需要登录态与支付。不要在不明确时直接写代码。
4. **敏感能力前置（按能力分口径）**：
   - 支付联调：确认商家已在开放平台完成支付产品签约（当面付/JSAPI 支付等）。**已签约**→真机直接联调；**未签约**→先走沙箱环境验证流程，并把「完成签约」列入交付待办——`my.tradePay` 的 `orderStr` 由服务端生成，签约与密钥配置是服务端能出单的前提
   - 用户信息/地理位置：确认对应权限已在平台申请，未申请则标注阻塞项
   - 真机验证还依赖手机支付宝客户端扫码（客户端版本决定基础库行为），需要真机环节时提前告知用户

### Gate B — 架构与配置

1. 按 [references/architecture.md](references/architecture.md) 的目录结构组织代码；新建项目从标准骨架起步，存量项目遵循已有结构，不擅自重构。涉及 App / Page / Component 三层生命周期触发顺序（onLaunch 阻塞 / onShow 重发 / 跨页数据共享 等）的形态决策，查 [references/framework-lifecycle.md](references/framework-lifecycle.md)。
2. 修改 `app.json` 时逐字段核对（支付宝字段名与微信不同：窗口用 `defaultTitle`/`titleBarColor`，tabBar 项用 `name` 而非 `text`）。新页面必须同时登记进 `pages`/`subPackages` 并落齐四件套文件。
3. 评估包体：主包资源能移则移入分包，静态大图优先走 CDN。核对 `component2` 与 `lazyCodeLoading` 已开启。

### Gate C — 页面与组件编码

1. 遵循 [references/coding-standards.md](references/coding-standards.md)：Page 生命周期写法、Component 的 `props`/`didMount` 体系、AXML 指令（`a:if`/`a:for`/`key`）、ACSS 的 rpx 体系。
2. 所有网络请求必须走统一封装的 `utils/request.js`，禁止在页面里直接散写 `my.request`。
3. 事件处理函数定义在 Page 顶层（组件内放 `methods`），AXML 绑定用 `onTap`/`catchTap`。
4. 每个 setData 只提交必要 diff，禁止整对象回传大列表。

### Gate D — 支付宝能力调用（my.* JSAPI）

1. 查 [references/jsapi.md](references/jsapi.md) 的 API 分类与封装规范：网络、本地存储、登录与用户信息、支付、路由跳转、UI 反馈、设备与媒体、能力探测、应用启动与应用事件。
2. 所有 `my.*` 回调风格 API 用 Promise 封装后调用；`fail` 分支必须处理并给用户可见的兜底提示。
3. 敏感能力（授权、支付、定位）调用前检查前置条件；支付参数只允许来自服务端返回的真实单号，禁止前端拼造。

### Gate E — 验证与调试

1. **确定性检查（三项硬指标）**：`node <skill>/scripts/check-project.mjs <project-path>`，退出码非 0 必须修复后重跑。脚本现在覆盖：
   - JS 语法零错误：全部 `.js` 过 `node --check`（ESM 语法）
   - API 零臆造：所有 `my.*` 调用命中白名单；白名单与 references/jsapi.md 自动比对（漂移即报错）；明文 `http://` 拦截；硬编码密钥拦截
   - 编码规范执法：`my.request` 仅允许出现在 `utils/`；AXML 事件处理器必须存在；自定义组件标签必须注册；`a:for` 必带 `key`；ESM 具名导入必须确实存在
   - 结构：AXML 标签配平、JSON 可解析、页面四件套、tabBar/subPackages/preloadRule 路径、组件引用
2. **自动唤起模拟器（固定动作，每个开发周期都执行）**：`check-project.mjs` 通过后立即运行 `node <skill>/scripts/open-ide.mjs <project-path>`，不询问用户是否需要。脚本经官方 CLI `minidev ide start-sim`（版本固定 `minidev@2.2.5`，见 devtools.md）启动 IDE（默认 Lite 模式）并打开项目+模拟器，自动携带 appId（`--appid` 参数或 `mini.project.json`；两者都无时输出 WARN，如实告知用户补配）。把这次的唤起结果按三态记录进交付摘要：

| 脚本输出 | 含义 | 动作 |
|---|---|---|
| `[OK]` / `[DONE]` | 模拟器已随项目打开 | 告知用户可在模拟器验证；如需指定启动页，用 `start-sim -m <编译模式>`（compileMode.json） |
| `[AUTH]` | 等待 IDE 服务端口授权（一次性） | 明确告知用户：IDE → 设置 → 安全设置 → 开启服务端口，完成后**自动重跑脚本**，不要把授权当作本轮失败 |
| `[FAIL]` / `[TIMEOUT]` / `[BLOCKED]` | 无法唤起（未安装/未登录等） | 报告具体原因与解除方法，列入交付待办 |

   只有 `[OK]`/`[DONE]` 才算「模拟器验证完成」；`[AUTH]` 算「已完成唤起流程、等待一次性授权」。任何一态都不能静默略过。
   唤起异常（授权后仍等待、`APP_ID_CANNOT_BE_SELECTED_<appId>`、HOME 受限 EPERM 等）按 [references/devtools.md](references/devtools.md)「第零步补充：唤起异常速查」处理，不要换着花样盲试。
3. 按 [references/devtools.md](references/devtools.md) 指导用户用小程序开发者工具编译：模拟器先过，再真机预览。真机才会校验域名白名单——模拟器不报 ≠ 真机能跑。
4. **真机预览（可选步骤）**：需要真机验证时运行 `node <skill>/scripts/open-ide.mjs <project-path> --qr <appId>`（内部走 `minidev preview -a <appId>`，二维码输出在终端）。前置：项目配置了真实 appId 且本机完成过 `npx -y minidev@2.2.5 login`；缺任一前置就如实告知并保持模拟器验证，不得伪装成真机已验证。
5. **错误分级契约**：检查脚本的 ERROR = 阻断交付，修复后重跑至 0；WARNING = 不阻断，但**每条必须在交付摘要中给出「已确认/已接受」口径**，不允许静默忽略。
6. 对照本文末尾的交付自检清单逐项确认。

**三层验证分工**（check 通过 ≠ 可上线）：

| 层 | 工具 | 兜住什么 | 兜不住什么 |
|---|---|---|---|
| 静态确定性 | check-project.mjs | 语法/白名单/结构/规范执法等确定性错误 | 类型推断、平台差异、运行时行为 |
| 模拟器 | open-ide.mjs → IDE Lite | 渲染、事件、编译错误、大多数 JSAPI 模拟 | 域名白名单、证书、真机性能 |
| 真机 | `--qr` / IDE 预览 | 白名单校验、真机性能、支付授权链路 | 灰度放量、审核合规 |

### Gate F — 交付

输出变更摘要：新增/修改的文件清单、`app.json` 配置变更、**本次模拟器唤起结果三态**（OK-DONE / AUTH / FAIL，来自 Gate E 第 2 步）、待用户在开放平台完成的事项（域名白名单、权限申请、体验版设置）。

## 2 参考资料索引

| 文件 | 内容 | 加载时机 |
|------|------|----------|
| [references/architecture.md](references/architecture.md) | 目录结构、app.json 全量字段、分包与预下载、启动性能 | Gate B |
| [references/framework-lifecycle.md](references/framework-lifecycle.md) | App/Page/Component 三层生命周期触发序列、应用级事件、跨层通讯（无 Signals 的原生数据共享方案）、启动场景分发例子 | Gate B（生命周期决策）/ Gate E（onShow 类避坑与跨层共享） |
| [references/coding-standards.md](references/coding-standards.md) | Page/Component 写法、AXML 指令、ACSS 规范、数据流 | Gate C |
| [references/builtin-components.md](references/builtin-components.md) | 内置组件目录（41 项 + OpenDocs 链接）、props/events 速查、canvas/scroll-view/picker-view/web-view 典型例子、原生层级限制 | Gate C |
| [references/jsapi.md](references/jsapi.md) | my.* API 分类、Promise 封装模板、错误处理、敏感能力前置、应用启动与应用事件 | Gate D |
| [references/devtools.md](references/devtools.md) | 开发者工具安装、模拟器/真机调试、白名单、常见报错排查、受限环境唤起实录 | Gate E |
| [references/build-and-publish.md](references/build-and-publish.md) | mini.project.json format2 / compileOptions（component2 / TS / Less / treeShaking / resolveAlias / globalObjectMode / transpile）、minidev build / dev / config 三命令、产物路径、版本号约定、资源约束、自定义组件→npm 发布 | Gate E（构建 / 发布链路） |
| [references/wechat-migration.md](references/wechat-migration.md) | 微信→支付宝 API/配置/组件对照表与迁移流程 | 迁移类需求（Gate A 判定） |

## 2.5 Skill 自身回归

（面向 Skill 维护者；`evals/` 只在源码仓库中提供，`.skill` 安装包不含。）修改本 Skill 的 scripts/ 或 references/ 后，必须运行 `node <skill>/evals/run-evals.mjs`（正例全绿 + 14 类负例逐项拦截 + 6 条 IDE 跨平台定位用例），至全部通过（当前 21/21）后才算改完。改了 `MY_API_ALLOWLIST` 或 §0 白名单块后，再运行 `node <skill>/scripts/check-jspi-coverage.mjs`（漂移对账：对 OpenDocs `api/search?word=my.X` 校验 allowlist 全部 API 仍有专属文档，发现漂移 EXIT≠0）。

## 3 硬性约束（违反即返工）

1. **页面必须注册**：`app.json` 的 `pages`/`subPackages` 未声明的 `.axml` 无法路由跳转。
2. **四件套齐全**：每个页面至少有 `.axml` `.js` `.json`（`.acss` 可省）。组件四件套 `.axml` `.js` `.json`（含 `"component": true`）`.acss` 同理。
3. **域名白名单**：`my.request` 只允许 `https`，且域名须在开放平台配置白名单；本地调试白名单放行方案见 devtools.md。
4. **凭据不落前端**：`appKey`/私钥/`token` 类密钥禁止硬编码；签名逻辑放服务端。
5. **组件属性用 `props`**：支付宝自定义组件用 `props`（不是微信的 `properties`），生命周期是 `didMount`/`didUpdate`/`didUnmount`。
6. **样式单位**：布局尺寸一律 `rpx`（750rpx = 屏宽），只有边框等物理像素用 `px`。
7. **rpx 不做运算**：AXML 插值表达式不支持 rpx 计算，尺寸换算在 JS 侧完成后传 data。
8. **零语法错误**：交付前 JS 必须过 `node --check`（脚本内置）。语法错误禁止进入交付。
9. **API 零臆造**：只能使用 check-project.mjs 白名单中的 `my.*` API。对 API 名、入参、返回字段、错误码、基础库版本要求**有任何不确定**（含白名单内 API 的参数细节），必须先查官方 API 文档：https://opendocs.alipay.com/mini/api?pathHash=5b4d0c83 ，按 [references/jsapi.md](references/jsapi.md) §0 的查证流程执行；文档读不到时向用户索取该 API 页内容，不得凭记忆或从微信类推补全。白名单外 API 核实后同步更新白名单与 jsapi.md，然后才能写代码。
10. **模拟器验证**：每个开发周期（不管改动大小）的 Gate E 必须实际运行 open-ide.mjs 并按三态报告结果；不允许只交付代码不看运行效果，也不允许重复轮询询问用户"要不要打开"。

## 4 交付自检清单

- [ ] `check-project.mjs` 退出码为 0
- [ ] appId 已写入 mini.project.json（或用户跳过、已列入待办）
- [ ] check-env.mjs 已跑：无 ERROR，WARN 均已给出口径
- [ ] 全部 `.js` 通过语法检查，无 `my.*` 白名单外调用
- [ ] 已运行 `open-ide.mjs` 且结果三态（OK-DONE / AUTH / FAIL）已写入交付摘要
- [ ] 所有新页面已在 `app.json` 注册且四件套齐全
- [ ] 请求全部走 `utils/request.js`，无散写 `my.request`
- [ ] 每个 `my.*` 异步调用都有 `fail` 处理与用户可见兜底
- [ ] 支付/授权/定位类调用有前置说明与拒绝路径
- [ ] 真机预览通过（或已明确告知用户待办）
- [ ] 已向用户输出开放平台侧待办（白名单、版本、提审）
