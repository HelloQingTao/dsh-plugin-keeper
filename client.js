/**
 * dsh-plugin-keeper — Client half (Web UI)。
 *
 * slot：settings.section —— 设置页新增「插件运维」页签。
 * M0：按来源分组盘点（官方 / npm / GitHub / 本地），只读展示。
 * M1：一键检查更新（npm + GitHub 双通道、GitHub API 代理设置）。
 * M2：多选批量 更新/停用/卸载 —— 批前配置快照（宿主半），逐行调官方
 *     pluginManager 服务（setBundleEnabled / removeBundle / installBundle），
 *     结果台账 + 重启横幅 + 快照恢复。本插件自己不碰 pnpm。
 *
 * 规范：
 * - 只用 --dsw-alias-* 主题 token（清单取自 dsh-client-ui-theme 实际定义），
 *   不硬编码颜色，不写 #fff 兜底；
 * - 不 require @deepseek-ai/dsh-client-ui-*（peer 由宿主 ResolutionRouter 提供）；
 * - 双语 zh/en 文案表，每次渲染实时读 <html lang>；
 * - 组件内样式集中一个 <style> 标签，幂等注入。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-keeper',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const SELF = 'dsh-plugin-keeper';

    // ---------- 双语文案表（跟随宿主语言，实时读取不缓存） ----------

    function localeId() {
      const raw = (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang)
        || (typeof navigator !== 'undefined' && navigator.language) || 'en';
      return String(raw).toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }

    const TEXT = {
      zh: {
        sectionTitle: '插件运维',
        summary: '共 {total} 个插件：官方 {official} · npm {npm} · GitHub {github} · 本地 {local}',
        refresh: '刷新',
        refreshing: '刷新中…',
        loading: '加载中…',
        loadFailed: '盘点数据加载失败',
        groupOfficial: '官方插件',
        groupNpm: 'npm 插件',
        groupGithub: 'GitHub 插件',
        groupLocal: '本地插件',
        groupUnknown: '其他来源',
        badgeOfficial: '官方',
        badgeLocal: '本地',
        stateOn: '运行中',
        stateOff: '未运行',
        stateDisabled: '已停用',
        officialReadonly: '官方插件：只读，不参与批量操作',
        noPlugins: '没有已安装的插件',
        checkBtn: '检查更新',
        checking: '检查中…',
        lastCheck: '上次检查 {time}',
        neverChecked: '未检查过',
        chkLatest: '最新',
        chkUpdate: '{ver}',
        chkIncompatible: '不兼容',
        chkNeedDsh: '需 dsh {range}',
        chkError: '检查失败',
        chkNoRelease: '无版本锚点',
        chkUnknownVer: '版本未知',
        checkDone: '检查完成：可更新 {update} · 最新 {latest} · 失败 {error}',
        checkDoneFail: '检查完成，但有 {fail} 项失败',
        checkErrDetail: '失败原因：{note}',
        checkConnHint: '连接类错误通常是代理不可达或网络受限：请在下方确认代理已启动，或留空改用系统代理。徽标停留在上次成功检查的结果，请修正后重新检查。',
        checkedAt: '检查于 {time}',
        installLabel: '从 GitHub 安装',
        installHint: '支持 owner/repo、github:owner/repo#tag、完整 GitHub 链接（含 .git、/tree/tag）、git@ SSH；安装与检查更新共用下方代理设置。',
        installNoResponse: '安装请求已发出，宿主暂未返回结果；下方实时日志可查看进度',
        settingsTitle: '高级配置',
        settingsBtn: '高级配置',
        sectionProxy: '网络代理',
        sectionInstall: '从 GitHub 安装',
        sectionDisplay: '显示位置',
        collapseAllGroups: '一键折叠全部分组',
        expandAllGroups: '一键展开全部分组',
        dialogClose: '关闭',
        clearLedger: '清空',
        clearLedgerAria: '清空所有消息',
        proxyLabel: 'HTTP 代理',
        proxyPlaceholder: '127.0.0.1:7890（可不带 http://）',
        proxyHint: '留空 = 跟随系统代理（环境变量 / git 配置）；填写后检查更新与 GitHub 安装都走此代理，不带前缀会自动补齐。需要认证时在下方填写账号密码，不用拼进地址。',
        proxyUnsupported: '代理未能注入安装进程：{reason}。请把 HTTPS_PROXY 写进 ~/.dsh/.env 并重启 dsh web。',
        proxyUserLabel: '代理账号',
        proxyPassLabel: '代理密码',
        proxyUserPlaceholder: '可选',
        proxyPassPlaceholder: '留空 = 保持原密码',
        proxyCredentialHint: '账号密码按 HTTP Basic 认证发送，特殊字符自动编码；密码不回显，清空账号即取消认证。',
        testProxyBtn: '测试连通性',
        testProxyNoFace: '宿主半区未就绪（远程方法不可用），请刷新页面或重启 dsh web',
        testProxyEmpty: '宿主无返回（RPC 被拒绝或超时），请刷新页面后重试',
        testProxyTesting: '测试中… {n}s',
        testProxySlowHint: 'git 链路经代理通常需 10~25 秒，失败会自动重试一次；上方按钮显示真实等待时长。',
        testProxyOk: '代理可用',
        testProxyFail: '代理不可用',
        testInstallOk: '安装链路（git）正常',
        testInstallFail: '安装链路（git）未通过：可能超时或 TLS 握手失败，代理本身仍可用',
        testProxyHint: '按当前输入框的值测试（不保存、不安装），同时验证检查更新与安装两条通道。',
        checkGithubApi: 'GitHub API',
        checkNpmRegistry: 'npm registry',
        checkGitRemote: 'GitHub git 远程',
        save: '保存',
        saving: '保存中…',
        saved: '已保存',
        saveFailed: '保存失败',
        installBtn: '安装',
        installing: '安装中…',
        installDone: '已安装 {name}，刷新列表可见',
        installRestart: '已安装 {name}，重启后生效',
        installStage: '安装进度',
        stageStarting: '准备中（解析地址、连接仓库）',
        stageInstalling: '正在安装依赖 · 第 {index}/{total} 个源 {registry}',
        stageInstallingSimple: '正在安装依赖（pnpm 运行中）',
        stageApplying: '正在应用到 profile',
        stageCancelling: '正在取消安装',
        installLogCount: '{n} 行输出',
        installCancel: '取消安装',
        installFailed: '安装失败',
        installBad: '无法识别的仓库地址',
        installPlaceholder: 'owner/repo、github:owner/repo#tag 或 GitHub 链接',
        // ---- M2 批量 ----
        batchUpdate: '更新所选',
        batchEnable: '启用所选',
        batchDisable: '停用所选',
        batchUninstall: '卸载所选',
        dialogCancel: '取消',
        dialogDescUpdate: '将先卸载所选插件的当前版本，再安装检查到的最新版本；操作前自动备份配置快照，可随时恢复。',
        dialogDescEnable: '将启用所选插件：加入运行列表并生效（操作前自动备份配置快照）；若需重启会另行提示。',
        dialogDescDisable: '将停用所选插件：立即停止运行，配置保留，可随时重新启用（操作前自动备份配置快照）。',
        dialogDescUninstall: '将从本 profile 卸载所选插件；操作前自动备份配置快照，可用「恢复快照」撤销。',
        dialogOkOp: '确认{op}',
        selHint: '已选 {sel} · 可更新 {upd}',
        batchRunning: '{op}中… {done}/{total}',
        opUpdate: '更新',
        opEnable: '启用',
        opDisable: '停用',
        opUninstall: '卸载',
        opApplied: '已应用',
        opRestart: '需重启',
        opFailed: '失败',
        opSkipped: '跳过',
        opNoTarget: '无可更新目标',
        opAlreadyEnabled: '已是启用状态',
        opAlreadyDisabled: '已是停用状态',
        opNone: '所选插件均处于目标状态，无需操作',
        opNoFace: 'pluginManager 服务不可用',
        opDone: '批量{op}完成：成功 {ok} · 需重启 {restart} · 失败 {fail} · 跳过 {skip}',
        batchBusy: '已有批量任务进行中，请等待其完成',
        restoredLedger: '（上次会话的记录）',
        snapshotDone: '已备份配置快照 {id}',
        restartBanner: '{n} 项变更需重启后生效',
        restoreBtn: '恢复快照',
        restoring: '恢复中…',
        restoreDone: '快照已恢复，重启后生效',
        restoreFail: '恢复失败',
        lastBatchLine: '上次批量：{op} · {time}——批量前的配置备份，点「恢复快照」可撤销该次批量；若批量中途关闭页面，此记录可能未完成',
        updateNone: '所选中没有可更新的插件（先检查更新）',
        rowUpdate: '更新',
        onlyUpdatable: '只看可更新',
        // ---- 搜索 ----
        searchPlaceholder: '搜索插件名 / 描述 / 版本',
        searchLabel: '搜索插件',
        searchClear: '清除搜索',
        searchCount: '匹配 {n} / {total}',
        searchNoMatch: '没有匹配「{q}」的插件',
        // ---- 分组独立检查 ----
        groupCheckBtn: '检查本组',
        groupChecking: '检查中…',
        groupCheckDone: '可更新 {u} · 最新 {l}',
        groupCheckFailed: '本组检查失败',
        groupCheckSkipped: '本组无需检查',
        cachedHint: '当前显示上次结果（{time}），正在刷新…',
        loadTimeout: '加载超时（{sec}s），当前显示的是上次结果',
        checkTimeout: '检查超时，请检查网络或 GitHub 代理设置',
        // ---- 打开图标（包名后的来源入口） ----
        openSource: '打开插件所在地址',
        copySpec: '复制可安装名称',
        specCopied: '安装名称已复制',
        copyFail: '复制失败',
        // ---- 显示位置 ----
        showInSettings: '在设置页也显示「插件运维」',
        showInSettingsHint: '关闭时仅在「插件」面板的页签中显示；改动在重新进入页面后生效。',
        showInSettingsSaved: '显示位置已更新，重新进入页面后生效',
        // ---- 分组折叠 ----
        groupCollapse: '折叠分组',
        groupExpand: '展开分组',
        // ---- 导出 ----
        batchExport: '导出所选',
        exportDialogTitle: '导出所选插件',
        exportWithConfig: '同时导出插件对应配置',
        exportWithConfigHint: '配置包含插件在 cordis.patch.yml 里的参数与独立配置文件；不含凭据文件。',
        exportConfigHeader: '将随包带走的配置',
        exportConfigEmpty: '未找到可导出的配置',
        exportConfigPatch: 'profile 配置片段',
        exportConfigHome: '独立配置文件',
        exportConfigDeclared: '插件声明的数据目录',
        exportConfigSuspicious: '疑似凭据文件，不会随包带走',
        exportConfigMaybe: '可能相关（请确认归属）',
        exportOk: '确认导出',
        exportRunning: '导出中…',
        exportDone: '已导出 {name}（{size}）',
        exportFailed: '导出失败',
        exportDownloadFailed: '导出包下载失败',
        exportNoPlugin: '未选择插件',
        exportPlanFailed: '导出预演失败',
        exportWarnings: '导出告警：{note}',
        exportInstallCmd: '安装命令',
        exportInstallCmdCopied: '安装命令已复制',
        // ---- 导入 ----
        batchImport: '导入所选',
        importPick: '选择导出包',
        importPickFailed: '读取文件失败',
        importUploading: '上传中…',
        importUploadFailed: '上传导入包失败',
        importPlanFailed: '导入包解析失败',
        importAnalyzeTitle: '导入预检',
        importSourceDsh: '导出源 DSH {src} · 本机 DSH {local}',
        importCompatOk: '兼容',
        importCompatBad: '不兼容',
        importCompatExempt: '已豁免',
        importCompatUnknown: '无法判定',
        importIntegrityBad: '完整性校验失败',
        importVersionDiff: '导出包记录版本 {pkg}，tarball 内为 {tar}',
        importConflictPlugin: '同名已装',
        importConflictPatch: '本机已有配置片段',
        importConflictFile: '本机已有同名文件',
        importStrategyKeep: '保留本机',
        importStrategyReplace: '以导出包为准',
        importStrategySkip: '跳过',
        importPluginStrategy: '插件处理',
        importConfigStrategy: '配置处理',
        importExecTitle: '执行导入',
        importRunning: '导入中… {done}/{total}',
        importOk: '确认导入',
        importDone: '导入完成：成功 {ok} · 跳过 {skip} · 失败 {fail}',
        importFailed: '导入失败',
        importNeedRestart: '{n} 项变更需重启后生效',
        importLocalPreview: '本机当前值',
        importPackageValue: '导出包中的值',
        importOnlyConfig: '仅导入配置（不装插件）',
        importNoConfig: '导出包内没有配置',
      },
      en: {
        sectionTitle: 'Plugin Ops',
        summary: '{total} plugins: official {official} · npm {npm} · GitHub {github} · local {local}',
        refresh: 'Refresh',
        refreshing: 'Refreshing…',
        loading: 'Loading…',
        loadFailed: 'Failed to load inventory',
        groupOfficial: 'Official plugins',
        groupNpm: 'npm plugins',
        groupGithub: 'GitHub plugins',
        groupLocal: 'Local plugins',
        groupUnknown: 'Other sources',
        badgeOfficial: 'Official',
        badgeLocal: 'Local',
        stateOn: 'Running',
        stateOff: 'Not running',
        stateDisabled: 'Disabled',
        officialReadonly: 'Official plugin: read-only, excluded from batch ops',
        noPlugins: 'No plugins installed',
        checkBtn: 'Check updates',
        checking: 'Checking…',
        lastCheck: 'Last checked {time}',
        neverChecked: 'Never checked',
        chkLatest: 'Latest',
        chkUpdate: '{ver}',
        chkIncompatible: 'Incompatible',
        chkNeedDsh: 'needs dsh {range}',
        chkError: 'Check failed',
        chkNoRelease: 'No release anchor',
        chkUnknownVer: 'Unknown version',
        checkDone: 'Checked: {update} updatable · {latest} latest · {error} failed',
        checkDoneFail: 'Checked, but {fail} failed',
        checkErrDetail: 'Reason: {note}',
        checkConnHint: 'Connection errors usually mean the proxy is down or the network is restricted: check the proxy below, or leave it empty to use the system proxy. Badges keep showing the last successful check until you re-check.',
        checkedAt: 'Checked at {time}',
        installLabel: 'Install from GitHub',
        installHint: 'Accepts owner/repo, github:owner/repo#tag, full GitHub URLs (.git, /tree/tag) and git@ SSH; installs and update checks share the proxy setting below.',
        installNoResponse: 'Install request sent but the host has not returned yet; see the live log below',
        settingsTitle: 'Advanced settings',
        settingsBtn: 'Advanced',
        sectionProxy: 'Network proxy',
        sectionInstall: 'Install from GitHub',
        sectionDisplay: 'Display',
        collapseAllGroups: 'Collapse all groups',
        expandAllGroups: 'Expand all groups',
        dialogClose: 'Close',
        clearLedger: 'Clear',
        clearLedgerAria: 'Clear all messages',
        proxyLabel: 'HTTP proxy',
        proxyPlaceholder: '127.0.0.1:7890 (http:// is optional)',
        proxyHint: 'Empty = follow the system proxy (env vars / git config). When set, both update checks and GitHub installs use it. A missing scheme is added automatically. Enter credentials below instead of putting them in the address.',
        proxyUnsupported: 'The proxy could not be injected into the install process: {reason}. Put HTTPS_PROXY in ~/.dsh/.env and restart dsh web.',
        proxyUserLabel: 'Proxy username',
        proxyPassLabel: 'Proxy password',
        proxyUserPlaceholder: 'Optional',
        proxyPassPlaceholder: 'Leave empty to keep current',
        proxyCredentialHint: 'Credentials are sent as HTTP Basic auth with automatic escaping; the password is never echoed. Clear the username to disable authentication.',
        testProxyBtn: 'Test connectivity',
        testProxyNoFace: 'Host half is not ready (remote method unavailable). Refresh the page or restart dsh web.',
        testProxyEmpty: 'No response from host (RPC rejected or timed out). Refresh the page and retry.',
        testProxyTesting: 'Testing… {n}s',
        testProxySlowHint: 'The git path through a proxy usually takes 10–25s and retries once on failure; the button shows the real elapsed time.',
        testProxyOk: 'Proxy reachable',
        testProxyFail: 'Proxy unreachable',
        testInstallOk: 'Install path (git) OK',
        testInstallFail: 'Install path (git) failed: timeout or TLS handshake; the proxy itself still works',
        testProxyHint: 'Tests the current input (nothing is saved or installed) across both update-check and install paths.',
        checkGithubApi: 'GitHub API',
        checkNpmRegistry: 'npm registry',
        checkGitRemote: 'GitHub git remote',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved',
        saveFailed: 'Save failed',
        installBtn: 'Install',
        installing: 'Installing…',
        installDone: 'Installed {name}, refresh the list to see it',
        installRestart: 'Installed {name}, takes effect after restart',
        installStage: 'Install progress',
        stageStarting: 'Preparing (resolving spec, connecting)',
        stageInstalling: 'Installing dependencies · source {index}/{total} {registry}',
        stageInstallingSimple: 'Installing dependencies (pnpm running)',
        stageApplying: 'Applying to profile',
        stageCancelling: 'Cancelling install',
        installLogCount: '{n} log lines',
        installCancel: 'Cancel install',
        installFailed: 'Install failed',
        installBad: 'Unrecognized repository address',
        installPlaceholder: 'owner/repo, github:owner/repo#tag or GitHub URL',
        // ---- M2 batch ----
        batchUpdate: 'Update selected',
        batchEnable: 'Enable selected',
        batchDisable: 'Disable selected',
        batchUninstall: 'Uninstall selected',
        dialogCancel: 'Cancel',
        dialogDescUpdate: 'Removes the current version of the selected plugins, then installs the latest checked version; a config snapshot is saved first and can be restored.',
        dialogDescEnable: 'Enables the selected plugins so they join the running set; a config snapshot is saved first. A restart prompt follows if needed.',
        dialogDescDisable: 'Disables the selected plugins: they stop running immediately, the configuration is kept, and they can be re-enabled anytime; a config snapshot is saved first.',
        dialogDescUninstall: 'Uninstalls the selected plugins from this profile; a config snapshot is saved first and can be restored to undo.',
        dialogOkOp: 'Confirm {op}',
        selHint: 'Selected {sel} · updatable {upd}',
        batchRunning: '{op}… {done}/{total}',
        opUpdate: 'update',
        opEnable: 'enable',
        opDisable: 'disable',
        opUninstall: 'uninstall',
        opApplied: 'Applied',
        opRestart: 'Restart needed',
        opFailed: 'Failed',
        opSkipped: 'Skipped',
        opNoTarget: 'No update target',
        opAlreadyEnabled: 'Already enabled',
        opAlreadyDisabled: 'Already disabled',
        opNone: 'All selected are already in the target state, nothing to do',
        opNoFace: 'pluginManager service unavailable',
        opDone: 'Batch {op} done: ok {ok} · restart {restart} · failed {fail} · skipped {skip}',
        batchBusy: 'A batch task is already running, please wait',
        restoredLedger: '(from a previous session)',
        snapshotDone: 'Config snapshot saved: {id}',
        restartBanner: '{n} change(s) take effect after restart',
        restoreBtn: 'Restore snapshot',
        restoring: 'Restoring…',
        restoreDone: 'Snapshot restored, takes effect after restart',
        restoreFail: 'Restore failed',
        lastBatchLine: 'Last batch: {op} · {time} — config backup taken before the batch; "Restore snapshot" undoes it. If the page was closed mid-run, this record may be incomplete',
        updateNone: 'No updatable plugin in selection (check updates first)',
        rowUpdate: 'Update',
        onlyUpdatable: 'Updatable only',
        // ---- Search ----
        searchPlaceholder: 'Search by name / description / version',
        searchLabel: 'Search plugins',
        searchClear: 'Clear search',
        searchCount: '{n} / {total} matched',
        searchNoMatch: 'No plugin matches "{q}"',
        // ---- 分组独立检查 ----
        groupCheckBtn: 'Check group',
        groupChecking: 'Checking…',
        groupCheckDone: '{u} updatable · {l} latest',
        groupCheckFailed: 'Group check failed',
        groupCheckSkipped: 'No check needed',
        cachedHint: 'Showing the last result ({time}), refreshing…',
        loadTimeout: 'Load timed out ({sec}s), showing the last result',
        checkTimeout: 'Check timed out; check the network or the GitHub proxy setting',
        // ---- 打开图标（包名后的来源入口） ----
        openSource: 'Open plugin home page',
        copySpec: 'Copy installable name',
        specCopied: 'Installable name copied',
        copyFail: 'Copy failed',
        // ---- 显示位置 ----
        showInSettings: 'Also show "Plugin Ops" in Settings',
        showInSettingsHint: 'When off, the panel only appears as a tab under Plugins; the change applies after re-entering the page.',
        showInSettingsSaved: 'Display location updated; applies after re-entering the page',
        // ---- 分组折叠 ----
        groupCollapse: 'Collapse group',
        groupExpand: 'Expand group',
        // ---- 导出 ----
        batchExport: 'Export selected',
        exportDialogTitle: 'Export selected plugins',
        exportWithConfig: 'Also export the matching plugin configuration',
        exportWithConfigHint: 'Configuration covers each plugin\'s parameters in cordis.patch.yml plus its standalone config files; credential files are never included.',
        exportConfigHeader: 'Configuration included in the package',
        exportConfigEmpty: 'No exportable configuration found',
        exportConfigPatch: 'Profile config fragment',
        exportConfigHome: 'Standalone config file',
        exportConfigDeclared: 'Plugin-declared data directory',
        exportConfigSuspicious: 'Looks like a credential file; it will not be included',
        exportConfigMaybe: 'Possibly related (please confirm ownership)',
        exportOk: 'Export',
        exportRunning: 'Exporting…',
        exportDone: 'Exported {name} ({size})',
        exportFailed: 'Export failed',
        exportDownloadFailed: 'Failed to download the export package',
        exportNoPlugin: 'No plugin selected',
        exportPlanFailed: 'Failed to prepare the export',
        exportWarnings: 'Export warning: {note}',
        exportInstallCmd: 'Install command',
        exportInstallCmdCopied: 'Install command copied',
        // ---- 导入 ----
        batchImport: 'Import package',
        importPick: 'Choose an export package',
        importPickFailed: 'Failed to read the file',
        importUploading: 'Uploading…',
        importUploadFailed: 'Failed to upload the package',
        importPlanFailed: 'Failed to parse the package',
        importAnalyzeTitle: 'Import pre-check',
        importSourceDsh: 'Source DSH {src} · local DSH {local}',
        importCompatOk: 'Compatible',
        importCompatBad: 'Incompatible',
        importCompatExempt: 'Exempted',
        importCompatUnknown: 'Cannot determine',
        importIntegrityBad: 'Integrity check failed',
        importVersionDiff: 'Package records {pkg}, tarball carries {tar}',
        importConflictPlugin: 'Already installed locally',
        importConflictPatch: 'Local config fragment exists',
        importConflictFile: 'Local file of the same name exists',
        importStrategyKeep: 'Keep local',
        importStrategyReplace: 'Use the package',
        importStrategySkip: 'Skip',
        importPluginStrategy: 'Plugin handling',
        importConfigStrategy: 'Configuration handling',
        importExecTitle: 'Apply import',
        importRunning: 'Importing… {done}/{total}',
        importOk: 'Import',
        importDone: 'Import done: ok {ok} · skipped {skip} · failed {fail}',
        importFailed: 'Import failed',
        importNeedRestart: '{n} change(s) take effect after restart',
        importLocalPreview: 'Current local value',
        importPackageValue: 'Value in the package',
        importOnlyConfig: 'Import configuration only (do not install plugins)',
        importNoConfig: 'The package carries no configuration',
      },
    };

    const t = (key, params) => {
      const table = TEXT[localeId()] ?? TEXT.en;
      let s = table[key] ?? TEXT.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
      }
      return s;
    };

    // ---------- 样式（主题 token，幂等注入一次） ----------

    const CSS_ID = 'dsh-plugin-keeper-css';
    const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
    const CSS = `
.dpk-root{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;display:flex;flex-direction:column;gap:12px;min-width:0;}
.dpk-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;row-gap:6px;}
.dpk-tbgroup{display:flex;align-items:center;gap:8px;white-space:nowrap;}
.dpk-summary{color:var(--dsw-alias-label-secondary);font-size:12px;min-width:0;}
.dpk-spacer{flex:1;}
.dpk-btn{border:1px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-md,8px);padding:2px 10px;font:inherit;font-size:12px;line-height:20px;cursor:pointer;transition:background .12s,border-color .12s,color .12s;}
.dpk-btn:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-btn:disabled{opacity:.38;cursor:default;}
.dpk-btn:disabled:hover{background:0 0;}
.dpk-btn.is-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}
.dpk-btn.is-primary:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-btn.is-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}
.dpk-btn.is-danger:hover{background:var(--dsw-alias-interactive-bg-hover);}
/* 确认浮层视口居中的前提：宿主 settings.section/plugins.tab 祖先链上无 transform/filter/
   contain 等会改写 fixed 包含块的属性（插件侧已排查干净）。若实测命中（浮层漂移/被裁），
   回退方案：absolute 居中于 dpk-root 顶部。 */
.dpk-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,10px);padding:14px 16px;width:360px;max-width:calc(100vw - 48px);display:flex;flex-direction:column;gap:10px;box-shadow:0 8px 32px rgba(0,0,0,.25);}
.dpk-mtitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}
.dpk-mlist{max-height:200px;overflow:auto;font-size:11px;color:var(--dsw-alias-label-secondary);line-height:22px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:6px 10px;background:var(--dsw-alias-bg-layer-2);border-radius:var(--dsw-radius-md,8px);}
.dpk-mfoot{display:flex;justify-content:flex-end;gap:8px;}
.dpk-btn.is-mini{padding:0 8px;font-size:11px;line-height:18px;flex:none;}
.dpk-lastcheck{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
.dpk-check{font-size:10px;line-height:16px;padding:0 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:0 0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;max-width:200px;overflow:hidden;text-overflow:ellipsis;}
.dpk-check.is-latest{color:var(--dsw-alias-label-tertiary);}
.dpk-check.is-update{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);}
.dpk-check.is-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary);}
.dpk-check.is-err{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);}
.dpk-setbody{display:flex;flex-direction:column;gap:8px;padding-top:8px;}
/* 高级配置按功能分区：只加分隔线与间距，标题复用 dpk-gtitle，不引入新颜色/圆角 */
.dpk-setsec{display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1);}
.dpk-setsec:first-child{border-top:none;padding-top:0;}
.dpk-instprog{display:flex;flex-direction:column;gap:6px;}
.dpk-setrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.dpk-setlabel{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.dpk-input{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-md,8px);padding:3px 10px;font:inherit;font-size:12px;line-height:20px;min-width:280px;}
.dpk-input:focus{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:0;}
.dpk-input::placeholder{color:var(--dsw-alias-label-caption);}
.dpk-hint{font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:18px;}
.dpk-savedok{font-size:11px;color:var(--dsw-alias-state-success-primary);}
.dpk-savederr{font-size:11px;color:var(--dsw-alias-state-error-primary);}
.dpk-err{color:var(--dsw-alias-state-error-primary);font-size:12px;}
.dpk-banner{font-size:11px;color:var(--dsw-alias-state-warn-primary);line-height:18px;overflow-wrap:anywhere;}
.dpk-banner.is-ok{color:var(--dsw-alias-state-success-primary);}
.dpk-group{display:flex;flex-direction:column;gap:4px;min-width:0;}
.dpk-ghead{display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;padding:2px 0;}
.dk-ghead:hover .dpk-gtitle{color:var(--dsw-alias-brand-primary);}
/* 收纳三角：内联 SVG（字符 ▸/▾ 在 9px 下几乎不可见）。
   12×12 视窗 + 16×16 命中区，颜色提到 label-secondary（caption 太弱）。 */
.dpk-garrow{width:16px;height:16px;flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--dsw-radius-sm,4px);color:var(--dsw-alias-label-secondary);transition:color .12s,background .12s;}
.dpk-ghead:hover .dpk-garrow{color:var(--dsw-alias-brand-primary);}
.dpk-garrow:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-garrow svg{display:block;width:12px;height:12px;fill:currentColor;}
.dpk-garrow:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dpk-gtitle{font-size:12px;font-weight:500;color:var(--dsw-alias-label-primary);transition:color .12s;}
.dpk-gcount{font-size:11px;color:var(--dsw-alias-label-caption);}
.dpk-rows{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);overflow:hidden;}
.dpk-row{display:block;padding:6px 12px;min-width:0;}
.dpk-rowmain{display:flex;align-items:center;gap:10px;min-width:0;height:22px;}
.dpk-rowdesc{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:24px;margin-top:2px;}
.dpk-onlyup{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;}
.dpk-onlyup input{accent-color:var(--dsw-alias-brand-primary);margin:0;width:13px;height:13px;}
/* 搜索框 + 只看可更新：同一组筛选控件 */
.dpk-filters{display:flex;align-items:center;gap:10px;flex-wrap:wrap;row-gap:6px;min-width:0;}
.dpk-search{position:relative;display:inline-flex;align-items:center;min-width:0;}
.dpk-searchicon{position:absolute;left:7px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-caption);pointer-events:none;}
.dpk-searchicon svg{display:block;width:12px;height:12px;}
.dpk-searchinput{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-md,8px);padding:2px 24px 2px 23px;font:inherit;font-size:12px;line-height:20px;width:190px;max-width:100%;}
.dpk-searchinput:focus{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:0;}
.dpk-searchinput::placeholder{color:var(--dsw-alias-label-caption);}
.dpk-searchclear{position:absolute;right:3px;width:17px;height:17px;border:none;border-radius:var(--dsw-radius-sm,4px);padding:0;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:13px;line-height:17px;display:inline-flex;align-items:center;justify-content:center;}
.dpk-searchclear:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);}
.dpk-searchclear:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dpk-searchcount{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
/* 命中文本高亮：黄色底（不用主题色 —— 搜索命中一律黄底），文字颜色保持原样，
   这样明暗主题下都读得清（黄字在白底上会糊）。 */
.dpk-hit{background:rgba(255,213,79,.42);color:inherit;border-radius:3px;padding:0 1px;font-weight:600;}
.dpk-row + .dpk-row{border-top:1px solid var(--dsw-alias-border-l1);}
.dpk-row:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-row.is-clickable{cursor:pointer;}
.dpk-row.is-official{opacity:.72;}
.dpk-row.is-selected{background:var(--dsw-alias-bg-layer-2);}
.dpk-cb{accent-color:var(--dsw-alias-brand-primary);margin:0;flex:none;width:14px;height:14px;cursor:pointer;}
.dpk-cb:disabled{cursor:default;opacity:.35;}
.dpk-dot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-label-caption);flex:none;}
.dpk-dot.on{background:var(--dsw-alias-state-success-primary);}
.dpk-name{font-family:${MONO};font-size:12.5px;white-space:nowrap;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;}
.dpk-ver{font-family:${MONO};font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;max-width:16ch;overflow:hidden;text-overflow:ellipsis;}
.dpk-badge{font-size:10px;line-height:16px;padding:0 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:0 0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;}
.dpk-open{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex:none;border:none;border-radius:var(--dsw-radius-sm,4px);padding:0;background:0 0;color:var(--dsw-alias-label-caption);cursor:pointer;text-decoration:none;transition:color .12s,background .12s;}
.dpk-open:hover{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover);}
.dpk-open.is-copied{color:var(--dsw-alias-state-success-primary);}
.dpk-open.is-failed{color:var(--dsw-alias-state-error-primary);}
.dpk-open:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dpk-rowops{display:flex;align-items:center;gap:10px;margin-left:auto;flex:none;}
.dpk-state{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;}
.dpk-op{font-size:10px;line-height:16px;padding:0 7px;border-radius:999px;white-space:nowrap;flex:none;max-width:260px;overflow:hidden;text-overflow:ellipsis;}
.dpk-rowops .dpk-op{flex:0 1 auto;min-width:2.5em;max-width:200px;}
.dpk-op.is-ok{color:var(--dsw-alias-state-success-primary);}
.dpk-op.is-restart{color:var(--dsw-alias-state-warn-primary);}
.dpk-op.is-failed{color:var(--dsw-alias-state-error-primary);}
.dpk-op.is-skipped{color:var(--dsw-alias-label-tertiary);}
.dpk-batchbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.dpk-selhint{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;margin-right:2px;}
.dpk-ledger{display:flex;flex-direction:column;gap:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);padding:8px 12px;}
.dpk-ledrow{display:flex;align-items:center;gap:8px;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);}
.dpk-ledrow .dpk-name{font-size:11px;}
.dpk-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;}
/* 主题化悬浮提示浮层（body 直挂单例，替代不随主题的原生 title） */
.dpk-tip{position:fixed;z-index:10000;max-width:400px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-size:11px;line-height:18px;padding:3px 9px;border-radius:var(--dsw-radius-md,8px);box-shadow:0 4px 16px rgba(0,0,0,.2);pointer-events:none;display:none;white-space:pre-wrap;overflow-wrap:anywhere;}
/* 显示位置开关（与「只看可更新」同一形态） */
.dpk-switch{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;}
.dpk-switch input{accent-color:var(--dsw-alias-brand-primary);margin:0;width:13px;height:13px;}
/* 导出弹框：比确认框宽（要列清单） */
.dpk-modal.is-wide{width:520px;}
/* 设置项较多：限制高度并让内容滚动，其余外观完全沿用 dpk-modal */
.dpk-modal.is-settings{max-height:min(80vh,720px);overflow:auto;}
.dpk-cfglist{display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto;}
.dpk-cfgrow{display:flex;align-items:flex-start;gap:8px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2);}
.dpk-cfgrow.is-suspicious{border-color:var(--dsw-alias-state-warn-primary);}
.dpk-cfgnames{min-width:0;flex:1;}
.dpk-cfgrel{font-family:${MONO};font-size:11px;line-height:16px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;}
.dpk-cfgtag{font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);}
.dpk-cfgtag.is-warn{color:var(--dsw-alias-state-warn-primary);}
.dpk-cfgtag.is-maybe{color:var(--dsw-alias-state-warn-primary);}
.dpk-cb.is-warn{accent-color:var(--dsw-alias-state-warn-primary);}
.dpk-cmdrow{display:flex;align-items:center;gap:8px;font-family:${MONO};font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:var(--dsw-radius-md,8px);padding:4px 8px;overflow-wrap:anywhere;}
/* 冲突策略下拉（导入弹框） */
.dpk-select{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-md,8px);padding:2px 6px;font:inherit;font-size:11px;line-height:18px;flex:none;max-width:150px;}
.dpk-select:focus{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:0;}
.dpk-select:disabled{opacity:.4;}
/* 导入弹框里的兼容性徽标要能跟文字并排 */
.dpk-cfgtag .dpk-op{display:inline-block;margin:0 4px 0 0;vertical-align:middle;}
`;
    let cssTag = null;
    function injectCss() {
      if (cssTag) return;
      cssTag = document.createElement('style');
      cssTag.id = CSS_ID;
      cssTag.textContent = CSS;
      document.head.appendChild(cssTag);
    }

    // ---------- 主题化悬浮提示（data-tip 委托，替代不随主题的原生 title） ----------

    let tipEl = null;
    let tipUsers = 0;
    let tipAnchor = null;

    function hideTip() {
      tipAnchor = null;
      if (tipEl) tipEl.style.display = 'none';
    }

    function showTip(text, anchor) {
      if (!tipEl || !text) return;
      tipAnchor = anchor;
      tipEl.textContent = text;
      tipEl.style.left = '0px';
      tipEl.style.top = '0px';
      tipEl.style.maxWidth = `${Math.min(400, window.innerWidth - 16)}px`;
      tipEl.style.display = 'block';
      const r = anchor.getBoundingClientRect();
      const tw = tipEl.offsetWidth;
      const th = tipEl.offsetHeight;
      let x = r.left + r.width / 2 - tw / 2;
      x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
      let y = r.top - th - 6;
      if (y < 8) y = Math.min(r.bottom + 6, window.innerHeight - th - 8);
      y = Math.max(8, y);
      tipEl.style.left = `${x}px`;
      tipEl.style.top = `${y}px`;
    }

    // 就地刷新当前悬浮内容（元素原地更新 data-tip 后指针未离开、不会再触发 mouseover 的场景）
    function updateTipIfActive(el, text) {
      if (tipAnchor === el && tipEl && tipEl.style.display !== 'none') showTip(text, el);
    }

    function onTipOver(e) {
      const t = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
      if (!t) { hideTip(); return; }
      const v = t.getAttribute('data-tip');
      if (v) showTip(v, t);
      else hideTip(); // 空 data-tip 统一为隐藏，避免上一个元素的 tip 滞留
    }

    function onTipOut(e) {
      // 移入仍带 data-tip 的元素（含嵌套切换）不隐藏，交给紧随的 mouseover 更新，避免闪烁
      const to = e.relatedTarget instanceof Element ? e.relatedTarget.closest('[data-tip]') : null;
      if (to) return;
      hideTip();
    }

    function onTipFocus(e) {
      const t = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
      if (!t) return;
      const v = t.getAttribute('data-tip');
      if (v) showTip(v, t);
    }

    // 引用计数：首个挂载点创建单例浮层与 document 委托，最后一个卸载点清理
    function acquireTooltip() {
      tipUsers += 1;
      if (tipEl) return;
      tipEl = document.createElement('div');
      tipEl.className = 'dpk-tip';
      document.body.appendChild(tipEl);
      document.addEventListener('mouseover', onTipOver, true);
      document.addEventListener('mouseout', onTipOut, true);
      document.addEventListener('focusin', onTipFocus, true);
      document.addEventListener('focusout', hideTip, true);
      window.addEventListener('scroll', hideTip, true);
      window.addEventListener('blur', hideTip);
    }

    function releaseTooltip() {
      tipUsers = Math.max(0, tipUsers - 1);
      if (tipUsers > 0 || !tipEl) return;
      document.removeEventListener('mouseover', onTipOver, true);
      document.removeEventListener('mouseout', onTipOut, true);
      document.removeEventListener('focusin', onTipFocus, true);
      document.removeEventListener('focusout', hideTip, true);
      window.removeEventListener('scroll', hideTip, true);
      window.removeEventListener('blur', hideTip);
      tipEl.remove();
      tipEl = null;
      tipAnchor = null;
    }

    // ---------- 首屏缓存 / 超时 / 打点 ----------

    // 盘点结果缓存到浏览器本地：开页签第一帧直接渲染上次结果，不等 RPC 往返
    // （宿主盘点本身只有毫秒级，慢的是往返与排队）。
    const CACHE_KEY = 'dsh-plugin-keeper:snapshot:v1';
    const LOAD_TIMEOUT_MS = 5000;
    const CHECK_TIMEOUT_MS = 30000;
    // 搜索防抖：输入停顿 200ms 后自动筛选（本地过滤是纯内存，延迟只是手感）
    const SEARCH_DEBOUNCE_MS = 200;

    function loadCachedSnapshot() {
      try {
        const raw = window.localStorage?.getItem(CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.plugins) || !data.plugins.length) return null;
        return { ...data, cachedAt: data.generatedAt ?? null, fromCache: true };
      } catch {
        return null; // 缓存损坏/不可用：退回「无缓存」路径
      }
    }

    function saveCachedSnapshot(data) {
      try {
        const payload = {
          ok: true,
          profileName: data.profileName ?? null,
          pluginCount: data.pluginCount ?? data.plugins?.length ?? 0,
          startedBundles: data.startedBundles ?? [],
          plugins: data.plugins ?? [],
          lastCheckAt: data.lastCheckAt ?? null,
          lastBatch: data.lastBatch ?? null,
          settings: data.settings ?? {},
          generatedAt: data.generatedAt ?? new Date().toISOString(),
        };
        window.localStorage?.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch {
        // 配额满 / 隐私模式：缓存失败不影响主流程
      }
    }

    // 超时包装：RPC 迟迟不返回时不转圈，转成可见的降级提示
    function withTimeout(promise, ms, label) {
      let timer = null;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms);
      });
      return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
    }

    // 打点：客户端分段耗时（与宿主半 console.debug 对照定位慢在哪一段）
    function markPerf(stage, ms) {
      console.debug(`[dsh-plugin-keeper] ${stage} ${Math.round(ms)}ms`);
    }

    // ---------- RPC ----------

    let rpcFace = null; // remote.dsh-plugin-keeper face，由装配段注入
    let pmFace = null; // remote.pluginManager（官方）face，批量操作直接调用

    // ---------- 安装进度：订阅宿主真实事件流，不做假进度 ----------
    // installBundle 带 requestId 后，宿主会 emit：
    //   plugin-manager/install-state  { requestId, phase, attempt? }
    //   plugin-manager/install-log   { requestId, stream, text, ... }（pnpm 实时输出）
    let installProgress = { requestId: null, phase: 'starting', attempt: null, lines: [], status: 'idle' };
    const progressListeners = new Set();
    function notifyProgress() {
      const snapshot = { ...installProgress, lines: [...installProgress.lines] };
      for (const fn of progressListeners) {
        try { fn(snapshot); } catch { /* 单个订阅者失败不影响其它 */ }
      }
    }
    function updateProgress(patch) {
      installProgress = { ...installProgress, ...patch };
      notifyProgress();
    }
    function stageLabel(phase, attempt) {
      if (phase === 'applying') return t('stageApplying');
      if (phase === 'cancelling') return t('stageCancelling');
      if (phase === 'installing') {
        if (attempt?.total) return t('stageInstalling', {
          index: attempt.index ?? 1, total: attempt.total, registry: String(attempt.registry ?? '-'),
        });
        return t('stageInstallingSimple');
      }
      return t('stageStarting');
    }

    // ---------- 批量/横幅模块级状态（切页签、组件重挂载不丢失） ----------
    // settings.section 与 plugins.tab 两个挂载点共享同一份执行状态：批量执行循环
    // 持有 store 引用，组件卸载后仍继续推进，重新进入时进度/台账/需重启提醒无缝恢复。
    // 跨浏览器刷新的持久化由宿主 lastBatch（reportBatch 落盘）承担。
    const batchStore = {
      batch: null, // {op, running, done, total, results, snapshotId, counts, restored?}
      banner: null, // {text, ok}
      listeners: new Set(),
    };
    function notifyStore() {
      for (const fn of [...batchStore.listeners]) {
        try { fn(); } catch { /* 单个订阅者异常不影响其余 */ }
      }
    }
    function storeBatch(next) {
      batchStore.batch = typeof next === 'function' ? next(batchStore.batch) : next;
      notifyStore();
    }
    function storeBanner(next) {
      batchStore.banner = next;
      notifyStore();
    }

    // typert face 的返回值可能是 {ok,value} 信封，也可能是裸值（取决于 result codec）。
    // 统一拆一次：成功取 value，失败/异常取 null。
    function unwrapEnvelope(r) {
      if (r && typeof r === 'object' && 'ok' in r && 'value' in r) return r.ok ? r.value : null;
      return r ?? null;
    }

    // 保存设置（当前仅 GitHub API 代理）。返回 {ok, proxyUrl} 或 {ok:false, error}
    async function callSaveSettings(payload) {
      try {
        const v = unwrapEnvelope(await rpcFace?.saveSettings?.(payload));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }

    // 批量前快照 / 恢复（宿主半文件操作）
    async function callPrepareBatch(op) {
      try {
        const v = unwrapEnvelope(await rpcFace?.prepareBatch?.({ op }));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }
    async function callRestoreBatch(id) {
      try {
        const v = unwrapEnvelope(await rpcFace?.restoreBatch?.({ id }));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }

    // 批量结束上报结果台账（宿主落盘 lastBatch，供切页/重开后恢复展示）
    async function callReportBatch(payload) {
      try {
        return unwrapEnvelope(await rpcFace?.reportBatch?.(payload)) ?? { ok: false };
      } catch {
        return { ok: false };
      }
    }

    // 导出预演：列出将带走的插件与配置（宿主半读盘 + 打包可行性预判）
    async function callPlanExport(names) {
      try {
        const v = unwrapEnvelope(await rpcFace?.planExport?.({ names }));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }

    // 执行导出（宿主半打包 + 写盘）
    async function callExportPlugins(payload) {
      try {
        const v = unwrapEnvelope(await rpcFace?.exportPlugins?.(payload));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }

    /** 导出包下载路由前缀（与宿主半 EXPORT_ROUTE_PREFIX 对齐）。 */
    const EXPORT_ROUTE_PREFIX = '/plugin-keeper/api/exports';

    /** 导入上传路由（与宿主半 IMPORT_UPLOAD_PATH 对齐）。 */
    const IMPORT_UPLOAD_PATH = '/plugin-keeper/api/imports/upload';

    /**
     * 下载导出包并触发浏览器保存。
     *
     * 为什么走 HTTP 而不是 RPC：导出包可达几十 MB，base64 塞进 JSON 信封不现实；
     * 宿主 webserver 没有静态目录挂载，所以宿主半注册了一条 loopback 路由。
     */
    async function downloadExport(filename) {
      const res = await fetch(`${EXPORT_ROUTE_PREFIX}/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        // 立刻 revoke 会让部分浏览器的下载中断，延后释放
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    }

    /**
     * 上传导入包（原始 zip 字节）到宿主半暂存，返回批次 id。
     * 与下载路由对称：走 loopback HTTP（体积大，不能走 RPC 信封）。
     */
    async function uploadImportPackage(file) {
      const res = await fetch(IMPORT_UPLOAD_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/zip' },
        body: file,
      });
      const text = await res.text();
      let body = null;
      try { body = JSON.parse(text); } catch { /* 非 JSON 响应 */ }
      if (!res.ok || body?.ok !== true) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return body;
    }

    // 导入预演（宿主半解包 + 兼容性预检 + 冲突检测）
    async function callPlanImport(id) {
      try {
        const v = unwrapEnvelope(await rpcFace?.planImport?.({ id }));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }

    // 执行导入（按策略装插件 + 写配置）
    async function callExecuteImport(payload) {
      try {
        const v = unwrapEnvelope(await rpcFace?.executeImport?.(payload));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }

    // 官方 pluginManager face 调用：返回 ChangeResult；不可用/异常抛错。
    async function callPm(method, ...args) {
      const fn = pmFace?.[method];
      if (typeof fn !== 'function') throw new Error(t('opNoFace'));
      const r = await fn.apply(pmFace, args);
      return unwrapEnvelope(r) ?? r;
    }

    // ChangeResult → 台账条目 {status: ok|restart|failed|skipped, note?}
    function mapChange(r) {
      if (!r || typeof r !== 'object') return { status: 'failed', note: 'no result' };
      switch (r.application) {
        case 'applied': return { status: 'ok' };
        case 'restart-required': return { status: 'restart', note: r.restartReason ?? '' };
        case 'overridden': return { status: 'ok', note: 'overridden' };
        case 'cancelled': return { status: 'skipped' };
        case 'failed':
          return { status: 'failed', note: r.error?.code ?? r.error?.diagnostic ?? r.error?.message ?? '' };
        default: return { status: 'failed', note: r.error?.message ?? 'unknown application' };
      }
    }

    // 检查结果归一化：更新后 check 可能滞后（latest===当前版本），此时按最新渲染
    function normCheck(entry) {
      const c = entry?.check;
      if (!c) return null;
      if (c.status === 'update' && c.latest && c.latest === entry.version) return { ...c, status: 'latest' };
      return c;
    }

    // 连接类检查错误识别（覆盖 ECONNREFUSED/超时/DNS/abort 等形态；服务端 note 已带 e.code 前缀）
    const CONN_ERR_RE = /econnrefused|etimedout|enotfound|getaddrinfo|eai_again|timed?\s*out|timeout|aborted|connect /i;

    // 检查徽标的悬浮内容：业务说明 + 检查时间（陈旧结果一眼可辨）。
    // lastCheckAt 由组件渲染时写入模块级缓存（checkBadgeOf 在组件外无法拿 snap）。
    let lastCheckAtCache = null;
    function checkTip(first) {
      const parts = [];
      if (first) parts.push(first);
      if (lastCheckAtCache) parts.push(t('checkedAt', { time: new Date(lastCheckAtCache).toLocaleString() }));
      return parts.length ? { 'data-tip': parts.join('\n') } : {};
    }

    // 行内检查徽标：entry.check = {status, latest, note}
    function checkBadgeOf(entry) {
      const c = normCheck(entry);
      if (!c) return null;
      switch (c.status) {
        case 'latest':
          return h('span', { className: 'dpk-check is-latest', ...checkTip() }, t('chkLatest'));
        case 'update': {
          // 徽标只留目标版本号；版本缺失回退"版本未知"，data-tip 兜底说明语义
          const tip = c.note || (c.latest ? `${t('rowUpdate')} → ${c.latest}` : undefined);
          return h('span', { className: 'dpk-check is-update', ...checkTip(tip) },
            c.latest ?? t('chkUnknownVer'));
        }
        case 'incompatible': {
          // 宿主 note 已是成品文案（"需 dsh ^x"），插值前剥掉前缀避免重复
          const range = String(c.note ?? '').replace(/^\s*(?:需\s*dsh|needs\s*dsh)\s*/i, '');
          return h('span', { className: 'dpk-check is-warn', ...checkTip(c.note) },
            range ? t('chkNeedDsh', { range }) : t('chkIncompatible'));
        }
        case 'error':
          return h('span', { className: 'dpk-check is-err', ...checkTip(c.note) }, t('chkError'));
        case 'no-release':
          return h('span', { className: 'dpk-check', ...checkTip(c.note) }, t('chkNoRelease'));
        default:
          return h('span', { className: 'dpk-check', ...checkTip(c.note) }, t('chkUnknownVer'));
      }
    }

    // ---------- 渲染辅助 ----------

    // 分组键：官方 > GitHub（github:/http 链接）> 本地（file:/link:/workspace:）> npm > 其他
    function groupKeyOf(entry) {
      if (entry.official) return 'official';
      const k = entry.source?.kind;
      if (k === 'github') return 'github';
      if (k === 'local') return 'local';
      if (k === 'npm') return 'npm';
      return 'unknown';
    }
    const GROUP_ORDER = ['official', 'npm', 'github', 'local', 'unknown'];
    // 可检查更新的分组（官方随 dsh 分发、本地为源码目录，都无远端版本锚点）
    const CHECKABLE_GROUPS = ['npm', 'github'];
    const GROUP_TITLE_KEY = {
      official: 'groupOfficial',
      npm: 'groupNpm',
      github: 'groupGithub',
      local: 'groupLocal',
      unknown: 'groupUnknown',
    };

    // ---------- 搜索 ----------
    // 检索范围 = 行内可见信息（包名 / 简述 / 版本）+ 来源锚点（仓库 / spec），
    // 让「按仓库名搜」也能命中（包名与仓库名常不一致）。
    function searchHaystack(entry) {
      return [
        entry?.name ?? '',
        entry?.description ?? '',
        entry?.version ?? '',
        entry?.source?.repo ?? '',
        entry?.source?.spec ?? '',
      ].join(' ').toLowerCase();
    }

    /**
     * 把查询串切成检索词（空白分隔，大小写不敏感）。
     * 多词之间是「与」关系：每个词都要出现在候选文本里。
     */
    function searchTerms(query) {
      return String(query ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    }

    /** 候选是否命中全部检索词。 */
    function matchesSearch(entry, terms) {
      if (!terms.length) return true;
      const hay = searchHaystack(entry);
      return terms.every((term) => hay.includes(term));
    }

    /**
     * 把文本按检索词切成片段：[{text, hit}]。
     * 重叠命中会合并成一段（避免嵌套 <span>）；无命中则整段返回。
     */
    function highlightSegments(text, terms) {
      const s = String(text ?? '');
      if (!s || !terms || !terms.length) return [{ text: s, hit: false }];
      const lower = s.toLowerCase();
      const marks = [];
      for (const term of terms) {
        if (!term) continue;
        let from = 0;
        for (;;) {
          const idx = lower.indexOf(term, from);
          if (idx < 0) break;
          marks.push([idx, idx + term.length]);
          from = idx + term.length; // 同一检索词不重叠匹配
        }
      }
      if (!marks.length) return [{ text: s, hit: false }];
      marks.sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const m of marks) {
        const last = merged[merged.length - 1];
        if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
        else merged.push([m[0], m[1]]);
      }
      const out = [];
      let pos = 0;
      for (const [a, b] of merged) {
        if (a > pos) out.push({ text: s.slice(pos, a), hit: false });
        out.push({ text: s.slice(a, b), hit: true });
        pos = b;
      }
      if (pos < s.length) out.push({ text: s.slice(pos), hit: false });
      return out;
    }

    /** 渲染高亮文本：命中片段套 .dpk-hit（主题色），其余原样。 */
    function highlightText(text, terms) {
      return highlightSegments(text, terms).map((seg, i) => (seg.hit
        ? h('span', { key: `h${i}`, className: 'dpk-hit' }, seg.text)
        : seg.text));
    }

    // host 半区 parseSource 已把 source.repo 统一成 owner/repo
    function repoKeyOf(entry) {
      return String(entry?.source?.repo ?? '');
    }

    // 批量更新目标 spec：npm → name@latest；github → github:repo#tag（已是最新则无目标）
    function updateSpecOf(entry) {
      const c = normCheck(entry);
      if (!c || c.status !== 'update') return null;
      const kind = entry.source?.kind;
      if (kind === 'npm') return `${entry.name}@${c.latest}`;
      if (kind === 'github') {
        const repo = repoKeyOf(entry);
        return c.tag && /^[^/]+\/[^/]+$/.test(repo) ? `github:${repo}#${c.tag}` : null;
      }
      return null;
    }

    const OP_LABEL_KEY = { update: 'opUpdate', enable: 'opEnable', disable: 'opDisable', uninstall: 'opUninstall' };
    const CHECK_LABEL_KEY = { githubApi: 'checkGithubApi', npmRegistry: 'checkNpmRegistry', gitRemote: 'checkGitRemote' };

    // ---------- 打开图标（包名后的来源入口） ----------

    // npm/GitHub 来源的跳转地址；官方（随 dsh 分发、不在公共 registry）与本地/未知来源返回 null。
    function openUrlOf(entry) {
      if (entry?.official) return null;
      const kind = entry?.source?.kind;
      if (kind === 'npm' && entry.name) return `https://www.npmjs.com/package/${entry.name}`;
      if (kind === 'github') {
        const repo = repoKeyOf(entry);
        if (!repo) return null;
        // 非 github.com 的 http(s) 直链（parseSource 归入 GitHub 组）原样打开；
        // github.com 裸域名（无法归一出 owner/repo）视为不可定位
        if (/^https?:\/\//i.test(repo)) {
          // codeload tarball 直链（profile 里常见的 github 依赖）也要能打开仓库页
          const m = /^https?:\/\/(?:www\.)?(?:codeload\.)?github\.com\/([^/]+)\/([^/#?]+)/i.exec(repo);
          if (m) return `https://github.com/${m[1]}/${m[2].replace(/\.git$/i, '')}`;
          return /^https?:\/\/github\.com\/.+/i.test(repo) ? repo : null;
        }
        return /^[^/]+\/[^/]+$/.test(repo) ? `https://github.com/${repo}` : null;
      }
      return null;
    }

    // 名字后面的 copy 复制「可直接安装的名称」：
    // npm → name@version；github → github:owner/repo[#ref]；其余 → 原始 spec / 包名。
    function installSpecOf(entry) {
      const kind = entry?.source?.kind;
      if (kind === 'npm') return entry?.version ? `${entry.name}@${entry.version}` : entry?.name;
      if (kind === 'github') {
        const repo = repoKeyOf(entry);
        const ref = entry?.source?.ref ?? null;
        if (repo && /^[^/]+\/[^/]+$/.test(repo)) return `github:${repo}${ref ? `#${ref}` : ''}`;
        return entry?.source?.spec || entry?.name;
      }
      return entry?.source?.spec || entry?.name;
    }

    // 复制文本：clipboard API 优先（安全上下文），失败回退 execCommand。
    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        let ta = null;
        try {
          ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          return document.execCommand('copy');
        } catch {
          return false;
        } finally {
          ta?.remove();
        }
      }
    }

    const OPEN_ICON = h('svg', { viewBox: '0 0 16 16', width: 11, height: 11, 'aria-hidden': true },
      h('path', {
        d: 'M6.75 3.25H4A1.75 1.75 0 0 0 2.25 5v7A1.75 1.75 0 0 0 4 13.75h7A1.75 1.75 0 0 0 12.75 12V9.25',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
      }),
      h('path', {
        d: 'M9.5 2.25h4.25V6.5M13.4 2.6 8.2 7.8',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
    );

    // 搜索框放大镜（描边 SVG，跟随主题色）
    const SEARCH_ICON = h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true },
      h('circle', { cx: 6.9, cy: 6.9, r: 4.1, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
      h('path', {
        d: 'M10 10l3.1 3.1',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
      }),
    );

    const COPY_ICON = h('svg', { viewBox: '0 0 16 16', width: 11, height: 11, 'aria-hidden': true },
      h('rect', { x: 5.75, y: 5.75, width: 7.5, height: 7.5, rx: 1.5, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
      h('path', {
        d: 'M3.25 10.25h-.5a1.5 1.5 0 0 1-1.5-1.5v-5a1.5 1.5 0 0 1 1.5-1.5h5a1.5 1.5 0 0 1 1.5 1.5v.5',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
      }),
    );

    const CHECK_ICON = h('svg', { viewBox: '0 0 16 16', width: 11, height: 11, 'aria-hidden': true },
      h('path', {
        d: 'M2.75 8.5 6.25 12 13.25 4.25',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
    );

    // 分组收纳三角（内联 SVG；字符 ▸/▾ 在小字号 + caption 色下几乎不可见）。
    // 展开 = 朝下的小三角，收起 = 朝右的小三角。
    function CollapseArrow({ collapsed }) {
      const path = collapsed
        ? 'M5.25 3.5 9.5 8l-4.25 4.5z'
        : 'M3.5 5.25 8 9.5l4.5-4.25z';
      return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true },
        h('path', { d: path }),
      );
    }

    // 通用复制按钮：hover 显示将复制的内容，点击写入剪贴板，成败各有短暂反馈。
    // 只用于名字后面复制「可直接安装的名称」。
    function CopyIcon({ text, tip, ariaLabel, copiedText }) {
      // 'idle' | 'ok' | 'fail'：ok 短暂打勾变绿，fail 短暂变红并提示复制失败
      const [flash, setFlash] = React.useState('idle');
      const timerRef = React.useRef(null);
      const aliveRef = React.useRef(true);
      React.useEffect(() => () => {
        aliveRef.current = false; // 卸载后 copyText 才 resolve 的竞态：不再 setState/注册定时器
        clearTimeout(timerRef.current);
      }, []);
      const onCopy = async (e) => {
        e.stopPropagation();
        const btn = e.currentTarget; // React 事件对象异步后 currentTarget 不可靠，先捕获
        const ok = await copyText(text);
        if (!aliveRef.current) return;
        setFlash(ok ? 'ok' : 'fail');
        updateTipIfActive(btn, ok ? copiedText : t('copyFail'));
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (aliveRef.current) {
            setFlash('idle');
            updateTipIfActive(btn, tip);
          }
        }, 1400);
      };
      const cls = flash === 'ok' ? ' is-copied' : flash === 'fail' ? ' is-failed' : '';
      return h('button', {
        className: `dpk-open${cls}`,
        type: 'button',
        'data-tip': flash === 'ok' ? copiedText : flash === 'fail' ? t('copyFail') : tip,
        'aria-label': ariaLabel,
        onClick: onCopy,
      }, flash === 'ok' ? CHECK_ICON : COPY_ICON);
    }

    function Row({ entry, checked, disabled, onToggle, opStatus, onUpdate, busy, terms }) {
      const gk = groupKeyOf(entry);
      // GitHub 行不显示 repo 徽标：与包名重复且挤占行内更新按钮位置
      const badgeText = gk === 'official' ? t('badgeOfficial')
        : gk === 'local' ? t('badgeLocal') : null;
      const repoLabel = gk === 'github' ? repoKeyOf(entry) : '';
      const openUrl = openUrlOf(entry);
      // 启停台账兜底：仅在 listBundles 合并失效（enabled 未知）时，以本次批量结果为准；
      // 合并成功时 host 真值优先，外部启停/恢复快照不被旧台账压制。
      // update 落账（installBundle enabled:true）蕴含启用。opStatus 由调用方取同名最新一条。
      const opApplied = opStatus && (opStatus.status === 'ok' || opStatus.status === 'restart');
      const opEnabled = !opApplied ? undefined
        : opStatus.op === 'disable' ? false
        : (opStatus.op === 'enable' || opStatus.op === 'update') ? true
        : undefined;
      const enabled = opEnabled !== undefined && entry.enabled === undefined ? opEnabled : entry.enabled;
      const rowProps = {
        className: `dpk-row${entry.official ? ' is-official' : ''}${checked ? ' is-selected' : ''}`,
      };
      if (entry.official) rowProps['data-tip'] = t('officialReadonly');
      // 点行任意空白处即切换勾选（与 checkbox 同规则：official/批量中/不可更新的行除外）；
      // 行内按钮与图标各自 stopPropagation，不受行点击影响
      if (!disabled) {
        rowProps.className += ' is-clickable';
        rowProps.onClick = () => onToggle(entry.name);
      }
      const chip = opStatus
        ? h('span', {
          className: `dpk-op is-${opStatus.status}`,
          'data-tip': opStatus.note || undefined,
        }, t(`op${opStatus.status === 'ok' ? 'Applied' : opStatus.status === 'restart' ? 'Restart' : opStatus.status === 'failed' ? 'Failed' : 'Skipped'}`)
          + (opStatus.note && opStatus.status !== 'ok' ? ` · ${opStatus.note}` : ''))
        : null;
      const spec = updateSpecOf(entry);
      const installSpec = installSpecOf(entry);
      return h('div', rowProps,
        h('div', { className: 'dpk-rowmain' },
          h('input', {
            type: 'checkbox',
            className: 'dpk-cb',
            checked,
            disabled,
            onChange: () => onToggle(entry.name),
            onClick: (e) => e.stopPropagation(),
          }),
          h('span', { className: `dpk-dot${entry.started && enabled !== false ? ' on' : ''}` }),
          h('span', {
            className: 'dpk-name',
            // repo 不上行内（与包名重复且挤压按钮）；悬停同时给出全名与来源
            'data-tip': repoLabel ? `${entry.name} · ${repoLabel}` : entry.name,
          }, highlightText(entry.name, terms)),
          // 名字后面：复制可直接安装的名称（npm → name@version，github → github:owner/repo#ref）
          h(CopyIcon, {
            text: installSpec,
            tip: `${t('copySpec')}：${installSpec}`,
            ariaLabel: t('copySpec'),
            copiedText: t('specCopied'),
          }),
          // 来源入口图标：npm/GitHub 点击开详情页（每行只保留名字后那一个复制按钮）
          openUrl
            ? h('a', {
              className: 'dpk-open',
              href: openUrl,
              target: '_blank',
              rel: 'noreferrer',
              'data-tip': t('openSource'),
              'aria-label': t('openSource'),
              onClick: (e) => e.stopPropagation(),
            }, OPEN_ICON)
            : null,
          entry.version ? h('span', { className: 'dpk-ver', 'data-tip': `v${entry.version}` }, highlightText(`v${entry.version}`, terms)) : null,
          badgeText ? h('span', { className: 'dpk-badge' }, badgeText) : null,
          h('div', { className: 'dpk-rowops' },
            checkBadgeOf(entry),
            spec && onUpdate
              ? h('button', {
                className: 'dpk-btn is-mini',
                type: 'button',
                disabled: Boolean(busy),
                onClick: (e) => { e.stopPropagation(); onUpdate(entry); },
              }, t('rowUpdate'))
              : null,
            chip,
            h('span', { className: 'dpk-state' }, enabled === false ? t('stateDisabled') : entry.started ? t('stateOn') : t('stateOff')),
          ),
        ),
        entry.description ? h('div', { className: 'dpk-rowdesc', 'data-tip': entry.description }, highlightText(entry.description, terms)) : null,
      );
    }

    // ---------- 组件 ----------

    function PluginKeeperSection() {
      // 首屏缓存：挂载即用上次结果渲染（0 等待），随后 RPC 覆盖。
      // cacheRef 让 loading 初值知道「有没有缓存可用」。
      const cacheRef = React.useRef(null);
      const [snap, setSnap] = React.useState(() => {
        cacheRef.current = loadCachedSnapshot();
        return cacheRef.current;
      });
      const [err, setErr] = React.useState(null);
      const [loading, setLoading] = React.useState(() => cacheRef.current === null);
      // 当前是否有数据可展示（超时降级提示用；ref 避免闭包里拿到旧值）
      const snapRef = React.useRef(null);
      React.useEffect(() => { snapRef.current = snap; }, [snap]);
      // 分组检查状态：{ npm: {status, counts, error, connErr, firstErrorNote}, github: {...} }
      const [checkState, setCheckState] = React.useState({});
      const [saving, setSaving] = React.useState(false);
      const [saveFlash, setSaveFlash] = React.useState(null); // 'ok' | {err}
      const [testing, setTesting] = React.useState(false);
      const [proxyTest, setProxyTest] = React.useState(null);
      const [testElapsed, setTestElapsed] = React.useState(0);
      // 真实等待计时（不是模拟进度）；用递归 setTimeout，宿主沙箱只保证 setTimeout
      React.useEffect(() => {
        if (!testing) { setTestElapsed(0); return; }
        let cancelled = false;
        const started = Date.now();
        const tickElapsed = () => {
          if (cancelled) return;
          setTestElapsed(Math.floor((Date.now() - started) / 1000));
          setTimeout(tickElapsed, 1000);
        };
        tickElapsed();
        return () => { cancelled = true; };
      }, [testing]);
      // 显示位置开关（设置页是否也显示本插件）：默认关；改动在重新进入页面后生效
      const [showInSettings, setShowInSettings] = React.useState(false);
      const [locationFlash, setLocationFlash] = React.useState(null); // 'ok' | {err}
      const proxyRef = React.useRef(null);
      const proxyUserRef = React.useRef(null);
      const proxyPassRef = React.useRef(null);
      const [installing, setInstalling] = React.useState(false);
      // 安装结果就地显示在按钮下方，不再塞进模块级顶部横幅
      const [installFlash, setInstallFlash] = React.useState(null);
      const [progress, setProgress] = React.useState(installProgress);
      React.useEffect(() => {
        const listener = (snapshot) => setProgress(snapshot);
        progressListeners.add(listener);
        return () => { progressListeners.delete(listener); };
      }, []);
      const [settingsOpen, setSettingsOpen] = React.useState(false);
      // 台账清空后连跨会话残留提示一起隐藏，直到下一次批量重新置位
      const [ledgerDismissed, setLedgerDismissed] = React.useState(false);
      const installRef = React.useRef(null);
      // M2 批量状态
      const [selected, setSelected] = React.useState(() => new Set());
      const [confirmOp, setConfirmOp] = React.useState(null); // 待二次确认的批量操作
      // 导出：弹框状态（null = 未打开）+ 预演结果 + 已勾选配置项 + 运行中标记
      const [exportState, setExportState] = React.useState(null);
      const [exportPlan, setExportPlan] = React.useState(null);
      const [exportConfigRels, setExportConfigRels] = React.useState(() => new Set());
      const [exporting, setExporting] = React.useState(false);
      // 导入：批次 id + 预检结果 + 策略选择 + 运行中标记 + 隐藏的文件 input
      const [importState, setImportState] = React.useState(null); // 'uploading' | 'analyze' | 'running' | null
      const [importPlan, setImportPlan] = React.useState(null);
      const [importId, setImportId] = React.useState(null);
      const [importPluginStrategies, setImportPluginStrategies] = React.useState(() => new Map());
      const [importConfigStrategies, setImportConfigStrategies] = React.useState(() => new Map());
      const [importOnlyConfig, setImportOnlyConfig] = React.useState(false);
      const importFileRef = React.useRef(null);
      // 确认浮层无遮罩：Esc 关闭补偿（原先"点遮罩关闭"已随遮罩移除）
      React.useEffect(() => {
        if (!confirmOp) return;
        const onKey = (e) => { if (e.key === 'Escape') setConfirmOp(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [confirmOp]);
      React.useEffect(() => {
        if (!settingsOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') setSettingsOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [settingsOpen]);
      const [restoring, setRestoring] = React.useState(false);
      // 批量/横幅状态在模块级 batchStore（切页签存活）；订阅变更触发重渲染
      const [, bump] = React.useReducer((x) => x + 1, 0);
      const batch = batchStore.batch;
      const banner = batchStore.banner;
      React.useEffect(() => {
        const listener = () => bump();
        batchStore.listeners.add(listener);
        return () => { batchStore.listeners.delete(listener); };
      }, []);
      // 语言切换 = <html lang> 属性变化 → 强制重渲染（文案实时跟随，数据不重拉）
      const [, setLangTick] = React.useState(0);
      React.useEffect(() => {
        const obs = new MutationObserver(() => setLangTick((x) => x + 1));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
        return () => obs.disconnect();
      }, []);
      // 只看可更新（默认关）；分组折叠（会话内记忆）
      const [onlyUpdatable, setOnlyUpdatable] = React.useState(false);
      // 搜索：query = 输入框实时值；search = 防抖后真正生效的查询串
      const [query, setQuery] = React.useState('');
      const [search, setSearch] = React.useState('');
      // 输入后停顿 SEARCH_DEBOUNCE_MS 才筛（连打时不抖动）；清空则立即生效
      React.useEffect(() => {
        if (!query) { setSearch(''); return undefined; }
        const timer = setTimeout(() => setSearch(query), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
      }, [query]);
      const [collapsedGroups, setCollapsedGroups] = React.useState(() => new Set());
      const toggleGroupCollapse = React.useCallback((key) => {
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key); else next.add(key);
          return next;
        });
      }, []);

      const load = React.useCallback(async () => {
        const t0 = performance.now();
        setLoading(true);
        setErr(null);
        try {
          // 超时兜底：RPC 迟迟不返回时给出可见降级（保留缓存数据继续显示）
          const data = unwrapEnvelope(
            await withTimeout(rpcFace?.snapshot(), LOAD_TIMEOUT_MS, 'snapshot'),
          );
          markPerf('snapshot', performance.now() - t0);
          if (data && data.ok) {
            setSnap(data);
            saveCachedSnapshot(data);
            // 显示位置开关跟随快照（宿主半是唯一真值来源）
            if (data.settings && typeof data.settings.showInSettings === 'boolean') {
              setShowInSettings(data.settings.showInSettings);
            }
          } else {
            setErr(t('loadFailed'));
          }
        } catch (e) {
          markPerf('snapshot(failed)', performance.now() - t0);
          // 有数据时降级为「显示上次结果」的提示，不清空列表
          setErr(snapRef.current
            ? t('loadTimeout', { sec: Math.round(LOAD_TIMEOUT_MS / 1000) })
            : String(e?.message ?? e));
        } finally {
          setLoading(false);
        }
        // 官方 bundle 启用态并入（listBundles 失败不影响主数据）。
        // face 返回值可能是 {ok,value} 信封（与 callPm 同口径），先统一拆一次再验数组；
        // 不拆的话 Array.isArray 对信封恒 false → 合并静默失效，停用后行仍显示"运行中"。
        const t1 = performance.now();
        try {
          const bundles = unwrapEnvelope(await pmFace?.listBundles?.());
          markPerf('listBundles', performance.now() - t1);
          if (Array.isArray(bundles)) {
            const enMap = new Map(bundles.map((b) => [b.name, b.enabled !== false]));
            setSnap((s) => (s ? { ...s, plugins: (s.plugins ?? []).map((p) => ({ ...p, enabled: enMap.has(p.name) ? enMap.get(p.name) : true })) } : s));
          } else {
            // {ok:false} 信封 / pmFace 缺失（undefined）等静默失效形态也留痕，便于排查
            console.debug('[dsh-plugin-keeper] listBundles merge skipped:', bundles);
          }
        } catch (e) {
          console.debug('[dsh-plugin-keeper] listBundles merge failed:', e?.message ?? e);
        }
      }, []);

      // 语言切换只重渲染文案，不重拉数据（拉数据由刷新按钮/批量后触发）
      React.useEffect(() => { void load(); }, [load]);

      // 会话恢复：本会话尚无批量状态、而宿主 lastBatch 带结果台账 → 恢复台账展示
      // 与「需重启」提醒（跨页签由模块级 store 承担；跨刷新由这份落盘数据承担）。
      // store 已有状态（进行中/本会话已收尾）时以实时数据优先，不覆盖。
      React.useEffect(() => {
        if (batchStore.batch) return;
        const lb = snap?.lastBatch;
        if (!lb || !Array.isArray(lb.results) || !lb.results.length) return;
        const counts = { ok: 0, restart: 0, fail: 0, skip: 0 };
        for (const r of lb.results) {
          if (r.status === 'ok') counts.ok += 1;
          else if (r.status === 'restart') counts.restart += 1;
          else if (r.status === 'failed') counts.fail += 1;
          else counts.skip += 1;
        }
        storeBatch({
          op: lb.op ?? 'update',
          running: false,
          restored: true, // 标记为历史恢复，与本次会话实时执行的批量区分
          done: lb.results.length,
          total: lb.results.length,
          results: lb.results,
          snapshotId: lb.id ?? null,
          counts,
        });
        if (counts.restart > 0 && !(batchStore.banner && batchStore.banner.ok)) {
          // 不覆盖正在展示的"恢复成功"类正向横幅
          storeBanner({ text: t('restartBanner', { n: counts.restart }), ok: false });
        }
      }, [snap]);

      // 分组独立检查：npm / github 两组各自发起、互不阻塞（一组慢不影响另一组）。
      // 结果就地并入 entries —— 不再像旧实现那样检查完再跑一次全量盘点。
      const doCheckGroup = React.useCallback(async (kind) => {
        const t0 = performance.now();
        setCheckState((s) => ({ ...s, [kind]: { status: 'checking', counts: null, error: null } }));
        try {
          const r = unwrapEnvelope(
            await withTimeout(rpcFace?.checkGroup?.({ kind }), CHECK_TIMEOUT_MS, `checkGroup:${kind}`),
          );
          markPerf(`checkGroup:${kind}`, performance.now() - t0);
          if (!r || !r.ok) {
            setCheckState((s) => ({
              ...s,
              [kind]: { status: 'error', counts: null, error: r?.error ?? t('chkError') },
            }));
            return;
          }
          const results = r.results ?? {};
          // 首条失败原因与连接类判定，供顶部横幅明示（error 徽标悬浮也有详情）
          const errItems = Object.values(results).filter((v) => v?.status === 'error');
          const firstErrorNote = typeof errItems[0]?.note === 'string' ? errItems[0].note : '';
          const connErr = errItems.some((v) => CONN_ERR_RE.test(typeof v?.note === 'string' ? v.note : ''));
          setSnap((s) => {
            if (!s) return s;
            const next = {
              ...s,
              plugins: (s.plugins ?? []).map((p) => (results[p.name] ? { ...p, check: results[p.name] } : p)),
              lastCheckAt: r.at ?? s.lastCheckAt,
            };
            // 同步刷新本地缓存：下次开页签直接看到本组徽标
            saveCachedSnapshot(next);
            return next;
          });
          setCheckState((s) => ({
            ...s,
            [kind]: { status: 'done', counts: r.counts ?? null, error: null, connErr, firstErrorNote },
          }));
        } catch (e) {
          markPerf(`checkGroup:${kind}(failed)`, performance.now() - t0);
          setCheckState((s) => ({
            ...s,
            [kind]: { status: 'error', counts: null, error: t('checkTimeout') },
          }));
        }
      }, []);

      // 一键检查更新：可检查的两组并行发起，各自独立计时与出结果
      const doCheck = React.useCallback(async () => {
        setErr(null);
        await Promise.all(CHECKABLE_GROUPS.map((kind) => doCheckGroup(kind)));
      }, [doCheckGroup]);

      // 检查汇总：由各组 checkState 聚合（不再单独维护一份全局状态）
      const checkInfo = React.useMemo(() => {
        const kinds = Object.keys(checkState);
        if (!kinds.length) return null;
        let update = 0;
        let latest = 0;
        let error = 0;
        let checking = false;
        let firstErrorNote = '';
        let connErr = false;
        for (const kind of kinds) {
          const st = checkState[kind];
          if (!st) continue;
          if (st.status === 'checking') checking = true;
          if (st.status === 'error') {
            error += 1;
            if (!firstErrorNote) firstErrorNote = st.error || '';
          }
          if (st.counts) {
            update += st.counts.update ?? 0;
            latest += st.counts.latest ?? 0;
            error += st.counts.error ?? 0;
          }
          if (st.connErr) connErr = true;
          if (!firstErrorNote && st.firstErrorNote) firstErrorNote = st.firstErrorNote;
        }
        return { update, latest, error, checking, firstErrorNote, connErr };
      }, [checkState]);

      // 保存 GitHub API 代理设置
      const doSave = React.useCallback(async () => {
        setSaving(true);
        setSaveFlash(null);
        const r = await callSaveSettings({
          proxyUrl: proxyRef.current?.value ?? '',
          proxyUser: proxyUserRef.current?.value ?? '',
          proxyPass: proxyPassRef.current?.value ?? '',
        });
        if (r?.ok) {
          setSaveFlash('ok');
          if (proxyRef.current && typeof r.proxyUrl === 'string') proxyRef.current.value = r.proxyUrl;
          if (proxyUserRef.current && typeof r.proxyUser === 'string') proxyUserRef.current.value = r.proxyUser;
          if (proxyPassRef.current) proxyPassRef.current.value = ''; // 密码不回显
          setSnap((s) => (s ? {
            ...s,
            settings: {
              ...(s.settings ?? {}),
              proxyUrl: r.proxyUrl ?? '',
              proxyUser: r.proxyUser ?? '',
              hasProxyPass: r.hasProxyPass === true,
              showInSettings: r.showInSettings === true,
            },
          } : s));
        } else {
          setSaveFlash({ err: r?.error ?? t('saveFailed') });
        }
        setSaving(false);
      }, []);

      // 测试代理连通性：用输入框的即时值，不保存、不安装
      const doTestProxy = React.useCallback(async () => {
        if (typeof rpcFace?.testProxy !== 'function') {
          setProxyTest({ ok: false, error: t('testProxyNoFace') });
          return;
        }
        setTesting(true);
        setProxyTest(null);
        try {
          const r = unwrapEnvelope(await rpcFace.testProxy({
            proxyUrl: proxyRef.current?.value ?? '',
            proxyUser: proxyUserRef.current?.value ?? '',
            proxyPass: proxyPassRef.current?.value ?? '',
          }));
          setProxyTest(r ?? { ok: false, error: t('testProxyEmpty') });
        } catch (e) {
          setProxyTest({ ok: false, error: String(e?.message ?? e) });
        } finally {
          setTesting(false);
        }
      }, []);

      // 保存「显示位置」开关（设置页是否也显示本插件）。
      // 改动要重新进入页面才生效（槽位注册发生在挂载期），所以这里只落盘 + 提示。
      const doSaveShowInSettings = React.useCallback(async (value) => {
        setSaving(true);
        setLocationFlash(null);
        const r = await callSaveSettings({ showInSettings: value });
        if (r?.ok) {
          setShowInSettings(r.showInSettings === true);
          setLocationFlash('ok');
          setSnap((s) => (s ? { ...s, settings: { ...(s.settings ?? {}), showInSettings: r.showInSettings === true } } : s));
        } else {
          setLocationFlash({ err: r?.error ?? t('saveFailed') });
        }
        setSaving(false);
      }, []);

      // ---------- GitHub 直装 ----------
      // spec 归一化只有 host 半区 github-spec.js 一份实现，客户端只消费结果，
      // 避免带/不带 github: 前缀在两处正则里漂移。

      const doInstall = React.useCallback(async () => {
        const normalized = unwrapEnvelope(await rpcFace?.normalizeGithubSpec?.({ raw: installRef.current?.value ?? '' }));
        const spec = normalized?.ok ? normalized.spec : null;
        if (!spec) {
          const why = normalized?.error || '宿主半区未就绪，请重启 dsh web';
          setInstallFlash({ ok: false, text: `${t('installBad')}：${why}` });
          return;
        }
        // requestId 是宿主进度事件的关联键：没有它宿主不会 emit install-state / install-log
        const requestId = `dpk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        updateProgress({ requestId, phase: 'starting', attempt: null, lines: [], status: 'running' });
        setInstalling(true);
        setInstallFlash(null);
        try {
          const r = unwrapEnvelope(await pmFace?.installBundle?.(spec, { enabled: true, requestId }));
          const errText = r?.error?.diagnostic || r?.error?.code || (r?.status === 'refused' ? r?.reason : null);
          let ok = false;
          if (!r) {
            // RPC 没给结果（超时/断连）时宿主可能仍在装：不误报失败，进度面板继续显示事件流
            setInstallFlash({ ok: false, text: t('installNoResponse') });
          } else if (r.application === 'restart-required') {
            setInstallFlash({ ok: true, text: t('installRestart', { name: r.target ?? spec }) });
            ok = true;
          } else if (r.application === 'applied' || r.application === 'overridden') {
            setInstallFlash({ ok: true, text: t('installDone', { name: r.target ?? spec }) });
            ok = true;
          } else {
            setInstallFlash({ ok: false, text: `${t('installFailed')}${errText ? `：${errText}` : ''}` });
          }
          if (r) updateProgress({ status: ok ? 'done' : 'failed' });
          if (installRef.current) installRef.current.value = '';
          await load();
        } catch (e) {
          setInstallFlash({ ok: false, text: `${t('installFailed')}：${e?.message ?? e}` });
          updateProgress({ status: 'failed' });
        } finally {
          setInstalling(false);
        }
      }, [load]);

      // ---------- M2 选择与批量 ----------

      const plugins = Array.isArray(snap?.plugins) ? snap.plugins : [];
      const byName = React.useMemo(() => new Map(plugins.map((p) => [p.name, p])), [plugins]);
      // 搜索词（防抖后的 search → 切词）
      const terms = React.useMemo(() => searchTerms(search), [search]);
      const searching = terms.length > 0;
      // 可见行 = 搜索过滤 ∧ 「只看可更新」过滤（两个筛选控件叠加生效）
      const visiblePlugins = React.useMemo(() => {
        let list = plugins;
        if (onlyUpdatable) list = list.filter((p) => !p.official && updateSpecOf(p));
        if (terms.length) list = list.filter((p) => matchesSearch(p, terms));
        return list;
      }, [plugins, onlyUpdatable, terms]);

      const toggleOne = React.useCallback((name) => {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(name)) next.delete(name); else next.add(name);
          return next;
        });
      }, []);

      const toggleGroup = React.useCallback((list) => {
        const eligible = list.filter((p) => !p.official).map((p) => p.name);
        setSelected((prev) => {
          const allIn = eligible.every((n) => prev.has(n));
          const next = new Set(prev);
          for (const n of eligible) {
            if (allIn) next.delete(n); else next.add(n);
          }
          return next;
        });
      }, []);

      const selCount = selected.size;
      // 可启用 = 未启用（已停用或未运行）；可停用 = 非停用状态。计数以 host 原始
      // enabled 为准（不含行级台账兜底）；合并失效时 undefined 一律视为可停用。
      const enableCount = React.useMemo(() => {
        let n = 0;
        for (const name of selected) {
          const p = byName.get(name);
          if (p && !p.official && (p.enabled === false || !p.started)) n += 1;
        }
        return n;
      }, [selected, byName]);
      const disableCount = React.useMemo(() => {
        let n = 0;
        for (const name of selected) {
          const p = byName.get(name);
          if (p && !p.official && p.enabled !== false) n += 1;
        }
        return n;
      }, [selected, byName]);
      const updatableCount = React.useMemo(() => {
        let n = 0;
        for (const name of selected) {
          const p = byName.get(name);
          if (p && !p.official && updateSpecOf(p)) n += 1;
        }
        return n;
      }, [selected, byName]);

      const onBatchBtn = (op) => {
        // 四个批量按钮统一走二次确认弹框
        setConfirmOp(op);
      };

      // ---------- M4 导出 ----------

      /**
       * 打开导出弹框：先向宿主半要「导出预演」（哪些插件 + 哪些配置），
       * 再把配置清单默认全选（用户可逐项取消）。
       *
       * 预演失败也要能打开弹框 —— 用户至少要知道为什么导不了。
       */
      const openExportDialog = React.useCallback(async () => {
        const names = [...selected].filter((n) => {
          const p = byName.get(n);
          return p && !p.official;
        });
        if (names.length === 0) {
          storeBanner({ ok: false, text: t('exportNoPlugin') });
          return;
        }
        setExportState('loading');
        const plan = await callPlanExport(names);
        if (!plan?.ok) {
          setExportState(null);
          storeBanner({ ok: false, text: `${t('exportPlanFailed')}：${plan?.error ?? '?'}` });
          return;
        }
        setExportPlan(plan);
        // 默认全选配置（可取消）；疑似凭据项即使勾选也不会被带走（宿主半再挡一层）
        const rels = new Set();
        for (const item of plan.config?.patch ?? []) rels.add(item.rel);
        for (const item of plan.config?.home ?? []) rels.add(item.rel);
        for (const item of plan.config?.declared ?? []) rels.add(item.rel);
        setExportConfigRels(rels);
        setExportState('open');
      }, [selected, byName]);

      /** 执行导出并下载。 */
      const doExport = React.useCallback(async () => {
        if (!exportPlan) return;
        const names = (exportPlan.plugins ?? []).map((p) => p.name);
        if (names.length === 0) {
          storeBanner({ ok: false, text: t('exportNoPlugin') });
          setExportState(null);
          return;
        }
        setExporting(true);
        setExportState('running');
        try {
          const r = await callExportPlugins({
            names,
            includeConfig: exportConfigRels.size > 0,
            configRels: [...exportConfigRels],
          });
          if (!r?.ok) {
            storeBanner({ ok: false, text: `${t('exportFailed')}：${r?.error ?? '?'}` });
            setExportState('open');
            return;
          }
          await downloadExport(r.filename);
          setExportState(null);
          setExportPlan(null);
          const size = r.sizeBytes >= 1024 * 1024
            ? `${(r.sizeBytes / 1024 / 1024).toFixed(1)} MB`
            : `${Math.max(1, Math.round(r.sizeBytes / 1024))} KB`;
          storeBanner({ ok: true, text: t('exportDone', { name: r.filename, size }) });
          // 导出告警（如某个插件打包失败）不能吞掉 —— 横幅下方补一行
          if (Array.isArray(r.warnings) && r.warnings.length > 0) {
            for (const w of r.warnings) {
              console.warn('[dsh-plugin-keeper] export warning:', w);
            }
          }
        } catch (e) {
          setExportState('open');
          storeBanner({ ok: false, text: `${t('exportDownloadFailed')}：${e?.message ?? e}` });
        } finally {
          setExporting(false);
        }
      }, [exportPlan, exportConfigRels]);

      // ---------- M5 导入 ----------

      /** 打开文件选择器（隐藏的 input 由渲染层提供）。 */
      const openImportPicker = React.useCallback(() => {
        importFileRef.current?.click();
      }, []);

      /**
       * 选好文件后：上传 → 宿主半预检 → 弹框展示兼容性与冲突。
       */
      const onImportFilePicked = React.useCallback(async (file) => {
        if (!file) return;
        setImportState('uploading');
        setImportPlan(null);
        try {
          const up = await uploadImportPackage(file);
          const plan = await callPlanImport(up.id);
          if (!plan?.ok) {
            setImportState(null);
            storeBanner({ ok: false, text: `${t('importPlanFailed')}：${plan?.error ?? '?'}` });
            return;
          }
          setImportId(up.id);
          setImportPlan(plan);
          // 默认策略（按之前拍板的）：
          //  - 同名已装 → 保留本机（不主动卸载已装插件）
          //  - 不兼容   → 跳过
          //  - 配置冲突 → 保留本机（用户可逐项改成「以导出包为准」）
          const ps = new Map();
          for (const p of plan.plugins ?? []) {
            if (p.compatibility?.status === 'incompatible') ps.set(p.name, 'skip');
            else if (p.installed) ps.set(p.name, 'keep');
            else ps.set(p.name, 'replace');
          }
          const cs = new Map();
          for (const c of plan.config ?? []) cs.set(c.rel, 'keep');
          setImportPluginStrategies(ps);
          setImportConfigStrategies(cs);
          setImportState('analyze');
        } catch (e) {
          setImportState(null);
          storeBanner({ ok: false, text: `${t('importUploadFailed')}：${e?.message ?? e}` });
        }
      }, []);

      /** 执行导入：把策略交给宿主半；插件安装由宿主半返回 tarball 路径后再逐个调官方 installBundle。 */
      const doImport = React.useCallback(async () => {
        if (!importPlan || !importId) return;
        setImportState('running');
        const pluginStrategies = [];
        for (const [name, strategy] of importPluginStrategies) pluginStrategies.push({ name, strategy });
        const configStrategies = [];
        for (const [rel, strategy] of importConfigStrategies) configStrategies.push({ rel, strategy });
        try {
          const r = await callExecuteImport({
            id: importId,
            pluginStrategies: importOnlyConfig ? pluginStrategies.map((s) => ({ ...s, strategy: 'keep' })) : pluginStrategies,
            configStrategies,
          });
          if (!r?.ok) {
            setImportState('analyze');
            storeBanner({ ok: false, text: `${t('importFailed')}：${r?.error ?? '?'}` });
            return;
          }
          // 插件安装：走官方 pluginManager（与批量操作同一条通道）
          const results = Array.isArray(r.results) ? [...r.results] : [];
          let okCount = 0;
          let skipCount = 0;
          let failCount = 0;
          for (const item of results) {
            if (item.op === 'import' && item.status === 'ok' && item.tarballPath) {
              try {
                const applied = await callPm('installBundle', `file:${item.tarballPath}`, { enabled: true });
                const mapped = mapChange(applied);
                results.push({ name: item.name, op: 'import', status: mapped.status, note: mapped.note ?? '' });
                if (mapped.status === 'ok' || mapped.status === 'restart') okCount += 1;
                else if (mapped.status === 'skipped') skipCount += 1;
                else failCount += 1;
              } catch (e) {
                results.push({ name: item.name, op: 'import', status: 'failed', note: String(e?.message ?? e) });
                failCount += 1;
              }
            } else if (item.status === 'skipped') skipCount += 1;
            else if (item.status === 'failed') failCount += 1;
            else okCount += 1;
          }
          setImportState(null);
          setImportPlan(null);
          setImportId(null);
          storeBanner({ ok: failCount === 0, text: t('importDone', { ok: okCount, skip: skipCount, fail: failCount }) });
          await load();
        } catch (e) {
          setImportState('analyze');
          storeBanner({ ok: false, text: `${t('importFailed')}：${e?.message ?? e}` });
        }
      }, [importPlan, importId, importPluginStrategies, importConfigStrategies, importOnlyConfig, load]);

      // 批量执行：快照 → 官方 pluginManager 逐行调用 → 刷新盘点 → 台账。
      // 顺序执行（pnpm 侧本就串行）；含本插件的操作放最后（中途把自己停了，后面的行没人执行）。
      // namesOverride：行内「更新」按钮只对单行执行，不动勾选集。
      const runBatch = React.useCallback(async (op, namesOverride) => {
        // 跨挂载点并发守卫：settings.section 与 plugins.tab 共享 store，同刻只允许一个批量
        if (batchStore.batch?.running) {
          storeBanner({ ok: false, text: t('batchBusy') });
          return;
        }
        const base = Array.isArray(namesOverride) && namesOverride.length ? namesOverride : [...selected];
        const names = base.filter((n) => {
          const p = byName.get(n);
          return p && !p.official;
        });
        if (!names.length) return;
        setLedgerDismissed(false); // 新一轮批量重新展示台账
        names.sort((a, b) => (a === SELF) - (b === SELF)); // self last

        const results = []; // 执行循环持有：组件卸载后循环仍推进并写 store

        // 更新目标解析：先算 spec，无目标的行记 skipped；快照只为有目标的批量服务
        let targets = [];
        if (op === 'update') {
          for (const name of names) {
            const p = byName.get(name);
            const spec = updateSpecOf(p);
            if (spec) targets.push({ name, spec });
            else results.push({ name, op, status: 'skipped', note: t('opNoTarget') });
          }
          if (!targets.length) {
            storeBanner({ text: t('updateNone'), ok: false });
            return;
          }
        } else if (op === 'enable' || op === 'disable') {
          // 与按钮计数同口径：混选时只处理可操作子集，已是目标状态的记 skipped
          for (const name of names) {
            const p = byName.get(name);
            const eligible = Boolean(p) && (op === 'enable'
              ? (p.enabled === false || !p.started)
              : p.enabled !== false);
            if (eligible) targets.push({ name });
            else results.push({ name, op, status: 'skipped', note: t(op === 'enable' ? 'opAlreadyEnabled' : 'opAlreadyDisabled') });
          }
          if (!targets.length) {
            storeBanner({ text: t('opNone'), ok: false });
            return;
          }
        } else {
          targets = names.map((name) => ({ name }));
        }

        storeBanner(null);
        hideTip(); // 批量重渲染会移动行位置，收起悬浮避免错位残留
        storeBatch({ op, running: true, done: results.length, total: results.length + targets.length, results: [...results], snapshotId: null });
        const push = (item) => {
          results.push(item);
          storeBatch((b) => (b ? { ...b, results: [...results], done: results.length } : b));
        };
        const prep = await callPrepareBatch(op);
        if (!prep?.ok) {
          // 发起组件可能已卸载：错误走模块级横幅而非组件内 err，保证可见
          storeBanner({ ok: false, text: prep?.error ?? t('loadFailed') });
          storeBatch(null);
          return;
        }

        for (const { name, spec } of targets) {
          try {
            if (op === 'update') {
              // installBundle 对已装包会 refused already-installed：更新 = 先卸后装两步
              try { await callPm('removeBundle', name); } catch { /* 移除失败交给安装步报错 */ }
              push({ name, op, ...mapChange(await callPm('installBundle', spec, { enabled: true })) });
            }
            else if (op === 'enable') push({ name, op, ...mapChange(await callPm('setBundleEnabled', name, true)) });
            else if (op === 'disable') push({ name, op, ...mapChange(await callPm('setBundleEnabled', name, false)) });
            else push({ name, op, ...mapChange(await callPm('removeBundle', name)) });
          } catch (e) {
            push({ name, op, status: 'failed', note: String(e?.message ?? e) });
          }
        }

        const finalResults = [...results];
        const counts = { ok: 0, restart: 0, fail: 0, skip: 0 };
        for (const r of finalResults) {
          if (r.status === 'ok') counts.ok += 1;
          else if (r.status === 'restart') counts.restart += 1;
          else if (r.status === 'failed') counts.fail += 1;
          else counts.skip += 1;
        }
        storeBatch({
          op,
          running: false,
          done: finalResults.length,
          total: finalResults.length, // 含 skipped，与 done 同口径避免 done>total 的潜伏坑
          results: finalResults,
          snapshotId: prep.id,
          counts,
        });
        if (counts.restart > 0) {
          storeBanner({ text: t('restartBanner', { n: counts.restart }), ok: false });
        }
        // 结果上报宿主落盘（切页签/重开后可恢复台账与「需重启」提醒）；
        // 组件已卸载时本循环仍会跑到这里（模块级调用不受影响）
        void callReportBatch({ id: prep.id, op, results: finalResults, counts });
        if (!namesOverride) setSelected(new Set());
        await load();
        // 宿主 startedBundles 的热更新是异步落账的，延迟补一刷，行状态才不滞留
        setTimeout(() => { void load(); }, 1500);
      }, [selected, byName, load]);

      // 行内更新（单个可更新插件，不经过勾选集）
      const onRowUpdate = React.useCallback((entry) => {
        if (batch?.running) return;
        setConfirmOp(null); // 确认框开着时点行内更新：作废浮层，避免名单与现实脱节
        void runBatch('update', [entry.name]);
      }, [batch?.running, runBatch]);

      // 恢复最近一次批量快照（把批量前的 package.json / cordis.patch.yml 复制回原位）
      const doRestore = React.useCallback(async (id) => {
        setRestoring(true);
        const r = await callRestoreBatch(id);
        setRestoring(false);
        if (r?.ok) {
          // 快照已回滚，先前批量的台账不再代表当前启停态，作废以免压制 host 真值
          storeBatch(null);
          storeBanner({ text: t('restoreDone'), ok: true });
        } else {
          storeBanner({ text: `${t('restoreFail')}：${r?.error ?? '?'}`, ok: false });
        }
        await load();
      }, [load]);

      const groups = React.useMemo(() => {
        const map = new Map();
        for (const p of visiblePlugins) {
          const k = groupKeyOf(p);
          if (!map.has(k)) map.set(k, []);
          map.get(k).push(p);
        }
        return GROUP_ORDER.filter((k) => map.has(k)).map((k) => [k, map.get(k)]);
      }, [visiblePlugins]);

      const counts = React.useMemo(() => {
        const c = { official: 0, npm: 0, github: 0, local: 0, unknown: 0 };
        for (const p of plugins) c[groupKeyOf(p)] += 1;
        return c;
      }, [plugins]);

      const lastCheckText = snap?.lastCheckAt
        ? t('lastCheck', { time: new Date(snap.lastCheckAt).toLocaleTimeString() })
        : t('neverChecked');
      // 徽标悬浮的"检查于"用：checkBadgeOf 在组件外，借模块级缓存传递
      if (snap?.lastCheckAt) lastCheckAtCache = snap.lastCheckAt;

      const batchRunning = Boolean(batch?.running);
      // 任一可检查分组正在检查 → 全局「检查中」
      const checking = Boolean(checkInfo?.checking);
      const busy = loading || checking || batchRunning;

      // 一键折叠：全部已折叠时点击展开，否则（含部分折叠）点击折叠全部
      const allCollapsed = GROUP_ORDER.every((k) => collapsedGroups.has(k));
      // 批量工具条：常驻显示（选中与否都在，避免列表跳动）；无选中时按钮禁用。
      // 四个按钮点击后弹二次确认框（列出将处理的插件），确认才执行。
      const batchBar = !batchRunning
        ? h('div', { className: 'dpk-batchbar' },
          h('span', { className: 'dpk-selhint' }, t('selHint', { sel: selCount, upd: updatableCount })),
          h('button', {
            className: 'dpk-btn',
            type: 'button',
            disabled: busy || updatableCount === 0,
            onClick: () => onBatchBtn('update'),
          }, `${t('batchUpdate')} (${updatableCount})`),
          h('button', {
            className: 'dpk-btn',
            type: 'button',
            disabled: busy || enableCount === 0,
            onClick: () => onBatchBtn('enable'),
          }, `${t('batchEnable')} (${enableCount})`),
          h('button', {
            className: 'dpk-btn',
            type: 'button',
            disabled: busy || disableCount === 0,
            onClick: () => onBatchBtn('disable'),
          }, `${t('batchDisable')} (${disableCount})`),
          h('button', {
            className: 'dpk-btn is-danger',
            type: 'button',
            disabled: busy || selCount === 0,
            onClick: () => onBatchBtn('uninstall'),
          }, `${t('batchUninstall')} (${selCount})`),
          // 导出所选：放在「卸载所选」右侧（导出是保留性操作，视觉上独立于破坏性操作）
          h('button', {
            className: 'dpk-btn',
            type: 'button',
            disabled: busy || selCount === 0,
            onClick: () => { void openExportDialog(); },
          }, `${t('batchExport')} (${selCount})`),
          // 导入所选：紧跟导出（文件驱动，与勾选集无关，故不禁用）
          h('button', {
            className: 'dpk-btn',
            type: 'button',
            disabled: busy || importState === 'uploading' || importState === 'running',
            onClick: () => { openImportPicker(); },
          }, t('batchImport')),
          // 高级配置：代理 / 安装 / 显示位置收进二级弹框
          h('button', {
            className: 'dpk-btn',
            type: 'button',
            'aria-label': t('settingsTitle'),
            onClick: () => setSettingsOpen(true),
          }, t('settingsBtn')),
          // 一键折叠/展开全部分组：图标复用分组头的收纳三角，无新增视觉
          h('button', {
            className: 'dpk-btn is-mini',
            type: 'button',
            'aria-label': allCollapsed ? t('expandAllGroups') : t('collapseAllGroups'),
            'data-tip': allCollapsed ? t('expandAllGroups') : t('collapseAllGroups'),
            onClick: () => setCollapsedGroups(allCollapsed ? new Set() : new Set(GROUP_ORDER)),
          }, h('span', { className: 'dpk-garrow' }, h(CollapseArrow, { collapsed: allCollapsed }))),
        )
        : null;

      const batchProgress = batchRunning
        ? h('div', { className: 'dpk-batchbar' },
          h('span', { className: 'dpk-hint' }, t('batchRunning', {
            op: t(OP_LABEL_KEY[batch.op] ?? 'opUpdate'),
            done: batch.done,
            total: batch.total,
          })))
        : null;

      // 结果台账（本次会话批量后）
      const ledger = batch && !batch.running && Array.isArray(batch.results) && batch.results.length > 0
        ? h('div', { className: 'dpk-ledger' },
          h('div', { className: 'dpk-ledrow' },
            h('span', null, t('opDone', {
              op: t(OP_LABEL_KEY[batch.op] ?? 'opUpdate'),
              ok: batch.counts?.ok ?? 0,
              restart: batch.counts?.restart ?? 0,
              fail: batch.counts?.fail ?? 0,
              skip: batch.counts?.skip ?? 0,
            }) + (batch.restored ? ` ${t('restoredLedger')}` : '')),
            h('div', { className: 'dpk-spacer' }),
            h('button', {
              className: 'dpk-btn is-mini',
              type: 'button',
              'aria-label': t('clearLedgerAria'),
              'data-tip': t('clearLedgerAria'),
              onClick: () => {
                storeBatch(null);
                storeBanner(null);
                setLedgerDismissed(true);
              },
            }, t('clearLedger')),
          ),
          batch.snapshotId
            ? h('div', { className: 'dpk-ledrow' },
              h('span', { className: 'dpk-hint' }, t('snapshotDone', { id: batch.snapshotId })),
              h('button', {
                className: 'dpk-btn',
                type: 'button',
                disabled: restoring || batchRunning,
                onClick: () => { void doRestore(batch.snapshotId); },
              }, restoring ? t('restoring') : t('restoreBtn')),
            )
            : null,
          batch.results.map((r) => h('div', { className: 'dpk-ledrow', key: r.name },
            h('span', { className: 'dpk-name', 'data-tip': r.name }, r.name),
            h('span', { className: `dpk-op is-${r.status}`, 'data-tip': r.note || undefined },
              t(`op${r.status === 'ok' ? 'Applied' : r.status === 'restart' ? 'Restart' : r.status === 'failed' ? 'Failed' : 'Skipped'}`)
              + (r.note && r.status !== 'ok' ? ` · ${r.note}` : '')),
          )),
        )
        : null;

      // 跨会话残留的批量快照（状态文件 lastBatch）——只提示存在与恢复入口
      const lastBatchLine = !batch && !ledgerDismissed && snap?.lastBatch?.id
        ? h('div', { className: 'dpk-ledrow' },
          h('span', { className: 'dpk-hint' }, t('lastBatchLine', {
            op: t(OP_LABEL_KEY[snap.lastBatch.op] ?? snap.lastBatch.op ?? ''),
            time: snap.lastBatch.at ? new Date(snap.lastBatch.at).toLocaleString() : '',
          })),
          h('button', {
            className: 'dpk-btn',
            type: 'button',
            disabled: restoring || batchRunning,
            onClick: () => { void doRestore(snap.lastBatch.id); },
          }, restoring ? t('restoring') : t('restoreBtn')),
        )
        : null;

      // 设置二级弹框：复用已有的 dpk-modal 体系（确认/导出/导入弹框同款），
      // 内容仍是原来的 dpk-setbody，避免在列表里长期占一大块空间。
      const settingsModal = !settingsOpen ? null
        : h('div', {
          className: 'dpk-modal is-wide is-settings',
          role: 'dialog',
          'aria-label': t('settingsTitle'),
        },
          h('div', { className: 'dpk-mtitle' }, t('settingsTitle')),
          h('div', { className: 'dpk-setbody' },
          // ---- 分区 1：网络代理 ----
          h('div', { className: 'dpk-setsec' },
            h('div', { className: 'dpk-gtitle' }, t('sectionProxy')),
          h('div', { className: 'dpk-setrow' },
            h('span', { className: 'dpk-setlabel' }, t('proxyLabel')),
            h('input', {
              ref: proxyRef,
              className: 'dpk-input',
              type: 'text',
              spellCheck: false,
              placeholder: t('proxyPlaceholder'),
              defaultValue: snap?.settings?.proxyUrl ?? '',
              key: snap?.settings?.proxyUrl ?? 'init', // 快照到达后回填默认值
              onChange: () => setSaveFlash(null),
            }),
            h('button', {
              className: 'dpk-btn',
              type: 'button',
              disabled: saving || testing || loading,
              onClick: () => { void doSave(); },
            }, saving ? t('saving') : t('save')),
            h('button', {
              className: 'dpk-btn',
              type: 'button',
              disabled: saving || testing || loading,
              onClick: () => { void doTestProxy(); },
            }, testing ? t('testProxyTesting', { n: testElapsed }) : t('testProxyBtn')),
            saveFlash === 'ok' ? h('span', { className: 'dpk-savedok' }, t('saved')) : null,
            saveFlash && saveFlash.err ? h('span', { className: 'dpk-savederr' }, saveFlash.err) : null,
          ),
          h('div', { className: 'dpk-hint' }, t('proxyHint')),
          snap?.proxy && (!snap.proxy.ok || !snap.proxy.verified)
            ? h('div', { className: 'dpk-savederr' },
                t('proxyUnsupported', { reason: snap.proxy.reason ?? 'unknown' }))
            : null,
          // 账号/密码独立输入：复用已按宿主对齐的 dpk-setrow / dpk-setlabel / dpk-input
          h('div', { className: 'dpk-setrow' },
            h('span', { className: 'dpk-setlabel' }, t('proxyUserLabel')),
            h('input', {
              ref: proxyUserRef,
              className: 'dpk-input',
              type: 'text',
              autoComplete: 'off',
              spellCheck: false,
              placeholder: t('proxyUserPlaceholder'),
              defaultValue: snap?.settings?.proxyUser ?? '',
              key: `u:${snap?.settings?.proxyUser ?? 'init'}`,
              onChange: () => setSaveFlash(null),
            }),
          ),
          h('div', { className: 'dpk-setrow' },
            h('span', { className: 'dpk-setlabel' }, t('proxyPassLabel')),
            h('input', {
              ref: proxyPassRef,
              className: 'dpk-input',
              type: 'password',
              autoComplete: 'new-password',
              spellCheck: false,
              placeholder: t('proxyPassPlaceholder'),
              onChange: () => setSaveFlash(null),
            }),
          ),
          h('div', { className: 'dpk-hint' }, t('proxyCredentialHint')),
          h('div', { className: 'dpk-hint' }, t('testProxyHint')),
          testing ? h('div', { className: 'dpk-hint' }, t('testProxySlowHint')) : null,
          proxyTest ? h('div', { className: 'dpk-hint' },
            h('div', { className: proxyTest.ok ? 'dpk-savedok' : 'dpk-savederr' },
              `${proxyTest.ok ? t('testProxyOk') : t('testProxyFail')} · ${proxyTest.mode ?? ''} · ${proxyTest.elapsedMs ?? 0}ms${proxyTest.error ? ` — ${proxyTest.error}` : ''}`),
            ...(Array.isArray(proxyTest.checks) ? [h('div', {
              className: proxyTest.installOk ? 'dpk-savedok' : 'dpk-savederr',
            }, proxyTest.installOk ? t('testInstallOk') : t('testInstallFail'))] : []),
            ...(Array.isArray(proxyTest.checks) ? proxyTest.checks.map((c) => h('div', {
              key: c.id,
              className: c.ok ? 'dpk-savedok' : 'dpk-savederr',
            }, `${t(CHECK_LABEL_KEY[c.id] ?? c.id)}: ${c.ok ? 'OK' : 'FAIL'}${c.status ? ` ${c.status}` : ''} · ${c.ms ?? 0}ms${c.error ? ` — ${c.error}` : ''}`)) : []),
          ) : null,
          ),
          // ---- 分区 2：从 GitHub 安装 ----
          h('div', { className: 'dpk-setsec' },
            h('div', { className: 'dpk-gtitle' }, t('sectionInstall')),
          h('div', { className: 'dpk-setrow' },
            h('span', { className: 'dpk-setlabel' }, t('installLabel')),
            h('input', {
              ref: installRef,
              className: 'dpk-input',
              type: 'text',
              spellCheck: false,
              placeholder: t('installPlaceholder'),
              disabled: installing,
              onKeyDown: (e) => { if (e.key === 'Enter' && !installing) { void doInstall(); } },
            }),
            h('button', {
              className: 'dpk-btn',
              type: 'button',
              disabled: installing || loading,
              onClick: () => { void doInstall(); },
            }, installing ? t('installing') : t('installBtn')),
          ),
          installFlash
            ? h('div', { className: `dpk-banner${installFlash.ok ? ' is-ok' : ''}` }, installFlash.text)
            : null,
          // 实时进度：阶段来自 install-state，日志行来自宿主转发的 pnpm 输出（非模拟）
          progress.status !== 'idle'
            ? h('div', { className: 'dpk-instprog' },
                h('div', { className: 'dpk-hint' },
                  `${t('installStage')}：${stageLabel(progress.phase, progress.attempt)} · ${t('installLogCount', { n: progress.lines.length })}`),
                progress.lines.length
                  ? h('div', { className: 'dpk-mlist' },
                      progress.lines.slice(-8).map((line, i) => h('div', {
                        key: i,
                        className: line.stream === 'stderr' ? 'dpk-savederr' : 'dpk-hint',
                      }, line.text)))
                  : null,
                progress.status === 'running'
                  ? h('button', {
                      className: 'dpk-btn is-mini',
                      type: 'button',
                      onClick: () => { void pmFace?.cancelInstall?.(progress.requestId); },
                    }, t('installCancel'))
                  : null,
              )
            : null,
          h('div', { className: 'dpk-hint' }, t('installHint')),
          ),
          // ---- 分区 3：显示位置 ----
          h('div', { className: 'dpk-setsec' },
            h('div', { className: 'dpk-gtitle' }, t('sectionDisplay')),
          // 显示位置：默认只在「插件」面板的页签显示；勾选后设置页也出现
          h('div', { className: 'dpk-setrow' },
            h('label', { className: 'dpk-switch' },
              h('input', {
                type: 'checkbox',
                checked: showInSettings,
                disabled: saving,
                onChange: (e) => { void doSaveShowInSettings(e.target.checked); },
              }),
              t('showInSettings'),
            ),
          ),
          h('div', { className: 'dpk-hint' }, t('showInSettingsHint')),
          locationFlash === 'ok' ? h('div', { className: 'dpk-savedok' }, t('showInSettingsSaved')) : null,
          locationFlash && locationFlash.err ? h('div', { className: 'dpk-savederr' }, locationFlash.err) : null,
          ),
          ),
          h('div', { className: 'dpk-mfoot' },
            h('button', {
              className: 'dpk-btn',
              type: 'button',
              autoFocus: true,
              onClick: () => setSettingsOpen(false),
            }, t('dialogClose')),
          ),
        );

      // 二次确认弹框：列出将要处理的插件名单，确认才真正执行
      const confirmModal = (() => {
        if (!confirmOp) return null;
        const base = [...selected].filter((n) => {
          const p = byName.get(n);
          return p && !p.official;
        });
        // 名单与按钮计数/执行目标同口径：混选时只列可操作子集
        const eligible = base.filter((n) => {
          const p = byName.get(n);
          if (!p) return false;
          if (confirmOp === 'update') return Boolean(updateSpecOf(p));
          if (confirmOp === 'enable') return p.enabled === false || !p.started;
          if (confirmOp === 'disable') return p.enabled !== false;
          return true; // uninstall
        });
        const names = eligible.sort((a, b) => (a === SELF) - (b === SELF));
        if (!names.length) return null;
        // 无遮罩浮层：不挡底下列表，观感不随列表内容变化；关闭走"取消"按钮
        const opLabel = t(OP_LABEL_KEY[confirmOp] ?? 'opUpdate');
        const DESC_KEY = {
          update: 'dialogDescUpdate', enable: 'dialogDescEnable',
          disable: 'dialogDescDisable', uninstall: 'dialogDescUninstall',
        };
        return h('div', { className: 'dpk-modal' },
          h('div', { className: 'dpk-mtitle' }, `${opLabel} (${names.length})`),
          DESC_KEY[confirmOp] ? h('div', { className: 'dpk-hint' }, t(DESC_KEY[confirmOp])) : null,
          h('div', { className: 'dpk-mlist' }, names.map((n) => h('div', { key: n }, n))),
          h('div', { className: 'dpk-mfoot' },
            h('button', { className: 'dpk-btn', type: 'button', autoFocus: true, onClick: () => setConfirmOp(null) }, t('dialogCancel')),
            h('button', {
              className: `dpk-btn is-primary${confirmOp === 'uninstall' ? ' is-danger' : ''}`,
              type: 'button',
              onClick: () => { setConfirmOp(null); void runBatch(confirmOp); },
            }, t('dialogOkOp', { op: opLabel })),
          ),
        );
      })();

      // 导出弹框：列出将导出的插件 + 可勾选的配置清单（含疑似凭据警示）
      const exportModal = (() => {
        if (!exportState || exportState === 'loading') return null;
        if (!exportPlan) return null;
        const cfgItems = [
          ...(exportPlan.config?.patch ?? []).map((i) => ({ ...i, kindLabel: 'exportConfigPatch' })),
          ...(exportPlan.config?.home ?? []).map((i) => ({ ...i, kindLabel: 'exportConfigHome' })),
          ...(exportPlan.config?.declared ?? []).map((i) => ({ ...i, kindLabel: 'exportConfigDeclared' })),
        ];
        const toggleRel = (rel) => {
          setExportConfigRels((prev) => {
            const next = new Set(prev);
            if (next.has(rel)) next.delete(rel); else next.add(rel);
            return next;
          });
        };
        return h('div', { className: 'dpk-modal is-wide' },
          h('div', { className: 'dpk-mtitle' }, `${t('exportDialogTitle')} (${exportPlan.plugins?.length ?? 0})`),
          h('div', { className: 'dpk-hint' }, t('exportWithConfigHint')),
          h('div', { className: 'dpk-mlist' },
            (exportPlan.plugins ?? []).map((p) => h('div', { key: p.name },
              `${p.name}${p.version ? ` · v${p.version}` : ''}`)),
          ),
          h('div', { className: 'dpk-hint' }, t('exportConfigHeader')),
          cfgItems.length === 0
            ? h('div', { className: 'dpk-hint' }, t('exportConfigEmpty'))
            : h('div', { className: 'dpk-cfglist' },
              cfgItems.map((item) => {
                const suspicious = item.suspicious === true;
                const maybe = item.suspicious === undefined && item.score !== undefined && item.score < 80;
                const checked = exportConfigRels.has(item.rel) && !suspicious;
                return h('div', { className: `dpk-cfgrow${suspicious ? ' is-suspicious' : ''}`, key: item.rel },
                  h('input', {
                    type: 'checkbox',
                    className: `dpk-cb${suspicious ? ' is-warn' : ''}`,
                    checked,
                    disabled: suspicious || exportState === 'running',
                    onChange: () => toggleRel(item.rel),
                  }),
                  h('div', { className: 'dpk-cfgnames' },
                    h('div', { className: 'dpk-cfgrel' }, item.rel),
                    h('div', { className: 'dpk-cfgtag' },
                      `${t(item.kindLabel)} · ${item.plugin ?? '-'}`,
                      suspicious ? ` · ${t('exportConfigSuspicious')}` : '',
                      maybe ? ` · ${t('exportConfigMaybe')}` : '',
                    ),
                  ),
                );
              }),
            ),
          h('div', { className: 'dpk-mfoot' },
            h('button', {
              className: 'dpk-btn',
              type: 'button',
              autoFocus: true,
              disabled: exportState === 'running',
              onClick: () => { setExportState(null); setExportPlan(null); },
            }, t('dialogCancel')),
            h('button', {
              className: 'dpk-btn is-primary',
              type: 'button',
              disabled: exportState === 'running' || (exportPlan.plugins?.length ?? 0) === 0,
              onClick: () => { void doExport(); },
            }, exportState === 'running' ? t('exportRunning') : t('exportOk')),
          ),
        );
      })();

      // 导入弹框：预检结果（兼容性 + 冲突）+ 逐项策略选择 + 执行
      const importModal = (() => {
        if (!importState || importState === 'uploading' || !importPlan) return null;
        const plugins = importPlan.plugins ?? [];
        const configs = importPlan.config ?? [];
        const setPluginStrategy = (name, strategy) => {
          setImportPluginStrategies((prev) => {
            const next = new Map(prev);
            next.set(name, strategy);
            return next;
          });
        };
        const setConfigStrategy = (rel, strategy) => {
          setImportConfigStrategies((prev) => {
            const next = new Map(prev);
            next.set(rel, strategy);
            return next;
          });
        };
        // 兼容性徽标
        const compatBadge = (p) => {
          const c = p.compatibility ?? {};
          if (p.integrityOk === false) return h('span', { className: 'dpk-op is-failed' }, t('importIntegrityBad'));
          if (c.status === 'compatible') return h('span', { className: 'dpk-op is-ok' }, t('importCompatOk'));
          if (c.status === 'exempted') return h('span', { className: 'dpk-op is-restart' }, t('importCompatExempt'));
          if (c.status === 'incompatible') return h('span', { className: 'dpk-op is-failed' }, t('importCompatBad'));
          return h('span', { className: 'dpk-op is-skipped' }, t('importCompatUnknown'));
        };
        return h('div', { className: 'dpk-modal is-wide' },
          h('div', { className: 'dpk-mtitle' }, t('importAnalyzeTitle')),
          importPlan.sourceDshVersion
            ? h('div', { className: 'dpk-hint' }, t('importSourceDsh', {
              src: importPlan.sourceDshVersion,
              local: importPlan.runtimeVersion,
            }))
            : null,
          // ---- 插件清单 ----
          h('div', { className: 'dpk-hint' }, t('importPluginStrategy')),
          h('div', { className: 'dpk-cfglist' },
            plugins.map((p) => {
              const strategy = importPluginStrategies.get(p.name) ?? 'keep';
              const incompatible = p.compatibility?.status === 'incompatible';
              const conflicted = p.installed === true;
              return h('div', { className: `dpk-cfgrow${conflicted ? ' is-suspicious' : ''}`, key: p.name },
                h('div', { className: 'dpk-cfgnames' },
                  h('div', { className: 'dpk-cfgrel' }, `${p.name}${p.version ? ` · v${p.version}` : ''}`),
                  h('div', { className: 'dpk-cfgtag' },
                    compatBadge(p),
                    conflicted ? ` · ${t('importConflictPlugin')}${p.installedVersion ? ` (v${p.installedVersion})` : ''}` : '',
                    incompatible ? ` · ${p.compatibility.note ?? ''}` : '',
                    p.versionMismatch ? ` · ${t('importVersionDiff', { pkg: p.version, tar: p.version })}` : '',
                  ),
                ),
                h('select', {
                  className: 'dpk-select',
                  value: strategy,
                  disabled: importState === 'running',
                  onChange: (e) => setPluginStrategy(p.name, e.target.value),
                },
                  h('option', { value: 'replace' }, t('importStrategyReplace')),
                  h('option', { value: 'keep' }, t('importStrategyKeep')),
                  h('option', { value: 'skip' }, t('importStrategySkip')),
                ),
              );
            }),
          ),
          // ---- 配置清单 ----
          h('div', { className: 'dpk-hint' }, t('importConfigStrategy')),
          configs.length === 0
            ? h('div', { className: 'dpk-hint' }, t('importNoConfig'))
            : h('div', { className: 'dpk-cfglist' },
              configs.map((c) => {
                const strategy = importConfigStrategies.get(c.rel) ?? 'keep';
                return h('div', { className: `dpk-cfgrow${c.conflict ? ' is-suspicious' : ''}`, key: c.rel },
                  h('div', { className: 'dpk-cfgnames' },
                    h('div', { className: 'dpk-cfgrel' }, c.rel),
                    h('div', { className: 'dpk-cfgtag' },
                      ` · ${c.plugin ?? '-'}`,
                      c.conflict
                        ? ` · ${c.kind === 'patch' ? t('importConflictPatch') : t('importConflictFile')}`
                        : '',
                    ),
                  ),
                  h('select', {
                    className: 'dpk-select',
                    value: strategy,
                    disabled: importState === 'running',
                    onChange: (e) => setConfigStrategy(c.rel, e.target.value),
                  },
                    h('option', { value: 'import' }, t('importStrategyReplace')),
                    h('option', { value: 'keep' }, t('importStrategyKeep')),
                  ),
                );
              }),
            ),
          // ---- 仅导配置 ----
          h('label', { className: 'dpk-switch' },
            h('input', {
              type: 'checkbox',
              checked: importOnlyConfig,
              disabled: importState === 'running',
              onChange: (e) => setImportOnlyConfig(e.target.checked),
            }),
            t('importOnlyConfig'),
          ),
          h('div', { className: 'dpk-mfoot' },
            h('button', {
              className: 'dpk-btn',
              type: 'button',
              autoFocus: true,
              disabled: importState === 'running',
              onClick: () => { setImportState(null); setImportPlan(null); setImportId(null); },
            }, t('dialogCancel')),
            h('button', {
              className: 'dpk-btn is-primary',
              type: 'button',
              disabled: importState === 'running',
              onClick: () => { void doImport(); },
            }, importState === 'running' ? t('importRunning', { done: 0, total: 0 }) : t('importOk')),
          ),
        );
      })();

      return h('div', { className: 'dpk-root' },
        confirmModal,
        exportModal,
        importModal,
        settingsModal,
        // 隐藏的文件选择器（导入入口）
        h('input', {
          ref: importFileRef,
          type: 'file',
          accept: '.zip,application/zip',
          style: { display: 'none' },
          onChange: (e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = ''; // 允许重选同一个文件
            void onImportFilePicked(file);
          },
        }),
        h('div', { className: 'dpk-toolbar' },
          plugins.length > 0
            ? h('span', { className: 'dpk-summary' }, t('summary', {
              total: plugins.length,
              official: counts.official,
              npm: counts.npm,
              github: counts.github,
              local: counts.local,
            }))
            : (!loading && !err ? h('span', { className: 'dpk-summary' }, t('noPlugins')) : null),
          // 筛选控件组：搜索框 + 「只看可更新」（两个条件叠加生效）
          h('div', { className: 'dpk-filters' },
            h('div', { className: 'dpk-search' },
              h('span', { className: 'dpk-searchicon' }, SEARCH_ICON),
              h('input', {
                className: 'dpk-searchinput',
                type: 'text',
                value: query,
                placeholder: t('searchPlaceholder'),
                'aria-label': t('searchLabel'),
                onChange: (e) => setQuery(e.target.value),
                onKeyDown: (e) => {
                  // Esc 清空（不冒泡，免得同时关掉确认弹框）
                  if (e.key === 'Escape' && query) {
                    e.stopPropagation();
                    setQuery('');
                  }
                },
              }),
              query
                ? h('button', {
                  className: 'dpk-searchclear',
                  type: 'button',
                  'aria-label': t('searchClear'),
                  'data-tip': t('searchClear'),
                  onClick: () => setQuery(''),
                }, '×')
                : null,
            ),
            searching
              ? h('span', { className: 'dpk-searchcount' }, t('searchCount', {
                n: visiblePlugins.length,
                total: plugins.length,
              }))
              : null,
            h('label', { className: 'dpk-onlyup' },
              h('input', {
                type: 'checkbox',
                checked: onlyUpdatable,
                disabled: batchRunning,
                onChange: () => setOnlyUpdatable((v) => !v),
              }),
              t('onlyUpdatable'),
            ),
          ),
          h('div', { className: 'dpk-spacer' }),
          h('div', { className: 'dpk-tbgroup' },
            h('span', { className: 'dpk-lastcheck' }, lastCheckText),
            h('button', {
              className: 'dpk-btn is-primary',
              type: 'button',
              disabled: checking || loading || counts.npm + counts.github === 0,
              onClick: () => { void doCheck(); },
            }, checking ? t('checking') : t('checkBtn')),
            h('button', {
              className: 'dpk-btn',
              type: 'button',
              disabled: loading || checking,
              onClick: () => { void load(); },
            }, loading ? t('refreshing') : t('refresh')),
          ),
        ),
        banner ? h('div', { className: `dpk-banner${banner.ok ? ' is-ok' : ''}` }, banner.text) : null,
        // 检查结果行：有失败时升级为警示横幅（含首条原因与连接类提示），全成才显示普通统计
        // 检查进行中不显示统计（此时分组各自在跑，数字还是上一轮的）
        checkInfo && !checkInfo.checking
          ? (checkInfo.error > 0
            ? h('div', { className: 'dpk-banner' },
              t('checkDoneFail', { fail: checkInfo.error }),
              checkInfo.firstErrorNote ? h('div', null, t('checkErrDetail', { note: checkInfo.firstErrorNote })) : null,
              checkInfo.connErr ? h('div', null, t('checkConnHint')) : null,
            )
            : h('div', { className: 'dpk-hint' }, t('checkDone', checkInfo)))
          : null,
        err ? h('div', { className: 'dpk-err' }, err) : null,
        // 有缓存但正在刷新：说明当前显示的是上次结果（避免把旧数据误当最新）
        loading && snap?.fromCache
          ? h('div', { className: 'dpk-hint' }, t('cachedHint', {
            time: snap.cachedAt ? new Date(snap.cachedAt).toLocaleString() : '',
          }))
          : null,
        batchBar,
        batchProgress,
        loading && !snap
          ? h('div', { className: 'dpk-empty' }, t('loading'))
          : null,
        // 搜索无命中：给一句明说（别让用户以为插件没了）
        searching && visiblePlugins.length === 0
          ? h('div', { className: 'dpk-empty' }, t('searchNoMatch', { q: search.trim() }))
          : null,
        groups.map(([key, list]) => {
            // 勾选限定：任意非官方插件可选中（启停/卸载批量不限可更新行；
            // 行内"更新"按钮按 updateSpecOf 独立显隐，批量更新对无目标行记 skipped）
            const eligible = list.filter((p) => !p.official);
            const allIn = eligible.length > 0 && eligible.every((p) => selected.has(p.name));
            const collapsed = collapsedGroups.has(key);
            // 分组级检查状态：npm / github 两组各自独立，互不阻塞
            const gState = checkState[key] ?? null;
            const gChecking = gState?.status === 'checking';
            const checkable = CHECKABLE_GROUPS.includes(key);
            return h('div', { className: 'dpk-group', key },
              h('div', { className: 'dpk-ghead', onClick: () => toggleGroupCollapse(key) },
                h('span', {
                  className: 'dpk-garrow',
                  'data-tip': collapsed ? t('groupExpand') : t('groupCollapse'),
                  'aria-label': collapsed ? t('groupExpand') : t('groupCollapse'),
                }, h(CollapseArrow, { collapsed })),
                eligible.length > 0
                  ? h('input', {
                    type: 'checkbox',
                    className: 'dpk-cb',
                    checked: allIn,
                    disabled: batchRunning,
                    onChange: () => toggleGroup(eligible),
                    onClick: (e) => e.stopPropagation(),
                  })
                  : null,
                h('span', { className: 'dpk-gtitle' }, t(GROUP_TITLE_KEY[key])),
                h('span', { className: 'dpk-gcount' }, String(list.length)),
                // 分组独立检查入口：只给有远端版本锚点的两组
                checkable
                  ? h('button', {
                    className: 'dpk-btn is-mini',
                    type: 'button',
                    disabled: gChecking || batchRunning || loading,
                    onClick: (e) => { e.stopPropagation(); void doCheckGroup(key); },
                  }, gChecking ? t('groupChecking') : t('groupCheckBtn'))
                  : null,
                gState?.status === 'done' && gState.counts
                  ? h('span', { className: 'dpk-gcount' }, t('groupCheckDone', {
                    u: gState.counts.update ?? 0,
                    l: gState.counts.latest ?? 0,
                  }))
                  : null,
                gState?.status === 'error'
                  ? h('span', { className: 'dpk-gcount', 'data-tip': gState.error || undefined }, t('groupCheckFailed'))
                  : null,
              ),
              !collapsed
                ? h('div', { className: 'dpk-rows' },
                  list.map((entry) => h(Row, {
                    key: entry.name,
                    entry,
                    checked: selected.has(entry.name),
                    disabled: entry.official || batchRunning,
                    onToggle: toggleOne,
                    onUpdate: onRowUpdate,
                    busy: batchRunning,
                    terms, // 检索词：命中文本用主题色高亮
                    opStatus: batch && !batch.running
                      ? batch.results?.findLast((r) => r.name === entry.name) ?? null
                      : null,
                  })),
                )
                : null,
            );
          }),
        ledger,
        lastBatchLine,
      );
    }

    // ---------- Typert Remote 契约（client 描述符走最小 strict codec，同 fallback-queue 形态） ----------

    const INPUT_PARAM = {
      name: 'input',
      wire: 'input',
      source: 'json',
      codec: { mode: 'strict', typeSymbol: 'dsh-plugin-keeper#ServiceInput', create: () => ({}) },
    };

    const TYPERT_REMOTE = {
      package: 'dsh-plugin-keeper',
      descriptors: [
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/snapshot',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'snapshot',
          invocation: { kind: 'direct' },
          parameters: [],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/checkUpdates',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'checkUpdates',
          invocation: { kind: 'direct' },
          parameters: [],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/checkGroup',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'checkGroup',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/getSettings',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'getSettings',
          invocation: { kind: 'direct' },
          parameters: [],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/saveSettings',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'saveSettings',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/normalizeGithubSpec',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'normalizeGithubSpec',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/testProxy',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'testProxy',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/prepareBatch',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'prepareBatch',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/restoreBatch',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'restoreBatch',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/reportBatch',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'reportBatch',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/planExport',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'planExport',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/exportPlugins',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'exportPlugins',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/planImport',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'planImport',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/executeImport',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'executeImport',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
      ],
    };

    // ---------- 装配 ----------

    /**
     * 「在设置页也显示」开关的当前值（模块级）。
     *
     * 为什么放模块级：槽位注册发生在**挂载期**，而开关值要等 RPC 回来才知道 ——
     * 若在 apply 里直接注册 settings.section，开关为关时设置页仍会出现（违背预期）；
     * 若等 RPC 再注册，则设置页未打开时槽类型可能还没声明（首验踩过的坑）。
     *
     * 折中：**先读一次宿主状态**，读到了就按开关决定；读不到（RPC 未就绪）就**保守地
     * 不注册设置页**（插件页 Tab 恒在，功能不缺）。用户勾选后重新进入页面即生效。
     */
    let showInSettingsFlag = false;

    /**
     * 设置页入口的注册器（模块级引用）。
     *
     * 用途：开关查询返回后，若槽类型**已经声明**，需要立刻补注册；
     * 若尚未声明，则等包裹器回调时再注册 —— 两者只会有一次注册发生。
     */
    let registerSettingsSection = null;

    /** 读取「在设置页也显示」开关（宿主半是唯一真值来源）。 */
    async function readShowInSettings() {
      try {
        const v = unwrapEnvelope(await rpcFace?.getSettings?.());
        return v?.showInSettings === true;
      } catch {
        return false;
      }
    }

    function mountSection(rctx) {
      injectCss();
      let disposeEntry = null;
      // settings.section 槽类型是否已声明：由 slots.inject 包裹器首次触发时置位。
      // 语言观察器只在声明后出手，避免启动期（槽类型未就绪）的注册失败噪声。
      let sectionDeclared = false;
      const register = () => {
        // 显示位置开关为关时不挂设置页入口（插件页 Tab 恒在，功能不缺）。
        if (!showInSettingsFlag) {
          try { disposeEntry?.(); } catch { /* 已被上层销毁时忽略 */ }
          disposeEntry = null;
          return;
        }
        try {
          disposeEntry?.();
        } catch { /* 已被上层销毁时忽略 */ }
        try {
          disposeEntry = rctx.slots.register(
            {
              name: 'settings.section',
              id: 'dsh-plugin-keeper',
              order: 60,
              label: () => t('sectionTitle'),
              inject: () => ({}),
            },
            PluginKeeperSection,
          );
        } catch (e) {
          // 理论上只在类型未声明时发生；留调试级日志兜底
          console.debug('[dsh-plugin-keeper] settings.section register deferred:', e?.message ?? e);
        }
      };
      // 暴露给「开关查询回来后补注册」用（槽类型已声明时立即生效）
      registerSettingsSection = () => {
        if (!sectionDeclared) return; // 类型未声明 → 等包裹器回调
        register();
      };
      const registerIfDeclared = () => {
        if (!sectionDeclared) return;
        register();
      };
      // 槽类型由 @deepseek-ai/dsh-client-ui-settings 在设置页挂载时声明，
      // 插件捆 apply 时尚未就绪（首验实测：eager 调用会让 entry 激活失败）。
      // 一律走 slots.inject 包裹器，声明完成后才真正挂载。
      const disposeInjection = rctx.slots.inject('settings.section', () => {
        sectionDeclared = true;
        register();
      });
      acquireTooltip(); // 注入成功后再接 tooltip，注入抛错时不泄漏引用计数
      const langObs = new MutationObserver(registerIfDeclared);
      langObs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
      return () => {
        langObs.disconnect();
        try {
          disposeInjection?.();
        } catch { /* 忽略 */ }
        try {
          disposeEntry?.();
        } catch { /* 忽略 */ }
        releaseTooltip();
      };
    }

    // M3：官方「插件管理」页的 plugins.tab 页签（槽类型由官方页挂载时声明，同样走包裹器）。
    // label 走 resolveSlotLabel 且官方 tabLedgerSource 订阅 locale revision，语言切换自动刷新，无需观察器。
    function mountPluginsTab(rctx) {
      injectCss();
      let disposeEntry = null;
      const register = () => {
        try {
          disposeEntry?.();
        } catch { /* 已被上层销毁时忽略 */ }
        try {
          disposeEntry = rctx.slots.register(
            {
              name: 'plugins.tab',
              id: 'dsh-plugin-keeper',
              label: () => t('sectionTitle'),
              inject: () => ({}),
            },
            PluginKeeperSection,
          );
        } catch (e) {
          console.debug('[dsh-plugin-keeper] plugins.tab register deferred:', e?.message ?? e);
        }
      };
      const disposeInjection = rctx.slots.inject('plugins.tab', register);
      acquireTooltip(); // 注入成功后再接 tooltip，注入抛错时不泄漏引用计数
      return () => {
        try {
          disposeInjection?.();
        } catch { /* 忽略 */ }
        try {
          disposeEntry?.();
        } catch { /* 忽略 */ }
        releaseTooltip();
      };
    }

    return {
      inject: ['slots', 'remote'],
      async apply(ctx) {
        // 挂自己的 Remote namespace，再在内层 ctx.inject 里拿 face
        // remote.pluginManager = 官方 pluginManager 服务（M2 批量操作的数据面）
        const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE);
        ctx.effect(() => () => { void disposeRemote(); }, 'dsh-plugin-keeper remote mount');
        await ctx.inject(
          ['slots', 'remote', 'remote.dsh-plugin-keeper', 'remote.pluginManager'],
          (rctx) => {
            rpcFace = rctx.remote?.['dsh-plugin-keeper'] ?? null;
            pmFace = rctx.remote?.pluginManager ?? null;
            // 插件页 Tab：恒有（默认入口）
            rctx.effect(() => mountPluginsTab(rctx), 'dsh-plugin-keeper plugins tab');
            // 设置页 section：按「在设置页也显示」开关决定（默认关）。
            // 开关值要问宿主半，但 slots.inject 的包裹器必须**立刻注册**
            // （否则槽类型声明后再无人接手）—— 两段式：
            //   ① 包裹器回调 → 开关已是 true 才真正注册；
            //   ② 开关查询回来 → 若 true 则调 registerSettingsSection() 补注册
            //      （槽类型未声明时它会跳过，等包裹器回调时再注册 → 只注册一次）。
            rctx.effect(() => mountSection(rctx), 'dsh-plugin-keeper settings section');
            // 宿主的真实安装事件流：只有本次 requestId 的事件才进进度面板
            rctx.effect(() => {
              const offs = [
                rctx.remote?.$on?.('plugin-manager/install-state', (p) => {
                  if (!p || p.requestId !== installProgress.requestId) return;
                  updateProgress({ phase: p.phase, attempt: p.attempt ?? null });
                }),
                rctx.remote?.$on?.('plugin-manager/install-log', (chunk) => {
                  if (!chunk || chunk.requestId !== installProgress.requestId) return;
                  const text = String(chunk.text ?? '').trim();
                  if (!text) return;
                  updateProgress({ lines: [...installProgress.lines, { stream: chunk.stream, text }].slice(-40) });
                }),
              ].filter(Boolean);
              return () => { for (const off of offs) { try { off?.(); } catch { /* 忽略解绑异常 */ } } };
            }, 'dsh-plugin-keeper install progress');
            void (async () => {
              showInSettingsFlag = await readShowInSettings();
              if (!showInSettingsFlag) return;
              registerSettingsSection?.();
            })();
          },
        );
      },
    };
  },
});
