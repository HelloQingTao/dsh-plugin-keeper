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
        checkConnHint: '连接类错误分两类：GitHub 检查需要配置的代理可达；npm 检查走纯直连，不受任何代理设置影响，失败通常是本机网络或 registry 不可达。徽标停留在上次成功检查的结果，请修正后重新检查。',
        checkedAt: '检查于 {time}',
        installLabel: '从 GitHub 安装',
        installHint: '支持 owner/repo、github:owner/repo#tag、完整 GitHub 链接（含 .git、/tree/tag）、git@ SSH；安装与检查更新共用下方代理设置。',
        installNoResponse: '安装请求已发出，宿主暂未返回结果；下方实时日志可查看进度',
        settingsTitle: '高级配置',
        settingsBtn: '高级配置',
        sectionProxy: '网络代理',
        sectionInstall: '从 GitHub 安装',
        sectionLocal: '从本地安装',
        sectionDisplay: '显示与交互',
        collapseAllGroups: '一键折叠全部分组',
        expandAllGroups: '一键展开全部分组',
        viewGroup: '分组',
        viewList: '列表',
        viewGroupAria: '切换到分组视图',
        viewListAria: '切换到列表视图',
        sortName: '按名称',
        sortInstalled: '按安装时间',
        sortUpdated: '按更新时间',
        sortAsc: '升序',
        sortDesc: '降序',
        sortAria: '排序方式',
        dirAria: '切换升降序',
        relJustNow: '刚刚',
        relMin: '{n} 分钟前',
        relHour: '{n} 小时前',
        relDay: '{n} 天前',
        relMonth: '{n} 个月前',
        relYear: '{n} 年前',
        timeInstalled: '安装于 {time}',
        timeUpdated: '更新于 {time}',
        timeChanged: '版本变更于 {time}',
        timeInstalledBadge: '装 {time}',
        timeUpdatedBadge: '更 {time}',
        timeUnknown: '时间未知',
        dialogClose: '关闭',
        clearLedger: '清空',
        clearLedgerAria: '清空所有消息',
        proxyLabel: 'HTTP 代理',
        proxyPlaceholder: '127.0.0.1:7890（可不带 http://）',
        proxyHint: '留空 = 跟随系统代理；填写后仅 GitHub 检查更新与 GitHub 安装走此代理，npm 检查更新与依赖下载保持直连；不带前缀会自动补齐。需要认证时在下方填写账号密码。',
        proxyUnsupported: '代理未能注入安装进程：{reason}。请把 HTTPS_PROXY 写进 ~/.dsh/.env 并重启 dsh web。',
        proxyUserLabel: '代理账号',
        proxyPassLabel: '代理密码',
        proxyUserPlaceholder: '可选',
        proxyPassPlaceholder: '留空 = 保持原密码',
        proxyCredentialHint: '账号密码按 HTTP Basic 认证发送，特殊字符自动编码；密码不回显，清空账号即取消认证。',
        testProxyBtn: '测试代理',
        testProxyNoFace: '宿主半区未就绪（远程方法不可用），请刷新页面或重启 dsh web',
        testProxyEmpty: '宿主无返回（RPC 被拒绝或超时），请刷新页面后重试',
        testProxyTesting: '测试中…',
        testProxyRunning: '测试中，已等待 {n}s；git 链路经代理通常需 10~25 秒，代理不通会自动回退直连兜底。',
        testProxyOk: '代理可用',
        testProxyFail: '代理不可用',
        testInstallOk: '安装链路（git）正常',
        testInstallFail: '安装链路（git）未通过：可能超时或 TLS 握手失败，代理本身仍可用',
        testInstallOkDirect: '安装链路（git）正常（经直连兜底：当前环境可能已用系统透明代理，无需叠加面板代理）',
        testProxyHint: '按当前输入框的值测试（不保存、不安装），只验证配置代理到 GitHub 的两条链路；npm 检查更新不走代理，不在此测试。',
        checkGithubApi: 'GitHub API',
        checkGitRemote: 'GitHub git 远程',
        gitDiag: 'git {version}{proxy}',
        gitDiagProxy: ' · 机器代理 {proxy}',
        checkViaDirect: '直连兜底',
        proxyVia: '代理 {host}',
        save: '保存',
        saving: '保存中…',
        saved: '已保存',
        saveFailed: '保存失败',
        installBtn: '安装',
        installing: '安装中…',
        localInstallLabel: '本地路径',
        localInstallPlaceholder: '/绝对路径/插件目录 或 .tgz',
        localInstallBtn: '安装',
        localInstalling: '安装中…',
        localInstallOk: '已安装 {name}，重启 dsh web 后生效',
        localInstallFail: '本地安装失败',
        localInstallWarn: '注意：{warning}',
        installDone: '已安装 {name}，刷新列表可见',
        installRestart: '已安装 {name}，重启后生效',
        installQueueBtn: '+ 安装插件',
        queueTitle: '安装队列',
        queuePlaceholder: 'npm 包名，可带 @版本；回车连续加入',
        queueAdd: '加入队列',
        queueHint: '加入后台队列后即可关掉本面板继续操作，安装串行进行。',
        iqTabNpm: 'npm 包',
        iqTabGithub: 'GitHub',
        queuePlaceholderGithub: 'GitHub 地址或 owner/repo，可带 #分支',
        queueHintGithub: '支持 owner/repo、github.com 链接与 github: 前缀；加入后台队列串行安装。',
        installMenuNpm: 'npm 包',
        installMenuGithub: 'GitHub 仓库',
        installMenuAria: '选择安装来源',
        queueEmpty: '队列为空',
        queueStatusQueued: '排队中',
        queueStatusRunning: '安装中',
        queueStatusDone: '已完成',
        queueStatusFailed: '失败',
        queueStatusCancelled: '已取消',
        iqCancel: '取消',
        queueRetry: '重试',
        queueRemove: '移除',
        queueClose: '关闭',
        queueCapsule: '⏳ 安装中 {i}/{n}',
        queueNoticeDone: '✅ {name} 安装完成（{version}）',
        queueNoticeRestart: '✅ {name} 已安装，需重启 dsh 后生效',
        queueNoticeFailed: '❌ {name} 安装失败：{error}',
        queueNeedBuilds: '该包需要批准构建脚本（approvedBuilds）；先在系统插件管理器里装一次以批准，再回来重试。',
        // ---- 详情视图（P3）----
        detailOpen: '查看详情',
        rowDetail: '详情',
        detailTitle: '插件详情',
        detailSectionBasic: '基本信息',
        detailSectionActions: '操作',
        detailVersion: '版本',
        detailState: '状态',
        detailRunning: '运行中',
        detailStopped: '未运行',
        detailSource: '来源',
        detailInstalledAt: '安装时间',
        detailUpdatedAt: '更新时间',
        detailVersionChanged: '版本变更',
        detailPath: '安装位置',
        detailDesc: '描述',
        detailNone: '—',
        detailCopyPath: '复制路径',
        detailLoading: '正在加载详情…',
        detailLoadFailed: '加载详情失败：{error}',
        detailRepo: '仓库',
        detailSectionRepoHint: '打开该插件的源码仓库',
        footerGithub: 'GitHub',
        footerIssues: '有任何问题或建议，欢迎提 Issue',
        detailActionUpdate: '更新到最新',
        detailActionEnable: '启用',
        detailActionDisable: '停用',
        detailActionIgnore: '忽略更新',
        detailActionRestore: '恢复更新',
        detailActionUninstall: '卸载',
        detailUninstallConfirm: '确认卸载（再点一次）',
        detailUninstallHint: '确认卸载 {name}？会从 profile 移除该插件，可随时重新安装。',
        detailUninstallOk: '✅ {name} 已卸载',
        detailOpFailed: '操作失败：{error}',
        detailRestartHint: '部分改动需重启 dsh 后完全生效',
        installGuideRestart: '已安装 {name}。插件包内容已更新，需重启 dsh web 后才能完全生效；重启前请勿依赖新功能。',
        installGuideApplied: '已安装 {name} 并已生效。若界面未自动更新，可点下方按钮刷新页面。',
        installGuideReload: '刷新页面',
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
        dialogSelfReload: '名单含「插件运维」自身：它只做队尾，且入队后队列封闭、不能再加入其它更新；更新本插件后面板会重新加载，请刷新页面。',
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
        opFailedGeneric: '操作失败，请重试',
        errUpdateFailed: '更新失败，请稍后重试',
        errNetwork: '网络连接失败，请检查网络或代理后重试',
        errNotFound: '找不到该版本，可能已被撤回',
        errBlocked: '该版本刚发布，暂不可安装，请稍后再试',
        errIncompatible: '该版本与当前 dsh 不兼容',
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
        restartBannerFull: '{n} 项变更需重启后生效（含不受热更新管理的插件，需整机重启 dsh）',
        restartSatisfied: '上次批量需重启的变更已随重启生效，无需再处理',
        restoreBtn: '恢复快照',
        restoring: '恢复中…',
        restoreDone: '快照已恢复，重启后生效',
        restoreFail: '恢复失败',
        lastBatchLine: '上次批量：{op} · {time}——批量前的配置备份，点「恢复快照」可撤销该次批量；若批量中途关闭页面，此记录可能未完成',
        autoDismissFoldShow: '▸ 其他',
        autoDismissFoldHide: '▾ 收起',
        autoDismissHint: '上次批量的通知已自动清除（宿主重启或超过 {hours} 小时）；如需撤销该次批量，可恢复批量前的配置快照',
        updateNone: '所选中没有可更新的插件（先检查更新）',
        rowUpdate: '更新',
        queueAdded: '已加入更新队列（第 {n} 项）',
        queueDuplicate: '该插件已在本轮更新队列中',
        queueCancel: '取消更新',
        queueCanceled: '已取消该项更新',
        queueSelfTail: '「插件运维」自身已排到队尾，队列封闭：本轮不再接受其它更新；它更新后面板会重新加载，请刷新页面',
        queueSealed: '本轮含「插件运维」自身的更新且已封队，请等本轮完成后再发起其它更新',
        queueProgress: '安装中 {done}/{total}',
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
        showInSettingsHint: '关闭时仅在「插件」面板的页签中显示。',
        showInSettingsSaved: '已保存',
        collapseGroupsByDefault: '进入时默认折叠分组',
        collapseGroupsByDefaultHint: '打开「插件运维」时自动折叠所有来源分组；改动在重新进入页面后生效。',
        collapseGroupsByDefaultSaved: '已保存',
        onlyUpdatableByDefault: '进入时默认勾选「只看可更新」',
        onlyUpdatableByDefaultHint: '打开「插件运维」时自动勾选「只看可更新」；改动在重新进入页面后生效。',
        onlyUpdatableByDefaultSaved: '已保存',
        checkOnEnter: '进入时默认检查更新',
        checkOnEnterHint: '打开「插件运维」时自动检查一次更新；距上次检查不足 {min} 分钟则跳过，避免反复请求。改动在重新进入页面后生效。',
        checkOnEnterSaved: '已保存',
        settingsReenterNote: '改动在重新进入页面后生效；「进入时默认检查更新」距上次不足 {min} 分钟会跳过。',
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
        // 忽略更新（双粒度）
        groupIgnored: '已忽略',
        ignoreBtn: '忽略',
        ignoreSelected: '忽略所选',
        restoreBtn: '恢复',
        restoreAll: '恢复全部',
        ignorePopTitle: '选择忽略粒度',
        ignoreVersion: '仅忽略此版本',
        ignoreVersionHint: '忽略本次检查到的新版本；远端出现不同版本时自动恢复提醒',
        ignorePlugin: '忽略此插件',
        ignorePluginHint: '不再提醒该插件更新，直到手动恢复',
        ignoreDisabledVersion: '需先检查更新',
        ignoreBatchHint: '其中 {n} 项暂无检查结果，选版本时会被跳过',
        badgeIgnoredVersion: '已忽略此版本',
        badgeIgnoredPlugin: '已忽略此插件',
        ignoredGroupStat: '按版本 {version} · 按插件 {plugin}',
        ignoreFailed: '忽略设置失败：{err}',
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
        checkConnHint: 'Connection errors fall into two cases: GitHub checks need the configured proxy to be reachable, while npm checks use a plain direct connection that ignores all proxy settings — a failure there usually means the local network or registry is unreachable. Badges keep showing the last successful check until you re-check.',
        checkedAt: 'Checked at {time}',
        installLabel: 'Install from GitHub',
        installHint: 'Accepts owner/repo, github:owner/repo#tag, full GitHub URLs (.git, /tree/tag) and git@ SSH; installs and update checks share the proxy setting below.',
        installNoResponse: 'Install request sent but the host has not returned yet; see the live log below',
        settingsTitle: 'Advanced settings',
        settingsBtn: 'Advanced',
        sectionProxy: 'Network proxy',
        sectionInstall: 'Install from GitHub',
        sectionLocal: 'Install from local',
        sectionDisplay: 'Display & interaction',
        collapseAllGroups: 'Collapse all groups',
        expandAllGroups: 'Expand all groups',
        viewGroup: 'Groups',
        viewList: 'List',
        viewGroupAria: 'Switch to group view',
        viewListAria: 'Switch to list view',
        sortName: 'By name',
        sortInstalled: 'By install time',
        sortUpdated: 'By update time',
        sortAsc: 'Ascending',
        sortDesc: 'Descending',
        sortAria: 'Sort by',
        dirAria: 'Toggle sort direction',
        relJustNow: 'just now',
        relMin: '{n} min ago',
        relHour: '{n} h ago',
        relDay: '{n} d ago',
        relMonth: '{n} mo ago',
        relYear: '{n} y ago',
        timeInstalled: 'Installed {time}',
        timeUpdated: 'Updated {time}',
        timeChanged: 'Version changed {time}',
        timeInstalledBadge: 'in {time}',
        timeUpdatedBadge: 'up {time}',
        timeUnknown: 'time unknown',
        dialogClose: 'Close',
        clearLedger: 'Clear',
        clearLedgerAria: 'Clear all messages',
        proxyLabel: 'HTTP proxy',
        proxyPlaceholder: '127.0.0.1:7890 (http:// is optional)',
        proxyHint: 'Empty = follow the system proxy. When set, only GitHub update checks and GitHub installs use it; npm update checks and dependency downloads stay direct. A missing scheme is added automatically. Enter credentials below.',
        proxyUnsupported: 'The proxy could not be injected into the install process: {reason}. Put HTTPS_PROXY in ~/.dsh/.env and restart dsh web.',
        proxyUserLabel: 'Proxy username',
        proxyPassLabel: 'Proxy password',
        proxyUserPlaceholder: 'Optional',
        proxyPassPlaceholder: 'Leave empty to keep current',
        proxyCredentialHint: 'Credentials are sent as HTTP Basic auth with automatic escaping; the password is never echoed. Clear the username to disable authentication.',
        testProxyBtn: 'Test proxy',
        testProxyNoFace: 'Host half is not ready (remote method unavailable). Refresh the page or restart dsh web.',
        testProxyEmpty: 'No response from host (RPC rejected or timed out). Refresh the page and retry.',
        testProxyTesting: 'Testing…',
        testProxyRunning: 'Testing, waited {n}s; the git path through a proxy usually takes 10–25s, and falls back to a direct connection if the proxy is unreachable.',
        testProxyOk: 'Proxy reachable',
        testProxyFail: 'Proxy unreachable',
        testInstallOk: 'Install path (git) OK',
        testInstallFail: 'Install path (git) failed: timeout or TLS handshake; the proxy itself still works',
        testInstallOkDirect: 'Install path (git) OK (via direct fallback: this environment likely already uses a system transparent proxy, so stacking the panel proxy is unnecessary)',
        testProxyHint: 'Tests the current input (nothing is saved or installed) against the two GitHub paths only: update checks and installs. npm update checks never use the proxy and are not tested here.',
        checkGithubApi: 'GitHub API',
        checkGitRemote: 'GitHub git remote',
        gitDiag: 'git {version}{proxy}',
        gitDiagProxy: ' · machine proxy {proxy}',
        checkViaDirect: 'via direct fallback',
        proxyVia: 'proxy {host}',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved',
        saveFailed: 'Save failed',
        installBtn: 'Install',
        installing: 'Installing…',
        localInstallLabel: 'Local path',
        localInstallPlaceholder: '/absolute/path/to/plugin or .tgz',
        localInstallBtn: 'Install',
        localInstalling: 'Installing…',
        localInstallOk: 'Installed {name}; restart dsh web to apply',
        localInstallFail: 'Local install failed',
        localInstallWarn: 'Note: {warning}',
        installDone: 'Installed {name}, refresh the list to see it',
        installRestart: 'Installed {name}, takes effect after restart',
        installQueueBtn: '+ Install plugin',
        queueTitle: 'Install queue',
        queuePlaceholder: 'npm package name, optional @version — Enter to add continuously',
        queueAdd: 'Add to queue',
        queueHint: 'Installs run serially in the background; you can close this panel and keep working.',
        iqTabNpm: 'npm package',
        iqTabGithub: 'GitHub',
        queuePlaceholderGithub: 'GitHub URL or owner/repo, optional #ref',
        queueHintGithub: 'Accepts owner/repo, github.com links, and the github: prefix; installs run serially.',
        installMenuNpm: 'npm package',
        installMenuGithub: 'GitHub repository',
        installMenuAria: 'Choose install source',
        queueEmpty: 'Queue is empty',
        queueStatusQueued: 'Queued',
        queueStatusRunning: 'Installing',
        queueStatusDone: 'Done',
        queueStatusFailed: 'Failed',
        queueStatusCancelled: 'Cancelled',
        iqCancel: 'Cancel',
        queueRetry: 'Retry',
        queueRemove: 'Remove',
        queueClose: 'Close',
        queueCapsule: '⏳ Installing {i}/{n}',
        queueNoticeDone: '✅ {name} installed ({version})',
        queueNoticeRestart: '✅ {name} installed — restart dsh to take effect',
        queueNoticeFailed: '❌ {name} install failed: {error}',
        queueNeedBuilds: 'This package requires build-script approval (approvedBuilds); install it once in the system plugin manager to approve, then retry here.',
        // ---- detail view (P3) ----
        detailOpen: 'View details',
        rowDetail: 'Details',
        detailTitle: 'Plugin details',
        detailSectionBasic: 'Basics',
        detailSectionActions: 'Actions',
        detailVersion: 'Version',
        detailState: 'State',
        detailRunning: 'Running',
        detailStopped: 'Stopped',
        detailSource: 'Source',
        detailInstalledAt: 'Installed',
        detailUpdatedAt: 'Updated',
        detailVersionChanged: 'Version changed',
        detailPath: 'Install path',
        detailDesc: 'Description',
        detailNone: '—',
        detailCopyPath: 'Copy path',
        detailLoading: 'Loading details…',
        detailLoadFailed: 'Failed to load details: {error}',
        detailRepo: 'Repository',
        detailSectionRepoHint: 'Open this plugin source repository',
        footerGithub: 'GitHub',
        footerIssues: 'Questions or ideas? Open an issue',
        detailActionUpdate: 'Update to latest',
        detailActionEnable: 'Enable',
        detailActionDisable: 'Disable',
        detailActionIgnore: 'Ignore updates',
        detailActionRestore: 'Resume updates',
        detailActionUninstall: 'Uninstall',
        detailUninstallConfirm: 'Confirm uninstall (click again)',
        detailUninstallHint: 'Uninstall {name}? This removes the plugin from the profile; you can reinstall anytime.',
        detailUninstallOk: '✅ {name} uninstalled',
        detailOpFailed: 'Action failed: {error}',
        detailRestartHint: 'Some changes need a dsh restart to take full effect',
        installGuideRestart: 'Installed {name}. The plugin package changed — restart dsh web for it to take full effect; do not rely on the new features before restarting.',
        installGuideApplied: 'Installed {name} and it is already active. If the UI did not update automatically, use the button below to reload the page.',
        installGuideReload: 'Reload page',
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
        dialogSelfReload: 'This list includes the Plugin Ops console itself: it is queued last, and once queued the round is sealed — no other updates can join. Updating it reloads the panel; please refresh afterwards.',
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
        opFailedGeneric: 'Operation failed, please retry',
        errUpdateFailed: 'Update failed, please try again later',
        errNetwork: 'Network error — check your network or proxy and retry',
        errNotFound: 'Version not found (it may have been unpublished)',
        errBlocked: 'This version was just published — please try again later',
        errIncompatible: 'This version is incompatible with the current dsh',
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
        restartBannerFull: '{n} change(s) take effect after restart (includes plugins outside hot-reload management — restart dsh entirely)',
        restartSatisfied: 'The changes from the last batch have taken effect after restart; nothing left to do',
        restoreBtn: 'Restore snapshot',
        restoring: 'Restoring…',
        restoreDone: 'Snapshot restored, takes effect after restart',
        restoreFail: 'Restore failed',
        lastBatchLine: 'Last batch: {op} · {time} — config backup taken before the batch; "Restore snapshot" undoes it. If the page was closed mid-run, this record may be incomplete',
        autoDismissFoldShow: '▸ Others',
        autoDismissFoldHide: '▾ Collapse',
        autoDismissHint: 'Notices from the last batch were cleared automatically (host restarted or older than {hours}h); to undo it, restore the pre-batch config snapshot',
        updateNone: 'No updatable plugin in selection (check updates first)',
        rowUpdate: 'Update',
        queueAdded: 'Added to update queue (item {n})',
        queueDuplicate: 'This plugin is already in the current update queue',
        queueCancel: 'Cancel update',
        queueCanceled: 'Removed from update queue',
        queueSelfTail: 'The Plugin Ops console itself is queued last and the queue is sealed — no other updates can join this round; the panel reloads after it updates, please refresh',
        queueSealed: 'This round includes the Plugin Ops console itself and is sealed; start other updates after it finishes',
        queueProgress: 'Installing {done}/{total}',
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
        showInSettingsHint: 'When off, the panel only appears as a tab under Plugins.',
        showInSettingsSaved: 'Saved',
        collapseGroupsByDefault: 'Collapse groups by default on entry',
        collapseGroupsByDefaultHint: 'When on, the "Plugin Ops" panel opens with all source groups collapsed; the change applies after re-entering the page.',
        collapseGroupsByDefaultSaved: 'Saved',
        onlyUpdatableByDefault: 'Check "Updatable only" by default on entry',
        onlyUpdatableByDefaultHint: 'When on, "Plugin Ops" opens with the "Updatable only" filter checked; applies after re-entering the page.',
        onlyUpdatableByDefaultSaved: 'Saved',
        checkOnEnter: 'Check for updates on entry',
        checkOnEnterHint: 'When on, "Plugin Ops" checks for updates once on entry; skipped if the last check was less than {min} minutes ago. Applies after re-entering the page.',
        checkOnEnterSaved: 'Saved',
        settingsReenterNote: 'Changes take effect after re-entering the page; the on-entry check is skipped if the last check was under {min} minutes ago.',
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
        // Ignore updates (two granularities)
        groupIgnored: 'Ignored',
        ignoreBtn: 'Ignore',
        ignoreSelected: 'Ignore selected',
        restoreBtn: 'Restore',
        restoreAll: 'Restore all',
        ignorePopTitle: 'Choose what to ignore',
        ignoreVersion: 'This version only',
        ignoreVersionHint: 'Ignore the newly detected version; a different version resumes alerts',
        ignorePlugin: 'This plugin',
        ignorePluginHint: 'Stop alerting updates for this plugin until you restore it',
        ignoreDisabledVersion: 'Run an update check first',
        ignoreBatchHint: '{n} selected items have no check result and will be skipped for this version',
        badgeIgnoredVersion: 'Version ignored',
        badgeIgnoredPlugin: 'Plugin ignored',
        ignoredGroupStat: 'By version {version} · By plugin {plugin}',
        ignoreFailed: 'Failed to update ignore list: {err}',
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
.dpk-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:nowrap;row-gap:6px;min-width:0;}
.dpk-tbgroup{display:flex;align-items:center;gap:8px;white-space:nowrap;}
/* 工具栏按钮按最长文案预留宽度：加载态文案「刷新中…」比「刷新」宽，若不定宽会把整组挤到下一行造成闪烁 */
.dpk-tbgroup .dpk-btn{min-width:5.8em;text-align:center;}
.dpk-tbgroup .dpk-btn.dpk-iconbtn{min-width:0;width:28px;height:28px;padding:0;justify-content:center;}
.dpk-btn.is-big{min-width:0;padding:5px 16px;font-size:12.5px;line-height:20px;border-radius:10px;}
.dpk-tbgroup .dpk-btn.is-big{min-width:0;}
.dpk-tile.is-img{background:var(--dsw-alias-bg-layer-2);overflow:hidden;}
.dpk-tile.is-img img{width:100%;height:100%;object-fit:cover;display:block;}
.dpk-iconbtn.is-busy svg{animation:dpk-spin .9s linear infinite;}
@keyframes dpk-spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){.dpk-iconbtn.is-busy svg{animation:none;}}
.dpk-summary{color:var(--dsw-alias-label-secondary);font-size:12px;min-width:0;flex-shrink:0;white-space:nowrap;}
.dpk-spacer{flex:1;}
.dpk-btn{border:1px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-sm,8px);padding:3px 11px;font:inherit;font-size:12px;line-height:20px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;transition:background-color .16s ease,border-color .16s ease,color .16s ease,transform .08s ease;}
.dpk-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3);}
.dpk-btn:active:not(:disabled){transform:translateY(.5px);}
.dpk-btn:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dpk-btn:disabled{opacity:.4;cursor:default;}
.dpk-btn:disabled:hover{background:0 0;border-color:var(--dsw-alias-border-l2);}
.dpk-btn.is-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}
.dpk-btn.is-primary:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-brand-primary);}
.dpk-btn.is-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}
.dpk-btn.is-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-state-error-primary);}
/* 行内「更新」按钮：绿色（成功主题色），与检查更新的品牌色区分，一眼识别「有更新可点」 */
.dpk-btn.is-success{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);}
.dpk-btn.is-success:hover{background:var(--dsw-alias-interactive-bg-hover);}
/* 弹框外层遮罩：全屏半透明底 + 弹性居中，拦截背景交互；点遮罩（自身）关闭。 */
.dpk-modalwrap{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--dsw-alias-bg-mask-1);animation:dpk-fade .12s ease-out;backdrop-filter:var(--dsw-mask-blur,none);}
@keyframes dpk-fade{from{opacity:0;}to{opacity:1;}}
@media (prefers-reduced-motion:reduce){.dpk-modalwrap{animation:none;}}
/* 弹框内容盒：不再自己 fixed 定位，由 wrap 居中；z-index/层叠交给 wrap。 */
.dpk-modal{position:relative;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,16px);padding:16px 18px;width:380px;max-width:calc(100vw - 48px);max-height:calc(100vh - 48px);overflow:auto;display:flex;flex-direction:column;gap:12px;box-shadow:var(--dsw-elevation-prominent);}
.dpk-mtitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}
.dpk-mlist{max-height:200px;overflow:auto;font-size:11px;color:var(--dsw-alias-label-secondary);line-height:22px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:6px 10px;background:var(--dsw-alias-bg-layer-2);border-radius:var(--dsw-radius-md,8px);}
.dpk-mfoot{display:flex;justify-content:flex-end;gap:8px;border-top:.5px solid var(--dsw-alias-border-l2);padding-top:12px;margin-top:2px;}
.dpk-btn.is-mini{padding:1px 9px;font-size:11px;line-height:18px;flex:none;}
.dpk-lastcheck{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
.dpk-check{font-size:10px;line-height:16px;padding:0 7px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l1);background:0 0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;max-width:200px;overflow:hidden;text-overflow:ellipsis;}
.dpk-check.is-latest{color:var(--dsw-alias-label-tertiary);}
.dpk-check.is-update{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);}
.dpk-check.is-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary);}
.dpk-check.is-err{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);}
.dpk-setbody{display:flex;flex-direction:column;gap:8px;padding-top:8px;}
/* 高级配置按功能分区：只加分隔线与间距，标题复用 dpk-gtitle，不引入新颜色/圆角 */
.dpk-setsec{display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2);}
.dpk-setsec:first-child{border-top:none;padding-top:0;}
.dpk-instprog{display:flex;flex-direction:column;gap:6px;}
.dpk-setrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
/* 代理操作行：输入框弹性收缩、按钮不换行，避免「测试」按钮文案变化时在行间跳动 */
.dpk-setrow.dpk-proxyacts{flex-wrap:nowrap;}
.dpk-setrow.dpk-proxyacts .dpk-input{min-width:0;flex:1 1 140px;}
.dpk-setrow.dpk-proxyacts .dpk-btn{flex:none;min-width:5.2em;}
.dpk-setlabel{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.dpk-input{background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-sm,8px);padding:4px 10px;font:inherit;font-size:12px;line-height:20px;min-width:280px;transition:border-color .16s ease,box-shadow .16s ease;}
.dpk-input:focus{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:0;}
.dpk-input::placeholder{color:var(--dsw-alias-label-caption);}
.dpk-hint{font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:18px;}
.dpk-setnote{font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary);padding-top:6px;}
.dpk-savedok{font-size:11px;color:var(--dsw-alias-state-success-primary);}
.dpk-savederr{font-size:11px;color:var(--dsw-alias-state-error-primary);}
.dpk-err{color:var(--dsw-alias-state-error-primary);font-size:12px;}
.dpk-banner{font-size:11px;color:var(--dsw-alias-state-warn-primary);line-height:18px;overflow-wrap:anywhere;}
.dpk-banner.is-ok{color:var(--dsw-alias-state-success-primary);}
/* 装完引导横幅：文字 + 手动刷新按钮纵向排列（不做自动整页刷新） */
.dpk-banner.is-guide{display:flex;flex-direction:column;align-items:flex-start;gap:6px;}
.dpk-group{display:flex;flex-direction:column;gap:4px;min-width:0;}
.dpk-ghead{display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;padding:5px 6px;margin:6px -4px 2px;border-radius:var(--dsw-radius-sm,8px);transition:background-color .12s ease;}
.dpk-ghead:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-ghead:hover .dpk-gtitle{color:var(--dsw-alias-brand-primary);}
/* 收纳三角：内联 SVG（字符 ▸/▾ 在 9px 下几乎不可见）。
   12×12 视窗 + 16×16 命中区，颜色提到 label-secondary（caption 太弱）。 */
.dpk-garrow{width:16px;height:16px;flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--dsw-radius-sm,4px);color:var(--dsw-alias-label-secondary);transition:color .12s,background .12s;}
.dpk-ghead:hover .dpk-garrow{color:var(--dsw-alias-brand-primary);}
.dpk-garrow:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-garrow svg{display:block;width:12px;height:12px;fill:currentColor;}
.dpk-garrow:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dpk-gtitle{font-size:15px;font-weight:700;color:var(--dsw-alias-label-primary);transition:color .12s;}
.dpk-gcount{font-size:12px;color:var(--dsw-alias-label-caption);margin-left:2px;}
.dpk-rows{border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,12px);overflow:hidden;}
.dpk-row{display:block;padding:10px 14px;min-width:0;transition:background-color .12s ease;}
.dpk-rowmain{display:flex;align-items:center;gap:10px;min-width:0;min-height:32px;}
.dpk-rowdesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:81px;margin-top:3px;} /* 81=cb14+gap10+tile32+gap10+dot5+gap10，与 .dpk-name 左缘对齐 */
.dpk-onlyup{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;}
.dpk-onlyup input{accent-color:var(--dsw-alias-brand-primary);margin:0;width:13px;height:13px;}
/* 搜索框 + 只看可更新：同一组筛选控件 */
.dpk-filters{display:flex;align-items:center;gap:10px;flex-wrap:nowrap;min-width:110px;flex:0 1 auto;}
.dpk-search{position:relative;display:inline-flex;align-items:center;min-width:0;flex:0 1 240px;}
.dpk-searchicon{position:absolute;left:7px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-caption);pointer-events:none;}
.dpk-searchicon svg{display:block;width:12px;height:12px;}
.dpk-searchinput{background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-sm,8px);padding:3px 24px 3px 23px;font:inherit;font-size:12px;line-height:20px;width:100%;min-width:0;max-width:340px;transition:border-color .16s ease,box-shadow .16s ease;}
.dpk-searchinput:focus{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:0;}
.dpk-searchinput::placeholder{color:var(--dsw-alias-label-caption);}
.dpk-searchclear{position:absolute;right:3px;width:17px;height:17px;border:none;border-radius:var(--dsw-radius-sm,4px);padding:0;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:13px;line-height:17px;display:inline-flex;align-items:center;justify-content:center;}
.dpk-searchclear:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);}
.dpk-searchclear:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dpk-searchcount{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
/* 命中文本高亮：黄色底（不用主题色 —— 搜索命中一律黄底），文字颜色保持原样，
   这样明暗主题下都读得清（黄字在白底上会糊）。 */
.dpk-hit{background:rgba(255,213,79,.42);color:inherit;border-radius:3px;padding:0 1px;font-weight:600;}
.dpk-row + .dpk-row{border-top:.5px solid var(--dsw-alias-border-l2);}
.dpk-row:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-row.is-clickable{cursor:pointer;}
.dpk-row.is-official{opacity:.72;}
.dpk-row.is-selected{background:var(--dsw-alias-bg-layer-2);}
.dpk-cb{accent-color:var(--dsw-alias-brand-primary);margin:0;flex:none;width:14px;height:14px;cursor:pointer;}
.dpk-cb:disabled{cursor:default;opacity:.35;}
.dpk-dot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-label-caption);flex:none;}
.dpk-dot.on{background:var(--dsw-alias-state-success-primary);}
.dpk-name{font-family:${MONO};font-size:13px;font-weight:600;white-space:nowrap;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;}
.dpk-ver{font-family:${MONO};font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;max-width:16ch;overflow:hidden;text-overflow:ellipsis;}
.dpk-badge{font-size:10px;line-height:16px;padding:0 7px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l1);background:0 0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;}
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
/* 视图切换 + 排序控件（P1 双视图）：常驻工具行，右对齐；批量运行中仍可切视图/排序 */
.dpk-subbar{display:flex;align-items:center;gap:12px;margin-bottom:8px;min-width:0;}
.dpk-subbar .dpk-hint{margin:0;flex:1 1 auto;min-width:0;}
.dpk-subbar .dpk-banner{margin:0;flex:1 1 auto;min-width:0;}
.dpk-subbar .dpk-summary{margin:0;flex:1 1 auto;min-width:0;}
.dpk-viewbar{display:flex;align-items:center;gap:8px;margin-left:auto;justify-content:flex-end;flex-shrink:0;}
.dpk-viewtoggle{display:inline-flex;gap:2px;border:none;background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;padding:2px;}
.dpk-viewtoggle .dpk-btn{border:0;border-radius:999px;background:transparent;min-width:0;padding:1px 10px;}
.dpk-viewtoggle .dpk-btn + .dpk-btn{border-left:0;}
.dpk-viewtoggle .dpk-btn.is-active{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-weight:600;box-shadow:var(--dsw-elevation-soft,0 1px 3px rgba(0,0,0,.14));}
.dpk-sortsel{border:1px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-sm,8px);padding:1px 6px;font:inherit;font-size:11px;line-height:18px;cursor:pointer;}
.dpk-sortsel:hover{background:var(--dsw-alias-interactive-bg-hover);}
/* 行首图标 tile：对齐官方插件列表（首字母圆角方块），色相由名字哈希稳定映射；
   半透明底 + 亮字，明暗主题都成立 */
.dpk-tile{width:32px;height:32px;border-radius:var(--dsw-radius-md,10px);flex:none;display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;font-family:${MONO};user-select:none;}
/* 行内时间徽标：弱化小字；更新=主题蓝，版本变更=警示黄，安装=三级灰 */
.dpk-rowtime{font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary);flex:none;white-space:nowrap;}
.dpk-rowtime.is-upd{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));}
.dpk-rowtime.is-chg{color:var(--dsw-alias-state-warn-primary);}
/* 后台安装队列（P2）：进度胶囊 / 面板列表 / 页内 notice */
.dpk-queuecapsule{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));white-space:nowrap;}
.dpk-queuelist{display:flex;flex-direction:column;gap:6px;max-height:min(40vh,360px);overflow:auto;}
.dpk-queuerow{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,10px);}
.dpk-queuemain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
.dpk-queuename{font-size:12px;line-height:18px;overflow-wrap:anywhere;}
.dpk-queuebadge{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.dpk-queuebadge.is-done{color:var(--dsw-alias-state-success-primary);}
.dpk-queuebadge.is-failed{color:var(--dsw-alias-state-error-primary);}
.dpk-queuebadge.is-running{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));}
.dpk-queuever{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
.dpk-queueerr{font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;}
.dpk-queueops{display:flex;gap:6px;flex:none;flex-wrap:wrap;justify-content:flex-end;}
.dpk-queuenotice{display:flex;align-items:center;justify-content:space-between;gap:8px;}

/* 安装分体按钮（对齐官方「添加插件」）+ 弹框类型 tabs */
.dpk-splitbtn{display:inline-flex;align-items:stretch;}
.dpk-splitbtn .dpk-splitmain{border-top-right-radius:0;border-bottom-right-radius:0;}
.dpk-splitbtn .dpk-splitcaret{border-top-left-radius:0;border-bottom-left-radius:0;padding-left:9px;padding-right:9px;display:inline-flex;align-items:center;justify-content:center;box-shadow:inset 1px 0 0 rgba(255,255,255,.28);}
.dpk-queuetabs{display:inline-flex;align-self:flex-start;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l3));border-radius:var(--dsw-radius-md,8px);overflow:hidden;}
.dpk-queuetab{border:0;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:20px;padding:4px 16px;cursor:pointer;}
.dpk-queuetab+.dpk-queuetab{border-left:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l3));}
.dpk-queuetab.is-active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary);font-weight:600;}
/* 安装弹框输入行：输入框撑满行宽（右侧不留空） */
.dpk-setrow.dpk-iqrow .dpk-input{min-width:0;flex:1 1 280px;}

/* ---------- 详情视图（P3）：基本信息表 + 设置项控件 + 操作区 ---------- */
/* 设置项两列网格：JSON/密钥等长控件占整行 */
/* 布尔字段：自绘开关（贴宿主开关形态：胶囊 + 滑块） */
.dpk-dhead{display:flex;align-items:center;gap:8px;min-width:0;}
.dpk-dname{font-family:${MONO};font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dpk-dfacts{display:flex;flex-direction:column;gap:4px;}
.dpk-fact{display:flex;align-items:baseline;gap:10px;min-width:0;font-size:12px;line-height:18px;}
.dpk-factlabel{flex:0 0 5.5em;color:var(--dsw-alias-label-tertiary);font-size:11px;}
.dpk-factvalue{color:var(--dsw-alias-label-secondary);min-width:0;overflow-wrap:anywhere;}
.dpk-factdesc{color:var(--dsw-alias-label-secondary);}
.dpk-path{font-family:${MONO};font-size:11px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;}
.dpk-detailacts{display:flex;gap:8px;flex-wrap:wrap;}
.dpk-link{color:var(--dsw-alias-state-business-primary);text-decoration:none;overflow-wrap:anywhere;}
.dpk-link:hover{text-decoration:underline;text-underline-offset:2px;}
.dpk-link:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:1px;border-radius:var(--dsw-radius-sm,4px);}
.dpk-dnoform{display:flex;flex-direction:column;align-items:flex-start;gap:8px;}
.dpk-footer{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:20px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;}
.dpk-footdot{opacity:.6;}
.dpk-footitem{font-variant-numeric:tabular-nums;}
.dpk-name.is-link{cursor:pointer;}
.dpk-name.is-link:hover{color:var(--dsw-alias-brand-primary);text-decoration:underline;text-underline-offset:2px;}
.dpk-name.is-link:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:1px;border-radius:var(--dsw-radius-sm,4px);}

/* 批量进度文字：主题蓝（business 主题色） + 呼吸动效（原为弱化 hint 色，不显眼） */
.dpk-progress{font-size:12px;line-height:18px;font-weight:600;color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));display:inline-flex;align-items:center;gap:6px;animation:dpk-pulse 1.3s ease-in-out infinite;}
.dpk-progress::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));flex:none;animation:dpk-dot 1.1s ease-in-out infinite;}
@keyframes dpk-pulse{0%,100%{opacity:1;}50%{opacity:.45;}}
@keyframes dpk-dot{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(.5);opacity:.4;}}
@media (prefers-reduced-motion:reduce){.dpk-progress,.dpk-progress::before{animation:none;}}
.dpk-selhint{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;margin-right:2px;}
.dpk-ledger{display:flex;flex-direction:column;gap:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);padding:8px 12px;}
.dpk-ledrow{display:flex;align-items:center;gap:8px;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);}
.dpk-ledrow .dpk-name{font-size:11px;}
.dpk-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;}
/* 主题化悬浮提示浮层（body 直挂单例，替代不随主题的原生 title） */
.dpk-tip{position:fixed;z-index:10000;max-width:400px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font-size:11px;line-height:18px;padding:4px 10px;border-radius:var(--dsw-radius-sm,8px);box-shadow:var(--dsw-elevation-soft,var(--dsw-elevation-prominent));pointer-events:none;display:none;white-space:pre-wrap;overflow-wrap:anywhere;}
/* 忽略粒度气泡：可点选项，对齐宿主菜单三层表面（backing→material→menu），根不写背景 */
.dpk-ignorepop{position:fixed;z-index:90;min-width:220px;max-width:min(360px,calc(100vw - 16px));border-radius:var(--dsw-radius-lg,16px);box-shadow:var(--dsw-elevation-prominent);isolation:isolate;overflow:hidden;}
.dpk-ignorepop-layer{position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;}
.dpk-ignorepop-backing{background:transparent;}
html[data-platform='darwin'] .dpk-ignorepop-backing{background:var(--dsw-alias-bg-base);}
.dpk-ignorepop-material{background:var(--dsw-menu-surface-fill,var(--dsw-alias-bg-layer-2,Canvas));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(40px) saturate(150%));}
.dpk-ignorepop-list{position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:0;padding:4px;max-height:min(420px,calc(100vh - 16px));overflow:auto;--dsw-elevation-stroke-color:var(--dsw-alias-border-l3);}
.dpk-ignorepop-title{font-size:11px;line-height:18px;color:var(--dsw-alias-label-tertiary);padding:4px 8px;}
.dpk-ignorepop-item{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:34px;padding:6px 8px;border:0;border-radius:var(--dsw-radius-md,8px);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer;}
.dpk-ignorepop-item:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-ignorepop-item:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:-1px;}
.dpk-ignorepop-item:disabled{opacity:.4;cursor:default;}
.dpk-ignorepop-item:disabled:hover{background:0 0;}
.dpk-ignorepop-item small{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);}
.dpk-check.is-ignored{color:var(--dsw-alias-label-tertiary);border-color:var(--dsw-alias-border-l1);}
/* 显示位置开关（与「只看可更新」同一形态） */
.dpk-switch{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;}
.dpk-switch input{accent-color:var(--dsw-alias-brand-primary);margin:0;width:13px;height:13px;}
/* 导出弹框：比确认框宽（要列清单） */
.dpk-modal.is-wide{width:520px;}
.dpk-modal.is-detail{width:720px;box-sizing:border-box;max-height:min(78vh,760px);overflow:auto;}
/* 设置项较多：限制高度并让内容滚动，其余外观完全沿用 dpk-modal */
.dpk-modal.is-settings{max-height:min(80vh,720px);overflow:auto;}
.dpk-cfglist{display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto;}
.dpk-cfgrow{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-layer-2);}
.dpk-cfgrow.is-suspicious{border-color:var(--dsw-alias-state-warn-primary);}
.dpk-cfgnames{min-width:0;flex:1;}
.dpk-cfgrel{font-family:${MONO};font-size:11px;line-height:16px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;}
.dpk-cfgtag{font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);}
.dpk-cfgtag.is-warn{color:var(--dsw-alias-state-warn-primary);}
.dpk-cfgtag.is-maybe{color:var(--dsw-alias-state-warn-primary);}
.dpk-cb.is-warn{accent-color:var(--dsw-alias-state-warn-primary);}
.dpk-cmdrow{display:flex;align-items:center;gap:8px;font-family:${MONO};font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:var(--dsw-radius-md,8px);padding:4px 8px;overflow-wrap:anywhere;}
/* 冲突策略下拉（导入弹框） */
.dpk-select{background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-sm,8px);padding:3px 6px;font:inherit;font-size:11px;line-height:18px;flex:none;max-width:150px;transition:border-color .16s ease;}
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
    // 进入时自动检查的节流窗口：距上次成功检查不足该时长就跳过，避免反复进页面打网络。
    // 具名常量便于按实际网络情况调整；不是用户配置项，故不占设置开关。
    const AUTO_CHECK_MIN_MS = 30 * 60 * 1000;
    // 一次页面会话里「进入时自动检查」最多判定一轮；两个挂载点共享去重，刷新页面即重置。
    const autoCheckStore = { done: false };
    // 底部台账/横幅的自动清除账龄：批量快照产生超过该时长，进页面时不再恢复展示。
    // 具名常量便于调整；不是用户配置项，故不占设置开关（同 AUTO_CHECK_MIN_MS 约定）。
    const NOTIFY_TTL_MS = 12 * 60 * 60 * 1000;
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
          ignored: data.ignored ?? {},
          generatedAt: data.generatedAt ?? new Date().toISOString(),
        };
        window.localStorage?.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch {
        // 配额满 / 隐私模式：缓存失败不影响主流程
      }
    }

    // 台账「清空」的持久化标记：记住被清空的 lastBatch id（localStorage）。
    // 宿主 lastBatch 是唯一真值、清空动作不改它，所以要用这份浏览器侧标记跨刷新/重开
    // 屏蔽同一条历史台账，避免「清空了下次又自动弹回来」。
    const DISMISSED_BATCH_KEY = 'dsh-plugin-keeper:dismissedBatch:v1';
    function loadDismissedBatchId() {
      try { return window.localStorage?.getItem(DISMISSED_BATCH_KEY) || null; } catch { return null; }
    }
    function saveDismissedBatchId(id) {
      try {
        if (id) window.localStorage?.setItem(DISMISSED_BATCH_KEY, String(id));
        else window.localStorage?.removeItem(DISMISSED_BATCH_KEY);
      } catch { /* 隐私模式等：忽略 */ }
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
    // 独立计时组件：每秒只重渲染自己，避免整块设置面板跟着重排/跳动。
    // 按钮文案保持固定宽度，计时只出现在说明行里（不新增/删除 DOM 行）。
    function TestTimer() {
      const [n, setN] = React.useState(0);
      React.useEffect(() => {
        let cancelled = false;
        const started = Date.now();
        const tick = () => {
          if (cancelled) return;
          const elapsed = Math.floor((Date.now() - started) / 1000);
          setN(elapsed);
          if (elapsed >= 60) return; // 兜底：任何情况下都不无限挂定时器
          setTimeout(tick, 1000);
        };
        tick();
        return () => { cancelled = true; };
      }, []);
      return h('span', null, t('testProxyRunning', { n }));
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
    // 本会话最近一次「实时」快照。页签切换会重挂载组件，用它初始化可在重进时保持行结构与
    // 刚离开时完全一致，避免退回 localStorage 缓存（缺 hostBootAt、带 fromCache）导致
    // 台账/折叠入口/「来自缓存」提示行先隐后现的内容闪动。
    let lastFreshSnapshot = null;
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

    // ---------- 可追加串行「更新」队列（模块级，单消费者） ----------
    // 单条点「更新」不再触发全局锁：点一个立即入队、按点击顺序依次执行，运行中仍可
    // 点其它行追加到队尾（while 循环每轮重新读取 pending，追加项会被接着执行）。
    // 模块级 → 切页签 / 组件重挂载不丢失；执行循环持有 store 引用，组件卸载后仍推进。
    // SELF 规则：点了自身 → 自身只做队尾并「封队」，之后其它项一律拒绝入队。
    // 自身更新会卸载本插件 client bundle 与 host service，剩余队列项是纯内存、无人
    // 执行；封队从根上杜绝这种静默丢失（用户 m00873 拍板）。
    const updateQueue = {
      pending: [],      // 待执行 {name, spec}
      running: false,   // 单消费者守卫（跨两个挂载点共享）
      sealed: false,    // 已入队自身 → 拒绝后续入队
      seen: new Set(),  // 本轮已入队过的 name（追加时去重）
      results: [],      // 本轮累计结果台账
      totalQueued: 0,   // 本轮累计入队数（进度分母，追加时增长）
      snapshotId: null, // 本轮共享的 prepareBatch 快照 id
    };
    function resetUpdateQueue() {
      updateQueue.pending = [];
      updateQueue.running = false;
      updateQueue.sealed = false;
      updateQueue.seen = new Set();
      updateQueue.results = [];
      updateQueue.totalQueued = 0;
      updateQueue.snapshotId = null;
    }
    function countResults(results) {
      const counts = { ok: 0, restart: 0, fail: 0, skip: 0 };
      for (const r of results) {
        if (r.status === 'ok') counts.ok += 1;
        else if (r.status === 'restart') counts.restart += 1;
        else if (r.status === 'failed') counts.fail += 1;
        else counts.skip += 1;
      }
      return counts;
    }
    // 纯函数：把一批候选折算成可入队项 —— 去重、自身只做队尾、判定封队。
    // 不改状态，便于独立验证（见 .temp/dsh-plugin-keeper/test-update-queue.cjs）。
    function planUpdateEnqueue(candidates, seen) {
      const items = [];
      const nextSeen = new Set(seen);
      let selfItem = null;
      for (const c of candidates) {
        if (!c || c.official || !c.spec || nextSeen.has(c.name)) continue;
        nextSeen.add(c.name);
        if (c.name === SELF) selfItem = { name: c.name, spec: c.spec };
        else items.push({ name: c.name, spec: c.spec });
      }
      if (selfItem) items.push(selfItem); // 自身只做队尾
      return { items, seen: nextSeen, sealed: Boolean(selfItem) };
    }
    // 执行单个更新项：原地升级（pnpm add 包@版本，不卸载、不碰 bundles）。
    // 失败码 → 用户可读中文（绝不回显内部错误码 / pnpm 原文）
    function friendlyErrorCode(code) {
      switch (String(code || '').toLowerCase()) {
        case 'network':
        case 'timeout': return t('errNetwork');
        case 'not-found':
        case 'no-matching-version': return t('errNotFound');
        case 'blocked':
        case 'minimum-release-age': return t('errBlocked');
        case 'incompatible':
        case 'incompatible-version': return t('errIncompatible');
        default: return t('errUpdateFailed');
      }
    }

    async function runOneUpdate(name, spec) {
      if (!spec) return { name, op: 'update', status: 'failed', note: t('opNoTarget') };
      // 原地升级：host 半 pnpm add 包@版本（不卸载，失败自动回滚+重试）；用户只看到最终成败
      const r = await callUpdateInPlace(name, spec);
      if (r?.ok) return { name, op: 'update', status: 'restart', note: '' };
      return { name, op: 'update', status: 'failed', note: friendlyErrorCode(r?.code) };
    }

    // typert face 的返回值可能是 {ok,value} 信封，也可能是裸值（取决于 result codec）。
    // 统一拆一次：成功取 value，失败/异常取 null。
    function unwrapEnvelope(r) {
      if (r && typeof r === 'object' && 'ok' in r && 'value' in r) return r.ok ? r.value : null;
      return r ?? null;
    }

    // 远端调用失败时官方 face 通常返回 {ok:false,error} 信封（不是抛异常）。
    // 需要区分成败的场合用这个严格版：失败直接抛出带 code 的错误。
    function unwrapEnvelopeStrict(r) {
      if (r && typeof r === 'object' && 'ok' in r) {
        if (!r.ok) {
          const err = r.error != null ? r.error : {};
          const msg = typeof err === 'string' ? err : (err.message || err.code || 'unknown');
          const e = new Error(String(msg));
          e.code = (err && err.code) || 'unknown';
          throw e;
        }
        return 'value' in r ? r.value : r;
      }
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

    // 设置 / 恢复忽略更新清单：host 返回 GC 后的全量映射，前端直接覆盖本地快照
    async function callSetIgnoredUpdates(payload) {
      try {
        const v = unwrapEnvelope(await rpcFace?.setIgnoredUpdates?.(payload));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }

    // 后台安装队列（P2）：宿主半内存串行 worker，面板关了也在跑
    async function callInstallEnqueue(name) {
      try {
        const v = unwrapEnvelope(await rpcFace?.installEnqueue?.({ name }));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }
    async function callInstallQueueState() {
      try {
        const v = unwrapEnvelope(await rpcFace?.installQueueState?.({}));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }
    async function callInstallQueueCancel(id) {
      try {
        const v = unwrapEnvelope(await rpcFace?.installQueueCancel?.({ id }));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }
    async function callInstallQueueRemove(id) {
      try {
        const v = unwrapEnvelope(await rpcFace?.installQueueRemove?.({ id }));
        return v ?? { ok: false, error: 'no response' };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    }
    async function callInstallQueueRetry(id) {
      try {
        const v = unwrapEnvelope(await rpcFace?.installQueueRetry?.({ id }));
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

    // 原地升级（不卸载）：host 半 spawn pnpm add 包@版本，失败自动回滚并重试一次
    async function callUpdateInPlace(name, spec) {
      try {
        const v = unwrapEnvelope(await rpcFace?.updateBundleInPlace?.({ name, spec }));
        return v ?? { ok: false, code: 'unknown' };
      } catch (e) {
        return { ok: false, code: 'unknown' };
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
          return { status: 'failed', note: t('opFailedGeneric') };
        default: return { status: 'failed', note: t('opFailedGeneric') };
      }
    }

    // 「需重启」提示的语义化与去重：
    // - 若批次里 restart 的原因是无法热更的插件（unmanaged-plugin / host-module / package-moved），
    //   明确告知需「整机重启」而不是简单刷新；
    // - 若宿主进程在批次之后已经重启（snap.hostBootAt > batch.at），说明重启已被满足，
    //   不再重复弹这条提示（解决「明明重启了还提示需重启」）。
    function restartBannerFor(results, n) {
      const reasons = new Set((Array.isArray(results) ? results : [])
        .filter((r) => r && r.status === 'restart').map((r) => r.note || ''));
      const needsFull = ['unmanaged-plugin', 'host-module', 'package-moved'].some((x) => reasons.has(x));
      return { text: t(needsFull ? 'restartBannerFull' : 'restartBanner', { n }), ok: false };
    }
    function isBatchRestartSatisfied(lb, snap) {
      const boot = snap?.hostBootAt;
      const at = lb?.at ? Date.parse(lb.at) : NaN;
      if (typeof boot !== 'number' || !Number.isFinite(boot) || !Number.isFinite(at)) return false;
      return boot > at;
    }
    // 底部通知自动清除判定：宿主进程在该批次之后重启过，或批次产生已超过 NOTIFY_TTL_MS。
    // 只读落盘锚点、不改宿主数据；命中则在会话恢复时跳过台账/横幅，仅保留折叠的恢复入口。
    function shouldAutoDismissBatch(lb, snap) {
      const at = lb?.at ? Date.parse(lb.at) : NaN;
      if (!Number.isFinite(at) || at <= 0) return false;
      const boot = snap?.hostBootAt;
      const restarted = typeof boot === 'number' && Number.isFinite(boot) && boot > at;
      const aged = Date.now() - at > NOTIFY_TTL_MS;
      return restarted || aged;
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
      // 已忽略：不再显示绿色「可更新」，改成中性徽标说明按哪种粒度忽略
      if (entry?.ignored?.mode) {
        const byPlugin = entry.ignored.mode === 'plugin';
        return h('span', {
          className: 'dpk-check is-ignored',
          ...checkTip(byPlugin ? t('ignorePluginHint') : t('ignoreVersionHint')),
        }, byPlugin ? t('badgeIgnoredPlugin') : t('badgeIgnoredVersion'));
      }
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
      // 忽略清单优先：被忽略的插件统一进末尾的「已忽略」组，不再混在来源组里
      if (entry.ignored?.mode) return 'ignored';
      if (entry.official) return 'official';
      const k = entry.source?.kind;
      if (k === 'github') return 'github';
      if (k === 'local') return 'local';
      if (k === 'npm') return 'npm';
      return 'unknown';
    }
    const GROUP_ORDER = ['official', 'npm', 'github', 'local', 'unknown', 'ignored'];
    // 可检查更新的分组（官方随 dsh 分发、本地为源码目录，都无远端版本锚点）
    const CHECKABLE_GROUPS = ['npm', 'github'];
    const GROUP_TITLE_KEY = {
      official: 'groupOfficial',
      npm: 'groupNpm',
      github: 'groupGithub',
      local: 'groupLocal',
      unknown: 'groupUnknown',
      ignored: 'groupIgnored',
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

    // 相对时间（时间台账 → 排序与行内徽标）。非法/未来时间返回空串（徽标不显示）。
    function relTimeOf(iso) {
      const ts = new Date(iso).getTime();
      if (!Number.isFinite(ts)) return '';
      const ms = Date.now() - ts;
      if (ms < 0) return '';
      const min = Math.floor(ms / 60000);
      if (min < 1) return t('relJustNow');
      if (min < 60) return t('relMin', { n: min });
      const hr = Math.floor(min / 60);
      if (hr < 24) return t('relHour', { n: hr });
      const day = Math.floor(hr / 24);
      if (day < 30) return t('relDay', { n: day });
      const mo = Math.floor(day / 30);
      if (mo < 12) return t('relMonth', { n: mo });
      return t('relYear', { n: Math.floor(mo / 12) });
    }

    // 行内时间徽标：优先「更新」，其次「版本变更」，再次「安装」；都没有则不显示。
    function timeBadgeOf(entry) {
      const times = entry?.times;
      if (!times) return null;
      const updated = times.updatedAt ? relTimeOf(times.updatedAt) : '';
      if (updated) return h('span', { className: 'dpk-rowtime is-upd', 'data-tip': t('timeUpdated', { time: new Date(times.updatedAt).toLocaleString() }) }, t('timeUpdatedBadge', { time: updated }));
      const changed = times.versionChangedAt ? relTimeOf(times.versionChangedAt) : '';
      if (changed) return h('span', { className: 'dpk-rowtime is-chg', 'data-tip': t('timeChanged', { time: new Date(times.versionChangedAt).toLocaleString() }) }, t('timeUpdatedBadge', { time: changed }));
      const installed = times.installedAt ? relTimeOf(times.installedAt) : '';
      if (installed) return h('span', { className: 'dpk-rowtime', 'data-tip': t('timeInstalled', { time: new Date(times.installedAt).toLocaleString() }) }, t('timeInstalledBadge', { time: installed }));
      return null;
    }

const KEEPER_REPO = 'https://github.com/HelloQingTao/dsh-plugin-keeper';
const KEEPER_ISSUES = `${KEEPER_REPO}/issues`;

/** 仓库地址展示成 host/owner/repo 形式（省掉协议与 .git 尾巴）。 */
function repoLabelOf(url) {
  const text = String(url ?? '');
  const m = /^https?:\/\/(?:www\.)?(.+)$/.exec(text);
  return (m ? m[1] : text).replace(/\/$/, '');
}

function countChecks(plugins, kinds) {
      let update = 0;
      let latest = 0;
      let error = 0;
      for (const p of plugins ?? []) {
        if (p.ignored?.mode) continue;
        if (kinds && !kinds.includes(p.source?.kind)) continue;
        const st = p.check?.status;
        if (st === 'update') update += 1;
        else if (st === 'latest') latest += 1;
        else if (st === 'error') error += 1;
      }
      return { update, latest, error };
    }

    // 批量更新目标 spec：npm → name@latest；github → github:repo#tag（已是最新则无目标）
    function updateSpecOf(entry) {
      // 忽略更新：行内按钮 / 批量 / 计数 / 只看可更新 / 确认弹框统一从这里收口
      if (entry?.ignored?.mode) return null;
      // 自身允许更新，但必须排最后（runBatch / 确认弹框都按 SELF 排序），
      // 否则中途卸载本插件会让后续批量行没人执行。重载提示由确认弹框给出。
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
    const CHECK_LABEL_KEY = { githubApi: 'checkGithubApi', gitRemote: 'checkGitRemote' };

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

    // 刷新（循环箭头，描边 SVG；加载中由 .is-busy 加旋转动画）
    const REFRESH_ICON = h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': true },
      h('path', {
        d: 'M13.1 8a5.1 5.1 0 1 1-1.5-3.6M13.1 2.6v2.6h-2.6',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
    );

    // 下拉 caret（分体安装按钮右段；点击弹出来源菜单）
    const CARET_ICON = h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true },
      h('path', {
        d: 'M4 6l4 4 4-4',
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
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

    // 从仓库地址提取 GitHub owner（用于 https://github.com/<owner>.png 头像，免 API）
    function githubOwnerOf(url) {
      const m = /github\.com\/([A-Za-z0-9-]{1,39})/i.exec(String(url || ''));
      return m ? m[1] : '';
    }

    // 头像缓存：owner → { d:dataUrl, u:CDN 直链, t:成功时间, nf:最近失败时间 }，localStorage 持久化。
    // 取图路径：缓存 dataUrl/CDN 直链（7 天内零网络请求）→ 直链过期走 api.github.com 解析
    // （GET 直连可用、带 CORS 头）→ avatars.githubusercontent.com 走 CORS fetch 收进 dataUrl；
    // 任一步失败只记负缓存（1 天内不再打网络），当次会话回退 <img> 直连渲染。
    const AVATAR_KEY = 'dpk.' + 'avatarCache.v1';
    const AVATAR_TTL = 7 * 864e5;
    const AVATAR_NEG_TTL = 864e5;
    const AVATAR_MAX = 100;
    let avatarCache = null; // Map owner → rec
    function avatarCacheMap() {
      if (avatarCache) return avatarCache;
      avatarCache = new Map();
      try {
        const raw = localStorage.getItem(AVATAR_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          for (const [owner, rec] of Object.entries(obj || {})) {
            if (rec && typeof rec === 'object') avatarCache.set(owner, rec);
          }
        }
      } catch { /* 坏缓存按空处理 */ }
      return avatarCache;
    }
    function avatarCacheSave() {
      try {
        const entries = [...avatarCache.entries()]
          .sort((a, b) => (a[1].t || a[1].nf || 0) - (b[1].t || b[1].nf || 0)).slice(-AVATAR_MAX);
        avatarCache = new Map(entries);
        localStorage.setItem(AVATAR_KEY, JSON.stringify(Object.fromEntries(entries)));
      } catch { /* 写失败（隐私模式/超限）只用内存态 */ }
    }
    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('read fail'));
      fr.readAsDataURL(blob);
    });
    // 有缓存就用（含过期旧图——先用着，刷新在后台做），没有返回 ''
    function avatarCachedSrcOf(owner) {
      if (!owner) return '';
      const rec = avatarCacheMap().get(owner);
      return rec && (rec.d || rec.u) ? (rec.d || rec.u) : '';
    }
    const avatarResolving = new Set(); // 同一会话同一 owner 只跑一次后台解析
    async function resolveAvatar(owner) {
      if (!owner || avatarResolving.has(owner)) return;
      const rec = avatarCacheMap().get(owner);
      if (rec && rec.d && Date.now() - rec.t < AVATAR_TTL) return; // 新鲜，不打网络
      if (!rec?.d && !rec?.u && rec?.nf && Date.now() - rec.nf < AVATAR_NEG_TTL) return; // 近期失败
      avatarResolving.add(owner);
      try {
        let cdnUrl = rec?.u || '';
        if (!cdnUrl || !rec?.t || Date.now() - rec.t >= AVATAR_TTL) {
          const res = await fetch(`https://api.github.com/users/${encodeURIComponent(owner)}`, {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (!res.ok) throw new Error(`api ${res.status}`);
          const json = await res.json();
          cdnUrl = String(json?.avatar_url || '');
          if (!cdnUrl) throw new Error('no avatar_url');
        }
        avatarCacheMap().set(owner, { ...(avatarCacheMap().get(owner) || {}), u: cdnUrl, t: Date.now() });
        avatarCacheSave();
        try {
          const sep = cdnUrl.includes('?') ? '&' : '?';
          const imgRes = await fetch(`${cdnUrl}${sep}size=64`, { mode: 'cors' });
          if (!imgRes.ok) throw new Error(`cdn ${imgRes.status}`);
          const dataUrl = await blobToDataUrl(await imgRes.blob());
          avatarCacheMap().set(owner, { u: cdnUrl, d: dataUrl, t: Date.now() });
        } catch {
          // CDN 收不进 dataUrl（CORS 变动）也无所谓：直链仍可用且带长缓存头
          avatarCacheMap().set(owner, { ...(avatarCacheMap().get(owner) || {}), u: cdnUrl, t: Date.now() });
        }
        avatarCacheSave();
      } catch {
        avatarCacheMap().set(owner, { ...(avatarCacheMap().get(owner) || {}), nf: Date.now() });
        avatarCacheSave();
      } finally {
        avatarResolving.delete(owner);
      }
    }

    // 行首图标：插件自己的 GitHub 头像优先（localStorage 缓存，7 天内零请求）；
    // 没有/拉取失败回退首字母字符 tile（色相随名字哈希固定）
    function PluginTile({ entry }) {
      const owner = githubOwnerOf(entry.repoUrl || entry.source?.repo);
      const [imgFail, setImgFail] = React.useState(false);
      React.useEffect(() => { setImgFail(false); }, [owner]);
      const cached = avatarCachedSrcOf(owner);
      if (owner && cached) {
        return h('span', { className: 'dpk-tile is-img' },
          h('img', { src: cached, alt: '' }));
      }
      if (owner && !imgFail) {
        // 无缓存：直连渲染（img 不受 CORS 限制，今天就能看到图），同时后台解析进缓存，
        // 成功后下次打开走缓存零请求
        void resolveAvatar(owner);
        return h('span', { className: 'dpk-tile is-img' },
          h('img', {
            src: `https://github.com/${owner}.png?size=64`,
            alt: '',
            onError: () => setImgFail(true),
          }));
      }
      const letter = entry.official ? '\u2605' : (entry.name.replace(/^@[^/]+\//, '')[0] || '?').toUpperCase();
      const hue = [...entry.name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
      return h('span', {
        className: 'dpk-tile',
        style: { background: `hsl(${hue} 60% 50% / .16)`, color: `hsl(${hue} 65% 58%)` },
        'aria-hidden': 'true',
      }, letter);
    }

    function Row({ entry, checked, disabled, onToggle, opStatus, onUpdate, onCancelUpdate, queued, onIgnore, onRestore, busy, updateDisabled, terms, showTime, onOpenDetail }) {
      const gk = groupKeyOf(entry);
      const srcKind = entry.source?.kind;
      const ignored = Boolean(entry.ignored?.mode);
      // 忽略入口只给有远端版本锚点的非官方插件；官方只读、本地/未知来源不显示
      const canIgnore = !entry.official && (srcKind === 'npm' || srcKind === 'github');
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
      // 行首 tile：官方 ★、其余取包名第一个可读字符；色相由全名哈希稳定生成
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
          h(PluginTile, { entry }),
          h('span', { className: `dpk-dot${entry.started && enabled !== false ? ' on' : ''}` }),
          // 名字可点开详情（基本信息 + 设置项 + 操作）；行本身点击仍是勾选，故这里拦下冒泡
          // 详情入口统一走行尾「详情」按钮；包名恢复纯展示（避免双重入口歧义）
          h('span', {
            className: 'dpk-name',
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
            // 明确的详情入口：名字可点这条对用户不直观，行内常驻一个「详情」按钮
            h('button', {
              className: 'dpk-btn is-mini dpk-detailbtn',
              type: 'button',
              'aria-label': `${t('detailOpen')}：${entry.name}`,
              'data-tip': t('detailOpen'),
              onClick: (e) => { e.stopPropagation(); onOpenDetail?.(entry); },
            }, t('rowDetail')),
            // 时间徽标（列表视图）：更新 > 版本变更 > 安装，取最近一条；hover 给绝对时间
            showTime ? timeBadgeOf(entry) : null,
            checkBadgeOf(entry),
            queued
              ? h('button', {
                className: 'dpk-btn is-mini is-danger',
                type: 'button',
                'aria-label': t('queueCancel'),
                onClick: (e) => { e.stopPropagation(); onCancelUpdate?.(entry); },
              }, t('queueCancel'))
              : spec && onUpdate
              ? h('button', {
                className: 'dpk-btn is-mini is-success',
                type: 'button',
                // 队列模式下：运行中仍可点其它行追加，仅该项已入队或队列封队时禁用；
                // 非队列（普通批量/加载/检查中）沿用 busy
                disabled: Boolean(updateDisabled ?? busy),
                onClick: (e) => { e.stopPropagation(); onUpdate(entry); },
              }, t('rowUpdate'))
              : null,
            ignored
              ? h('button', {
                  className: 'dpk-btn is-mini',
                  type: 'button',
                  disabled: Boolean(busy),
                  'aria-label': t('restoreBtn'),
                  'data-tip': entry.ignored?.mode === 'plugin' ? t('ignorePluginHint') : t('ignoreVersionHint'),
                  onClick: (e) => { e.stopPropagation(); onRestore?.(entry); },
                }, t('restoreBtn'))
              : (canIgnore
                  ? h('button', {
                      className: 'dpk-btn is-mini',
                      type: 'button',
                      disabled: Boolean(busy),
                      'aria-label': t('ignoreBtn'),
                      onClick: (e) => { e.stopPropagation(); onIgnore?.(entry, e.currentTarget); },
                    }, t('ignoreBtn'))
                  : null),
            chip,
            h('span', { className: 'dpk-state' }, enabled === false ? t('stateDisabled') : entry.started ? t('stateOn') : t('stateOff')),
          ),
        ),
        entry.description ? h('div', { className: 'dpk-rowdesc', 'data-tip': entry.description }, highlightText(entry.description, terms)) : null,
      );
    }

    // ---------- 组件 ----------

    // 统一弹框外壳：遮罩 + 居中 + 系统弹框行为（点遮罩关闭 / Esc 关闭 / Tab 焦点锁在框内 /
    // aria-modal 语义 / 打开时锁定背景滚动 / 焦点移入与还原）。
    // 所有二级弹框（确认 / 导出 / 导入 / 高级配置）都经它渲染，外观与交互一致。
    function Modal({ onClose, className, ariaLabel, children }) {
      const dialogRef = React.useRef(null);
      // 打开期间：锁定背景滚动、焦点移入弹框首元素，关闭时还原焦点。
      React.useEffect(() => {
        const prevActive = document.activeElement;
        const dialog = dialogRef.current;
        // 打开期间锁定背景滚动：弹框渲染在应用根内部，遮罩已挡住指针穿透，
        // 这里再冻结 body 滚动，避免滚轮/空格把背景页面滚走（即「背景还能操作」）。
        const scrollLocks = [];
        try {
          for (const el of [document.documentElement, document.body]) {
            if (!el) continue;
            const prevOverflow = el.style.overflow;
            el.style.overflow = 'hidden';
            scrollLocks.push([el, prevOverflow]);
          }
        } catch { /* 忽略 */ }
        // 焦点移入：优先首个可聚焦元素，否则弹框自身
        try {
          const focusable = dialog?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          (focusable || dialog)?.focus?.();
        } catch { /* 忽略 */ }
        return () => {
          for (const [el, prev] of scrollLocks) { try { el.style.overflow = prev; } catch { /* 忽略 */ } }
          try { prevActive?.focus?.(); } catch { /* 忽略 */ }
        };
      }, []);
      // Esc 关闭 + Tab 焦点陷阱（系统弹框标准行为；背景应用无法用 inert 完全隔离，
      // 因为弹框渲染在应用根内部，故用 Tab 循环把焦点锁在弹框内）。
      React.useEffect(() => {
        const onKey = (e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); return; }
          if (e.key !== 'Tab') return;
          const dialog = dialogRef.current;
          if (!dialog) return;
          const focusables = Array.from(dialog.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )).filter((el) => el.offsetParent !== null || el === document.activeElement);
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
      }, [onClose]);
      return h('div', {
        className: 'dpk-modalwrap',
        // 只有点中遮罩本身（不是冒泡自内容）才关闭
        onMouseDown: (e) => { if (e.target === e.currentTarget) onClose?.(); },
      },
        h('div', {
          ref: dialogRef,
          className: `dpk-modal${className ? ` ${className}` : ''}`,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': ariaLabel,
          tabIndex: -1,
        }, children),
      );
    }

    /**
     * 忽略粒度气泡：可点选项，对齐宿主菜单三层表面（backing / material / menu）。
     * 与 .dpk-tip 分开：后者是 pointer-events:none 的纯展示浮层，承载不了点击。
     * 挂在应用根内、position:fixed 定位到触发按钮旁；点外部 / Esc / 滚动自动关闭。
     */
    function IgnorePop({ pop, onPick, onClose }) {
      const ref = React.useRef(null);
      const pickRef = React.useRef(onPick);
      pickRef.current = onPick;
      React.useEffect(() => {
        if (!pop) return undefined;
        const onKey = (e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); }
        };
        const onDown = (e) => {
          if (ref.current && !ref.current.contains(e.target)) onClose?.();
        };
        window.addEventListener('keydown', onKey, true);
        document.addEventListener('mousedown', onDown, true);
        window.addEventListener('scroll', onClose, true);
        window.addEventListener('blur', onClose);
        try { ref.current?.querySelector('.dpk-ignorepop-item:not(:disabled)')?.focus?.(); } catch { /* 忽略 */ }
        return () => {
          window.removeEventListener('keydown', onKey, true);
          document.removeEventListener('mousedown', onDown, true);
          window.removeEventListener('scroll', onClose, true);
          window.removeEventListener('blur', onClose);
          try { pop.anchor?.focus?.(); } catch { /* 忽略 */ }
        };
      }, [pop, onClose]);
      if (!pop) return null;
      return h('div', {
        ref,
        className: 'dpk-ignorepop',
        role: 'menu',
        'aria-label': t('ignorePopTitle'),
        style: { left: pop.left, top: pop.top },
      },
        // 两个装饰层必须在内容层之前，都靠 z-index:-1 与根的 isolation 兜住
        h('div', { className: 'dpk-ignorepop-layer dpk-ignorepop-backing' }),
        h('div', { className: 'dpk-ignorepop-layer dpk-ignorepop-material' }),
        h('div', { className: 'dpk-ignorepop-list' },
          h('div', { className: 'dpk-ignorepop-title' }, t('ignorePopTitle')),
          pop.hint ? h('div', { className: 'dpk-ignorepop-title' }, pop.hint) : null,
          h('button', {
            className: 'dpk-ignorepop-item',
            type: 'button',
            role: 'menuitem',
            disabled: pop.versionDisabled,
            'aria-label': t('ignoreVersion'),
            onClick: (e) => { e.stopPropagation(); pickRef.current?.('version'); },
          }, t('ignoreVersion'),
            h('small', null, pop.versionDisabled ? t('ignoreDisabledVersion') : t('ignoreVersionHint'))),
          h('button', {
            className: 'dpk-ignorepop-item',
            type: 'button',
            role: 'menuitem',
            'aria-label': t('ignorePlugin'),
            onClick: (e) => { e.stopPropagation(); pickRef.current?.('plugin'); },
          }, t('ignorePlugin'), h('small', null, t('ignorePluginHint'))),
        ),
      );
    }

    // 安装来源小菜单：贴 caret 分体按钮下方，列出 npm / GitHub 两种来源。
    // 复用 IgnorePop 的三层表面模式（backing / material / 内容）；点外部 / Esc / 滚动自动关闭；
    // 点在触发按钮上不关（交给按钮自己的 onClick 做开合切换，避免先关后开的闪跳）。
    function InstallSourcePop({ pop, onPick, onClose }) {
      const ref = React.useRef(null);
      const pickRef = React.useRef(onPick);
      pickRef.current = onPick;
      React.useEffect(() => {
        if (!pop) return undefined;
        const onKey = (e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); }
        };
        const onDown = (e) => {
          if (ref.current && ref.current.contains(e.target)) return;
          if (pop.anchor?.contains?.(e.target)) return;
          onClose?.();
        };
        window.addEventListener('keydown', onKey, true);
        document.addEventListener('mousedown', onDown, true);
        window.addEventListener('scroll', onClose, true);
        window.addEventListener('blur', onClose);
        try { ref.current?.querySelector('.dpk-ignorepop-item:not(:disabled)')?.focus?.(); } catch { /* 忽略 */ }
        return () => {
          window.removeEventListener('keydown', onKey, true);
          document.removeEventListener('mousedown', onDown, true);
          window.removeEventListener('scroll', onClose, true);
          window.removeEventListener('blur', onClose);
          try { pop.anchor?.focus?.(); } catch { /* 忽略 */ }
        };
      }, [pop, onClose]);
      if (!pop) return null;
      return h('div', {
        ref,
        className: 'dpk-ignorepop dpk-installsrclist',
        role: 'menu',
        'aria-label': t('installMenuAria'),
        style: { left: pop.left, top: pop.top },
      },
        h('div', { className: 'dpk-ignorepop-layer dpk-ignorepop-backing' }),
        h('div', { className: 'dpk-ignorepop-layer dpk-ignorepop-material' }),
        h('div', { className: 'dpk-ignorepop-list' },
          h('button', {
            className: 'dpk-ignorepop-item',
            type: 'button',
            role: 'menuitem',
            onClick: (e) => { e.stopPropagation(); pickRef.current?.('npm'); },
          }, t('installMenuNpm'), h('small', null, 'pkg@1.2.3')),
          h('button', {
            className: 'dpk-ignorepop-item',
            type: 'button',
            role: 'menuitem',
            onClick: (e) => { e.stopPropagation(); pickRef.current?.('github'); },
          }, t('installMenuGithub'), h('small', null, 'owner/repo')),
        ),
      );
    }

    function PluginKeeperSection() {
      // 首屏缓存：挂载即用上次结果渲染（0 等待），随后 RPC 覆盖。
      // cacheRef 让 loading 初值知道「有没有缓存可用」。
      const cacheRef = React.useRef(null);
      const [snap, setSnap] = React.useState(() => {
        // 页签切换会重挂载组件：优先用本会话最近一次「实时」快照，保证重进时行结构与刚离开时一致，
        // 避免退回 localStorage 缓存（缺少 hostBootAt、带 fromCache）导致台账/提示行先隐后现的内容闪动。
        cacheRef.current = lastFreshSnapshot ?? loadCachedSnapshot();
        return cacheRef.current;
      });
      const [err, setErr] = React.useState(null);
      const [loading, setLoading] = React.useState(() => cacheRef.current === null);
      // 当前是否有数据可展示（超时降级提示用；ref 避免闭包里拿到旧值）
      const snapRef = React.useRef(null);
      React.useEffect(() => { snapRef.current = snap; }, [snap]);
      // 保持模块级「最近实时快照」与当前 snap 同步（含设置/忽略清单/启停态等所有就地更新），
      // 供页签切换重挂载时无缝恢复；带 fromCache 的旧缓存不覆盖它。
      React.useEffect(() => { if (snap && !snap.fromCache) lastFreshSnapshot = snap; }, [snap]);
      // 折叠分组时内容变矮 → 宿主滚动条消失 → 页面内容区变宽横移。
      // 给本页的滚动祖先固定预留滚动条槽位（scrollbar-gutter:stable），彻底消掉这个左右晃。
      React.useEffect(() => {
        let el = document.querySelector('.dpk-root');
        while (el && el !== document.documentElement) {
          const oy = getComputedStyle(el).overflowY;
          if (oy === 'auto' || oy === 'scroll') { el.style.scrollbarGutter = 'stable'; break; }
          el = el.parentElement;
        }
      }, []);
      // 分组检查状态：{ npm: {status, counts, error, connErr, firstErrorNote}, github: {...} }
      const [checkState, setCheckState] = React.useState({});
      const [saving, setSaving] = React.useState(false);
      const [saveFlash, setSaveFlash] = React.useState(null); // 'ok' | {err}
      const [testing, setTesting] = React.useState(false);
      const [proxyTest, setProxyTest] = React.useState(null);
      // 显示位置开关（设置页是否也显示本插件）：默认关；改动在重新进入页面后生效
      const [showInSettings, setShowInSettings] = React.useState(() => cacheRef.current?.settings?.showInSettings === true);
      const [locationFlash, setLocationFlash] = React.useState(null); // 'ok' | {err}
      // 进入时默认折叠分组：默认关；改动在重新进入页面后生效
      const [collapseByDefault, setCollapseByDefault] = React.useState(() => cacheRef.current?.settings?.collapseGroupsByDefault === true);
      const [collapseFlash, setCollapseFlash] = React.useState(null); // 'ok' | {err}
      // 进入时默认勾选「只看可更新」：默认关；改动在重新进入页面后生效
      const [onlyUpdatableByDefault, setOnlyUpdatableByDefault] = React.useState(() => cacheRef.current?.settings?.onlyUpdatableByDefault === true);
      const [onlyUpdatableFlash, setOnlyUpdatableFlash] = React.useState(null); // 'ok' | {err}
      // 进入时默认检查更新：默认关；改动在重新进入页面后生效
      const [checkOnEnter, setCheckOnEnter] = React.useState(() => cacheRef.current?.settings?.checkOnEnter === true);
      const [checkOnEnterFlash, setCheckOnEnterFlash] = React.useState(null); // 'ok' | {err}
      // 自动检查判定锚点：load() 拿到首份快照后置入，触发下面的 useEffect 只判一轮
      const [autoCheckReady, setAutoCheckReady] = React.useState(null);
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
      // 被「清空」屏蔽的 lastBatch id（持久化在 localStorage，跨刷新/重开有效）
      const [dismissedBatchId, setDismissedBatchId] = React.useState(() => loadDismissedBatchId());
      // 自动清除后折叠的「恢复快照」入口是否展开（默认收起，不占地方）
      const [restoreFoldOpen, setRestoreFoldOpen] = React.useState(false);
      const installRef = React.useRef(null);
      const localInstallRef = React.useRef(null);
      const [localInstalling, setLocalInstalling] = React.useState(false);
      const [localFlash, setLocalFlash] = React.useState(null);
      // M2 批量状态
      const [selected, setSelected] = React.useState(() => new Set());
      const [confirmOp, setConfirmOp] = React.useState(null); // 待二次确认的批量操作
      // 忽略粒度气泡：{ left, top, names, versionDisabled, hint, anchor }；null = 关闭
      const [ignorePop, setIgnorePop] = React.useState(null);
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
      // （弹框的 Esc 关闭 + 遮罩点击关闭已由统一 Modal 组件处理，不再各自注册）
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
      // 只看可更新：用首份快照的「默认勾选」设置做初值，避免首帧全量再过滤的闪动
      const [onlyUpdatable, setOnlyUpdatable] = React.useState(() => cacheRef.current?.settings?.onlyUpdatableByDefault === true);
      // 「默认勾选」只在首次拿到快照时套用一次，之后用户手动切换不被 load() 覆盖；
      // 已用 cacheRef 初始化过即视为已套用，置 true 防止 load() 再改
      const onlyUpdatableInitRef = React.useRef(cacheRef.current != null);
      // 搜索：query = 输入框实时值；search = 防抖后真正生效的查询串
      const [query, setQuery] = React.useState('');
      const [search, setSearch] = React.useState('');
      // 输入后停顿 SEARCH_DEBOUNCE_MS 才筛（连打时不抖动）；清空则立即生效
      React.useEffect(() => {
        if (!query) { setSearch(''); return undefined; }
        const timer = setTimeout(() => setSearch(query), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
      }, [query]);
      // 用首份快照的「默认折叠」设置做初值：首帧即折叠，避免先展开再折叠的闪动
      const [collapsedGroups, setCollapsedGroups] = React.useState(() => (cacheRef.current?.settings?.collapseGroupsByDefault ? new Set(GROUP_ORDER) : new Set()));
      // ---------- 双视图 + 时间排序（P1）----------
      // 视图/排序是纯本机 UI 偏好，走 localStorage（不进 host 设置面板，避免设置项膨胀）。
      const [viewMode, setViewMode] = React.useState(() => (localStorage.getItem('dpk.viewMode') === 'list' ? 'list' : 'group'));
      const [sortKey, setSortKey] = React.useState(() => {
        const v = localStorage.getItem('dpk.sortKey');
        return v === 'installedAt' || v === 'updatedAt' ? v : 'name';
      });
      const [sortDir, setSortDir] = React.useState(() => (localStorage.getItem('dpk.sortDir') === 'asc' ? 'asc' : 'desc'));
      const switchViewMode = React.useCallback((mode) => {
        setViewMode(mode);
        try { localStorage.setItem('dpk.viewMode', mode); } catch { /* 隐私模式等写失败可忽略 */ }
      }, []);
      const switchSortKey = React.useCallback((key) => {
        setSortKey(key);
        try { localStorage.setItem('dpk.sortKey', key); } catch { /* ignore */ }
      }, []);
      const toggleSortDir = React.useCallback(() => {
        setSortDir((prev) => {
          const next = prev === 'asc' ? 'desc' : 'asc';
          try { localStorage.setItem('dpk.sortDir', next); } catch { /* ignore */ }
          return next;
        });
      }, []);
      // 「默认折叠分组」只在首次拿到快照时套用一次，避免手动展开后被 load() 反复覆盖；
      // 已用 cacheRef 初始化过即视为已套用，置 true
      const collapseInitRef = React.useRef(cacheRef.current != null);
      const toggleGroupCollapse = React.useCallback((key) => {
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key); else next.add(key);
          return next;
        });
      }, []);

      const load = React.useCallback(async (opts) => {
        // silent：已有快照时的后台静默刷新（页签切换重进 / 批量后补刷），
        // 不触发 loading 骨架与刷新按钮文案跳变，避免内容闪动。
        const silent = opts?.silent === true;
        const t0 = performance.now();
        if (!silent) setLoading(true);
        setErr(null);
        try {
          // 超时兜底：RPC 迟迟不返回时给出可见降级（保留缓存数据继续显示）
          const data = unwrapEnvelope(
            await withTimeout(rpcFace?.snapshot(), LOAD_TIMEOUT_MS, 'snapshot'),
          );
          markPerf('snapshot', performance.now() - t0);
          if (data && data.ok) {
            lastFreshSnapshot = data;
            setSnap(data);
            saveCachedSnapshot(data);
            // 显示位置开关跟随快照（宿主半是唯一真值来源）
            if (data.settings && typeof data.settings.showInSettings === 'boolean') {
              setShowInSettings(data.settings.showInSettings);
            }
            // 默认折叠分组：跟随即时真值；仅在「首次拿到快照」时按它初始化分组折叠态，
            // 之后用户的展开/折叠手动操作不被后续 load() 覆盖。
            if (data.settings && typeof data.settings.collapseGroupsByDefault === 'boolean') {
              setCollapseByDefault(data.settings.collapseGroupsByDefault);
              if (!collapseInitRef.current) {
                collapseInitRef.current = true;
                if (data.settings.collapseGroupsByDefault) {
                  setCollapsedGroups(new Set(GROUP_ORDER));
                }
              }
            }
            // 默认勾选「只看可更新」：跟随即时真值；同样只在首次拿到快照时套用一次，
            // 之后用户手动取消/勾选不被批量后的 load() 覆盖。
            if (data.settings && typeof data.settings.onlyUpdatableByDefault === 'boolean') {
              setOnlyUpdatableByDefault(data.settings.onlyUpdatableByDefault);
              if (!onlyUpdatableInitRef.current) {
                onlyUpdatableInitRef.current = true;
                if (data.settings.onlyUpdatableByDefault) setOnlyUpdatable(true);
              }
            }
            // 默认检查更新：设置态跟随真值；实际是否触发交给下面的 useEffect 判定
            if (data.settings && typeof data.settings.checkOnEnter === 'boolean') {
              setCheckOnEnter(data.settings.checkOnEnter);
            }
            // 交出判定锚点（含落盘的 lastCheckAt，用于节流）
            setAutoCheckReady(data);
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
          if (!silent) setLoading(false);
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

      // ---------- 后台安装队列（P2）----------
      // 队列状态在宿主半（内存），前端轮询；面板可关，胶囊常驻工具栏。
      const [installQueueItems, setInstallQueueItems] = React.useState(null); // null=还没拉过
      const [installPanelOpen, setInstallPanelOpen] = React.useState(false);
      const [installNotices, setInstallNotices] = React.useState([]); // {id, ok, text}
      const [installInputFlash, setInstallInputFlash] = React.useState(null); // 入队失败的行内提示 {text}
      const [installDraft, setInstallDraft] = React.useState('');
      // 安装来源：npm / GitHub（localStorage 持久化；caret 菜单预选、弹框 tabs 切换）
      const [installType, setInstallType] = React.useState(() => {
        try { return window.localStorage.getItem('dpk.installType') === 'github' ? 'github' : 'npm'; } catch { return 'npm'; }
      });
      const switchInstallType = React.useCallback((v) => {
        const next = v === 'github' ? 'github' : 'npm';
        setInstallType(next);
        try { window.localStorage.setItem('dpk.installType', next); } catch { /* 忽略 */ }
      }, []);
      const [installMenu, setInstallMenu] = React.useState(null); // {left, top, anchor}
      const installMenuRef = React.useRef(null);
      installMenuRef.current = installMenu;
      const installCaretRef = React.useRef(null);
      const installInputRef = React.useRef(null);
      // 状态变化检测：上一次见到的 {id: status}，用来在条目结束时弹 notice + 刷列表
      const queueSeenRef = React.useRef(new Map());
      const queueActive = (installQueueItems ?? []).some((it) => it.status === 'queued' || it.status === 'running');

      const pushInstallNotice = React.useCallback((ok, text) => {
        const id = `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
        setInstallNotices((prev) => [...prev, { id, ok, text }]);
      }, []);
      const dismissInstallNotice = React.useCallback((id) => {
        setInstallNotices((prev) => prev.filter((n) => n.id !== id));
      }, []);

      // 轮询：面板开着或队列还有活跃条目时，每 1.5s 拉一次；空闲时完全停掉
      React.useEffect(() => {
        if (!installPanelOpen && !queueActive) return undefined;
        let alive = true;
        const tick = async () => {
          try {
            const v = await callInstallQueueState();
            if (!alive || !v?.ok) return;
            const items = Array.isArray(v.items) ? v.items : [];
            setInstallQueueItems(items);
            // 与上次状态对比：结束的条目弹 notice（不重复）
            const prevSeen = queueSeenRef.current;
            const nextSeen = new Map();
            for (const it of items) {
              nextSeen.set(it.id, it.status);
              const before = prevSeen.get(it.id);
              if (before === it.status) continue;
              if (it.status === 'done') {
                const version = typeof it.installedVersion === 'string' ? it.installedVersion : '?';
                const text = it.application === 'restart-required'
                  ? t('queueNoticeRestart', { name: it.name })
                  : t('queueNoticeDone', { name: it.name, version });
                pushInstallNotice(true, text);
                void load({ silent: true }); // 新插件入列，静默补刷
              } else if (it.status === 'failed') {
                pushInstallNotice(false, t('queueNoticeFailed', { name: it.name, error: it.error ?? '?' }));
              }
            }
            queueSeenRef.current = nextSeen;
          } catch { /* 网络抖动下轮等下一轮 */ }
        };
        void tick();
        const tm = setInterval(() => { void tick(); }, 1500);
        return () => { alive = false; clearInterval(tm); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [installPanelOpen, queueActive]);

      // notice 自动消失（12s），失败的不自动清
      React.useEffect(() => {
        const timers = installNotices
          .filter((n) => n.ok)
          .map((n) => setTimeout(() => dismissInstallNotice(n.id), 12000));
        return () => { for (const tm of timers) clearTimeout(tm); };
      }, [installNotices, dismissInstallNotice]);

      const doInstallEnqueue = React.useCallback(async () => {
        const name = installDraft.trim();
        if (!name) return;
        const v = await callInstallEnqueue(name);
        if (v?.ok) {
          setInstallDraft('');
          setInstallInputFlash(null);
          // 立即拉一次状态，让新条目立刻出现在列表里
          const st = await callInstallQueueState();
          if (st?.ok) setInstallQueueItems(Array.isArray(st.items) ? st.items : []);
        } else {
          setInstallInputFlash({ text: v?.error ?? v?.code ?? 'error' });
        }
      }, [installDraft]);

      const doInstallQueueCancel = React.useCallback(async (id) => {
        await callInstallQueueCancel(id);
        const st = await callInstallQueueState();
        if (st?.ok) setInstallQueueItems(Array.isArray(st.items) ? st.items : []);
      }, []);
      const doInstallQueueRemove = React.useCallback(async (id) => {
        await callInstallQueueRemove(id);
        const st = await callInstallQueueState();
        if (st?.ok) setInstallQueueItems(Array.isArray(st.items) ? st.items : []);
      }, []);
      const doInstallQueueRetry = React.useCallback(async (id) => {
        await callInstallQueueRetry(id);
        const st = await callInstallQueueState();
        if (st?.ok) setInstallQueueItems(Array.isArray(st.items) ? st.items : []);
      }, []);

      // ---------- 详情视图（P3）：基本信息 + 设置项 + 操作 ----------
      const [detailName, setDetailName] = React.useState(null);
      const [detail, setDetail] = React.useState(null); // {loading,error,bundle}
      const [detailBusy, setDetailBusy] = React.useState(false);
      const [detailFlash, setDetailFlash] = React.useState(null); // {ok,text}
      const [uninstallArm, setUninstallArm] = React.useState(false); // 卸载二次确认（按钮二次点击）

      const loadDetail = React.useCallback(async (name) => {
        setDetail((prev) => (prev ? { ...prev, loading: true, error: null } : { loading: true, error: null, bundle: null }));
        try {
          const bundlesRaw = pmFace && pmFace.listBundles ? await pmFace.listBundles() : null;
          const bundles = unwrapEnvelope(bundlesRaw);
          const bundle = Array.isArray(bundles) ? bundles.find((b) => b && b.name === name) || null : null;
          setDetail({ loading: false, error: null, bundle });
        } catch (e) {
          setDetail({ loading: false, error: String((e && e.message) || e), bundle: null });
        }
      }, []);

      const closeDetail = React.useCallback(() => {
        setDetailName(null);
        setDetail(null);
        setDetailFlash(null);
        setUninstallArm(false);
      }, []);

      const openDetail = React.useCallback((entry) => {
        const name = entry && entry.name ? entry.name : '';
        if (!name) return;
        setDetailName(name);
        setDetail(null);
        setDetailFlash(null);
        setUninstallArm(false);
        void loadDetail(name);
      }, [loadDetail]);

      const detailSetEnabled = React.useCallback(async (bundle, enabled) => {
        const rows = bundle && Array.isArray(bundle.rows) ? bundle.rows : [];
        const entryId = rows.map((r) => r && r.entryId).find(Boolean);
        if (!entryId) {
          setDetailFlash({ ok: false, text: t('detailOpFailed', { error: 'entryId missing' }) });
          return;
        }
        setDetailBusy(true);
        try {
          const res = unwrapEnvelopeStrict(await pmFace.setPluginEnabled(entryId, enabled));
          if (res && res.application === 'failed') {
            throw new Error(String(res.error?.message || res.error?.code || 'failed'));
          }
          const restart = res && res.application === 'restart-required';
          setDetailFlash({
            ok: true,
            text: `${enabled ? `✅ ${t('detailActionEnable')}` : `✅ ${t('detailActionDisable')}`}${restart ? ` · ${t('detailRestartHint')}` : ''}`,
          });
          await loadDetail(detailName);
          void load({ silent: true });
        } catch (e) {
          setDetailFlash({ ok: false, text: t('detailOpFailed', { error: String((e && e.message) || e) }) });
        } finally {
          setDetailBusy(false);
        }
      }, [detailName, load, loadDetail, t]);

      const detailUninstall = React.useCallback(async (bundle) => {
        if (!bundle || !bundle.name) return;
        if (!uninstallArm) { setUninstallArm(true); return; } // 第一次点只上膛，第二次才真删
        setUninstallArm(false);
        setDetailBusy(true);
        try {
          const res = unwrapEnvelopeStrict(await pmFace.removeBundle(bundle.name));
          if (res && res.application === 'failed') {
            throw new Error(String(res.error?.message || res.error?.code || 'failed'));
          }
          closeDetail();
          pushInstallNotice(true, t('detailUninstallOk', { name: bundle.name }));
          void load({ silent: true });
        } catch (e) {
          setDetailFlash({ ok: false, text: t('detailOpFailed', { error: String((e && e.message) || e) }) });
        } finally {
          setDetailBusy(false);
        }
      }, [closeDetail, load, pushInstallNotice, t, uninstallArm]);

      // 语言切换只重渲染文案，不重拉数据（拉数据由刷新按钮/批量后触发）
      React.useEffect(() => { void load({ silent: cacheRef.current != null }); }, [load]);

      // 会话恢复：本会话尚无批量状态、而宿主 lastBatch 带结果台账 → 恢复台账展示
      // 与「需重启」提醒（跨页签由模块级 store 承担；跨刷新由这份落盘数据承担）。
      // 首屏缓存只用于加速插件列表：它不含 hostBootAt，无法判定「宿主重启」。
      // 底部通知（台账/横幅/残留行/折叠入口）一律以实时快照为准，避免先用缓存灌出一条台账、
      // 等实时快照带着新 hostBootAt 到达时又因 store 非空而清不掉的竞态。
      // store 已有状态（进行中/本会话已收尾）时以实时数据优先，不覆盖。
      React.useEffect(() => {
        if (snap?.fromCache) return;
        if (batchStore.batch) return;
        const lb = snap?.lastBatch;
        if (!lb || !Array.isArray(lb.results) || !lb.results.length) return;
        // 用户已「清空」过这条台账 → 跨刷新/重开不再自动弹回
        if (dismissedBatchId && lb.id === dismissedBatchId) return;
        // 自动清除：宿主进程在该批次之后重启过，或账龄超过 NOTIFY_TTL_MS → 不恢复台账/横幅，
        // 仅由渲染层给一条折叠的恢复入口（不落盘、不动宿主数据、可逆）。
        if (shouldAutoDismissBatch(lb, snap)) return;
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
        // 重启提示：若宿主在批次之后已整机重启过，则不再提示「需重启」，
        // 改为告知「已随重启生效」（解决「明明重启了还提示需重启」）。
        const satisfied = isBatchRestartSatisfied(lb, snap);
        if (counts.restart > 0) {
          if (satisfied) {
            if (!batchStore.banner) storeBanner({ text: t('restartSatisfied'), ok: true });
          } else if (!(batchStore.banner && batchStore.banner.ok)) {
            // 不覆盖正在展示的"恢复成功"类正向横幅
            storeBanner(restartBannerFor(lb.results, counts.restart));
          }
        }
      }, [snap, dismissedBatchId]);

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

      // 进入时默认检查更新：只在「本会话拿到首份快照」时判定一次。
      // - 模块级 autoCheckStore 跨两个挂载点（插件页 Tab / 设置页分区）去重，避免重复发网络请求；
      // - 占位放在开关判断之前：当次改动设置不追发，符合「重新进入页面后生效」；
      // - 节流：宿主落盘的 lastCheckAt 不足 AUTO_CHECK_MIN_MS 就跳过，避免每次进页面都打网络。
      React.useEffect(() => {
        if (!autoCheckReady) return;
        if (autoCheckStore.done) return;
        autoCheckStore.done = true;
        if (autoCheckReady.settings?.checkOnEnter !== true) return;
        const raw = autoCheckReady.lastCheckAt;
        const last = typeof raw === 'number' ? raw : Date.parse(raw ?? '');
        if (Number.isFinite(last) && last > 0 && Date.now() - last < AUTO_CHECK_MIN_MS) return;
        void doCheck();
      }, [autoCheckReady, doCheck]);

      // 检查汇总：checking / 组级失败 / 连接判定来自 checkState；
      // 可更新·最新·失败改为按当前清单实时聚合（排除已忽略插件），不直接用 host counts 快照。
      const checkInfo = React.useMemo(() => {
        const kinds = Object.keys(checkState);
        if (!kinds.length) return null;
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
          if (st.connErr) connErr = true;
          if (!firstErrorNote && st.firstErrorNote) firstErrorNote = st.firstErrorNote;
        }
          // 只汇总本次已完成的组：组级失败/检查中的组没有有效 counts，别把旧缓存结果算进来
        const tally = countChecks(snap?.plugins, kinds.filter((k) => checkState[k]?.status === 'done'));
        return {
          update: tally.update,
          latest: tally.latest,
          error: error + tally.error,
          checking,
          firstErrorNote,
          connErr,
        };
      }, [checkState, snap]);

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
          applyShowInSettingsSection?.(r.showInSettings === true);
          setLocationFlash('ok');
          setSnap((s) => (s ? { ...s, settings: { ...(s.settings ?? {}), showInSettings: r.showInSettings === true } } : s));
        } else {
          setLocationFlash({ err: r?.error ?? t('saveFailed') });
        }
        setSaving(false);
      }, []);

      const doSaveCollapseByDefault = React.useCallback(async (value) => {
        setSaving(true);
        setCollapseFlash(null);
        const r = await callSaveSettings({ collapseGroupsByDefault: value });
        if (r?.ok) {
          const next = r.collapseGroupsByDefault === true;
          setCollapseByDefault(next);
          setCollapseFlash('ok');
          setSnap((s) => (s ? { ...s, settings: { ...(s.settings ?? {}), collapseGroupsByDefault: next } } : s));
        } else {
          setCollapseFlash({ err: r?.error ?? t('saveFailed') });
        }
        setSaving(false);
      }, []);

      // 保存「进入时默认勾选只看可更新」开关：只落盘 + 提示，改动重新进入页面后生效
      const doSaveOnlyUpdatableByDefault = React.useCallback(async (value) => {
        setSaving(true);
        setOnlyUpdatableFlash(null);
        const r = await callSaveSettings({ onlyUpdatableByDefault: value });
        if (r?.ok) {
          const next = r.onlyUpdatableByDefault === true;
          setOnlyUpdatableByDefault(next);
          setOnlyUpdatableFlash('ok');
          setSnap((s) => (s ? { ...s, settings: { ...(s.settings ?? {}), onlyUpdatableByDefault: next } } : s));
        } else {
          setOnlyUpdatableFlash({ err: r?.error ?? t('saveFailed') });
        }
        setSaving(false);
      }, []);

      // 保存「进入时默认检查更新」开关：只落盘 + 提示，改动重新进入页面后生效
      const doSaveCheckOnEnter = React.useCallback(async (value) => {
        setSaving(true);
        setCheckOnEnterFlash(null);
        const r = await callSaveSettings({ checkOnEnter: value });
        if (r?.ok) {
          const next = r.checkOnEnter === true;
          setCheckOnEnter(next);
          setCheckOnEnterFlash('ok');
          setSnap((s) => (s ? { ...s, settings: { ...(s.settings ?? {}), checkOnEnter: next } } : s));
        } else {
          setCheckOnEnterFlash({ err: r?.error ?? t('saveFailed') });
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
            // 包内容变更：刷新页面 ≠ 重启宿主，只提示需重启 dsh web，不给刷新按钮
            setInstallFlash({ ok: true, guide: 'restart', text: t('installGuideRestart', { name: r.target ?? spec }) });
            ok = true;
          } else if (r.application === 'applied' || r.application === 'overridden') {
            // 已热生效：界面未自动更新时给用户一个手动刷新入口（不自动整页刷新）
            setInstallFlash({ ok: true, guide: 'applied', text: t('installGuideApplied', { name: r.target ?? spec }) });
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

      // ---------- 本地安装（开发中的插件：目录软链 / 本地压缩包） ----------
      const doInstallLocal = React.useCallback(async () => {
        const raw = localInstallRef.current?.value ?? '';
        const normalized = unwrapEnvelope(await rpcFace?.normalizeLocalSpec?.({ raw }));
        if (!normalized?.ok) {
          setLocalFlash({ ok: false, text: normalized?.error || t('localInstallFail') });
          return;
        }
        const requestId = `dpk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        updateProgress({ requestId, phase: 'starting', attempt: null, lines: [], status: 'running' });
        setLocalInstalling(true);
        setLocalFlash(null);
        try {
          const r = unwrapEnvelope(await pmFace?.installBundle?.(normalized.spec, { enabled: true, requestId }));
          const errText = r?.error?.diagnostic || r?.error?.code || (r?.status === 'refused' ? r?.reason : null);
          let ok = false;
          if (!r) {
            setLocalFlash({ ok: false, text: t('installNoResponse') });
          } else if (r.application === 'applied' || r.application === 'overridden' || r.application === 'restart-required') {
            const target = r.target ?? normalized.name ?? normalized.spec;
            const restart = r.application === 'restart-required';
            setLocalFlash({
              ok: true,
              guide: restart ? 'restart' : 'applied',
              text: restart
                ? t('installGuideRestart', { name: target })
                : t('installGuideApplied', { name: target }),
            });
            ok = true;
          } else {
            setLocalFlash({ ok: false, text: `${t('localInstallFail')}${errText ? `：${errText}` : ''}` });
          }
          if (normalized.warning) {
            // spread 保留 guide（刷新/重启引导按钮），只追加 warning 文字
            setLocalFlash((prev) => (prev?.ok
              ? { ...prev, text: `${prev.text} · ${t('localInstallWarn', { warning: normalized.warning })}` }
              : prev));
          }
          if (r) updateProgress({ status: ok ? 'done' : 'failed' });
          if (localInstallRef.current) localInstallRef.current.value = '';
          await load();
        } catch (e) {
          setLocalFlash({ ok: false, text: `${t('localInstallFail')}：${e?.message ?? e}` });
          updateProgress({ status: 'failed' });
        } finally {
          setLocalInstalling(false);
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
        // 已忽略行不计入可更新：勾选时隐藏，取消勾选后在「已忽略」组点「恢复」
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

      // ---------- 忽略更新（双粒度） ----------

      // 勾选集里可忽略的行：非官方 + npm/github 来源 + 当前未被忽略
      const ignorableNames = React.useMemo(() => {
        const out = [];
        for (const name of selected) {
          const p = byName.get(name);
          if (!p || p.official || p.ignored?.mode) continue;
          const k = p.source?.kind;
          if (k === 'npm' || k === 'github') out.push(name);
        }
        return out;
      }, [selected, byName]);
      const ignorableCount = ignorableNames.length;

      // host 是忽略清单的唯一真值来源：RPC 返回 GC 后的全量映射，覆盖本地快照
      const applyIgnored = React.useCallback((map) => {
        const nextMap = map && typeof map === 'object' ? map : {};
        setSnap((s) => {
          if (!s) return s;
          const next = {
            ...s,
            ignored: nextMap,
            plugins: (s.plugins ?? []).map((p) => ({
              ...p,
              ignored: nextMap[p.name] ? { ...nextMap[p.name] } : null,
            })),
          };
          saveCachedSnapshot(next);
          return next;
        });
      }, []);

      const closeIgnorePop = React.useCallback(() => setIgnorePop(null), []);

      // 安装来源菜单的开合与预选（caret 分体按钮用）
      const closeInstallMenu = React.useCallback(() => setInstallMenu(null), []);
      const pickInstallSource = React.useCallback((kind) => {
        setInstallMenu(null);
        switchInstallType(kind);
        setInstallPanelOpen(true);
      }, [switchInstallType]);

      // 气泡贴着触发按钮定位；批量时若部分行没有检查结果，版本粒度给出跳过提示
      const openIgnorePop = React.useCallback((names, anchor) => {
        if (!names?.length) return;
        const rect = anchor?.getBoundingClientRect?.() ?? null;
        const w = 260;
        const hh = 150;
        const left = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)) : 8;
        const below = rect ? rect.bottom + 6 : 8;
        const top = rect && below + hh > window.innerHeight - 8
          ? Math.max(8, rect.top - hh - 6) : below;
        const withVersion = names.filter((n) => {
          const c = byName.get(n)?.check;
          return c?.status === 'update' && c.latest;
        }).length;
        setIgnorePop({
          left,
          top,
          names,
          anchor,
          versionDisabled: withVersion === 0,
          hint: names.length > 1 && withVersion > 0 && withVersion < names.length
            ? t('ignoreBatchHint', { n: names.length - withVersion }) : '',
        });
      }, [byName]);

      const doPickIgnore = async (mode) => {
        const pop = ignorePop;
        setIgnorePop(null);
        if (!pop?.names?.length) return;
        const r = await callSetIgnoredUpdates({ names: pop.names, mode });
        if (r?.ok) applyIgnored(r.ignored);
        else setErr(t('ignoreFailed', { err: String(r?.error ?? '') }));
      };

      // 恢复更新提醒（与已有的「恢复批量快照 doRestore(id)」不是一回事，故独立命名）
      const doRestoreIgnored = async (names) => {
        if (!names?.length) return;
        setIgnorePop(null);
        const r = await callSetIgnoredUpdates({ names, mode: null });
        if (r?.ok) applyIgnored(r.ignored);
        else setErr(t('ignoreFailed', { err: String(r?.error ?? '') }));
      };

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
        // 新一轮批量：清掉旧的「已清空」屏蔽标记，让本次结果正常显示
        saveDismissedBatchId(null);
        setDismissedBatchId(null);
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
              // 原地升级：不卸载、不碰 bundles，失败自动回滚+重试（用户只见最终成败）
              const r = await callUpdateInPlace(name, spec);
              push(r?.ok
                ? { name, op, status: 'restart', note: '' }
                : { name, op, status: 'failed', note: friendlyErrorCode(r?.code) });
            }
            else if (op === 'enable') push({ name, op, ...mapChange(await callPm('setBundleEnabled', name, true)) });
            else if (op === 'disable') push({ name, op, ...mapChange(await callPm('setBundleEnabled', name, false)) });
            else push({ name, op, ...mapChange(await callPm('removeBundle', name)) });
          } catch (e) {
            push({ name, op, status: 'failed', note: t('opFailedGeneric') });
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
          storeBanner(restartBannerFor(finalResults, counts.restart));
        }
        // 结果上报宿主落盘（切页签/重开后可恢复台账与「需重启」提醒）；
        // 组件已卸载时本循环仍会跑到这里（模块级调用不受影响）
        void callReportBatch({ id: prep.id, op, results: finalResults, counts });
        if (!namesOverride) setSelected(new Set());
        await load();
        // 宿主 startedBundles 的热更新是异步落账的，延迟补一刷，行状态才不滞留
        setTimeout(() => { void load({ silent: true }); }, 1500);
      }, [selected, byName, load]);

      // ---------- 可追加串行更新队列：单消费者 ----------
      // 整轮共用一份 prepareBatch 快照（op='update'），进度/台账复用 batchStore。
      // while 每轮重读 updateQueue.pending，故队列中仍可继续追加、按入队顺序依次执行。
      // 动自身（队尾）之前先把已完成结果连台账落盘：自身更新会卸载本插件 client bundle
      // 与 host service，之后 rpcFace 的 reportBatch/snapshot 会失效；封队又保证其后无待执行项，
      // 因此其它插件的更新成果不会因面板重载而丢失。
      const drainUpdateQueue = React.useCallback(async () => {
        if (updateQueue.running) return;
        if (!updateQueue.pending.length) return;
        updateQueue.running = true;
        hideTip(); // 批量重渲染会移动行位置，收起悬浮避免错位残留
        storeBatch({ op: 'update', running: true, done: 0, total: updateQueue.totalQueued, results: [], snapshotId: null });
        const prep = await callPrepareBatch('update');
        if (!prep?.ok) {
          storeBanner({ ok: false, text: prep?.error ?? t('loadFailed') });
          storeBatch(null);
          resetUpdateQueue();
          return;
        }
        updateQueue.snapshotId = prep.id;
        while (updateQueue.pending.length) {
          const { name, spec } = updateQueue.pending.shift();
          // 自身是队尾：动手前把已完成结果落盘，保住其它行更新成果（含台账/需重启提醒）
          if (name === SELF && updateQueue.results.length) {
            await callReportBatch({
              id: updateQueue.snapshotId, op: 'update',
              results: [...updateQueue.results], counts: countResults(updateQueue.results),
            });
          }
          const item = await runOneUpdate(name, spec);
          updateQueue.results.push(item);
          storeBatch((b) => (b ? {
            ...b,
            done: updateQueue.results.length,
            total: updateQueue.totalQueued, // 直接取当前入队总数：追加会抬高、取消会回落
            results: [...updateQueue.results],
          } : b));
        }
        const finalResults = [...updateQueue.results];
        const counts = countResults(finalResults);
        const sealed = updateQueue.sealed;
        storeBatch({
          op: 'update', running: false, done: finalResults.length, total: finalResults.length,
          results: finalResults, snapshotId: updateQueue.snapshotId, counts,
        });
        if (counts.restart > 0) storeBanner(restartBannerFor(finalResults, counts.restart));
        else if (!sealed) storeBanner(null); // 封队轮保留「自身已更新，请刷新」提示
        // 组件已卸载时本循环仍会跑到这里（模块级调用不受影响）
        void callReportBatch({ id: updateQueue.snapshotId, op: 'update', results: finalResults, counts });
        resetUpdateQueue();
        await load();
        // 宿主 startedBundles 的热更新是异步落账的，延迟补一刷，行状态才不滞留
        setTimeout(() => { void load({ silent: true }); }, 1500);
      }, [load]);

      // 行内/批量「更新」统一入口：折算候选 → 去重/排队/自身排队尾并封队 → 追加 → 起消费者。
      // 不再触发全局锁：队列运行中仍可点其它行追加（自身入队后封队除外）。
      const enqueueUpdate = React.useCallback((entries) => {
        const candidates = (Array.isArray(entries) ? entries : []).map((e) => ({
          name: e?.name,
          official: Boolean(e?.official),
          spec: updateSpecOf(e),
        })).filter((c) => c.name);
        if (!candidates.length) return;
        if (updateQueue.sealed) { // 本轮已含自身，拒绝后续任何入队
          storeBanner({ ok: false, text: t('queueSealed') });
          return;
        }
        const plan = planUpdateEnqueue(candidates, updateQueue.seen);
        if (!plan.items.length) {
          storeBanner({ ok: false, text: t('queueDuplicate') });
          return;
        }
        const starting = !updateQueue.running;
        updateQueue.seen = plan.seen;
        for (const it of plan.items) updateQueue.pending.push(it);
        updateQueue.totalQueued += plan.items.length;
        if (!starting) {
          // 运行中追加：立即抬高进度分母，不必等当前项装完再刷新总数
          storeBatch((b) => (b ? { ...b, total: updateQueue.totalQueued } : b));
        }
        if (plan.sealed) {
          updateQueue.sealed = true;
          storeBanner({ ok: true, text: t('queueSelfTail') });
        } else {
          storeBanner({ ok: true, text: t('queueAdded', { n: updateQueue.totalQueued }) });
        }
        if (starting) void drainUpdateQueue(); // 已在跑则仅追加，while 下轮自会取到
      }, [drainUpdateQueue]);

      // 行内更新（单个可更新插件，不经过勾选集）：改为入队，不再受批量全局锁限制
      const onRowUpdate = React.useCallback((entry) => {
        setConfirmOp(null); // 确认框开着时点行内更新：作废浮层，避免名单与现实脱节
        void enqueueUpdate([entry]);
      }, [enqueueUpdate]);

      // 行内取消：仅对「已入队但还没轮到执行」的项生效，从待跑队列里摘掉并把名额还回去
      const onRowCancel = React.useCallback((entry) => {
        const name = entry?.name;
        const idx = updateQueue.pending.findIndex((p) => p.name === name);
        if (idx < 0) return; // 已在执行或未入队：不可取消
        updateQueue.pending.splice(idx, 1);
        updateQueue.seen.delete(name); // 归还名额，允许之后重新入队
        updateQueue.totalQueued = Math.max(0, updateQueue.totalQueued - 1);
        // 立刻回落进度分母（不小于已完成数），并清掉过时的"已加入"提示
        storeBatch((b) => (b ? { ...b, total: Math.max(b.done, updateQueue.totalQueued) } : b));
        storeBanner({ ok: true, text: t('queueCanceled') });
      }, []);

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

      // 排序键：时间键空值排最后（不参与升降序翻转的双向比较——空值永远垫底）；
      // 同值回退按名称，保证顺序稳定。时间排序默认降序（新→旧）符合「最近动过在前」直觉。
      const sortPlugins = React.useCallback((list) => {
        const keyed = list.map((p) => {
          let key;
          if (sortKey === 'installedAt') key = p.times?.installedAt ?? '';
          else if (sortKey === 'updatedAt') key = p.times?.updatedAt ?? p.times?.versionChangedAt ?? '';
          else key = p.name;
          return { p, key };
        });
        const dirMul = sortDir === 'asc' ? 1 : -1;
        keyed.sort((a, b) => {
          const aEmpty = a.key === '' && sortKey !== 'name';
          const bEmpty = b.key === '' && sortKey !== 'name';
          if (aEmpty && bEmpty) return a.p.name.localeCompare(b.p.name);
          if (aEmpty) return 1; // 空值垫底（不受方向影响）
          if (bEmpty) return -1;
          const cmp = sortKey === 'name' ? a.key.localeCompare(b.key)
            : (a.key < b.key ? -1 : a.key > b.key ? 1 : a.p.name.localeCompare(b.p.name));
          return cmp * dirMul;
        });
        return keyed.map((x) => x.p);
      }, [sortKey, sortDir]);

      const groups = React.useMemo(() => {
        const map = new Map();
        for (const p of sortPlugins(visiblePlugins)) {
          const k = groupKeyOf(p);
          if (!map.has(k)) map.set(k, []);
          map.get(k).push(p);
        }
        return GROUP_ORDER.filter((k) => map.has(k)).map((k) => [k, map.get(k)]);
      }, [visiblePlugins, sortPlugins]);

      const counts = React.useMemo(() => {
        // 顶部汇总按「来源」统计：显示分组会把已忽略插件挪到 ignored 组，这里仍算回原来源，
        // 否则「共 N 个插件」与明细对不上。
        const c = { official: 0, npm: 0, github: 0, local: 0, unknown: 0 };
        for (const p of plugins) {
          const k = p.official ? 'official' : (p.source?.kind ?? 'unknown');
          if (k in c) c[k] += 1;
          else c.unknown += 1;
        }
        return c;
      }, [plugins]);

      // 「检查更新」按真实来源统计：已忽略的插件仍要检查，不能按显示分组算
      const checkableCount = React.useMemo(() => {
        let n = 0;
        for (const p of plugins) {
          const k = p.source?.kind;
          if (!p.official && (k === 'npm' || k === 'github')) n += 1;
        }
        return n;
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
      // 视图切换 + 排序控件：常驻（批量运行中也可切，纯只读 UI 操作）
      const viewBar = h('div', { className: 'dpk-viewbar' },
        h('div', { className: 'dpk-viewtoggle', role: 'group', 'aria-label': t('viewGroupAria') },
          h('button', {
            className: `dpk-btn is-mini${viewMode === 'group' ? ' is-active' : ''}`,
            type: 'button',
            'aria-label': t('viewGroupAria'),
            'aria-pressed': viewMode === 'group',
            onClick: () => switchViewMode('group'),
          }, t('viewGroup')),
          h('button', {
            className: `dpk-btn is-mini${viewMode === 'list' ? ' is-active' : ''}`,
            type: 'button',
            'aria-label': t('viewListAria'),
            'aria-pressed': viewMode === 'list',
            onClick: () => switchViewMode('list'),
          }, t('viewList')),
        ),
        h('select', {
          className: 'dpk-sortsel',
          'aria-label': t('sortAria'),
          value: sortKey,
          onChange: (e) => switchSortKey(e.target.value),
        },
          h('option', { value: 'name' }, t('sortName')),
          h('option', { value: 'installedAt' }, t('sortInstalled')),
          h('option', { value: 'updatedAt' }, t('sortUpdated')),
        ),
        h('button', {
          className: 'dpk-btn is-mini',
          type: 'button',
          'aria-label': sortDir === 'asc' ? t('sortAsc') : t('sortDesc'),
          'data-tip': sortDir === 'asc' ? t('sortAsc') : t('sortDesc'),
          onClick: toggleSortDir,
        }, sortDir === 'asc' ? '↑' : '↓'),
      );
      // 批量工具条：常驻显示（选中与否都在，避免列表跳动）；无选中时按钮禁用。
      // 四个按钮点击后弹二次确认框（列出将处理的插件），确认才执行。
      const batchBar = !batchRunning
        ? h('div', { className: 'dpk-batchbar' },
          h('span', { className: 'dpk-selhint' }, t('selHint', { sel: selCount, upd: updatableCount })),
          h('button', {
            className: 'dpk-btn is-success',
            type: 'button',
            // 更新入队不走全局锁：显式不含 batchRunning（运行中本条工具条整体隐藏，追加靠行内按钮）
            disabled: loading || checking || updatableCount === 0,
            onClick: () => onBatchBtn('update'),
          }, `${t('batchUpdate')} (${updatableCount})`),
          // 忽略所选：与行内按钮共用同一个气泡，目标换成 names 数组
          h('button', {
            className: 'dpk-btn',
            type: 'button',
            disabled: busy || ignorableCount === 0,
            onClick: (e) => openIgnorePop(ignorableNames, e.currentTarget),
          }, `${t('ignoreSelected')} (${ignorableCount})`),
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

      // 仅当运行中的批量就是更新队列时，才用「安装中 当前/总数」的进度文案并放开行内更新按钮；
      // 其它批量（启用/停用/卸载）与加载/检查中仍沿用 busy 全禁用，避免两个批量并发写同一 storeBatch
      const queueRunning = batchRunning && batch.op === 'update';
      const batchProgress = batchRunning
        ? h('div', { className: 'dpk-batchbar' },
          h('span', { className: 'dpk-progress', role: 'status', 'aria-live': 'polite' }, queueRunning
            ? t('queueProgress', { done: Math.min(batch.done + 1, batch.total), total: batch.total })
            : t('batchRunning', {
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
                // 记住被清空的台账 id：宿主 lastBatch 不会被清，靠这份标记跨刷新屏蔽
                const id = batch.snapshotId ?? null;
                if (id) { saveDismissedBatchId(id); setDismissedBatchId(id); }
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
      const lastBatchLine = !batch && !ledgerDismissed && !snap?.fromCache && snap?.lastBatch?.id && snap.lastBatch.id !== dismissedBatchId
        && !shouldAutoDismissBatch(snap.lastBatch, snap)
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

      // 自动清除后的折叠恢复入口（L2）：台账/横幅都不占地方，但撤销能力不丢。
      // 默认收起，仅一行小按钮；展开后才给出说明与「恢复快照」按钮。
      const autoDismissFold = !batch && !ledgerDismissed && !snap?.fromCache && snap?.lastBatch?.id
        && snap.lastBatch.id !== dismissedBatchId && shouldAutoDismissBatch(snap.lastBatch, snap)
        ? h('div', null,
          h('div', { className: 'dpk-ledrow' },
            h('button', {
              className: 'dpk-btn is-mini',
              type: 'button',
              'aria-expanded': restoreFoldOpen,
              onClick: () => setRestoreFoldOpen((v) => !v),
            }, restoreFoldOpen ? t('autoDismissFoldHide') : t('autoDismissFoldShow')),
          ),
          restoreFoldOpen
            ? h('div', { className: 'dpk-ledrow' },
              h('span', { className: 'dpk-hint' }, t('autoDismissHint', { hours: Math.round(NOTIFY_TTL_MS / 3600000) })),
              h('button', {
                className: 'dpk-btn',
                type: 'button',
                disabled: restoring || batchRunning,
                onClick: () => { void doRestore(snap.lastBatch.id); },
              }, restoring ? t('restoring') : t('restoreBtn')),
            )
            : null,
        )
        : null;

      // 设置二级弹框：复用已有的 dpk-modal 体系（确认/导出/导入弹框同款），
      // 内容仍是原来的 dpk-setbody，避免在列表里长期占一大块空间。
      const settingsModal = !settingsOpen ? null
        : h(Modal, {
          className: 'is-wide is-settings',
          ariaLabel: t('settingsTitle'),
          onClose: () => setSettingsOpen(false),
        },
          h('div', { className: 'dpk-mtitle' }, t('settingsTitle')),
          h('div', { className: 'dpk-setbody' },
          // ---- 分区 1：网络代理 ----
          h('div', { className: 'dpk-setsec' },
            h('div', { className: 'dpk-gtitle' }, t('sectionProxy')),
          h('div', { className: 'dpk-setrow dpk-proxyacts' },
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
            }, testing ? t('testProxyTesting') : t('testProxyBtn')),
            saveFlash === 'ok' ? h('span', { className: 'dpk-savedok' }, t('saved')) : null,
            saveFlash && saveFlash.err ? h('span', { className: 'dpk-savederr' }, saveFlash.err) : null,
          ),
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
          testing ? h('div', { className: 'dpk-hint' }, h(TestTimer)) : null,
          proxyTest ? h('div', { className: 'dpk-hint' },
            h('div', { className: proxyTest.ok ? 'dpk-savedok' : 'dpk-savederr' },
              `${proxyTest.ok ? t('testProxyOk') : t('testProxyFail')} · ${proxyTest.mode ?? ''}${proxyTest.proxyHost ? ` · ${t('proxyVia', { host: proxyTest.proxyHost })}` : ''} · ${proxyTest.elapsedMs ?? 0}ms${proxyTest.error ? ` — ${proxyTest.error}` : ''}`),
            ...(Array.isArray(proxyTest.checks) ? [h('div', {
              className: proxyTest.installOk ? 'dpk-savedok' : 'dpk-savederr',
            }, proxyTest.installOk
              ? (proxyTest.checks.find((c) => c.id === 'gitRemote')?.viaDirect ? t('testInstallOkDirect') : t('testInstallOk'))
              : t('testInstallFail'))] : []),
            ...(Array.isArray(proxyTest.checks) ? proxyTest.checks.map((c) => h('div', {
              key: c.id,
              className: c.ok ? 'dpk-savedok' : 'dpk-savederr',
            }, `${t(CHECK_LABEL_KEY[c.id] ?? c.id)}: ${c.ok ? 'OK' : 'FAIL'}${c.status ? ` ${c.status}` : ''} · ${c.ms ?? 0}ms${c.viaDirect ? ` · ${t('checkViaDirect')}` : ''}${c.error ? ` — ${c.error}` : ''}`)) : []),
            ...(proxyTest.git && (proxyTest.git.version || proxyTest.git.systemProxy) ? [h('div', {
              key: 'gitDiag',
              className: 'dpk-hint',
            }, t('gitDiag', {
              version: String(proxyTest.git.version ?? '').replace(/^git\s+version\s+/i, '') || '?',
              proxy: proxyTest.git.systemProxy ? t('gitDiagProxy', { proxy: proxyTest.git.systemProxy }) : '',
            }))] : []),
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
            ? h('div', {
                className: `dpk-banner${installFlash.ok ? ' is-ok' : ''}${installFlash.guide ? ' is-guide' : ''}`,
              },
                h('span', null, installFlash.text),
                installFlash.guide === 'applied'
                  ? h('button', {
                      className: 'dpk-btn is-mini',
                      type: 'button',
                      onClick: () => { globalThis.location.reload(); },
                    }, t('installGuideReload'))
                  : null,
              )
            : null,
          // ---- 分区 3：从本地安装（开发中的插件：目录软链 / 本地压缩包） ----
          h('div', { className: 'dpk-setsec' },
            h('div', { className: 'dpk-gtitle' }, t('sectionLocal')),
            h('div', { className: 'dpk-setrow' },
              h('span', { className: 'dpk-setlabel' }, t('localInstallLabel')),
              h('input', {
                ref: localInstallRef,
                className: 'dpk-input',
                type: 'text',
                spellCheck: false,
                placeholder: t('localInstallPlaceholder'),
                disabled: localInstalling,
                onKeyDown: (e) => { if (e.key === 'Enter' && !localInstalling) { void doInstallLocal(); } },
              }),
              h('button', {
                className: 'dpk-btn',
                type: 'button',
                disabled: localInstalling || installing || loading,
                onClick: () => { void doInstallLocal(); },
              }, localInstalling ? t('localInstalling') : t('localInstallBtn')),
            ),
            localFlash
              ? h('div', {
                  className: `dpk-banner${localFlash.ok ? ' is-ok' : ''}${localFlash.guide ? ' is-guide' : ''}`,
                },
                  h('span', null, localFlash.text),
                  localFlash.guide === 'applied'
                    ? h('button', {
                        className: 'dpk-btn is-mini',
                        type: 'button',
                        onClick: () => { globalThis.location.reload(); },
                      }, t('installGuideReload'))
                    : null,
                )
              : null,
          ),
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
          locationFlash === 'ok' ? h('div', { className: 'dpk-savedok' }, t('showInSettingsSaved')) : null,
          locationFlash && locationFlash.err ? h('div', { className: 'dpk-savederr' }, locationFlash.err) : null,
          // 进入时默认折叠分组：默认不勾选
          h('div', { className: 'dpk-setrow' },
            h('label', { className: 'dpk-switch' },
              h('input', {
                type: 'checkbox',
                checked: collapseByDefault,
                disabled: saving,
                onChange: (e) => { void doSaveCollapseByDefault(e.target.checked); },
              }),
              t('collapseGroupsByDefault'),
            ),
          ),
          collapseFlash === 'ok' ? h('div', { className: 'dpk-savedok' }, t('collapseGroupsByDefaultSaved')) : null,
          collapseFlash && collapseFlash.err ? h('div', { className: 'dpk-savederr' }, collapseFlash.err) : null,
          // 进入时默认勾选「只看可更新」：默认关
          h('div', { className: 'dpk-setrow' },
            h('label', { className: 'dpk-switch' },
              h('input', {
                type: 'checkbox',
                checked: onlyUpdatableByDefault,
                disabled: saving,
                onChange: (e) => { void doSaveOnlyUpdatableByDefault(e.target.checked); },
              }),
              t('onlyUpdatableByDefault'),
            ),
          ),
          onlyUpdatableFlash === 'ok' ? h('div', { className: 'dpk-savedok' }, t('onlyUpdatableByDefaultSaved')) : null,
          onlyUpdatableFlash && onlyUpdatableFlash.err ? h('div', { className: 'dpk-savederr' }, onlyUpdatableFlash.err) : null,
          // 进入时默认检查更新：默认关
          h('div', { className: 'dpk-setrow' },
            h('label', { className: 'dpk-switch' },
              h('input', {
                type: 'checkbox',
                checked: checkOnEnter,
                disabled: saving,
                onChange: (e) => { void doSaveCheckOnEnter(e.target.checked); },
              }),
              t('checkOnEnter'),
            ),
          ),
          checkOnEnterFlash === 'ok' ? h('div', { className: 'dpk-savedok' }, t('checkOnEnterSaved')) : null,
          checkOnEnterFlash && checkOnEnterFlash.err ? h('div', { className: 'dpk-savederr' }, checkOnEnterFlash.err) : null,
          h('div', { className: 'dpk-setnote' }, t('settingsReenterNote', { min: Math.round(AUTO_CHECK_MIN_MS / 60000) })),
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
        const opLabel = t(OP_LABEL_KEY[confirmOp] ?? 'opUpdate');
        const DESC_KEY = {
          update: 'dialogDescUpdate', enable: 'dialogDescEnable',
          disable: 'dialogDescDisable', uninstall: 'dialogDescUninstall',
        };
        return h(Modal, { ariaLabel: `${opLabel}`, onClose: () => setConfirmOp(null) },
          h('div', { className: 'dpk-mtitle' }, `${opLabel} (${names.length})`),
          DESC_KEY[confirmOp] ? h('div', { className: 'dpk-hint' }, t(DESC_KEY[confirmOp])) : null,
          confirmOp === 'update' && names.includes(SELF)
            ? h('div', { className: 'dpk-hint' }, t('dialogSelfReload'))
            : null,
          h('div', { className: 'dpk-mlist' }, names.map((n) => h('div', { key: n }, n))),
          h('div', { className: 'dpk-mfoot' },
            h('button', { className: 'dpk-btn', type: 'button', autoFocus: true, onClick: () => setConfirmOp(null) }, t('dialogCancel')),
            h('button', {
              className: `dpk-btn is-primary${confirmOp === 'uninstall' ? ' is-danger' : ''}`,
              type: 'button',
              onClick: () => {
                setConfirmOp(null);
                // 更新走可追加串行队列（名单已按 SELF 排最后过滤），其余操作仍走原批量
                if (confirmOp === 'update') {
                  void enqueueUpdate(names.map((n) => byName.get(n)).filter(Boolean));
                  setSelected(new Set());
                } else {
                  void runBatch(confirmOp);
                }
              },
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
        return h(Modal, {
          className: 'is-wide',
          ariaLabel: `${t('exportDialogTitle')}`,
          onClose: () => { if (exportState !== 'running') { setExportState(null); setExportPlan(null); } },
        },
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
        return h(Modal, {
          className: 'is-wide',
          ariaLabel: `${t('importAnalyzeTitle')}`,
          onClose: () => { if (importState !== 'running') { setImportState(null); setImportPlan(null); setImportId(null); } },
        },
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

      // 安装队列面板：输入即入队（可连续输），条目状态轮询宿主半；面板可随时关掉，安装继续跑
      const installQueueModal = installPanelOpen
        ? h(Modal, {
          className: 'is-wide',
          ariaLabel: t('queueTitle'),
          onClose: () => setInstallPanelOpen(false),
        },
          h('div', { className: 'dpk-mtitle' }, t('queueTitle')),
          // ---- 类型 tabs：npm / GitHub，切换输入占位与说明 ----
          h('div', { className: 'dpk-queuetabs', role: 'tablist', 'aria-label': t('installMenuAria') },
            h('button', {
              className: `dpk-queuetab${installType === 'npm' ? ' is-active' : ''}`,
              type: 'button',
              role: 'tab',
              'aria-selected': installType === 'npm' ? 'true' : 'false',
              onClick: () => switchInstallType('npm'),
            }, t('iqTabNpm')),
            h('button', {
              className: `dpk-queuetab${installType === 'github' ? ' is-active' : ''}`,
              type: 'button',
              role: 'tab',
              'aria-selected': installType === 'github' ? 'true' : 'false',
              onClick: () => switchInstallType('github'),
            }, t('iqTabGithub')),
          ),
          h('div', { className: 'dpk-hint' }, installType === 'github' ? t('queueHintGithub') : t('queueHint')),
          // ---- 输入行：回车/按钮都可入队，入队成功清空输入框方便连续输 ----
          h('div', { className: 'dpk-setrow dpk-iqrow' },
            h('input', {
              ref: installInputRef,
              className: 'dpk-input',
              type: 'text',
              spellCheck: false,
              autoComplete: 'off',
              placeholder: installType === 'github' ? t('queuePlaceholderGithub') : t('queuePlaceholder'),
              value: installDraft,
              onChange: (e) => setInstallDraft(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); void doInstallEnqueue(); } },
            }),
            h('button', {
              className: 'dpk-btn is-primary',
              type: 'button',
              disabled: !installDraft.trim(),
              onClick: () => { void doInstallEnqueue(); },
            }, t('queueAdd')),
          ),
          installInputFlash
            ? h('div', { className: 'dpk-banner' }, installInputFlash.text)
            : null,
          // ---- 队列列表 ----
          h('div', { className: 'dpk-queuelist' },
            (installQueueItems ?? []).length === 0
              ? h('div', { className: 'dpk-hint' }, t('queueEmpty'))
              : (installQueueItems ?? []).map((it) => h('div', { className: 'dpk-queuerow', key: it.id },
                h('div', { className: 'dpk-queuemain' },
                  h('span', { className: 'dpk-queuename' }, it.name),
                  h('span', { className: `dpk-queuebadge is-${it.status}` }, t(`queueStatus${it.status.charAt(0).toUpperCase()}${it.status.slice(1)}`)),
                  typeof it.installedVersion === 'string' && it.status === 'done'
                    ? h('span', { className: 'dpk-queuever' }, `v${it.installedVersion}`)
                    : null,
                  it.status === 'failed' && it.error
                    ? h('div', { className: 'dpk-queueerr' },
                      it.error,
                      /approve|build|script|批准/i.test(String(it.error))
                        ? h('div', { className: 'dpk-banner' }, t('queueNeedBuilds'))
                        : null,
                    )
                    : null,
                ),
                h('div', { className: 'dpk-queueops' },
                  (it.status === 'queued' || it.status === 'running')
                    ? h('button', { className: 'dpk-btn is-mini', type: 'button', onClick: () => { void doInstallQueueCancel(it.id); } }, t('iqCancel'))
                    : null,
                  (it.status === 'failed' || it.status === 'cancelled')
                    ? h('button', { className: 'dpk-btn is-mini', type: 'button', onClick: () => { void doInstallQueueRetry(it.id); } }, t('queueRetry'))
                    : null,
                  (it.status === 'done' || it.status === 'failed' || it.status === 'cancelled')
                    ? h('button', { className: 'dpk-btn is-mini', type: 'button', onClick: () => { void doInstallQueueRemove(it.id); } }, t('queueRemove'))
                    : null,
                ),
              )),
          ),
        )
        : null;

      // ---------- 详情视图渲染 ----------
      // 基本信息用人话表格；操作区只放当前可用的动作（设置项展示与配置已移除）。
      const detailModal = !detailName ? null
        : (() => {
            const entry = plugins.find((p) => p.name === detailName) ?? null;
            const bundle = detail && detail.bundle ? detail.bundle : null;
            const absTime = (iso) => {
              if (typeof iso !== 'string' || !iso) return t('detailNone');
              const d = new Date(iso);
              return Number.isNaN(d.getTime()) ? t('detailNone') : d.toLocaleString();
            };
            const factRow = (label, value, extra) => h('div', { className: 'dpk-fact' },
              h('span', { className: 'dpk-factlabel' }, label),
              h('span', { className: 'dpk-factvalue' }, value),
              extra ?? null,
            );
            const sourceText = entry
              ? (entry.source && entry.source.kind === 'github' && entry.source.repo
                  ? `${t(GROUP_TITLE_KEY[groupKeyOf(entry)])} · ${entry.source.repo}`
                  : t(GROUP_TITLE_KEY[groupKeyOf(entry)]))
              : t('detailNone');
            const stateText = entry
              ? (entry.enabled === false ? t('stateDisabled') : entry.started ? t('detailRunning') : t('detailStopped'))
              : t('detailNone');
            const actions = [];
            const canIgnore = Boolean(entry) && !entry.official
              && (entry.source?.kind === 'npm' || entry.source?.kind === 'github');
            const updateSpec = entry ? updateSpecOf(entry) : '';
            if (entry && updateSpec && !entry.official && !entry.ignored?.mode) {
              actions.push(h('button', {
                className: 'dpk-btn',
                type: 'button',
                key: 'update',
                disabled: detailBusy || batchRunning,
                onClick: () => { onRowUpdate(entry); closeDetail(); },
              }, t('detailActionUpdate')));
            }
            if (entry && !entry.official && bundle && (bundle.rows || []).some((r) => r && r.entryId)) {
              const disabledNow = entry.enabled === false;
              actions.push(h('button', {
                className: 'dpk-btn',
                type: 'button',
                key: 'toggle',
                disabled: detailBusy || batchRunning,
                onClick: () => { void detailSetEnabled(bundle, disabledNow); },
              }, disabledNow ? t('detailActionEnable') : t('detailActionDisable')));
            }
            if (canIgnore) {
              actions.push(entry.ignored?.mode
                ? h('button', {
                    className: 'dpk-btn',
                    type: 'button',
                    key: 'restore',
                    disabled: detailBusy || batchRunning,
                    onClick: () => { void doRestoreIgnored([entry.name]).then(() => loadDetail(entry.name)); },
                  }, t('detailActionRestore'))
                : h('button', {
                    className: 'dpk-btn',
                    type: 'button',
                    key: 'ignore',
                    disabled: detailBusy || batchRunning,
                    onClick: (e) => { openIgnorePop([entry.name], e.currentTarget); },
                  }, t('detailActionIgnore')));
            }
            if (entry && !entry.official && bundle) {
              actions.push(h('button', {
                className: 'dpk-btn is-danger',
                type: 'button',
                key: 'uninstall',
                disabled: detailBusy || batchRunning,
                onClick: () => { void detailUninstall(bundle); },
              }, uninstallArm ? t('detailUninstallConfirm', { name: entry.name }) : t('detailActionUninstall')));
            }
            return h(Modal, {
              className: 'is-wide is-detail',
              ariaLabel: t('detailTitle'),
              onClose: closeDetail,
            },
              h('div', { className: 'dpk-mtitle' }, t('detailTitle')),
              h('div', { className: 'dpk-dhead' },
                h('span', { className: 'dpk-dname' }, detailName),
                entry && entry.version ? h('span', { className: 'dpk-ver' }, `v${entry.version}`) : null,
              ),
              detail && detail.loading ? h('div', { className: 'dpk-hint' }, t('detailLoading')) : null,
              detail && detail.error
                ? h('div', { className: 'dpk-savederr' }, t('detailLoadFailed', { error: detail.error }))
                : null,
              // ---- 基本信息 ----
              h('div', { className: 'dpk-setsec' },
                h('div', { className: 'dpk-gtitle' }, t('detailSectionBasic')),
                h('div', { className: 'dpk-dfacts' },
                  factRow(t('detailVersion'), entry && entry.version ? `v${entry.version}` : t('detailNone')),
                  factRow(t('detailState'), stateText),
                  factRow(t('detailSource'), sourceText),
                  factRow(t('detailInstalledAt'), absTime(entry?.times?.installedAt)),
                  factRow(t('detailUpdatedAt'), absTime(entry?.times?.updatedAt)),
                  entry?.times?.versionChangedAt
                    ? factRow(t('detailVersionChanged'), absTime(entry.times.versionChangedAt))
                    : null,
                  entry?.repoUrl
                    ? factRow(t('detailRepo'),
                        h('a', {
                          className: 'dpk-link',
                          href: entry.repoUrl,
                          target: '_blank',
                          rel: 'noreferrer noopener',
                          'data-tip': t('detailSectionRepoHint'),
                        }, repoLabelOf(entry.repoUrl)))
                    : null,
                  entry?.installedPath
                    ? factRow(t('detailPath'), h('code', { className: 'dpk-path' }, entry.installedPath),
                        h('button', {
                          className: 'dpk-btn is-mini',
                          type: 'button',
                          onClick: () => { void copyText(entry.installedPath).then((ok) => pushInstallNotice(ok, ok ? t('detailCopyPath') : t('copyFail'))); },
                        }, t('detailCopyPath')))
                    : null,
                  entry?.description
                    ? factRow(t('detailDesc'), h('span', { className: 'dpk-factdesc' }, entry.description))
                    : null,
                ),
              ),
              // ---- 操作 ----
              h('div', { className: 'dpk-setsec' },
                h('div', { className: 'dpk-gtitle' }, t('detailSectionActions')),
                actions.length
                  ? h('div', { className: 'dpk-detailacts' }, actions)
                  : h('div', { className: 'dpk-hint' }, t('officialReadonly')),
                uninstallArm
                  ? h('div', { className: 'dpk-banner' }, h('span', null, t('detailUninstallHint', { name: detailName })))
                  : null,
                h('div', { className: 'dpk-hint' }, t('detailRestartHint')),
              ),
              detailFlash
                ? h('div', { className: `dpk-banner${detailFlash.ok ? ' is-ok' : ''}` },
                    h('span', null, detailFlash.text))
                : null,
            );
          })();

      // 行渲染（列表视图与分组视图共用一份 props，改一处两视图同步生效）
      const rowOf = (entry) => h(Row, {
        key: entry.name,
        entry,
        checked: selected.has(entry.name),
        disabled: entry.official || batchRunning,
        onToggle: toggleOne,
        onUpdate: onRowUpdate,
        queued: updateQueue.pending.some((p) => p.name === entry.name),
        onCancelUpdate: onRowCancel,
        onOpenDetail: openDetail,
        onIgnore: (entry, anchor) => openIgnorePop([entry.name], anchor),
        onRestore: (entry) => { void doRestoreIgnored([entry.name]); },
        busy: batchRunning,
        // 更新队列运行中：仅该项已入队或队列封队时禁用，其余行保持可点以便追加；
        // 其它批量/空闲状态沿用 batchRunning，避免与启用/停用/卸载批量并发写 storeBatch
        updateDisabled: queueRunning
          ? updateQueue.sealed || updateQueue.seen.has(entry.name)
          : batchRunning,
        terms, // 检索词：命中文本用主题色高亮
        showTime: viewMode === 'list', // 时间徽标只在列表视图显示（分组视图保持清爽）
        opStatus: batch && !batch.running
          ? batch.results?.findLast((r) => r.name === entry.name) ?? null
          : null,
      });

      // 底部统一说明区：版本 + 仓库 + 提 issue 引导（各设置项不再重复这类说明）
      const keeperVersion = plugins.find((p) => p.name === 'dsh-plugin-keeper')?.version ?? null;
      const footer = h('div', { className: 'dpk-footer' },
        keeperVersion ? h('span', { className: 'dpk-footitem' }, `dsh-plugin-keeper v${keeperVersion}`) : null,
        h('span', { className: 'dpk-footdot' }, '·'),
        h('a', {
          className: 'dpk-link',
          href: KEEPER_REPO,
          target: '_blank',
          rel: 'noreferrer noopener',
        }, t('footerGithub')),
        h('span', { className: 'dpk-footdot' }, '·'),
        h('a', {
          className: 'dpk-link',
          href: KEEPER_ISSUES,
          target: '_blank',
          rel: 'noreferrer noopener',
        }, t('footerIssues')),
      );

      return h('div', { className: 'dpk-root' },
        confirmModal,
        exportModal,
        importModal,
        installQueueModal,
        detailModal,
        settingsModal,
        h(IgnorePop, { pop: ignorePop, onPick: doPickIgnore, onClose: closeIgnorePop }),
        h(InstallSourcePop, { pop: installMenu, onPick: pickInstallSource, onClose: closeInstallMenu }),
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
          // 筛选控件组：搜索框 + 「只看可更新」（两个条件叠加生效）；统计挪到下一行信息区
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
            // 安装进度胶囊：队列活跃时常驻（点击打开队列面板）
            queueActive
              ? h('button', {
                className: 'dpk-btn is-mini dpk-queuecapsule',
                type: 'button',
                'data-tip': t('queueTitle'),
                onClick: () => setInstallPanelOpen(true),
              }, t('queueCapsule', {
                i: (installQueueItems ?? []).filter((it) => it.status === 'done').length + 1,
                n: (installQueueItems ?? []).filter((it) => it.status !== 'cancelled' && it.status !== 'failed').length || 1,
              }))
              : null,
            h('span', { className: 'dpk-lastcheck' }, lastCheckText),
            h('button', {
              className: 'dpk-btn is-big',
              type: 'button',
              disabled: checking || loading || checkableCount === 0,
              onClick: () => { void doCheck(); },
            }, checking ? t('checking') : t('checkBtn')),
            h('button', {
              className: `dpk-btn dpk-iconbtn${loading ? ' is-busy' : ''}`,
              type: 'button',
              'aria-label': t('refresh'),
              'data-tip': loading ? t('refreshing') : t('refresh'),
              disabled: loading || checking,
              onClick: () => { void load(); },
            }, REFRESH_ICON),
            // 官方样式：主按钮 + caret 分体；caret 弹出来源菜单（npm / GitHub 预选类型）
            h('div', { className: 'dpk-splitbtn' },
              h('button', {
                className: 'dpk-btn is-primary is-big dpk-splitmain',
                type: 'button',
                disabled: loading || checking || batchRunning,
                onClick: () => setInstallPanelOpen(true),
              }, t('installQueueBtn')),
              h('button', {
                ref: installCaretRef,
                className: 'dpk-btn is-primary is-big dpk-splitcaret',
                type: 'button',
                'aria-label': t('installMenuAria'),
                'aria-haspopup': 'menu',
                'aria-expanded': installMenu ? 'true' : 'false',
                disabled: loading || checking || batchRunning,
                onClick: () => {
                  if (installMenuRef.current) { setInstallMenu(null); return; }
                  const anchor = installCaretRef.current;
                  if (!anchor) return;
                  const rect = anchor.getBoundingClientRect();
                  const w = 200;
                  const hh = 88;
                  const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
                  const below = rect.bottom + 6;
                  const top = below + hh > window.innerHeight - 8 ? Math.max(8, rect.top - hh - 6) : below;
                  setInstallMenu({ left, top, anchor });
                },
              }, CARET_ICON),
            ),
          ),
        ),
        // 安装队列 notice（页内横幅，可手动关；成功的 12s 自动消失）
        installNotices.length > 0
          ? installNotices.map((n) => h('div', {
            key: n.id,
            className: `dpk-banner${n.ok ? ' is-ok' : ''} dpk-queuenotice`,
          },
            h('span', null, n.text),
            h('button', {
              className: 'dpk-btn is-mini',
              type: 'button',
              'aria-label': t('queueClose'),
              onClick: () => dismissInstallNotice(n.id),
            }, '×'),
          ))
          : null,
        banner ? h('div', { className: `dpk-banner${banner.ok ? ' is-ok' : ''}` }, banner.text) : null,
        // 信息行：左 = 检查结果（刚检查完）/ 插件统计（常态），右 = 视图切换（分组/列表 + 排序）
        h('div', { className: 'dpk-subbar' },
          checkInfo && !checkInfo.checking
            ? (checkInfo.error > 0
              ? h('div', { className: 'dpk-banner' },
                t('checkDoneFail', { fail: checkInfo.error }),
                checkInfo.firstErrorNote ? h('div', null, t('checkErrDetail', { note: checkInfo.firstErrorNote })) : null,
                checkInfo.connErr ? h('div', null, t('checkConnHint')) : null,
              )
              : h('div', { className: 'dpk-hint' }, t('checkDone', checkInfo)))
            : (plugins.length > 0
              ? h('span', { className: 'dpk-summary' }, t('summary', {
                total: plugins.length,
                official: counts.official,
                npm: counts.npm,
                github: counts.github,
                local: counts.local,
              }))
              : (!loading && !err ? h('span', { className: 'dpk-summary' }, t('noPlugins')) : null)),
          viewBar,
        ),
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
        // 列表视图：平铺全部可见行（排序全局生效）；分组视图：组内按排序键排
        viewMode === 'list'
          ? h('div', { className: 'dpk-rows' }, sortPlugins(visiblePlugins).map((entry) => rowOf(entry)))
          : groups.map(([key, list]) => {
            // 勾选限定：任意非官方插件可选中（启停/卸载批量不限可更新行；
            // 行内"更新"按钮按 updateSpecOf 独立显隐，批量更新对无目标行记 skipped）
            const eligible = list.filter((p) => !p.official);
            const allIn = eligible.length > 0 && eligible.every((p) => selected.has(p.name));
            const collapsed = collapsedGroups.has(key);
            // 分组级检查状态：npm / github 两组各自独立，互不阻塞
            const gState = checkState[key] ?? null;
            const gTally = gState?.status === 'done' ? countChecks(plugins, [key]) : null;
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
                key === 'ignored'
                  ? h('span', { className: 'dpk-gcount' }, t('ignoredGroupStat', {
                    version: list.filter((p) => p.ignored?.mode === 'version').length,
                    plugin: list.filter((p) => p.ignored?.mode === 'plugin').length,
                  }))
                  : null,
                key === 'ignored'
                  ? h('button', {
                    className: 'dpk-btn is-mini',
                    type: 'button',
                    disabled: batchRunning || loading,
                    onClick: (e) => { e.stopPropagation(); void doRestoreIgnored(list.map((p) => p.name)); },
                  }, t('restoreAll'))
                  : null,
                gState?.status === 'done' && gTally
                  ? h('span', { className: 'dpk-gcount' }, t('groupCheckDone', {
                    u: gTally?.update ?? 0,
                    l: gTally?.latest ?? 0,
                  }))
                  : null,
                gState?.status === 'error'
                  ? h('span', { className: 'dpk-gcount', 'data-tip': gState.error || undefined }, t('groupCheckFailed'))
                  : null,
              ),
              !collapsed
                ? h('div', { className: 'dpk-rows' },
                  list.map((entry) => rowOf(entry)))
                : null,
            );
          }),
        ledger,
        lastBatchLine,
        autoDismissFold,
        footer,
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
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/setIgnoredUpdates',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'setIgnoredUpdates',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/installEnqueue',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'installEnqueue',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/installQueueState',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'installQueueState',
          invocation: { kind: 'direct' },
          parameters: [],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/installQueueCancel',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'installQueueCancel',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/installQueueRemove',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'installQueueRemove',
          invocation: { kind: 'direct' },
          parameters: [INPUT_PARAM],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/installQueueRetry',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'installQueueRetry',
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
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/normalizeLocalSpec',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'normalizeLocalSpec',
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
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/updateBundleInPlace',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'updateBundleInPlace',
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

    /**
     * 设置页入口的即时开关（模块级引用）。
     *
     * 用户取消「在设置页也显示」时，已注册的页签要立刻撤掉 —— 不能等重新进入页面，
     * 否则会出现「勾掉了还在」的错觉。由 mountSection 注入实现。
     */
    let applyShowInSettingsSection = null;

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
          // 调试可见性：分区被 shell 挂载/卸载时留痕（定位「取消勾选后导航仍在」类问题）
          console.debug('[dsh-plugin-keeper] settings.section register ->', showInSettingsFlag);
        } catch (e) {
          // 理论上只在类型未声明时发生；留调试级日志兜底
          console.debug('[dsh-plugin-keeper] settings.section register deferred:', e?.message ?? e);
        }
      };
      // 开关切换时即时生效：置位后重新走一遍 register()（false 会顺手销毁已注册页签）
      applyShowInSettingsSection = (value) => {
        showInSettingsFlag = value === true;
        register();
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
