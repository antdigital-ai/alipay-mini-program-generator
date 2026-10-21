# alipay-mini-program-generator

> Codex / Claude Code Skill — 装进技能目录后，agent 用自然语言提需求时按 6-Gate 工程化流程执行：覆盖支付宝小程序（原生框架）架构 → 编码 → 能力 → 调试 → 构建发布 → 交付全链路，自带 4 个确定性脚本与 21/21 回归夹具。

[![npm version](https://img.shields.io/npm/v/alipay-mini-program-generator.svg)](https://www.npmjs.com/package/alipay-mini-program-generator)
[![GitHub stars](https://img.shields.io/github/stars/antdigital-ai/alipay-mini-program-generator?style=social&label=Star)](https://github.com/antdigital-ai/alipay-mini-program-generator)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Features

- **6-Gate Workflow** — 状态判定 → 架构 → 编码 → `my.*` 能力 → 调试验证 → 交付；每 Gate 产出完整才进下一个，发现上层决策错误自动回退
- **Three-layer Lifecycle & 41 Built-in Components** — App / Page / Component 三层生命周期 + OpenDocs 全量内置组件速查
- **Zero-Fabrication `my.*`** — 42 项白名单与 `references/jsapi.md` §0 单一事实源比对，散写 `my.request` / 硬编码密钥 / 明文 http / 主包超 2MB 自动拦截
- **Build & Publish Chain** — `mini.project.json` format2 / `compileOptions`、`minidev build` / `dev` / `config`、`upload` / `audit` / `cancel-audit` / `preview`，自定义组件 → npm 发布
- **Cross-Platform IDE Awakening** — macOS / Windows 自动定位「小程序开发者工具」+ 模拟器；`--qr <appId>` 走真机预览二维码
- **Allowlist ⇄ OpenDocs Drift Audit** — `check-jspi-coverage.mjs` 实时扫 42 项 `my.*` 看 OpenDocs URL 是否仍能命中
- **WeChat → Alipay Migration** — API / 配置 / 组件 对照表 + 迁移流程 + 高频坑

## Installation

```bash
npm install alipay-mini-program-generator
# 或从源码克隆（含 `evals/`，纳入到 Codex 技能目录）：
git clone git@github.com:antdigital-ai/alipay-mini-program-generator.git \
  $HOME/.agents/skills/alipay-mini-program-generator
```

## Usage

无需手动调用 — 在 Codex / Claude Code 里用自然语言提需求即可：

```text
- 帮我新建一个支付宝小程序 Todos 页面
- 把这个微信小程序迁到支付宝
- 排查 my.request 报错 / 做真机预览 / 上传体验版 / 提审
```

## Scripts

| Script | Purpose | Exit Code |
|---|---|---|
| `scripts/check-env.mjs` | Node / IDE / minidev / appId 环境探针 | `0` ready / `1` blocked |
| `scripts/check-project.mjs` | 工程确定性检查（语法 / 42 `my.*` 白名单 / AXML / 结构） | `0` pass / `1` error |
| `scripts/check-jspi-coverage.mjs` | allowlist ⇄ OpenDocs 漂移对账 | `0` aligned / `1` drift |
| `scripts/open-ide.mjs` | 唤起 IDE + 模拟器（`--qr` 走真机预览） | `0` done / `1` unreachable |

## Directory

```
SKILL.md                       # Skill 指令正文
.claude-skill.json             # 包 → 技能 manifest
references/
  architecture.md · framework-lifecycle.md · coding-standards.md
  builtin-components.md · jsapi.md · devtools.md · build-and-publish.md · wechat-migration.md
scripts/                       # check-env / check-project / check-jspi-coverage / open-ide / lib/platform.mjs
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
node scripts/check-jspi-coverage.mjs    # 期望 42/42 无漂移
```

## 6-Gate Workflow

A 状态判定 → B 架构配置 → C 编码 → D 能力调用 → E 验证 / 调试 / 构建发布 → F 交付；每 Gate 产出完整才进下一个，发现上层决策错误自动回退。详见 `SKILL.md`。

## Contributing

PR 欢迎修订 `my.*` 白名单或组件时同步：`scripts/check-project.mjs` 的 `MY_API_ALLOWLIST` + `references/jsapi.md` §0 + `references/builtin-components.md`，并跑完 `node evals/run-evals.mjs` 与 `node scripts/check-jspi-coverage.mjs`（保 `42/42` 一致、漂移 = 0）。

## Trademark

`alipay` / 支付宝 / 小程序 等相关商标归其各自所有权人所有；本技能与蚂蚁集团 / 支付宝无关联或授权关系。

## License

[ISC](https://opensource.org/licenses/ISC)

## Author

[**唐小新**](https://github.com/hey-tangxiaoxin)
