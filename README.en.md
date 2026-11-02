# dsh-plugin-keeper

Plugin ops console for DeepSeek Harness (DSH 0.2.x): inventory the installed plugins, check for updates, batch-process them, export and import them, install straight from GitHub, and search them from the panel.

It only manages plugins you already have. No marketplace, no hot restart — the host requires a process restart when package contents change.

## Features (0.3.0)

### Inventory

- Plugins of the current profile, grouped by how they were installed: official / npm / GitHub / local. Each row shows name, version, source badge, description and running state (running / not running / disabled)
- Official plugins ship with DSH, so they are dimmed and excluded from batch operations
- Totals per source on top; groups can be collapsed and selected as a whole
- npm / GitHub rows open the package page or repository; local rows show the plugin path on hover and copy it on click

### Update checks

- One click checks npm plugins against the registry and GitHub plugins against their latest release (tag fallback). Row badges: latest / updatable / incompatible / needs dsh x.y / no version anchor / failed
- The npm group and the GitHub group are checked independently, so a slow or unreachable group does not hold up the other; each group header can check its own group
- The GitHub API goes through an HTTP proxy you can set in the page; npm always talks to the registry directly
- Results are kept across restarts, and the time of the last check is shown; failure reasons are shown in full
- The inventory is cached in the browser: opening the tab shows the last list right away, the fresh snapshot replaces it in the background. Load and check have timeouts (5s / 30s)

### Batch operations

- Update / enable / disable / uninstall; a confirmation dialog lists the selected packages first
- Enable and disable take effect immediately; update and uninstall need a restart
- The profile config is snapshotted before each batch and can be restored from the page
- Each run reports success / restart-required / failed / skipped counts and the reason per item; the report is kept across page reloads
- "Updatable only" narrows the list to plugins that have a newer version

### Export / import

- Export selected produces a zip: one `npm pack` tarball per plugin, plus `manifest.json` and an `INSTALL.md` with install commands
- Optionally included config: parameter fragments from the profile `cordis.patch.yml` (matched exactly by plugin name), standalone config files under `$DSH_HOME` (heuristic, each item labelled with its confidence), and plugin-declared `dsh.dataDirs`
- Credentials never end up in the package; files that look like credentials are listed but not packaged. The download runs over a loopback-only HTTP route
- Import: choose a zip, it is checked first, nothing changes until you confirm
  - The compatibility check mirrors the host's own gate (`evaluatePluginCompatibility`): `engines.dsh` decides alone, otherwise every `@deepseek-ai/dsh*` peer must match; `workspace:` peers count as the current runtime; the profile's `compatibility.json` exemptions apply. Incompatible plugins are skipped and the unmet requirement is spelled out
  - Conflicts are decided per item: same name installed / existing config fragment / existing standalone file — keep local, use the package, or skip
  - Config files are edited line by line, so comments and formatting in `cordis.patch.yml` survive
  - A snapshot is taken before anything is overwritten and can be restored; "import configuration only" installs no plugins

### GitHub install

- Type `owner/repo`, `github:owner/repo#tag` or a GitHub URL to install

### Search

- A search box in the toolbar filters by package name, description, version or source repository
- It filters shortly after you stop typing (200ms debounce), highlights the matched parts in yellow and shows matched / total
- Several words must all match; Esc or × clears it; it stacks with "updatable only"

### Integration

- Entry: sidebar Plugins → "插件运维 / Plugin Ops" tab; a switch in "Check settings" can also show it in Settings
- Theme follows the host (`--dsw-alias-*` tokens, light and dark); text is zh/en and follows the host locale
- The zip is written with `node:zlib` and a hand-written CRC32 — no new dependency

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

Restart dsh after installing (package changes require a process restart). Default entry: sidebar Plugins → "插件运维" tab.

## Verify

1. Open the entry; plugins should be grouped by source and the totals match `dsh plugin ls`
2. Click "Check updates"; badges should match npm / GitHub web results
3. Select any non-official plugin; the batch bar appears and disable/enable reflects on the row immediately
4. If a batch operation reports restart required, restart once and confirm the new state
5. Select some plugins → "Export selected" → confirm the plugin and configuration lists → export; the browser should download a zip (check with `unzip -l` that it contains `manifest.json` and `plugins/*.tgz`)
6. Click "Import package" → pick that zip back → the pre-check dialog should list plugins, compatibility verdicts and conflicts; pick the strategies and confirm
7. Type a package name fragment (e.g. `acp`) in the search box; the list should narrow automatically, the matched text should be highlighted in yellow and the counter should show matched / total; Esc or × restores the full list

## Roadmap

- Later: desktop profile adaptation, experimental items (nav icon injection, deep embedding in the official page)

## License

MIT
