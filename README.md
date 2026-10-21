# alipay-mini-program-generator

> Codex / Claude Code Skill: 装进技能目录（`.agents/skills/` / `.claude/skills/` 等）后，agent 在你用自然语言提需求时按 6-Gate 工程化流程执行，覆盖支付宝小程序（原生框架）的架构 → 编码 → 能力调用 → 调试 → 构建发布 → 交付全链路；自带 4 类确定性脚本与 21/21 回归夹具。

[![npm version](https://img.shields.io/npm/v/alipay-mini-program-generator.svg)](https://www.npmjs.com/package/alipay-mini-program-generator)
[![GitHub stars](https://img.shields.io/github/stars/antdigital-ai/alipay-mini-program-generator?style=social&label=Star)](https://github.com/antdigital-ai/alipay-mini-program-generator)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Why

支付宝原生小程序常见 agent 失误：① `my.*` API 凭记忆臆造、② 跨平台 IDE 唤起磕绊、③ `mini.project.json` / 分包 / 发布链路陌生、④ 微信对照时漏字段。本 Skill 把"约定 + 检查器 + 觉察文档"集中一处，强制 6-Gate 流程，配 4 个确定性脚本 + 21/21 回归夹具，让输出可以直接预览 / 上传 / 测试。

## Features

- **6-Gate Workflow** — 状态判定 → 架构配置 → 编码 → `my.*` 能力调用 → 调试验证 → 交付；每 Gate 产出完整才进下一个，发现上层决策错误自动回退
- **Three-layer Lifecycle & Built-in Components** — App / Page / Component 三层生命周期触发序列、应用级事件、跨层通讯；41 项内置组件按 OpenDocs 2026-10 全量收录，附 props / events 速查与典型例子
- **Zero-Fabrication `my.*`** — 42 项白名单（网络 / 存储 / 授权 / 支付 / 路由 / UI / 启动事件），与 `references/jsapi.md` §0 单一事实源自动比对；散写 `my.request` / 硬编码密钥 / 明文 http / 幽灵导入 / 主包超 2MB / tabBar 超 40KB 自动拦截
- **Build & Publish Chain** — `mini.project.json` format2 与 `compileOptions`（component2 / TypeScript / Less / treeShaking / resolveAlias / globalObjectMode / transpile）、`minidev build` / `dev` / `config` 三命令、`upload` / `audit` / `cancel-audit` / `preview` 发布 CLI、版本递增与资源约束（图片-only）、自定义组件 → npm 发布
- **Cross-Platform IDE Awakening** — macOS / Windows 自动定位「小程序开发者工具」+ 打开项目与模拟器；Linux 受限环境如实告知；`--qr <appId>` 走真机预览二维码与三态记录
- **Allowlist ⇄ OpenDocs Drift Audit** — `check-jspi-coverage.mjs` 实时扫 42 项 `my.*` 看 OpenDocs URL 是否仍能命中；`--with-gap-candidates` 列出可补缺口 API、`--offline` 跳过网络
- **WeChat → Alipay Migration** — API / 配置字段 / 组件名差异表 + 迁移流程 + 高频坑

## Installation

### npm (recommended for engineering use)

```bash
npm install alipay-mini-program-generator
```

> npm 包内容不含 `evals/`；要用 21/21 回归夹具请克隆源码仓库（见下文）。

### Install into Codex skill directory

```bash
TARGET="$HOME/.agents/skills/alipay-mini-program-generator"
mkdir -p "$HOME/.agents/skills"
TMP="$(mktemp -d)"; cd "$TMP"
npm install --no-save alipay-mini-program-generator
mv "node_modules/alipay-mini-program-generator" "$TARGET"
```

### Clone source from GitHub (includes `evals/`)

```bash
git clone git@github.com:antdigital-ai/alipay-mini-program-generator.git \
  $HOME/.agents/skills/alipay-mini-program-generator
```

### Local symlink (for development, edits reflect immediately)

```bash
ln -s "$(pwd)" "$HOME/.agents/skills/alipay-mini-program-generator"
```

> 安装完成后重启 agent（或下一次发起请求）即可被自动识别。

## Usage

无需手动调用：在 Codex / Claude Code 里用自然语言提需求即可。例如：

```text
- 帮我新建一个支付宝小程序 Todos 页面
- 把这个微信小程序迁到支付宝
- 排查 my.request 报错
- 做真机预览
- 把这次改动上传成体验版
- 我要把自定义组件以 npm 包形式发布给别的小程序项目用
```

agent 识别意图后按 `SKILL.md` 的 6-Gate 流程执行，并在需要时调用下面的脚本。

## Scripts

| Script | Purpose | Exit Code |
|---|---|---|
| `scripts/check-env.mjs` | 环境探针：Node ≥ 18、IDE 安装与版本、minidev 可达、项目 appId | `0` ready / `1` blocked |
| `scripts/check-project.mjs` | 工程确定性检查（语法 / 42 项 `my.*` 白名单 / AXML / 编码规范 / 结构） | `0` pass / `1` error |
| `scripts/check-jspi-coverage.mjs` | allowlist ⇄ OpenDocs 漂移对账（`--with-gap-candidates` / `--offline`） | `0` aligned / `1` drift |
| `scripts/open-ide.mjs` | 唤起 IDE + 模拟器（`--qr <appId>` 走真机预览二维码） | `0` done / `1` unreachable |

Run directly:

```bash
node scripts/check-env.mjs     <project-path>
node scripts/check-project.mjs <project-path>
node scripts/check-jspi-coverage.mjs                  # 漂移对账
node scripts/check-jspi-coverage.mjs --with-gap-candidates
node scripts/open-ide.mjs      <project-path>
node scripts/open-ide.mjs      <project-path> --qr <appId>
```

> 第一次使用任一脚本会自动 `npx -y minidev@2.2.5` 装上 `minidev`。

## Build & Publish CLI (`minidev@2.2.5`)

```bash
npx -y minidev@2.2.5 dev     -p <project>                                  # DevServer + HMR
npx -y minidev@2.2.5 build   -p <project> -o dist                           # 构建产物包
npx -y minidev@2.2.5 preview -p <project> -a <appId>                       # 真机预览二维码
npx -y minidev@2.2.5 upload  -p <project> -a <appId> -v <ver> -e            # 上传 + 自动生成体验版
npx -y minidev@2.2.5 audit   -a <appId> -v <ver> --version-description '...' --version-screenshot shots/1.png  # 提审
npx -y minidev@2.2.5 cancel-audit -a <appId> -v <ver>                       # 撤回提审
npx -y minidev@2.2.5 config  set compiler.version 3.9.91                    # 工具配置
```

> 完整参数与 `mini.project.json` format2 / `compileOptions` 字段表见 `references/build-and-publish.md`；发布 CLI 完整示例见 `references/devtools.md §5 / §6`。

## Directory

```
SKILL.md                       # Skill 指令正文（agent 读取）
.claude-skill.json             # 包 → 技能 manifest
references/
  ├─ architecture.md           # 目录结构、app.json 全字段、分包/预下载、启动性能、mini.project.json 速览
  ├─ framework-lifecycle.md    # App/Page/Component 三层生命周期 + 跨层通讯 + 应用级事件 + 反模式
  ├─ coding-standards.md       # Page/Component 写法、AXML/ACSS 规范、services 层、setData 规范
  ├─ builtin-components.md     # 41 项内置组件目录（OpenDocs 2026-10 全测）+ props/events 速查 + 典型例子
  ├─ jsapi.md                  # my.* API 白名单（42 项）、分类、Promise 封装模板、错误处理、敏感能力前置
  ├─ devtools.md               # 开发者工具安装、模拟器/真机调试、域名白名单、报错速查、发布 CLI、appId 前置
  ├─ build-and-publish.md      # mini.project.json format2 + compileOptions、minidev build/dev/config、自定义组件→npm 发布
  └─ wechat-migration.md       # 微信→支付宝 API / 配置 / 组件 对照表 + 迁移流程 + 高频坑
scripts/
  ├─ check-env.mjs             # 环境探针
  ├─ check-project.mjs         # 工程确定性检查（21/21 evals 覆盖）
  ├─ check-jspi-coverage.mjs   # allowlist ⇄ OpenDocs 漂移对账
  ├─ open-ide.mjs              # IDE / 模拟器 / 真机预览二合一
  └─ lib/platform.mjs          # 跨平台公共（IDE 定位 / npx 调用 / minidev 版本固定）
package.json / README.md / .npmignore
evals/                         # 源码仓库内（不随 npm 包发布）
```

> npm 包不含 `evals/`（见 `package.json` 的 `files` 白名单与 `.npmignore`）；GitHub 源码仓库包含 evals 用于维护者跑回归。

## Requirements

- [Node.js](https://nodejs.org) ≥ 18 — scripts will fail on lower versions
- 小程序开发者工具（macOS / Windows）— Linux 无官方 IDE，仅能做开发与静态检查
- appId：在 [开放平台](https://open.alipay.com) 创建小程序后获取（16 位数字）；缺 appId 仍可开发与静态验证，但完整模拟器预览 / 真机 / 上传 / 提审依赖 appId
- `minidev ≥ 2.2.5` — 脚本内固定版本，`npx` 按需自动安装

## Testing

```bash
git clone git@github.com:antdigital-ai/alipay-mini-program-generator.git
cd alipay-mini-program-generator

node evals/run-evals.mjs                                          # 21/21 工程 + IDE 跨平台定位
node scripts/check-jspi-coverage.mjs                              # 期望 42/42 一致、无漂移
node scripts/check-jspi-coverage.mjs --with-gap-candidates         # 列缺口 API 给"扩充白名单"决策
python3 <skill-creator>/scripts/quick_validate.py .
tnpm pack --dry-run --registry=https://registry.npmjs.org/        # 17 files / ~50 kB
```

## 6-Gate Workflow

| Gate | Subject | Output |
|---|---|---|
| A | 状态判定与需求澄清 | 环境就绪清单、项目状态（新建 / 存量）、需求粒度、敏感能力前置 |
| B | 架构与配置 | 目录结构、`app.json` 逐字段、分包 / 预下载、`mini.project.json` 与 `compileOptions`、包体评估 |
| C | 页面与组件编码 | Page / Component 写法、AXML 指令、ACSS rpx 体系、`utils/request.js` 统一封装、41 项内置组件选型 |
| D | 支付宝能力调用 | `my.*` 42 项白名单、Promise 封装、fail 兜底、敏感能力前置、应用级事件订阅 |
| E | 验证与调试 / 构建发布 | `check-project.mjs`（确定性）+ `open-ide.mjs`（模拟器）+ `--qr`（真机）+ `minidev build / preview / upload / audit` |
| F | 交付 | 变更摘要、模拟器唤起三态、开放平台侧待办（白名单 / 权限 / 版本 / 提审） |

## Contributing

欢迎 Issue 与 PR：

- 列出场景 + 期望 agent 行为；附 minidev 与 Node 版本
- 新增 / 修正 `my.*` 或组件时，记得同时改 `scripts/check-project.mjs` 的 `MY_API_ALLOWLIST` + `references/jsapi.md` §0 + `references/builtin-components.md`，并跑完 `node evals/run-evals.mjs` 与 `node scripts/check-jspi-coverage.mjs`（保 `42/42` 一致、漂移 = 0）

## Trademark

本技能内容仅供技术学习与开发者社区交流，未与蚂蚁集团 / 支付宝（中国）网络技术有限公司存在任何关联或授权关系。`alipay` / 支付宝 / 小程序 等相关商标、产品名称归其各自所有权人所有。

## License

[ISC](https://opensource.org/licenses/ISC) © 唐小新

## Author

**唐小新** — [github.com/hey-tangxiaoxin](https://github.com/hey-tangxiaoxin) · <1302947749@qq.com>

> npm 包 `package.json` author 字段维持 `<1302947749@qq.com>`；git 提交签名按全局 git 身份。

## Resources

- GitHub: https://github.com/antdigital-ai/alipay-mini-program-generator
- npm: https://www.npmjs.com/package/alipay-mini-program-generator
- 支付宝开放文档: https://opendocs.alipay.com/mini/
- `minidev` CLI 指令总览: https://opendocs.alipay.com/mini/02q29z
