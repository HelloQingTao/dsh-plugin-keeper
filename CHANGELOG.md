# Changelog

## 0.3.6 (2026-11-07)

### 中文

- **修复：面板代理仍会被 `~/.gitconfig` 里的 GitHub URL 段抢走** — 之前只给 git 传了全局 `http.proxy`，但 git 里 URL 段级配置（`[http "https://github.com/"] proxy = ...`）优先级高于全局项，导致机器上残留的旧代理段（如已失效的 33210 端口）仍会劫持到 GitHub 的连接，表现为"面板代理明明可用、安装链路却连不上"。现在命令行 `-c`、git 包装器 shim、`GIT_CONFIG_*` 环境变量三处都同时写全局 `http.proxy` 与 `http.https://github.com/.proxy` 的 URL 段级覆盖，彻底压住任何残留。
- **新增：连通性测试智能降级直连兜底** — 当面板代理探测失败时（典型场景：机器已启用 TUN/透明代理，面板 HTTP 代理会与系统代理叠加成「双重代理」导致 TLS 握手不稳），自动回退到「清空残留代理的直连」再测一次，任一链路通即判通过。未配置面板代理（跟随系统）时直接用清残留的直连测。彻底告别"第一次点全红"。
- **修复：测试卡一分钟** — git 超时后其 helper 子进程仍持有管道、Node 的 close 事件迟迟不触发，导致测试挂起。现在超时后立即 SIGTERM + 1.5s 后 SIGKILL 并兜底 resolve，最坏耗时封顶，不会无限等待。

### English

- **Fix: panel proxy could still be hijacked by a GitHub URL-section entry in `~/.gitconfig`** — Previously only the global `http.proxy` was passed to git, but git's URL-section config (`[http "https://github.com/"] proxy = ...`) outranks the global setting, so a leftover stale proxy section (e.g. a dead port like 33210) kept hijacking GitHub connections — the panel proxy looked fine yet installs failed to connect. Now all three injection paths (command-line `-c`, the git shim wrapper, and `GIT_CONFIG_*` env vars) write both the global `http.proxy` and the URL-section `http.https://github.com/.proxy` override, fully suppressing any leftover config.
- **New: connectivity test falls back to a direct connection** — When probing the panel proxy fails (typical case: the machine already runs a TUN/transparent proxy, so adding the panel HTTP proxy creates a "double proxy" that destabilizes TLS handshakes), the test now retries with a direct connection that clears any leftover proxy; passing either path counts as OK. With no panel proxy configured (follow system), the direct path is used directly. No more "all red on the first click".
- **Fix: test hanging for a minute** — After a git timeout, its helper subprocess keeps the pipes open so Node's close event fires very late, hanging the test. Now on timeout we SIGTERM immediately, SIGKILL after 1.5s, and resolve as a fallback so the worst case is bounded and never hangs indefinitely.

## 0.3.5 (2026-11-07)

### 中文

- **面板代理不再被系统配置抢走** — 配了代理后，GitHub 检查更新与从 GitHub 安装的每一条 git 命令（远程探测、拉取代码）都显式带上这个代理地址，机器上残留的旧代理配置不会再把请求带走；全程不修改你的任何全局配置。
- **高级配置更清爽** — 去掉三段说明文字，代理区只保留结果本身。
- **新增从本地安装** — 直接把开发中的插件目录装进当前环境试用，不必先发版；目录以软链方式安装（改完源码重启 dsh web 即生效），本地 .tgz / .tar.gz 也能装。

### English

- **The panel proxy is now authoritative** — Once a proxy is configured, every git command behind GitHub update checks and GitHub installs (remote probes, clones) explicitly carries that proxy address, so leftover proxy settings on the machine can no longer hijack the connection; no global configuration is modified.
- **Cleaner advanced settings** — Three explanatory paragraphs are gone; the proxy section now shows results only.
- **Install from a local path** — Try a plugin straight from its working directory before publishing; directories are linked (edit the source, restart dsh web, it takes effect), and local .tgz / .tar.gz files work too.

## 0.3.4 (2026-11-07)

### 中文

- **修复检查更新失败** — npm 插件的检查更新改为直连，不再受系统或面板中的代理设置影响；GitHub 检查更新与安装仍使用面板配置的代理。
- **代理设置更可靠** — 修复部分环境下 GitHub 安装未使用面板所配代理、仍连接旧代理地址的问题。
- **连通性测试聚焦 GitHub** — 只验证所配代理到 GitHub 检查更新与安装这两条链路，并在结果中显示当前使用的代理地址。
- **本插件可随批量更新升级** — 插件运维自身重新参与批量更新，且始终排在最后执行；更新前明确提示面板会重新加载，其余插件不受影响。

### English

- **Fixed update checks** — npm plugin checks now use a direct connection and are no longer affected by system or panel proxy settings; GitHub checks and installs still use the configured proxy.
- **More reliable proxy settings** — GitHub installs now honour the proxy configured in the panel even when another proxy is preset on the machine.
- **Connectivity test focused on GitHub** — checks only the two GitHub paths through the configured proxy and shows the proxy address in use.
- **Self-update in batch operations** — the Plugin Ops console can be updated together with other plugins, always last; a clear notice explains that its panel will reload while other plugins are unaffected.

## 0.3.3 (2026-11-07)

### 中文

- **代理只服务 GitHub** — 配置后，仅 GitHub 检查更新与从 GitHub 安装走该代理；npm 检查更新与依赖下载保持直连。留空则跟随系统代理，地址不带前缀会自动补齐。
- **支持需要账号密码的代理** — 账号与密码单独填写，密码不回显、不出现在面板数据中，配置文件仅本人可读写。
- **一键测试连通性** — 验证 GitHub 检查更新与安装链路并逐条给出结果，npm 作为直连基线一并检查；显示真实等待时长，重复点击不会重复发起检查。
- **安装过程可见** — 从 GitHub 安装时显示当前阶段与安装输出，可中途取消；成功或失败结果直接显示在按钮旁。
- **安装地址更宽容** — 支持带或不带 github: 前缀、完整链接、版本标签与提交号；列表中可复制可直接安装的名称，也能打开仓库页面。
- **高级配置** — 设置改为二级弹框并按功能分区；新增一键折叠或展开全部插件分组，批量结果可一键清空。
- **慢代理下更稳定** — 改善代理较慢时 GitHub 安装的成功率，以及等待期间的反馈。

### English

- **Proxy for GitHub only** — When configured, the proxy is used only for GitHub update checks and GitHub installs; npm update checks and dependency downloads stay direct. Leave it empty to follow the system proxy; a missing scheme is added automatically.
- **Authenticated proxies** — Username and password have their own fields; the password is never echoed or sent back to the panel, and the config file is owner-only.
- **One-click connectivity check** — Verifies the GitHub update-check and install paths with per-target results, with npm as a direct-connection baseline; shows the real elapsed time and ignores repeated clicks while a check is running.
- **Visible install progress** — GitHub installs show the current stage and live install output, can be cancelled, and report success or failure right next to the button.
- **More flexible install addresses** — Accepts addresses with or without the github: prefix, full URLs, tags and commit SHAs; each plugin can copy an installable name and open its repository page.
- **Advanced settings** — Settings moved into a dialog with clearly separated sections, plus one-click collapse/expand for all plugin groups and a clear button for batch results.
- **Better behaviour on slow proxies** — GitHub installs are more reliable through slow proxies, with clearer feedback while waiting.

## 0.3.2 (2026-11-05)

### 中文

- **npm 页面改成中英双语** — README 合并成一份，英文在前、中文在后，顶部可一键切换语言
- **不再有单独的英文文件** — 原英文独立文件改为指向主 README 的入口，两份内容不会再各自漂移

### English

- **Bilingual README on npm** — the README is now a single file with English first and Chinese below, with a language switch at the top
- **No more separate English file** — the standalone English file is now a pointer into the main README, so the two versions can no longer drift apart

## 0.3.1 (2026-11-05)

### 中文

- **已上架 npm** — 现在可以直接用 `dsh plugin add dsh-plugin-keeper` 安装；npm 页面展示完整双语 README 与面板截图
- **npm 页面图片正常显示** — 面板截图在 npmjs.com 上正常渲染，不再是破图

### English

- **Available on npm** — the plugin is now installable with `dsh plugin add dsh-plugin-keeper`; the npm page carries the full bilingual README and the panel screenshot
- **Panel screenshot on the package page** — the screenshot now renders on npmjs.com instead of showing a broken image

## 0.3.0 (2026-11-02)

### English

- **Export selected plugins**: a new "Export selected" button next to "Uninstall selected" produces a portable zip package (one `npm pack` tarball per plugin, plus a manifest and an `INSTALL.md` with ready-to-run install commands)
- The export dialog lets you toggle "also export the matching plugin configuration" and pick individual configuration items: profile `cordis.patch.yml` fragments (exact, matched by plugin name), standalone config files under `$DSH_HOME` (heuristic, each item labelled with its confidence), and plugin-declared `dsh.dataDirs`
- Exported packages never carry credential files; items that look like credentials are listed in the dialog but never packaged
- The export package is downloaded through a loopback-only HTTP route (peer address + `Host` header must both be loopback)
- **Import package**: an "Import package" button sits right after "Export selected"; choose a zip and the plugin pre-checks it before touching anything
  - **Compatibility pre-check** mirrors the host's own gate (`evaluatePluginCompatibility`): `engines.dsh` decides alone, otherwise every `@deepseek-ai/dsh*` peer must match; `workspace:` peers count as the current runtime; the profile's `compatibility.json` exemptions are honoured
  - Incompatible plugins are skipped by default and reported with the exact unmet requirement
  - **Conflict handling** per item: same-name-already-installed (keep local / use the package / skip), profile config fragment (keep local / use the package), standalone config file (keep local / use the package)
  - Configuration is written with line-level text edits, so your hand-edited `cordis.patch.yml` keeps its comments and formatting
  - A config snapshot is taken before anything is overwritten and stays restorable in-page
  - "Import configuration only" installs no plugins at all
- **Display location setting**: the panel now lives only in the sidebar Plugins tab by default; a new switch in "Check settings" can also show it as a Settings section (applies after re-entering the page)
- The group collapse arrow is now an inline SVG triangle at a readable size and contrast, with a hover hint
- Packaged plugins that carry lifecycle scripts (`prepare` / `prepack`) are staged in a temp directory with `scripts` stripped before packing — without this, `npm pack` fails on packages such as `dsh-config-manager` and `billion-context`
- **Plugin search**: a search box in the toolbar (next to the "Updatable only" filter) narrows the inventory by package name, description, version or source repository; typing filters automatically after a short pause, matched parts are highlighted in yellow, and the counter shows how many matched

### 中文

- **导出所选插件**：「卸载所选」右侧新增「导出所选」按钮，产出可移植的 zip 导出包（每个插件一个 `npm pack` tarball + manifest + 带安装命令的 `INSTALL.md`）
- 导出弹框可勾选「同时导出插件对应配置」，并逐项选择：profile `cordis.patch.yml` 配置片段（按插件名精确匹配）、`$DSH_HOME` 下的独立配置文件（启发式，逐项标注置信度）、插件自述声明的 `dsh.dataDirs`
- 导出包不含凭据文件；疑似凭据的文件在弹框里列出但不会被打包
- 导出包通过 loopback 专用 HTTP 路由下载（peer 地址与 `Host` 头都必须是 loopback）
- **导入所选**：「导出所选」右侧新增「导入所选」，选 zip 后先做导入预检，确认后才动任何东西
  - **兼容性预检**复刻宿主官方闸门（`evaluatePluginCompatibility`）：`engines.dsh` 说了算，否则每个 `@deepseek-ai/dsh*` peer 都要满足；`workspace:` peer 视为当前运行时；profile 的 `compatibility.json` 豁免表生效
  - 不兼容的插件默认跳过，并如实写明未满足的要求
  - **冲突逐项可选**：同名已装（保留本机 / 以导出包为准 / 跳过）、profile 配置片段（保留本机 / 以导出包为准）、独立配置文件（保留本机 / 以导出包为准）
  - 配置写入走行级文本编辑 —— 你手改的 `cordis.patch.yml` 的注释与格式原样保留
  - 覆盖前自动做配置快照，页内可一键恢复
  - 支持「仅导入配置」：完全不装插件
- **显示位置设置**：面板默认只在侧栏「插件」页签显示；「检查设置」里新增开关可同时显示在设置页（重新进入页面后生效）
- 分组收纳图标改为内联 SVG 三角（尺寸与对比度可读），并带悬停提示
- 带生命周期脚本（`prepare` / `prepack`）的插件改为「临时目录 + 剥离 scripts」后再打包 —— 否则 `npm pack` 会在 `dsh-config-manager`、`billion-context` 这类包上失败
- **插件搜索**：工具栏新增搜索框（与「只看可更新」并列），按 包名 / 简述 / 版本 / 来源仓库 检索；输入停顿约 0.2 秒自动筛选，命中文本黄色高亮，并显示命中数 / 总数

## 0.2.0 (2026-10-24)

### English

- Added one-click update check: npm plugins via the registry with `engines.dsh` compatibility pre-check; GitHub plugins via releases with tag fallback; GitHub API goes through a configurable in-page proxy
- Added multi-select batch operations: batch update / enable / disable / uninstall, with disable and enable applied hot; batch runs are preceded by an automatic profile config snapshot (last 10 kept) restorable in-page
- Added a result ledger per batch run: success / restart-required / failed / skipped counts with per-item reasons
- Added GitHub installs: `owner/repo`, `github:owner/repo#tag` or a GitHub URL; failure reasons are echoed in full
- Added a "Plugin Ops" tab in the official sidebar Plugins panel, sharing the same data as the settings tab
- Update states persist across restarts and show the time of the last check

### 中文

- 新增一键检查更新：npm 插件查 registry 并做 `engines.dsh` 兼容预判；GitHub 插件查 releases（tag 兜底）；GitHub API 走页内可配置代理
- 新增多选批量操作：批量更新 / 启用 / 停用 / 卸载，停用与启用热生效；每次批量前自动快照 profile 配置（保留最近 10 份），页内一键恢复
- 新增结果台账：每轮批量输出 成功 / 需重启 / 失败 / 跳过 计数与逐项原因
- 新增 GitHub 直装：`owner/repo`、`github:owner/repo#tag` 或 GitHub 链接；失败原因完整回显
- 官方侧栏「插件」面板新增「插件运维」页签，与设置页共享数据
- 检查结果跨重启持久化并显示上次检查时间

## 0.1.0 (2026-10-24)

### English

- Initial release: source-grouped plugin inventory (official / npm / GitHub / local) in a settings tab, with per-row version, source badge, description and running state; official plugins read-only; theme and locale follow the host

### 中文

- 首个版本：设置页「插件运维」页签，按 官方 / npm / GitHub / 本地 来源分组盘点插件，行内展示版本、来源徽标、简述与运行状态；官方插件只读；主题与语言跟随宿主
