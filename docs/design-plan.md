# DSH 非官方插件更新管理器 — 设计 · 可行性 · 竞品分析

> 2026-10-23 · 基于 DSH CLI 0.2.1-rc.2 本机实测侦察（web / desktop 双 profile，27 个第三方插件）与全生态联网调研。
> 结论先行：**可行，工程量可控（官方有可编程的 pluginManager 服务和设置页 slot，不用发明安装管线）；但这是一条拥挤赛道——同生态至少 6 个直接竞品，其中 3 个就叫 updater。真正的空白点 = 多选批量操作 + 按安装来源分组 + 整合官方检查更新页签 + GitHub 代理双通道。文档给出完整设计与分期，命名与 4 个范围问题待拍板。**

---

## 0. 竞品分析（先看这个，它决定差异化）

### 0.1 竞品清单

| 产品 | 形态 | 已覆盖 | 关键缺口 |
|---|---|---|---|
| **官方内置**插件管理页（dsh-client-ui-plugin-manager + ui-settings-plugin-inventory） | 随 dsh 自带 | 启用/停用/安装/卸载；官方 on-demand 插件「可更新」提示 | 第三方插件**没有任何更新检查**——官方 locale 原话："To update other plugins, uninstall and reinstall them"（dsh-client-ui-plugin-manager/lib/client.js:382） |
| **dsh-plugin-updater**（Alyosha28） | github | 全量版本追踪、npm/GitHub releases 比对、自动检查（6h 可配）+ 右上角铃铛通知、一键「下载→完整性校验→替换→热重启」+ 失败自动回滚、AI 工具 `dsh_plugin_update` | 无多选（只有「全部更新」）；无批量停用/卸载；来源只是标签不分组；GitHub 代理支持弱；**热重启走清模块缓存+重建 fiber 的私有配方**（官方口径是必须重启） |
| **dsh-plugin-updater**（hyqhyq3，v0.3.0） | github | 依赖级 install/update/remove、npm dist-tags / git commit&tags 检测、GitHub topic 市场搜索直装、双语 README | 启停明确 out of scope；改动需重启（自带横幅）；无代理；无批量；无分组 |
| **dsh-market** | npm | 分类市场 + 命名分组 + 组级开关；逐个/全部更新；中国区 GitHub 路由韧性（多 fallback + 记住最后可用路由 + 拒绝伪装 200）；持久加速前缀 + `DSHM_GITHUB_PROXY`；热禁用；诊断页 + 启动失败恢复页 | 分组是用户自命名、不是安装来源维度；无多选；无批量卸载/停用 |
| **dsh-plugin-hub**（npm 包名 `dsh-plugin`，本机已装 2.1.0） | npm | 市场目录（api.dsh-plugin.org）、更新提示（取「过 pnpm 24h 发布门槛」的最高版）、npm 镜像自动降级、`file:`/`link:` 不被认领、精确版本安装 | 只做发现与提示，无批量管理、无 github 来源更新锚点 |
| **dsh-plugin-market**（npm `deepseek-harness-market`） | npm | Discover/Installed/Updates 三 tab；「检查→全部更新(N)」逐行成败 + 诚实汇总（重启待定算成功）；宿主 ledger `pendingRestart`；`DSHM_REGISTRY_URL`/`DSHM_NPM_MIRROR` | 无多选；无来源分组；github 代理缺位 |

邻接：dsh-plugin-toggle（第三方启停，改 cordis.patch.yml 热生效）、dsh-tool-explorer（GitHub 批量安装）、dsh-find-plugin / awesome-dsh-plugin 索引（发现侧）。

### 0.2 差距矩阵 → 差异化定位

用户需求逐条对照，**无人同时覆盖**的组合：

| 需求 | 最接近的竞品 | 差距 |
|---|---|---|
| 按安装来源分组（npm / GitHub / 本地） | Alyosha28 有来源标签 | 没有「来源 = 一级分组且分组可整体操作」 |
| 多选批量更新 | 都只有「全部更新」 | 复选框多选 = 空白 |
| 批量停用 | dsh-market 组级开关 / dsh-plugin-toggle 单个 | 与更新/卸载同面板的多选批量停用 = 空白 |
| 批量卸载 | hyqhyq3 逐个 remove | 批量 = 空白 |
| GitHub 代理（检查 + 安装都走代理） | dsh-market 有加速前缀 | 检查（api.github.com）与安装（下载/clone）双通道分开设置 = 空白 |
| 整合到官方检查更新页签 | 全部是独立 section/独立页 | 官方 `settings.plugins.tab` 槽无人利用 = 空白 |
| 主题适配 / 中英双语 | Alyosha28、hyqhyq3 已做 | 必答题，不算差异化 |

**定位**：不做市场、不做发现（hub/dsh-market 已饱和），做「**已装插件的多来源批量管理器**」——按来源分组 + 多选批量（更新/停用/卸载）+ GitHub 代理双通道 + 官方页签整合选项 + 诚实的结果台账。
**备选路线（ honesty check）**：直接装 Alyosha28 的 updater + dsh-market 能覆盖约 70% 需求；上面 5 条空白才是自研的净收益。拍板时把这层账算进去。

---

## 1. 可行性分析（逐条判定，带证据）

证据来自本机只读侦察（`/opt/homebrew/lib/node_modules/@deepseek-ai/dsh`，下称 $CLI）与 `~/.dsh/profiles/{web,desktop}` 实测。

| # | 能力 | 判定 | 依据 / 风险 |
|---|---|---|---|
| 1 | 按安装来源分组 | ✅ 直接可做 | profile `package.json` 的 dependencies 天然记录来源：npm=`^0.14.0`/精确版本，github=`github:owner/repo`（本机实证 2 个：dsh-thought-fold、@chengdb/capability-panel），本地=`file:`/`link:`。官方包按 `@deepseek-ai/*` 前缀识别 |
| 2 | npm 检查更新 | ✅ 直接可做 | 宿主半 Node fetch `registry.npmjs.org/{name}/latest` 或 `/-/package/{name}/dist-tags`；npmmirror 可作备用源；生态先例：hub 的镜像降级 |
| 3 | GitHub 检查更新（通用） | ✅ 有明确规则 | api.github.com 元数据**直连或走 HTTP(S)_PROXY，不可加镜像前缀**；release 下载/archive/raw **可加 gh-proxy 系前缀**（hunshcn/gh-proxy 系实测有效）。降级链：releases/latest → tags → 默认分支 package.json/HEAD sha（无 release 明示，防 HACS 式幽灵更新）。token 绝不发往镜像服务 |
| 4 | 一键检查更新 | ✅ 直接可做 | 宿主半并发 fetch（限流 4）+ ETag/时间戳缓存；每插件 1-2 请求；27 插件秒级完成 |
| 5 | 多选批量更新 | ✅ 实现要点明确 | 更新 ≠ installBundle（已装会抛 already-installed，dsh-plugin-manager/lib/index.js:1970）；走宿主半在 profileContext.dir spawn `pnpm add pkg@ver`；装前对每个候选版本**复刻官方兼容闸** evaluatePluginCompatibility（dsh-app-boot/lib/index.js:311-340：engines.dsh 优先且唯一、semver includePrerelease:true），不满足的默认跳过并标「需豁免」 |
| 6 | 批量停用/启用 | ✅ 最省事 | 直接注入官方 pluginManager 服务调 setPluginEnabled/setBundleEnabled（index.js:1930/1949）——写 profile cordis.patch.yml 的 disabled 行（yaml 原子写，index.js:1032-1094），**热生效不用重启** |
| 7 | 批量卸载 | ✅ 直接可做 | removeBundle（index.js:2137）+ 二次确认列出将移除的包 |
| 8 | GitHub 插件安装（直连/代理） | ✅ 直接可做 | installBundle 已支持 github: spec（自带 github 预检 + 逐源回退）；代理双通道：检查走 HTTP(S)_PROXY/自配代理，下载走可配镜像前缀 |
| 9 | 新设置页签 | ✅ 官方 slot | `settings.section` slot 第三方可注册，meow-memory 等 6 个插件在用（meow-memory/lib/client.js:2460-2471 三件套：slots.inject → slots.register → onUiLocaleChange 重注册） |
| 10 | 自定义页签图标 | ⚠️ 有保留 | settings 导航图标**官方硬编码**，未知 id 一律齿轮兜底（dsh-client-ui-settings-general/lib/client.js:239-262 navIcon）；自定义图标只能 DOM 注入（meow-memory dream-icon 先例）→ 设计为默认接受齿轮 + 实验开关「注入自定义 svg（失败自动降级）」 |
| 11 | 整合到官方检查更新页签 | ⚠️ 有保留 | 官方途径：`settings.plugins.tab` 是官方插件 section 的页签槽（ui-settings-plugin-inventory 注册了 id 'all' order:10），第三方可注册自己的页签 = 「官方插件 section 下的批量管理页签」；**官方插件管理页本体无 slot**，深度嵌入只能 DOM 注入（railist 账号菜单同款思路，需 selfCheck + degraded 降级）→ 设计为：官方页签注册默认开、深度嵌入实验开关默认关 |
| 12 | 主题适配 | ✅ 直接可做 | 全 UI 走 `--dsw-alias-*` CSS 变量（dsh-client-ui-theme/lib/client.js），深浅色自动跟随；fallback-queue 有 38 处用例可抄 |
| 13 | 中英双语 | ✅ 官方机制 | `ctx.locale.register(ns,{zh,en})` + `ctx.bind(ns)`（dsh-client-locale/lib/client.js:1387/1414），fallback 链内置 |
| 14 | web + desktop 双 profile | ✅ 带 1 条限制 | CLI 硬拒 desktop（bin.js:35-37 rejectElectronProfile），但宿主半对 desktop profile 目录 spawn pnpm 可行（社区已验证）；启停走官方服务写 patch 与 profile 无关。限制：desktop 生效必须 ⌘Q 重启 App，插件不代重启 |
| 15 | 更新后何时生效 | ⚠️ 必须诚实 | **包内容变更官方硬性要求进程重启**（dsh-app-boot/lib/index.js:1547-1563 ResolutionRestartRequired，plugin-manager 捕获后向客户端返回 restart-required）；只有 enable/disable 和配置可热更。竞品 Alyosha28 的「热重启」是清模块缓存+重建 fiber 的私有配方，脆且对抗官方机制——**本设计不采用**，更新完给「重启后生效」横幅（web：重启 dsh web；desktop：⌘Q） |

**三条额外的坑（侦察实锤，设计里都要处理）**：
1. **pnpm minimumReleaseAge 供应链门槛**：profile 的 pnpm-workspace.yaml 配了发布冷静期，太新的版本会被 pnpm 拒装（本机白名单逐版本豁免 billion-context 的实证）。检查更新要区分「已发布」与「现在装得上」，状态分开显示；「强行安装」= 写 minimumReleaseAgeExclude 豁免，做成逐包显式 opt-in。
2. **preflight 只覆盖 add/install**（dsh-plugin-manager/lib/types/operations.js:153）：绕过 CLI 自己 spawn pnpm 时，装前兼容预检 + 装后复检 + 失败恢复（restore + `pnpm install --frozen-lockfile`，operations.js:543）都要自己复刻。
3. **github: 来源插件更新涉及 allowBuilds 构建脚本白名单**（pnpm ≥10 行为），更新后 pnpm 可能打印待批准构建，要在结果台账里如实呈现。

---

## 2. 七段方案

### 2.1 现状与问题

- **现在是什么样**：web profile 装 27 个第三方插件（24 npm + 2 github + 1 本地），升级全靠手动逐个 `npm view` / 上 GitHub 看 release；官方管理页对第三方插件只有「卸载重装」一条路；已装的 dsh-plugin（hub）只给市场目录内的更新提示。
- **问题是什么**：① 没有任何地方能一次看清「哪些插件有新版本」；② GitHub 来源插件（2 个）完全没有更新通道；③ 不走代理时 npm registry / api.github.com 经常连不通；④ 想批量整理（升级一批 / 停用一批 / 清掉一批）只能逐个点。
- **影响谁**：所有装了多个插件的用户；对用户自己 = 每次生态巡检 10-30 分钟手工活。
- **为什么现在做**：生态插件数已上量（市场收录 5000+，本机 27 个），竞品验证了需求真实存在，且空白点明确（0.2 节）。

### 2.2 这个方案解决什么

- **解决**：来源分组总览（npm/GitHub/本地/官方只读）、一键全量检查更新、多选批量更新/停用/卸载、GitHub 插件安装（直连或代理）、检查与安装的代理双通道、兼容性预判（跨 engines 边界的版本默认拦截）、诚实的结果台账与重启提示。
- **不解决**：不做插件发现/市场（已有 3 家）；不做热重启（对抗官方机制，明确放弃）；不更新官方核心包（`@deepseek-ai/*` 只读展示）；不管理 runtime loader 之外的层。
- **为什么不用别的办法**：① 装 Alyosha28 updater——覆盖不了多选批量/来源分组/代理安装/官方页签整合，且热重启配方与本机双 profile 现实不匹配；② 给竞品提 issue 补功能——不可控且周期不可知；③ 宿主改官方代码加扩展点——随 DSH 升级被覆盖，不可维护。

### 2.3 做完后用起来什么样

**用户视角**：

- **入口**：设置 → 左栏新增「插件批量管理」section（order 避开官方 15 与 meow-memory 35）；开关打开后，官方「插件」section 里也出现「批量管理」页签（settings.plugins.tab 注册）。
- **总览**：顶部统计行「27 个插件 · npm 24 · GitHub 2 · 本地 1 · 有更新 3」；下方按来源分组的列表，每行 = 名称 + 已装版本 → 最新版本 + 状态徽章（🟢最新 / 🟡可更新 / 🔵已发布暂不可装 / 🟠兼容警告 / 🔴检查失败）+ 来源徽章 + 复选框。
- **检查**：点「检查更新」→ 行级 spinner → 逐行出结果；GitHub 行显示 release tag 或「无 release，按默认分支检测」。
- **批量操作**：勾选若干行 → 工具条出现「更新(N)/停用(N)/卸载(N)」；卸载弹确认框列出包名清单；执行为串行逐包，每行独立成功/失败，结束给汇总（成功 N · 失败 M · 跳过 K）。
- **GitHub 安装**：GitHub 分组头部「安装 GitHub 插件」输入框（owner/repo 或完整 URL）+「经代理」勾选 → installBundle 走官方 github 预检。
- **更新完成后**：顶部横幅「N 个插件已更新，重启 dsh web 后生效」（desktop：提示 ⌘Q 重开），横幅常驻到确认。
- **失败反馈**：行级错误原因（网络超时/被 24h 门槛拒/engines 不兼容/构建脚本待批准），可单行重试。
- **设置块**（页面底部折叠）：GitHub 代理通道（直连 / 环境变量 / 自定义 HTTP 代理 / 镜像前缀）、npm 源（官方 + 自动降级 npmmirror / 锁定）、GitHub 检测策略（auto/强制 release）、官方页签整合开关、两个实验项（自定义图标注入、深度嵌入官方管理页）默认关。

**开发视角**：

- **架构**（三层）：
  - 宿主半 `index.js`：`PluginKeeperService extends TypertRemoteService`（fallback-queue 同款模板），`static inject = ['pluginManager','profileContext']`——同进程直调官方服务做启停/卸载，自己 spawn pnpm 做更新/安装；外网请求（npm registry、api.github.com）全部在宿主半发（无 CSP 问题，也绕开 CORS 与未来收紧）。
  - client 半 `client.js`：`settings.section` 注册主界面 + `settings.plugins.tab` 注册官方页签；UI 全走 `--dsw-alias-*` 变量；文案走 `ctx.locale.register(ns,{zh,en})`；网络一律经自家 RPC 调宿主半。
  - 数据：`$DSH_HOME/plugin-keeper.json`（来源标注缓存、检查结果、代理设置、开关）+ `$DSH_HOME/plugin-keeper/backups/<ts>/`（操作前 package.json + pnpm-lock.yaml 快照）。**状态型数据不进 settings**（避免每次交互推 revision 触发主题全量重算，性能体检第 1 条）。
- **更新管线**（每包串行）：
  1. 读候选版本 manifest（registry /latest 或 GitHub release tag）；
  2. 兼容预判：复刻 evaluatePluginCompatibility（engines.dsh 优先、includePrerelease:true），不满足 → 跳过并标「需豁免」；
  3. 备份 package.json + pnpm-lock.yaml 到 backups/；
  4. `pnpm add <pkg>@<ver>`（精确钉住版保持精确风格，范围版写 `^<new>`；github 来源默认钉到 release tag `github:o/r#vX.Y.Z`，无 release 则刷新 HEAD）；
  5. 失败 → 还原两个文件 + `pnpm install --frozen-lockfile` 恢复现场；成功 → 记台账；
  6. 全部结束 → 汇总 + 重启横幅。pnpm update 不改名不动 bundles 数组，无需 reconcile（改 github 钉 tag 属 spec 改写，需同步核对 bundles 无变化）。
- **自更新特判**：更新自己排最后执行，成功后横幅写明「本插件更新将在重启后生效」；拒绝停用/卸载自己。

### 2.4 出错怎么办

- **用户看到什么**：行级错误 + 原因；代理不通时提示当前通道（直连/代理/镜像）并给切换入口；检查失败保留上次缓存结果（标注检查时间）。
- **系统怎么兜底**：所有 profile 目录变更走串行队列 + 操作前快照，失败自动 restore + frozen-lockfile 恢复（对应官方 operations.js:543 同款行为）；DOM 注入类实验项失败自动降级并停用（railist selfCheck 同款 degraded 模式）；检测到 package.json 被外部改动（用户手动 pnpm）自动重新盘点。
- **能不能重试补偿**：逐包独立重试；被 24h 门槛拒的版本次日可重试或显式豁免；GitHub 限流时 ETag 条件请求 + 退避。
- **怎么回滚**：单包降级 = `pnpm add pkg@旧版本`；批量回滚 = 用 backups/ 快照还原两个清单文件 + frozen-lockfile 安装；卸载前确认框 = 第一道闸。
- **怎么告警排查**：`[plugin-keeper]` 前缀日志进宿主 logger；台账写 `$DSH_HOME/plugin-keeper-state.json`（重启不丢）。

### 2.5 对现有功能影响、兼容

- **相邻插件盘点**：① dsh-plugin（hub）的更新提示与本插件并存不冲突（它只提示市场目录内）；② dsh-settings-arranger 管 settings nav 排序——新 section 会被它纳入管理，属正常协作；③ dsh-config-manager 的备份/恢复是文件级，与我们的快照互不干扰；④ 自家数据只写 `$DSH_HOME/plugin-keeper*`，不碰别人命名空间；⑤ 批量停用范围**默认排除官方包与官方 on-demand**（用户需求就是「非官方」），UI 里官方包灰显只读。
- **老数据老接口兼容**：首次运行只读不写（除自己的 state 文件）；不改 cordis.patch.yml 结构（启停复用官方 writePluginEnabled 的 yaml 语义）。
- **双 profile**：web 走完整管线；desktop 同管线（宿主半直接操作 profile 目录），但重启提示不同。风险点：desktop 是被 CLI 有意保护的 profile，绕过 CLI 直改目录属社区既有做法（Desktop App 内置管理器同机制），文档里向用户明示。
- **主要风险**：官方 slot/DOM 结构随 DSH 升级变化（→ selfCheck + degraded）；pnpm 24h 门槛（→ 状态区分 + 显式豁免）；github 无 release 仓库（→ 明示检测锚点）。

### 2.6 实施顺序

1. **M0 骨架 + 只读盘点**：settings.section 注册、listInstalled（合并 package.json/patch/官方服务数据）、来源分组列表 UI、主题 + 双语。验收：真机看到 27 个插件按来源正确分组。
2. **M1 检查更新**：npm + GitHub 检查（降级链）、代理双通道、ETag 缓存、兼容预判标记、「已发布暂不可装」状态。验收：一键检查 27 个插件，2 个 github 插件能正确出 release；断网/换代理各有正确报错。
3. **M2 批量操作**：多选更新/停用/卸载、快照备份与回滚、结果台账、重启横幅、自更新特判。验收：对 2-3 个插件真机走通更新→重启生效→单包回滚全流程；批量停用热生效验证。
4. **M3 GitHub 安装 + 官方整合**：github 直装（直连/代理）、settings.plugins.tab 官方页签、两个实验项（图标注入/深度嵌入）。验收：经镜像前缀装通一个 github 插件；官方页签出现且可切换。
5. **M4 发布**：性能体检（§3.6 五维度）、敏感筛查、双语 README、`engines.dsh` 范围声明、tag → CI 发版、市场 topic 收录。

### 2.7 验收标准

- **用户验收**：web + desktop 各过一遍清单（总览分组数对、检查结果与 npm/GitHub 网页人工核对一致、批量操作后插件实际状态正确、重启后新版本生效）。
- **功能验收**（AGENT.md §6 硬性要求，一条命令跑通，纳入 CI）：来源 spec 解析（github:/file:/link:/range 四态）、兼容闸复刻（engines.dsh 优先 + includePrerelease + 豁免）、检查结果合并状态机、批量串行队列与失败恢复、镜像前缀 URL 规则（哪些可加哪些不可加）、快照回滚 e2e（临时 profile）。
- **数据验收**：每次批量操作前后 package.json / bundles diff 只含预期行；台账与实际 node_modules 版本一致。
- **回归验收**：全部插件启动日志无 `skipping profile bundle`；官方插件操作全部灰显不可触发。

---

## 3. 命名与待拍板

1. **插件名**：`dsh-plugin-updater` 已被生态里 3 个同名插件占用，不可用。候选：**`dsh-plugin-keeper`（推荐，批量运维语义，npm/目录均未见占用）** / `dsh-plugin-keeper`（keeper 后缀生态有同类） / `dsh-plugin-batch`（直白）。
2. **官方包处理**：默认只读展示、不可操作（符合「非官方插件」范围）——确认即可。
3. **desktop profile**：默认 v1 就支持（用户双 profile 日常在用），代价是多一条「重启 App」提示——确认即可。
4. **两个实验项**（自定义 nav 图标注入、深度嵌入官方管理页 DOM）：默认关闭、selfCheck 降级保护；若嫌维护成本高，v1 可直接砍掉。

## 4. 性能体检预承诺（§3.6 五维度）

1. **输入侧**：检查结果/台账写 `$DSH_HOME` 文件，不写 settings（零 revision 推送）；配置变更单次合并写。
2. **定时器**：自动检查（如做）用单例定时器 + unref，页面隐藏时暂停；所有 setTimeout/Interval 登记清理。
3. **DOM 观测**：仅两个实验项用 MutationObserver，回调只做锚点匹配打标，不做 DOM 改序。
4. **视觉抖动**：无 `#fff` 兜底（全 --dsw-alias 变量）；列表 React key 用插件包名不用 index；批量执行用状态机而非高频 setState。
5. **体积与冷启动**：零依赖目标（undici ProxyAgent 为 Node 内置）；激活期不做网络请求（首屏只读本地缓存，检查需用户点击或显式开启自动检查）。

> 附：GitHub 代理双通道速记——api.github.com（检查元数据）：直连 / HTTP(S)_PROXY / 自定义 HTTP 代理，**不可**加 gh-proxy 前缀；github.com 的 archive/releases/raw（安装下载）与 git clone：**可**加 gh-proxy 系镜像前缀（ghfast.top / gh-proxy.com / mirror.ghproxy.com 实测有效），token 不发往镜像。npm 检查：registry.npmjs.org/{name}/latest + /-/package/{name}/dist-tags，npmmirror 可作降级源（自定义/内网源不自动切换，防私有包名外泄）。

> 更名记录：2026-10-24 `dsh-plugin-ops` 在 npm 被他人注册，最终定名 `dsh-plugin-keeper`（keeper/batch/steward 等候选实测后选定）。

---

## 附：施工进度（2026-10-24）

- **M0 骨架+盘点** ✅ commit 63929a2（改名 bd95a57→dsh-plugin-keeper）：settings.section 页签、来源分组、双语、主题 token
- **M1 检查更新** ✅ commits 087950c + 82a2172：npm/GitHub 双通道、代理、兼容预判、undici v7 redirect interceptor、状态落 $DSH_HOME/plugin-keeper.json
- **M2 批量操作** ✅ commits 1d43f67 + 42b5336 + a8df6b2：多选批量 启用/停用/卸载/更新、armed 二次确认、快照/恢复、结果台账、跨会话 lastBatch、官方 listBundles 状态并入；真机验证 settings-arranger 停用→恢复→启用全链路
- **M3 GitHub 安装+官方整合** ⚠️ commit 4f12b92（部分完成）：plugins.tab 页签（侧栏插件面板）、裸 `github:` spec 直装、错误诊断完整回显。**M3 验收项「经镜像前缀/代理装通一个 github 插件」当时未实现**：只覆盖直连路径；「真实装卸 capability-panel」也无脚本、日志或产物留痕，不应记为完整 ✅。两个实验项（nav 图标注入/深度嵌入）按拍板默认不做。
- **代理双通道与 spec 归一化（补齐）**：留空跟随系统代理，配置后检查更新（GitHub API + npm registry）与 GitHub 安装都走代理 —— 安装侧经 `profileContext.packageManager.env` 注入宿主 git/pnpm 子进程；带/不带 `github:` 前缀的地址统一由 `github-spec.js` 收敛。验收以真实链路自检脚本为准，不再以文档声明代替。
- **M4 发布准备**：性能体检五查通过（定时器自清/无硬编码色/无 index key/Observer 有清理/无输入侧放大）、敏感筛查通过（无密钥无绝对路径）、双语 README+CHANGELOG 就绪；**push/tag/publish 等用户明确说「发布」**
