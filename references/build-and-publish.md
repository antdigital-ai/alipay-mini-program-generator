# 构建与发布链路

> 本页覆盖「源码 → 产物 → 上传 → 提审 → 上架」的工程侧。模拟器/真机调试细节见 [devtools.md](devtools.md)；发布 CLI 的完整参数（upload / preview / audit / cancel-audit）同样见 devtools.md §5、§6。

> **minidev 版本固定为 `minidev@2.2.5`**（与 devtools.md §1 同步），本页所有命令统一带 `-y minidev@2.2.5`；升级版本前先逐条复核 flags（来源见每节末尾 OpenDocs 链接）。

## 1 mini.project.json：构建 / 编译配置主入口

format2 完整属性表：

| 属性 | 类型 | 默认 | 描述 |
|---|---|---|---|
| `format` | Number | `2` | 固定值，schema 版本号 |
| `compileType` | `"mini"` \| `"plugin"` | `"mini"` | 编译类型，区分小程序应用 / 小程序插件 |
| `miniprogramRoot` | Path String | `"./"` | 小程序源码相对路径（app.json 所在目录）；`compileType=plugin` 时为预览宿主应用目录 |
| `pluginRoot` | Path String | - | 插件源码目录（plugin.json 所在）；仅 `compileType=plugin` 时生效 |
| `compileOptions` | Object | - | 编译相关配置，见 §1.1 |
| `uploadExclude` | String[] | - | 上传时需忽略的文件，glob（底层 minimatch 3.0.4） |
| `assetsInclude` | String[] | - | 构建后需打进产物的资产，glob（底层 minimatch 3.0.4） |
| `developOptions` | Object | - | 本地开发相关配置 |
| `pluginResolution` | Object | - | 插件联调选项 |
| `scripts` | Object | - | 小程序预构建脚本相关配置 |

OpenDocs：https://opendocs.alipay.com/mini/03dbc3

### 1.1 compileOptions 子表（构建编译核心配置）

| 属性 | 类型 | 默认 | 描述 |
|---|---|---|---|
| `component2` | Boolean | `false` | 自定义组件是否开启新生命周期运行模型；若 app.json 开启 `plugins` / `useDynamicPlugins` 则强制开启 |
| `typescript` | Boolean | `false` | 启用 TypeScript 支持（IDE / CLI 3.0.1+，详见 [TypeScript 和 Less 编译](https://opendocs.alipay.com/mini/02zko2)） |
| `less` | Boolean | `false` | 启用 Less 支持 |
| `treeShaking` | Boolean | `false` | 生产构建是否进行 tree shaking |
| `resolveAlias` | Object | - | 路径别名配置，IDE 3.7.5+，见 §1.2 |
| `globalObjectMode` | String | - | `global`/`globalThis` 访问策略，`legacy`/`enable`(推荐)/`fake`，IDE 3.8.1+ / CLI 2.0+ |
| `transpile` | Object | - | 小程序代码转 ES5 配置（新），IDE 3.8.1+ / CLI 2.0+，含 `script.ignore` |

`transpile.script.ignore` 支持 glob 规则，且支持以 `!` 反向包含：例如 `["node_modules/**", "!node_modules/lodash-es/**"]` 表示忽略整个 `node_modules/` 但保留 `lodash-es/`。`globalObjectMode`：`enable` 才能拿到真实的 `global.Math === Math`；`fake` 会挂一个空对象（赋值能存，但取回 undefined）。

### 1.2 resolveAlias 规则要点

- 键值对都相对于 mini.project.json 所在的目录；**键值都必须以 `/*` 结尾**。
- 仅做路径的**前缀字符串匹配**，不支持更复杂规则；键、值都不能以 `/` 开头。
- 多条规则前缀重叠时，**最长（最具体）的键生效**（如 `hello/world/*` 优先于 `hello/*`）。
- 生效文件：JS/TS 的 `import` / `require()`；Acss/Less 的 `@import` / `url()`；SJS 的 `import`；AXML 的 `<import>` / `<include>` / `<import-sjs>`。
- **不生效**：app.json 等各类 `.json`、`node_modules` 内文件。
- 值若引用项目外路径，构建会失败（仅本地绝对路径解析，仅示例已说明）。

完整 doc：https://opendocs.alipay.com/mini/03dbc3#resolveAlias

### 1.3 旧版 mini.project.json 字段（存量 / 迁移项目仍可能命中）

| 字段 | 默认 | 作用 | 等价新版位 |
|---|---|---|---|
| `axmlStrictCheck` | `false` | 构建时检查 AXML 标签未闭合等严格语法 | （目前仅在旧版表） |
| `nonLoadingIndicator` | `true` | 初始化小程序时是否隐藏默认 loading 动画 | （旧版独立项） |
| `enableParallelLoader` | `false` | 启用多进程编译，首次无缓存时效果更明显 | 见 `dev --parallel` |
| `enableDistFileMinify` | `false` | 真机预览 / 调试阶段是否压缩最终产物 | 见 `build --minify` |
| `component2` | `false` | 同 `compileOptions.component2` 旧位置 | `compileOptions.component2` |

OpenDocs（旧版）：https://opendocs.alipay.com/mini/framework/project —— **新项目用 §1 的 format2 主表**。

## 2 minidev CLI 构建指令

### 2.1 全命令地图

| 命令 | 作用 |
|---|---|
| `minidev app` | 请求开放平台获取小程序列表与信息 |
| **`minidev build`** | 由小程序源码构建小程序，生成小程序运行时产物包（§2.2） |
| `minidev create` | 创建小程序项目 |
| `minidev dev` | 启动开发服务器 DevServer（§2.3） |
| `minidev ide` | 启动小程序开发者工具（`start-sim` 在其下）—— 本技能 open-ide.mjs 封装的就是它 |
| `minidev preview` | 构建小程序并发起真机预览 |
| `minidev remote-debug` | 构建小程序并发起真机调试 |
| `minidev upload` | 上传小程序以进行提审（完整 flags 见 devtools.md §5） |
| `minidev audit` | 提审小程序 |
| `minidev cancel-audit` | 取消提审 |
| `minidev config` | 设置 / 展示当前配置（`set` / `get`，§2.4） |
| `minidev download-assets` | 下载 CLI 资源文件 |
| `minidev login` | 工具授权登录（一次性扫码） |

OpenDocs：https://opendocs.alipay.com/mini/02q29z

### 2.2 minidev build —— 源码 → 运行时产物包

```bash
npx -y minidev@2.2.5 build -p <项目>                  # 默认产物目录（$TMPDIR/minicode_compile_dy 下随机名）
npx -y minidev@2.2.5 build -p <项目> -o dist           # 指定产物路径
npx -y minidev@2.2.5 build -p <项目> --minify         # 压缩产物（额外耗时）
npx -y minidev@2.2.5 build -p <项目> --no-source-map  # 关 sourceMap（加快构建、损失运行时调试 / 错误收集）
npx -y minidev@2.2.5 build -p <项目> --pluginId <id>  # 构建插件
```

| flag | 类型 | 默认 | 说明 |
|---|---|---|---|
| `-p, --project` | Path | cwd | 目标项目（含 mini.project.json 的目录） |
| `-o, --output` | Path | `$TMPDIR/minicode_compile_dy/<随机名>` | 产物输出路径，不传则随机名目录 |
| `--cacheDir` | Path | 系统缓存 | 构建缓存路径 |
| `--minify` | Boolean | `false` | 是否压缩产物 |
| `--source-map` | Boolean | `true` | 是否产出 sourceMap |
| `--pluginId` | String | - | 构建插件时生成到代码中 |

**默认产物目录**（未指定 `-o` 时）：
- macOS / Linux：`$TMPDIR/minicode_compile_dy/`
- Windows：`%LOCALAPPDATA%\Temp\minicode_compile_dy\`

OpenDocs：https://opendocs.alipay.com/mini/02q17m

### 2.3 minidev dev —— DevServer（持续监听 + HMR）

```bash
npx -y minidev@2.2.5 dev -p <项目>                       # 默认开 HMR
npx -y minidev@2.2.5 dev -p <项目> --parallel            # 多进程编译
npx -y minidev@2.2.5 dev -p <项目> --typescript --less    # 启用 TS + Less 编译分支
npx -y minidev@2.2.5 dev -p <项目> --no-source-map        # 关 sourceMap
npx -y minidev@2.2.5 dev -p <项目> --port 8080 --host 0.0.0.0
```

| flag | 默认 | 说明 |
|---|---|---|
| `--hmr` | `true` | 是否开启 HMR |
| `--host` | `127.0.0.1` | 本地服务 host |
| `--port` | - | 本地服务端口号 |
| `--parallel` | `false` | 多进程编译 |
| `--typescript` / `--less` | `false` | 启用对应编译分支（也可用 `compileOptions` 常驻配置） |
| `--minify` | `false` | 是否压缩产物 |
| `--source-map` | `true` | 是否产出 sourceMap |
| `--cacheDir` | 系统缓存 | 构建缓存路径 |
| `-o, --output` | `$TMPDIR/minicode_compile_dy` | 产物输出路径 |

`dev` 额外支持把 preview / ide 的转发参数透传（`--auto-open` 自动开模拟器、`--lite` 用 Lite 模式、`--page`/`--page-query`/`--query`/`--scene` 进入入口、`--ignore-http-domain-check` 关白名单校验等）。把构建与 IDE 模拟器联动起来时用这些。

OpenDocs：https://opendocs.alipay.com/mini/02q17n

### 2.4 minidev config —— 工具配置（4 级配置）

```bash
npx -y minidev@2.2.5 config set compiler.version 3.9.91                 # 全局设置编译器版本
npx -y minidev@2.2.5 config set ide.appPath /path/to/ide --scope project # 项目级设置 IDE 路径
npx -y minidev@2.2.5 config get compiler.version                          # 查询
```

| scope | 含义 |
|---|---|
| `RUNTIME` | 仅单次 Node.js 运行 / 单次 CLI 调用上下文 |
| `PROJECT` | 项目配置（默认存项目目录下） |
| `GLOBAL` | 全局配置 |
| `USER` | 用户级 |

常见 key：
- `alipay.authentication.privateKey` —— 工具授权的 privateKey（避免每次 `--identity-key-path` 反复指定）
- `alipay.authentication.toolId` —— 授权的 toolId
- `compiler.version` —— 编译器版本
- `ide.appPath` —— IDE 安装路径（脚本自动探测失败时，可在此项目级显式指定）

配置项支持 JSON Object 的解构 / 聚合（`alipay.authentication.privateKey` 完全解构、`alipay.authentication` 半聚合、`alipay` 完全聚合等价）；冲突时按顺序解析，无法解析时模块抛错。

OpenDocs：https://opendocs.alipay.com/mini/02q3aq / https://opendocs.alipay.com/mini/02q3ap

## 3 上传与发布的部分约束（完整 CLI 示例见 devtools.md §5、§6）

- **版本号约定**：每次上传默认递增 `0.0.1`，且**必须大于当前线上版本**；后台每份代码版本唯一。
- **资源约束**：资源文件**只支持图片**，不支持视频；建议用 URL 引用减小整包大小（主包 / 分包预算与图片限制见 architecture.md 与 check-project.mjs）。
- **appid 一致性**：见 devtools.md §5「appid 一致性」与 §5.5「appId：模拟器 / 真机 / 上传的前置标识」。
- 完整 `minidev upload` / `audit` / `cancel-audit` / `preview` 命令与 flags 见 devtools.md §5（发布）与 §6（真机预览）。

OpenDocs：https://opendocs.alipay.com/mini/ide/upload

## 4 自定义组件 → npm 发布（工程是组件库而非小程序本体时）

> 仅当用户的工程是「自定义组件库」（要复用 / 分享给其他小程序项目），不是「要直接发布上架的小程序本体」时用本节。决定后再走，避免误把组件 demo 当成正式小程序上架。

推荐的文件结构：

```
├── src                       # 单个自定义组件
│   ├── index.js
│   ├── index.json
│   ├── index.axml
│   ├── index.acss
│   └── demo                   # 自定义组件的演示 Demo
│       ├── index.js
│       ├── index.json
│       ├── index.axml
│       └── index.acss
├── app.js / app.json / app.acss    # 组件的 Demo 小程序
```

`package.json` 关键字段：
- `files: ["es"]` —— 只发布编译产物目录。
- `scripts.build`: `rc-tools run compile && node scripts/cp.js && node scripts/rm.js`（rc-tools 编译产物写入 `es/`，再用 cp / 自定义 rm 脚本整理）。
- `scripts.pub`: `git push origin && npm run build && npm publish`（先推送再构建最后发布，单条 npm 内联）。

发布流程：
1. `npm run build` —— 产物落 `es/`。
2. `npm login` 登录、`npm publish` 发布（私库 / scope 时 tarball 命名要对齐）。
3. 消费方工程按原生 / 第三方 npm 引入（支付宝小程序原生支持第三方 npm 模块）。

OpenDocs：https://opendocs.alipay.com/mini/framework/custom-component-publish
