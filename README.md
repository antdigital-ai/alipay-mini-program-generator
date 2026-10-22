# alipay-mini-program-generator

> Codex / Claude Code Skill — 装进技能目录后，agent 用自然语言提需求时按 6-Gate 工程化流程执行：覆盖支付宝小程序（原生框架）架构 → 编码 → 能力 → 调试 → 构建发布 → 交付全链路，自带 4 个确定性脚本与 21/21 回归夹具。

[![npm version](https://img.shields.io/npm/v/alipay-mini-program-generator.svg)](https://www.npmjs.com/package/alipay-mini-program-generator)
[![GitHub stars](https://img.shields.io/github/stars/antdigital-ai/alipay-mini-program-generator?style=social&label=Star)](https://github.com/antdigital-ai/alipay-mini-program-generator)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Features

- **6-Gate 工程化执行** — 状态判定 → 架构 → 编码 → `my.*` 能力 → 调试验证 → 交付；agent 按 Gate 推进，每 Gate 产出完整才进下一个，发现上层决策错误自动回退
- **零编造 `my.*`** — 44 项 JSAPI 白名单 + `references/jsapi.md` §0 单一事实源比对；散写 `my.request` / 硬编码密钥 / 明文 http / 主包超 2MB 自动拦截
- **OpenDocs 漂移对账** — `check-jspi-coverage.mjs` 实时校验白名单 ↔ OpenDocs URL 是否仍能命中，防 API 漂移失效
- **确定性脚本护栏** — `check-env` / `check-project` / `check-jspi-coverage` / `open-ide` 四个可执行脚本 + 21/21 回归夹具，输出可验证、可复现
- **全链路覆盖** — app.json · 分包 · tabBar · AXML/ACSS · 41 内置组件 · 三层生命周期 · 模拟器调试 · 真机预览 · 构建/上传/提审/灰度 · 自定义组件发 npm · 微信→支付宝迁移
- **H5 嵌入** — web-view 嵌入 H5 + 小程序与 H5 的 JSAPI 双向通信

## Installation

```bash
npm install alipay-mini-program-generator
```

注册到 `~/.agents/skills/alipay-mini-program-generator`；换根目录设 `ALIPAY_SKILL_ROOT`，`--ignore-scripts`/CI 下补跑 `npx alipay-mini-program-generator install`。

## Update

```bash
npm install alipay-mini-program-generator@latest
```

覆盖更新、无残留。

## Uninstall

```bash
npx alipay-mini-program-generator uninstall
```

一行清技能目录 + 自动卸载 npm 包。`npm uninstall` 单条不清技能目录，请用上面这条。

## Usage

无需手动调用 — 在 Codex / Claude Code / AiWork 里用自然语言提需求即可：

```text
- 帮我新建一个支付宝小程序 Todos 页面
- 把这个微信小程序迁到支付宝
- 把已有 H5 页面嵌入支付宝小程序（web-view + JSAPI 通信），打通与小程序的双向通信
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
  builtin-components.md · jsapi.md · devtools.md · build-and-publish.md · web-view-embedding.md · wechat-migration.md
scripts/                       # check-env / check-project / check-jspi-coverage / open-ide / install-skill / cli / lib/platform.mjs · lib/skill-registrar.mjs
evals/                         # 仅源码仓库内（npm 包不含）
```

## Requirements

- [Node.js](https://nodejs.org) ≥ 18
- 小程序开发者工具：macOS / Windows（Linux 仅做开发与静态检查）
- appId：在 [开放平台](https://open.alipay.com) 创建小程序后获取（16 位数字）
- `minidev ≥ 2.2.5`（`npx` 按需自动安装）

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
