# Changelog

## 未发布

### English

- Instant first paint: the inventory is cached in the browser, so opening the tab renders the last known list immediately and the fresh snapshot replaces it in the background — no more full-page "Loading…"
- Load and check RPCs now carry timeouts (5s / 30s) with visible degradation instead of an endless spinner
- Update checks are now per group: the npm group and the GitHub group run independently (within-group concurrency npm 8 / GitHub 3), so a slow or failing group no longer blocks the other
- Each group header gained its own "check this group" button and that group's result counts
- Host-side inventory collection runs concurrently instead of serially
- A finished check no longer triggers an extra full refresh; results are merged in place
- Language switches no longer refetch the inventory
- Added timing marks on both halves (`[dsh-plugin-keeper] …`) to locate slow phases

### 中文

- 首屏秒开：盘点结果缓存到浏览器，打开页签立即渲染上次列表，新快照后台覆盖，不再整页「加载中…」
- 加载与检查 RPC 加超时（5s / 30s）与可见降级，不再无限转圈
- 检查更新改为按分组独立：npm 组与 GitHub 组互不阻塞（组内并发 npm 8 / GitHub 3）
- 分组头部新增「检查本组」入口与本组结果计数
- 宿主半盘点由串行改为并发
- 检查完不再额外全量刷新，结果就地合并
- 语言切换不再重拉盘点数据
- 两端新增耗时打点（`[dsh-plugin-keeper] …`）便于定位慢在哪一段

## 0.2.0 (2026-10-24)

### English

- Added one-click update check: npm plugins via the registry with `engines.dsh` compatibility pre-check; GitHub plugins via releases with tag fallback; GitHub API goes through a configurable in-page proxy
- Added multi-select batch operations: batch update / enable / disable / uninstall, with disable and enable applied hot; batch runs are preceded by an automatic profile config snapshot (last 10 kept) restorable in-page
- Added an honest result ledger per batch run: success / restart-required / failed / skipped counts with per-item reasons
- Added GitHub installs: `owner/repo`, `github:owner/repo#tag` or a GitHub URL; failure reasons are echoed in full
- Added a "Plugin Ops" tab in the official sidebar Plugins panel, sharing the same data as the settings tab
- Update states persist across restarts and show the time of the last check

### 中文

- 新增一键检查更新：npm 插件查 registry 并做 `engines.dsh` 兼容预判；GitHub 插件查 releases（tag 兜底）；GitHub API 走页内可配置代理
- 新增多选批量操作：批量更新 / 启用 / 停用 / 卸载，停用与启用热生效；每次批量前自动快照 profile 配置（保留最近 10 份），页内一键恢复
- 新增诚实结果台账：每轮批量输出 成功 / 需重启 / 失败 / 跳过 计数与逐项原因
- 新增 GitHub 直装：`owner/repo`、`github:owner/repo#tag` 或 GitHub 链接；失败原因完整回显
- 官方侧栏「插件」面板新增「插件运维」页签，与设置页共享数据
- 检查结果跨重启持久化并显示上次检查时间

## 0.1.0 (2026-10-24)

### English

- Initial release: source-grouped plugin inventory (official / npm / GitHub / local) in a settings tab, with per-row version, source badge, description and running state; official plugins read-only; theme and locale follow the host

### 中文

- 首个版本：设置页「插件运维」页签，按 官方 / npm / GitHub / 本地 来源分组盘点插件，行内展示版本、来源徽标、简述与运行状态；官方插件只读；主题与语言跟随宿主
