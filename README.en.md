# dsh-plugin-keeper

Plugin ops console for DeepSeek Harness (DSH 0.2.x): source-grouped inventory, one-click update checks, multi-select batch operations, and GitHub installs — inside a Settings tab and the official plugin manager page.

## Features (0.2.0)

- **Source-grouped inventory**: every plugin in the current profile grouped as official / npm / GitHub / local; each row shows package name, version, source badge (official/local; GitHub source is conveyed by the group, repo shown on name hover), description and running state; official plugins are dimmed and read-only
- **Instant first paint**: the inventory is cached in the browser, so opening the tab renders the last known list right away and the fresh snapshot replaces it in the background; loading and checking have timeouts with honest degradation instead of an endless spinner
- **One-click update check**: npm plugins via the registry (with `engines.dsh` compatibility pre-check), GitHub plugins via releases (tag fallback); npm goes direct, GitHub API through a proxy (configurable in-page); results are badged updatable / latest / incompatible / failed
- **Per-group checks**: the npm group and the GitHub group run independently and never block each other (within-group concurrency: npm 8, GitHub 3); each group header can trigger its own check and shows that group's counts
- **Batch operations**: multi-select then batch update / enable / disable / uninstall; enable and disable apply hot with instant row feedback, updates and uninstalls honestly report "restart required"; every operation auto-snapshots the profile config first (last 10 kept), restorable in-page with one click
- **Result ledger**: each batch run reports success / restart-required / failed / skipped counts with per-item reasons — no silent failures
- **GitHub install**: type `owner/repo`, `github:owner/repo#tag` or a GitHub URL to install; failure reasons are echoed in full
- **Official plugin manager integration**: a "插件运维 / Plugin Ops" tab in the sidebar Plugins panel, sharing the same data as the settings tab
- Theme follows the host (semantic `--dsw-alias-*` tokens only); UI text is bilingual (zh/en) and follows the host locale

## Install

```bash
dsh plugin add dsh-plugin-keeper
```

Restart dsh after installing (package changes require a process restart). Two entries: Settings → "插件运维" tab; sidebar Plugins → "插件运维" tab.

## Verify

1. Open either entry; plugins should be grouped by source and the totals match `dsh plugin ls`
2. Click "Check updates"; badges should match npm / GitHub web results
3. Select any non-official plugin; the batch bar appears and disable/enable reflects on the row immediately
4. If a batch operation reports restart required, restart once and confirm the new state

## Roadmap

- Later: desktop profile adaptation, experimental items (nav icon injection, deep embedding in the official page)

## License

MIT
