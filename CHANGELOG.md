# Changelog

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
