# dsh-plugin-keeper

Plugin ops console for DeepSeek Harness (DSH 0.2.x): **source-grouped inventory, one-click update checks, multi-select batch operations, export/import of plugin packages, GitHub installs, and in-panel search**.

It only manages plugins you already have — no plugin marketplace, and no hot restart (the host requires a process restart for package changes, so it honestly tells you "restart required").

## Features (0.3.0)

### Inventory

- **Grouped by install source**: every plugin in the current profile grouped by **how it was installed** — official / npm / GitHub / local (plus "other sources"); each row shows package name, version, source badge (official / local; GitHub source is conveyed by the group, repo shown on name hover), description and running state (running / not running / disabled)
- **Official plugins are read-only**: they ship with DSH, so they are dimmed and excluded from every batch operation
- **Summary line and group actions**: totals per source on top; groups can be collapsed and selected as a whole
- **Source entry points**: npm / GitHub rows open the package page or repository; local rows show the plugin path on hover and copy it on click

### Update checks

- **One click checks**: npm plugins via the registry (with an `engines.dsh` compatibility pre-check), GitHub plugins via releases (tag fallback); row badges read latest / updatable / incompatible / needs dsh x.y / no version anchor / check failed
- **Per-group checks**: the npm group and the GitHub group run independently and never block each other (within-group concurrency: npm 8, GitHub 3); each group header can trigger its own check and shows that group's counts
- **Two proxy channels**: the GitHub API goes through a configurable in-page HTTP proxy, npm always talks to the registry directly
- **Persistent results**: check results survive restarts, the time of the last check is shown, every failure reason is echoed in full and connection errors get a dedicated hint
- **Timeouts and degradation**: 5s load / 30s check timeouts keep the last known list on screen instead of an endless spinner
- **Instant first paint**: the inventory is cached in the browser, so opening the tab renders the last known list right away and the fresh snapshot replaces it in the background

### Batch operations

- **Four operations**: multi-select, then batch update / enable / disable / uninstall; every batch asks for confirmation and lists the packages it will touch
- **Hot where possible, honest where not**: enable and disable apply hot (visible immediately), updates and uninstalls report "restart required" and keep a restart banner on screen
- **Config snapshots and rollback**: the profile configuration is snapshotted before each batch (last 10 kept) and can be restored from the page with one click
- **Result ledger**: each run reports success / restart-required / failed / skipped counts with the reason for every item — no silent failures; it survives page reloads
- **Updatable only**: narrows the list to plugins that actually have a newer version

### Export / import

- **Export selected**: produces a portable zip package (one `npm pack` tarball per plugin + `manifest.json` + an `INSTALL.md` with ready-to-run install commands); the dialog can also carry the matching plugin configuration
  - Three configuration sources: parameter fragments in the profile `cordis.patch.yml` (**exactly** matched by plugin name), standalone config files under `$DSH_HOME` (**heuristic**, each item labelled with its confidence) and plugin-declared `dsh.dataDirs`
  - The package never carries **credentials**; files that look like credentials are listed in the dialog but never packaged
  - The download goes through a loopback-only HTTP route (peer address and `Host` header must both be loopback)
  - The zip is implemented with zero added dependencies (`node:zlib` deflate + a hand-written CRC32)
- **Import package**: choose a zip → pre-check → nothing is touched until you confirm
  - The **compatibility pre-check** mirrors the host's own gate (`evaluatePluginCompatibility`): `engines.dsh` decides alone, otherwise every `@deepseek-ai/dsh*` peer must match; `workspace:` peers count as the current runtime; the profile's `compatibility.json` exemptions are honoured
  - Incompatible plugins are **skipped by default**, and the exact unmet requirement is reported
  - **Per-item conflict handling**: same name already installed / existing config fragment / existing standalone file (keep local / use the package / skip)
  - Configuration is written with line-level text edits — your hand-edited `cordis.patch.yml` keeps its comments and formatting
  - A config snapshot is taken before anything is overwritten and stays restorable; "import configuration only" installs no plugins at all

### GitHub install

- Type `owner/repo`, `github:owner/repo#tag` or a GitHub URL to install; failure reasons are echoed in full

### Plugin search

- The toolbar search box narrows the inventory by package name, description, version or source repository; typing filters automatically after a short pause (debounced)
- Matched parts are highlighted in **yellow** and an "n / total matched" counter tells you how much is left; multiple words combine with AND
- Esc or the × button clears it; it stacks with the "updatable only" filter

### Integration and polish

- **Two entries**: the sidebar **Plugins** panel → "插件运维 / Plugin Ops" tab (always available); a switch in "Check settings" can also show it as a Settings section
- **Theme follows the host**: semantic `--dsw-alias-*` tokens only, light and dark; UI text is bilingual (zh/en) and follows the host locale
- **In-row actions**: collapsible groups, select-a-whole-group, an in-row "Update" button, copying a local plugin path

## Compatibility

| Item | Requirement |
|---|---|
| DSH | `>=0.2.0-rc.2 <0.3.0` |
| Node | `>=20` |
| peer | `@deepseek-ai/dsh-typert-protocol@^0.2.0-rc.2` |

## Install

```bash
dsh plugin add dsh-plugin-keeper
```

Restart dsh after installing (package changes require a process restart). Default entry: sidebar Plugins → "插件运维" tab (optionally Settings → "插件运维" tab).

## Verify

1. Open either entry; plugins should be grouped by source and the totals match `dsh plugin ls`
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
