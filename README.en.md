# dsh-plugin-keeper

Plugin ops console for DeepSeek Harness (DSH 0.2.x): source-grouped inventory, one-click update checks, multi-select batch operations, export/import of plugin packages, and GitHub installs — inside the official plugin manager page (and optionally a Settings tab).

## Features (0.3.0)

- **Source-grouped inventory**: every plugin in the current profile grouped as official / npm / GitHub / local; each row shows package name, version, source badge (official/local; GitHub source is conveyed by the group, repo shown on name hover), description and running state; official plugins are dimmed and read-only
- **Instant first paint**: the inventory is cached in the browser, so opening the tab renders the last known list right away and the fresh snapshot replaces it in the background; loading and checking have timeouts with honest degradation instead of an endless spinner
- **One-click update check**: npm plugins via the registry (with `engines.dsh` compatibility pre-check), GitHub plugins via releases (tag fallback); npm goes direct, GitHub API through a proxy (configurable in-page); results are badged updatable / latest / incompatible / failed
- **Per-group checks**: the npm group and the GitHub group run independently and never block each other (within-group concurrency: npm 8, GitHub 3); each group header can trigger its own check and shows that group's counts
- **Batch operations**: multi-select then batch update / enable / disable / uninstall; enable and disable apply hot with instant row feedback, updates and uninstalls honestly report "restart required"; every operation auto-snapshots the profile config first (last 10 kept), restorable in-page with one click
- **Export selected**: produces a portable zip package (one `npm pack` tarball per plugin + `manifest.json` + an `INSTALL.md` with ready-to-run install commands); the dialog can also carry the matching plugin configuration
  - Three configuration sources: parameter fragments in the profile `cordis.patch.yml` (**exactly** matched by plugin name), standalone config files under `$DSH_HOME` (**heuristic**, each item labelled with its confidence), and plugin-declared `dsh.dataDirs`
  - The package never carries **credentials**; files that look like credentials are listed in the dialog but never packaged
  - The download goes through a loopback-only HTTP route (peer address and `Host` header must both be loopback)
- **Import package**: choose a zip → pre-check → nothing is touched until you confirm
  - The **compatibility pre-check** mirrors the host's own gate: `engines.dsh` decides alone, otherwise every `@deepseek-ai/dsh*` peer must match; `workspace:` peers count as the current runtime; the profile's `compatibility.json` exemptions are honoured
  - Incompatible plugins are **skipped by default**, and the exact unmet requirement is reported
  - **Per-item conflict handling**: same name already installed (keep local / use the package / skip), profile config fragment (keep local / use the package / skip), standalone config file (keep local / use the package / skip)
  - Configuration is written with line-level text edits — your hand-edited `cordis.patch.yml` keeps its comments and formatting
  - A config snapshot is taken before anything is overwritten and stays restorable in-page; "import configuration only" installs no plugins at all
- **Result ledger**: each batch run reports success / restart-required / failed / skipped counts with per-item reasons — no silent failures
- **GitHub install**: type `owner/repo`, `github:owner/repo#tag` or a GitHub URL to install; failure reasons are echoed in full
- **Display location**: the panel lives in the sidebar Plugins tab by default; a switch in "Check settings" can also show it as a Settings section (applies after re-entering the page)
- **Plugin search**: the toolbar search box narrows the inventory by package name, description, version or source repository; typing filters automatically after a short pause, matched parts are highlighted in yellow, and an "n / total matched" counter tells you how much is left; it combines with "Updatable only", and Esc or the × button clears it
- Theme follows the host (semantic `--dsw-alias-*` tokens only); UI text is bilingual (zh/en) and follows the host locale

## Install

```bash
dsh plugin add dsh-plugin-keeper
```

Restart dsh after installing (package changes require a process restart). Default entry: sidebar Plugins → "插件运维" tab (optionally Settings → "插件运维" tab).

## Verify

1. Open the entry; plugins should be grouped by source and the totals match `dsh plugin ls`
2. Click "Check updates"; badges should match npm / GitHub web results
3. Select any non-official plugin; the batch bar appears and disable/enable reflects on the row immediately
4. If a batch operation reports restart required, restart once and confirm the new state
5. Select some plugins → "Export selected" → confirm the plugin and configuration lists → export; the browser should download a zip (check with `unzip -l` that it contains `manifest.json` and `plugins/*.tgz`)
6. Click "Import package" → pick that zip back → the pre-check dialog should list plugins, compatibility verdicts and conflicts; pick the strategies and confirm
7. Type a package name fragment (e.g. `acp`) in the search box; the list should narrow automatically, the matched text should be highlighted in yellow and the counter should show "n / total"; Esc or × restores the full list

## Roadmap

- Later: desktop profile adaptation, experimental items (nav icon injection, deep embedding in the official page)

## License

MIT
