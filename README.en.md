# dsh-plugin-keeper

A plugin ops console for DeepSeek Harness (DSH 0.2.x): inventory the installed plugins, update / enable / disable / remove them in bulk, export and import them, install straight from GitHub, and search the list.

It only manages plugins you already have. No marketplace, no hot restart — the host requires a process restart when package contents change.

## What you can do

- See every plugin installed in the current profile in one place, grouped by where it came from (official / npm / GitHub / local)
- Find out which ones have a newer version and update them in bulk
- Enable, disable or remove plugins in bulk
- Export selected plugins (with their config) into a zip, and import that zip on another machine
- Install a plugin straight from GitHub
- Search the list by package name, description or version

## How to use it

- The panel lives in the sidebar Plugins page → "插件运维 / Plugin Ops" tab; it can also be shown in Settings
- Tick the rows you want, pick an action; a dialog lists what will be touched before anything runs
- Enable and disable take effect right away; updates and removals need a restart
- Export downloads a zip you can copy to another machine; import shows you what will happen before installing anything
- Type a package name fragment in the search box to filter; the matched parts are highlighted

## When it helps

- Moving to a new machine: export the plugins you use and import them there
- Cleaning up after a burst of installs: review, then disable or remove in bulk
- Routine upkeep: one click to see what is outdated, then update in bulk

## Install

```bash
dsh plugin add dsh-plugin-keeper
```

Restart dsh after installing (package changes require a process restart).

## Compatibility

| Item | Requirement |
|---|---|
| DSH | `>=0.2.0-rc.2 <0.3.0` |
| Node | `>=20` |

## First run

1. Open sidebar Plugins → "插件运维": plugins are grouped by source and the totals match `dsh plugin ls`
2. Click "Check updates": the badges match the latest versions on npm / GitHub
3. Select a non-official plugin → "Disable": the row immediately shows disabled; enabling it works the same way
4. Type a package name fragment in the search box: the list narrows and the matched parts are highlighted; Esc or × restores the full list

## Roadmap

- Later: desktop profile adaptation, experimental items (nav icon injection, deep embedding in the official page)

## License

MIT
