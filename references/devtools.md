# 开发者工具调试指南

## 1 工具与项目准备

1. 从支付宝开放平台（opendocs.alipay.com → 下载「小程序开发者工具」）安装 macOS/Windows 版。
   - 脚本自动探测安装位置（判据与 minidev 源码一致：存在 `resources/app/package.json`）：
     - macOS：`/Applications/小程序开发者工具.app`、`~/Applications/小程序开发者工具.app`
     - Windows：`C:\Program Files\小程序开发者工具`、`%ProgramFiles%`、`%ProgramFiles(x86)%`、`%LOCALAPPDATA%\Programs` 下同名目录
   - 装在其他位置：脚本加 `--ide-path <路径>`，或设环境变量 `ALIPAY_IDE_PATH`（macOS 填 `.app` 路径，Windows 填安装目录）
   - Linux 无官方 IDE：可开发与静态检查，模拟器/预览需在 macOS/Windows 上进行
2. IDE 用支付宝账号登录，新建项目时绑定小程序 appid；导入存量项目直接打开含 `app.json` 的目录。
3. IDE 会生成/维护 `mini.project.json`；出现「基础库不支持某 API」时，在 IDE 设置里切换调试基础库版本对齐目标客户端。

> **minidev 版本固定为 `minidev@2.2.5`**（`scripts/lib/platform.mjs` 的 `MINIDEV` 常量）：本文全部 CLI 参数都按该版本 `--help` 实测。手动执行命令也请带版本号；升级时先逐条复核参数再改常量。

## 2 调试链路（顺序执行）

### 第零步：命令行唤起 IDE + 模拟器（优先做）
```
node <skill>/scripts/open-ide.mjs <project-path>
```
脚本封装官方 CLI：`npx -y minidev@2.2.5 ide start-sim -p <项目> --app-path <IDE路径>`（IDE 路径由脚本自动探测），实测链路：
- IDE 未安装 → 给出官方下载地址，退出码 1；
- 正常 → 启动 IDE 并打开项目，模拟器随项目编译展示效果；
- **首次被 CLI 控制**：CLI 会停在「Wait for IDE Service Host Ready」，脚本在 20 秒后输出授权指引——到 IDE「设置 → 安全设置 → 开启服务端口」（弹出确认窗点允许），授权是一次性的，之后重跑脚本即自动打开模拟器；
- 注意：直接以项目路径为参数启动 IDE 二进制**不会**打开项目（只开欢迎窗），别走那条路。
- **Lite 模式**：minidev 的 `ide`/`start-sim` 默认以 IDE Lite（轻量高性能模式）启动，配合任意编辑器使用；需要完整模式时在 IDE 菜单「窗口 → 切换到完整模式」（官方文档：IDE Lite）。
- 编译模式（启动页面/参数）存于项目内 `./.mini-ide/compileMode.json`，可用 `start-sim -m <模式名>` 指定。

### 第零步补充：唤起异常速查

健康链路：`✔ 启动成功` →（首次）若干轮 `Wait for IDE Service Host Ready` → `✔ Connected to IDE` → exit 0。

| 现象 | 处置 |
|---|---|
| 一直 `Wait for IDE Service Host Ready` | IDE → 设置 → 安全设置 → 开启「服务端口」，弹窗点允许，重跑 |
| `APP_ID_CANNOT_BE_SELECTED_<appId>` | IDE 登录账号无该小程序权限 → 换有成员权限的账号登录；或先去掉 appid 仅本地预览 |
| `EPERM: operation not permitted, access '<HOME>'` | 受限执行环境（沙箱/后台进程）HOME 不可写；脚本已自动换 `$TMPDIR/alipay-minidev-home` 重试 |
| macOS 上 IDE 拉起后约 40 秒消失 | 后台进程直接拉起的 IDE 拿不到 GUI 会话；脚本已先用 `open -a` 在用户会话启动 IDE |
| 首次运行超时 | `npx` 首次下载 minidev 较慢（实测 50s+）；预热：`npx -y minidev@2.2.5 --version` |

### 第一步：模拟器编译
- IDE 自动编译并热刷新；先解决编译面板报错（JSON 语法、`app.json` 路径、组件引用不存在是三大高频）。
- 本技能的 `scripts/check-project.mjs` 可在命令行先行扫掉这类确定性错误。

### 第二步：模拟器调试
- **Console**：看 `console.log` 与运行时警告（setData 大数据、缺失 key 等）。
- **调试器/Sources**：对页面 JS 打断点；`data` 面板实时查看/编辑页面数据验证渲染分支。
- **Network**：检查请求 URL、header 与响应信封是否按预期。

### 第三步：真机预览
- IDE「预览」生成二维码，支付宝扫码运行（或数据线连接）。真机才校验：域名白名单、https 证书、客户端基础库差异、真机性能。
- 常见坑：模拟器一切正常、真机请求 fail → 99% 是白名单没配或配了 http。

### 第四步：真机调试模式
- IDE「真机调试」把日志/断点回传到 IDE，排查真机才复现的问题（授权弹窗、支付链路、定位权限）。
- 涉及支付的链路必须在真机 + 沙箱/测试商家账号验证，模拟器无法完整还原。

## 3 域名白名单本地联调

正式域名上线前：
1. 开放平台「开发管理 → 服务器域名白名单」尽早登记（白名单修改后需重新预览生效）。
2. 本地起 `https`（自签证书真机不信任）；可行做法是给本地服务挂一个已备案白名单域名的反向代理（如 `local.example.com` → 127.0.0.1），比关校验更接近真机行为。
3. 纯本地验证接口逻辑时，可先在 `services/` 层做可切换的 mock 数据源，联调完成即删。

## 4 高频报错排查表

| 现象 | 排查顺序 |
|---|---|
| 页面白屏/无法跳转 | `app.json` 是否注册该页 → 四件套是否齐全 → URL 是否带分包 root 前缀 |
| 编译报 JSON 错误 | 逐个 `.json` 校验语法（跑 check-project.mjs 定位文件） |
| 真机请求失败 | 白名单 → https 证书 → 请求参数/`content-type` 与后端是否匹配 |
| 组件不渲染 | 页面 `usingComponents` 路径 → 组件 json 是否 `"component": true` → 标签名与注册名一致 |
| 授权后仍拿不到数据 | `authCode` 是否真的传服务端换了 session → header 是否带 token |
| setData 无效果 | 路径拼写（`list[3].status`）→ data 是否初始化该字段 |
| 授权后 CLI 仍 `Wait for IDE Service Host Ready` | 参考「第零步补充」实录表：IDE 是否在 GUI 会话存活（SingletonLock 判活）→ 是否换了 HOME（用稳定兜底 HOME）→ 服务记录 rec 指向端口是否存活 |
| `APP_ID_CANNOT_BE_SELECTED_<appId>` | IDE 登录账号无该 appId 权限 → 换拥有该小程序的账号登录 IDE；本地模拟器可先不带 appId 预览 |

## 5 发布链路

> 构建侧（`mini.project.json` format2 / `compileOptions` / `minidev build`/`dev`/`config` / 产物路径 / 版本号约定 / 资源约束）已独立到 [references/build-and-publish.md](build-and-publish.md)；本节聚焦上传 / 提审 / 撤回的发布 CLI。

优先走 CLI（`minidev@2.2.5`，以下参数均来自该版本 `--help` 实测）：

```bash
npx -y minidev@2.2.5 login                                  # 一次性授权（浏览器/扫码）
npx -y minidev@2.2.5 upload -p <项目> -a <appId> \
  -v 1.0.1 --version-description '修复列表分页'              # 上传版本（描述 ≤200 字符）
npx -y minidev@2.2.5 upload -p <项目> -a <appId> -v 1.0.1 -e # 上传并自动设为体验版（需权限）
#   -d/--delete-version <版本号>：上传时删除指定旧版本（需权限），不需要就不要传

# 提审：-v、--version-description（5-500 字符）、--version-screenshot（≤4M/张，最大 2160*3840）均必填
npx -y minidev@2.2.5 audit -a <appId> -v 1.0.1 \
  --version-description '修复列表分页问题，优化首页加载' \
  --version-screenshot ./shots/1.png ./shots/2.png
#   可选：--auto-publish（审核通过自动上架）、--test-account <账号> --test-account-password <密码>

npx -y minidev@2.2.5 cancel-audit -a <appId> -v 1.0.1      # 撤回提审（-v 必填）
```

CLI 不便时用 IDE「上传」等价完成。提审前确认清单：
- 敏感能力权限已申请、隐私协议/用户信息采集声明合规
- check-project.mjs 体积预算通过（主包/分包 ≤ 2MB）
- **体验成员已配置**：上传体验版前，在开放平台「成员管理」添加验收人员的支付宝账号，否则他人扫码看不到体验版
- **appid 一致性**：mini.project.json 的 appid 与开放平台目标小程序一致（不一致会上传到别的小程序，真机预览/审核全对不上）

审核通过后全量/灰度发布在开放平台侧配置。

## 5.5 appId：模拟器/真机/上传的前置标识

| 环节 | appId 是否必填 |
|---|---|
| `ide start-sim`（模拟器） | 可选（`-a`），但 IDE 绑定 appId 才能完整预览小程序，**强烈建议提供** |
| `preview`（真机预览） | 必填（`-a`） |
| `upload` / `audit`（发布） | 必填（`-a`） |

获取：支付宝开放平台（open.alipay.com）创建小程序后在控制台查看（16 位数字）。
配置：项目根 `mini.project.json` 的 `appid` 字段；或运行时 `--appid <id>` 参数（优先级更高）。本技能的 open-ide.mjs 自动按「参数 > mini.project.json」解析并透传。

## 6 真机预览 CLI

```bash
# 二维码直接输出在终端，支付宝扫码运行
npx -y minidev@2.2.5 preview -p <项目> -a <appId>
# 常用参数（均为实测帮助输出）
#   --page pages/order/order --page-query 'id=1'   指定入口页与参数
#   --scene 1001                                   进入场景值
#   --enable-hot-reboot                            真机推包热重启
#   --ignore-http-domain-check                     联调期忽略 http 白名单校验（仅调试用）
```

或用本技能封装：`node <skill>/scripts/open-ide.mjs <project> --qr <appId>`。
前置：本机完成过 `npx -y minidev@2.2.5 login`、项目配置真实 appId。模拟器不校验域名白名单，**真机才校验**——preview fail 先查白名单。

## 7 编译模式脚手架（compileMode）

启动页/参数等「编译模式」存于项目内 `./.mini-ide/compileMode.json`，模板：

```json
{ "modes": [ { "title": "订单详情", "page": "pages/order/order", "pageQuery": "id=1" } ] }
```

- 模拟器指定启动态：`npx -y minidev@2.2.5 ide start-sim -p <项目> -m 订单详情`
- 自定义模式建议在 IDE 中维护（脚本只读该文件）；`pages[0]` 对应内置模式 default
