# alipay-mini-program-generator

> Codex / Claude Code Skill — 装进技能目录后，agent 用自然语言提需求时按 6-Gate 工程化流程执行：覆盖支付宝小程序（原生框架）架构 → 编码 → 能力 → 调试 → 构建发布 → 交付全链路，自带 4 个确定性脚本与 21/21 回归夹具。

[![npm version](https://img.shields.io/npm/v/alipay-mini-program-generator.svg)](https://www.npmjs.com/package/alipay-mini-program-generator)
[![GitHub stars](https://img.shields.io/github/stars/antdigital-ai/alipay-mini-program-generator?style=social&label=Star)](https://github.com/antdigital-ai/alipay-mini-program-generator)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Features

- **6-Gate Workflow** — 状态判定 → 架构 → 编码 → `my.*` 能力 → 调试验证 → 交付；每 Gate 产出完整才进下一个，发现上层决策错误自动回退
- **Three-layer Lifecycle & 41 Built-in Components** — App / Page / Component 三层生命周期 + OpenDocs 全量内置组件速查
- **Zero-Fabrication `my.*`** — 44 项白名单与 `references/jsapi.md` §0 单一事实源比对，散写 `my.request` / 硬编码密钥 / 明文 http / 主包超 2MB 自动拦截
- **Build & Publish Chain** — `mini.project.json` format2 / `compileOptions`、`minidev build` / `dev` / `config`、`upload` / `audit` / `cancel-audit` / `preview`，自定义组件 → npm 发布
- **Cross-Platform IDE Awakening** — macOS / Windows 自动定位「小程序开发者工具」+ 模拟器；`--qr <appId>` 走真机预览二维码
- **Allowlist ⇄ OpenDocs Drift Audit** — `check-jspi-coverage.mjs` 实时扫 44 项 `my.*` 看 OpenDocs URL 是否仍能命中
- **WeChat → Alipay Migration** — API / 配置 / 组件 对照表 + 迁移流程 + 高频坑

## Installation

`npm install` 会触发 `postinstall`，把技能 payload（`SKILL.md` / `references/` / `scripts/` / `.claude-skill.json` / `package.json` 等）覆盖写入 `~/.agents/skills/alipay-mini-program-generator`，Codex 重载技能后即可用：

```bash
npm install alipay-mini-program-generator        # 技能注册到 ~/.agents/skills/alipay-mini-program-generator
```

- 默认根目录 `~/.agents/skills`；想换根目录：`ALIPAY_SKILL_ROOT=~/.codex/skills npm install alipay-mini-program-generator`。全局 `npm install -g ...` 同样会注册。
- 受 CI / `--ignore-scripts` 限制没自动注册？手动补一句：`npx alipay-mini-program-generator install`（等价 postinstall）。
- 维护者要带 `evals/`（npm 包不含）：`git clone git@github.com:antdigital-ai/alipay-mini-program-generator.git ~/.agents/skills/alipay-mini-program-generator`。

## Update

直接升版即可覆盖更新——`postinstall` 会重跑、先清旧目录再写入新 payload（无残留文件），并刷新 `package.json` 版本：

```bash
npm install alipay-mini-program-generator@latest     # 或 npm update alipay-mini-program-generator
```

## Uninstall

一行卸载、无残留（先清技能目录，再自动卸载 npm 包）：

```bash
npx alipay-mini-program-generator uninstall
```

> 为什么不能只用 `npm uninstall`？npm 10 在「卸载依赖」时**不会触发**依赖自身的 `preuninstall`（registry 安装与本地 tarball 均已实测），所以 `npm uninstall alipay-mini-program-generator` 只会移除 `node_modules` 副本、留下 `~/.agents/skills` 下的技能目录。本命令兜底：清掉 `~/.agents/skills/alipay-mini-program-generator` 后再自动 `npm uninstall` 自身。

- 默认清 `~/.agents/skills/alipay-mini-program-generator`；设过 `ALIPAY_SKILL_ROOT` 则清你那个根下的同名目录；全局安装会自动带 `-g` 卸载。
- 只想清技能副本、保留 npm 包（开发/恢复）：`npx alipay-mini-program-generator uninstall --skills-only`（或环境变量 `ALIPAY_NO_SELF_UNINSTALL=1`）。
- 已经用过 `npm uninstall`、技能目录变成孤儿残留？重新 `npm install` 本包后再跑一次上面的 `uninstall`，或直接删掉 `~/.agents/skills/alipay-mini-program-generator`。

## Usage

无需手动调用 — 在 Codex / Claude Code / AiWork 里用自然语言提需求即可：

```text
- 帮我新建一个支付宝小程序 Todos 页面
- 把这个微信小程序迁到支付宝
- 排查 my.request 报错 / 做真机预览 / 上传体验版 / 提审
```

## Scripts

| Script | Purpose | Exit Code |
|---|---|---|
| `scripts/check-env.mjs` | Node / IDE / minidev / appId 环境探针 | `0` ready / `1` blocked |
| `scripts/check-project.mjs` | 工程确定性检查（语法 / 44 `my.*` 白名单 / AXML / 结构） | `0` pass / `1` error |
| `scripts/check-jspi-coverage.mjs` | allowlist ⇄ OpenDocs 漂移对账 | `0` aligned / `1` drift |
| `scripts/open-ide.mjs` | 唤起 IDE + 模拟器（`--qr` 走真机预览） | `0` done / `1` unreachable |

## Directory

```
SKILL.md                       # Skill 指令正文
.claude-skill.json             # 包 → 技能 manifest
references/
  architecture.md · framework-lifecycle.md · coding-standards.md
  builtin-components.md · jsapi.md · devtools.md · build-and-publish.md · wechat-migration.md
scripts/                       # check-env / check-project / check-jspi-coverage / open-ide / install-skill / cli / lib/platform.mjs · lib/skill-registrar.mjs
evals/                         # 仅源码仓库内（npm 包不含）
```

## Requirements

- [Node.js](https://nodejs.org) ≥ 18
- 小程序开发者工具：macOS / Windows（Linux 仅做开发与静态检查）
- appId：在 [开放平台](https://open.alipay.com) 创建小程序后获取（16 位数字）
- `minidev ≥ 2.2.5`（`npx` 按需自动安装）

## Testing

```bash
git clone git@github.com:antdigital-ai/alipay-mini-program-generator.git
cd alipay-mini-program-generator
node evals/run-evals.mjs                # 期望 21/21
node scripts/check-jspi-coverage.mjs    # 期望 44/44 无漂移
```

## 6-Gate Workflow

A 状态判定 → B 架构配置 → C 编码 → D 能力调用 → E 验证 / 调试 / 构建发布 → F 交付；每 Gate 产出完整才进下一个，发现上层决策错误自动回退。详见 `SKILL.md`。

## Contributing

PR 欢迎修订 `my.*` 白名单或组件时同步：`scripts/check-project.mjs` 的 `MY_API_ALLOWLIST` + `references/jsapi.md` §0 + `references/builtin-components.md`，并跑完 `node evals/run-evals.mjs` 与 `node scripts/check-jspi-coverage.mjs`（保 `44/44` 一致、漂移 = 0）。

## Trademark

`alipay` / 支付宝 / 小程序 等相关商标归其各自所有权人所有；本技能与蚂蚁集团 / 支付宝无关联或授权关系。

## License

[ISC](https://opensource.org/licenses/ISC)

## Author

[**hey_tangxiaoxin**](https://github.com/hey-tangxiaoxin)
