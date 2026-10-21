# alipay-mini-program-generator

> **Codex / Claude Code Skill** — 装到技能目录后，agent 在你用自然语言提需求时自动按 6-Gate 工程化流程执行，覆盖支付宝小程序（原生框架）的架构 → 编码 → 能力调用 → 调试 → 交付全链路；并自带确定性检查脚本与 IDE 唤起脚本。

## ✨ 特性

- **6-Gate 工作流**：状态判定 → 架构配置 → 编码 → `my.*` 能力调用 → 调试验证 → 交付；每个 Gate 的产出完整后才进下一个，发现上层决策错误自动回退。
- **自带确定性检查脚本**（三硬指标）：JS 零语法错误 / `my.*` API 零臆造（白名单 + 与 `references/jsapi.md` 单一事实源自动比对）/ 编码规范执法（请求仅限 `utils/`、`a:for` 必带 `key`、自定义组件必须注册 等）。
- **跨平台 IDE 唤起**：macOS / Windows 自动定位并启动支付宝「小程序开发者工具」+ 打开项目与模拟器；Linux 受限环境如实告知。
- **微信 → 支付宝迁移对照**：API / 配置字段 / 组件名差异表与迁移流程。

## 📦 安装

### 方式一：安装到 Codex 技能目录（推荐）

把包当普通依赖装进临时目录、再把技能目录搬到技能根目录：

```bash
TARGET="$HOME/.agents/skills/alipay-mini-program-generator"
mkdir -p "$HOME/.agents/skills"

# 若目标目录已存在，请先手动清空再继续
TMP="$(mktemp -d)"; cd "$TMP"
npm install --no-save alipay-mini-program-generator
mv "node_modules/alipay-mini-program-generator" "$TARGET"
```

> 装完重开 agent（或下一次发起请求），即可被自动识别。

### 方式二：本地软链（开发联调，改完即时生效）

```bash
ln -s "$(pwd)" "$HOME/.agents/skills/alipay-mini-program-generator"
```

## 🚀 使用

无需手动调用：在 Codex / Claude Code 里用自然语言提需求，例如：

- "帮我新建一个支付宝小程序 Todos 页面"
- "把某个微信小程序迁到支付宝"
- "排查 `my.request` 报错"
- "做真机预览"

agent 识别意图后会按 `SKILL.md` 的 6-Gate 流程执行，并在需要时跑这几个脚本：

| 脚本 | 作用 | 退出码语义 |
|---|---|---|
| `scripts/check-env.mjs` | 环境探针：Node ≥ 18、IDE 安装与版本、minidev 可达、项目 appId | `0` 就绪 / `1` 阻断 |
| `scripts/check-project.mjs` | 工程确定性检查（语法 / API / 规范 / 结构） | `0` 通过 / `1` 错误 |
| `scripts/open-ide.mjs` | 唤起 IDE + 模拟器（加 `--qr` 走真机预览二维码） | `0` 完成 / `1` 无法唤起 |

直接手工执行也没问题：

```bash
node ~/.../alipay-mini-program-generator/scripts/check-env.mjs <project-path>
node ~/.../alipay-mini-program-generator/scripts/check-project.mjs <project-path>
node ~/.../alipay-mini-program-generator/scripts/open-ide.mjs <project-path>
node ~/.../alipay-mini-program-generator/scripts/open-ide.mjs <project-path> --qr <appId>
```

脚本会在首次使用时自动 `npx -y minidev@2.2.5` 装上 `minidev`。

## 📁 目录结构

```
SKILL.md                 # Skill 指令正文（agent 读取）
.claude-skill.json       # 包→技能 manifest
references/
  ├─ architecture.md     # 目录结构、app.json 全字段、分包/预下载/启动性能
  ├─ coding-standards.md # Page/Component 写法、AXML/ACSS 规范、数据流
  ├─ jsapi.md            # my.* API 分类、Promise 封装模板、错误处理
  ├─ devtools.md         # 开发者工具安装、模拟器/真机调试、白名单、报错速查
  └─ wechat-migration.md# 微信→支付宝对照表与迁移流程
scripts/
  ├─ check-env.mjs
  ├─ check-project.mjs
  ├─ open-ide.mjs
  └─ lib/platform.mjs    # 跨平台公共能力（IDE 定位 / npx 调用 / minidev 版本固定）
package.json
README.md
```

注：`evals/`（自检夹具）**只在源码仓库中**，不随 npm 包发布（见 `package.json` 的 `files` 白名单与 `.npmignore`）。

## ⚙️ 前置要求

- **Node.js ≥ 18**（脚本会自检并拦死低版本）
- **小程序开发者工具**：macOS / Windows。Linux 无官方 IDE，仅做开发与静态检查
- **appId**：在 [开放平台](https://open.alipay.com) 创建小程序后获取；缺 appId 仍可开发与静态验证，但模拟器完整预览 / 真机 / 上传依赖 appId
- **minidev ≥ 2.2.5**：脚本内固定版本，`npx` 按需自动安装

## 🧪 Skill 自检（面向维护者）

从源码仓库克隆后执行：

```bash
node alipay-mini-program-generator/evals/run-evals.mjs
```

跑通「正例全绿 + 14 类负例逐项拦截 + 6 条 IDE 跨平台定位用例（当前 21/21）」才算 Skill 改动合格。

## 🧭 6-Gate 工作流概览

| Gate | 主题 | 关键产出 |
|---|---|---|
| A | 状态判定与需求澄清 | 环境就绪清单、项目状态（新建/存量）、需求粒度、敏感能力前置 |
| B | 架构与配置 | 目录结构、`app.json` 逐字段、分包/预下载、包体评估 |
| C | 页面与组件编码 | Page/Component 写法、AXML 指令、ACSS rpx 体系、`utils/request.js` 统一封装 |
| D | 支付宝能力调用 | `my.*` JSAPI 分类、Promise 封装、fail 兜底、敏感能力前置 |
| E | 验证与调试 | `check-project.mjs`（确定性）+ `open-ide.mjs`（模拟器）+ 可选 `--qr`（真机），错误分级契约 |
| F | 交付 | 变更摘要、模拟器唤起三态、开放平台侧待办 |

## ⚠️ 商标声明

本技能内容仅供技术学习与开发者社区交流，未与蚂蚁集团 / 支付宝（中国）网络技术有限公司存在任何关联或授权关系。`alipay` / 支付宝 / 小程序 等相关商标、产品名称归其各自所有权人所有。

## 📄 License

ISC © [唐小新](mailto:1302947749@qq.com)

## 👤 Author

唐小新 <1302947749@qq.com>
