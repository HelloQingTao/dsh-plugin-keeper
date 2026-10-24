# dsh-plugin-keeper

Plugin ops console for DeepSeek Harness (DSH 0.2.x): collects plugin information scattered across the profile into one settings tab, grouped by install source, with update checks and batch operations coming in later releases.

## Current version (0.1.0, M0)

Adds a "插件运维 / Plugin Ops" tab to Settings:

- Inventory of every plugin in the current profile, **grouped by source**: official, npm, GitHub, local
- Each row shows: package name, version, source badge (GitHub shows `user/repo`), description, running state (green dot = started)
- Official plugins are dimmed and marked read-only; they are excluded from future batch operations
- Theme follows the host (semantic `--dsw-alias-*` tokens only); UI text is bilingual (zh/en) and follows the host locale
- Strictly read-only: writes nothing in the profile

## Data sources

- `dependencies` of `~/.dsh/profiles/<profile>/package.json` (the dependency spec records the install source: npm range / `github:` / `file:`)
- Each package's own `package.json` (version and `dsh` metadata)
- Host `profileContext.startedBundles` (the set of plugins actually started)

## Install & verify

1. Install: `dsh plugin add dsh-plugin-keeper` (or a local path), then restart dsh web / desktop (package changes require a process restart)
2. Verify: open Settings → "插件运维" tab; plugins should be grouped by source, theme and locale follow the host

## Roadmap

- M1: one-click update check (npm registry + GitHub releases, with proxy support for both check and download channels)
- M2: multi-select batch update / disable / uninstall (pre-install snapshot, rollback on failure, honest result ledger; disable is hot-applied, updates ask for a restart)
- M3: install GitHub plugins (direct or via proxy); optional integration into the official plugin management tab

## License

MIT
