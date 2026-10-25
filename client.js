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
        badgeGithub: 'GitHub',
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
        chkUpdate: '可更新 {ver}',
        chkIncompatible: '不兼容',
        chkNeedDsh: '需 dsh {range}',
        chkError: '检查失败',
        chkNoRelease: '无版本锚点',
        chkUnknownVer: '版本未知',
        checkDone: '检查完成：可更新 {update} · 最新 {latest} · 失败 {error}',
        settingsTitle: '检查设置',
        proxyLabel: 'GitHub API 代理',
        proxyPlaceholder: 'http://127.0.0.1:33210（留空 = 直连）',
        proxyHint: '仅作用于 GitHub 检查（api.github.com）；npm registry 始终直连。支持 http(s) 代理。',
        save: '保存',
        saving: '保存中…',
        saved: '已保存',
        saveFailed: '保存失败',
        installBtn: '安装',
        installing: '安装中…',
        installDone: '已安装 {name}，刷新列表可见',
        installRestart: '已安装 {name}，重启后生效',
        installFailed: '安装失败',
        installBad: '无法识别的仓库地址',
        installPlaceholder: 'owner/repo 或 GitHub 链接',
        // ---- M2 批量 ----
        batchUpdate: '更新所选',
        batchEnable: '启用所选',
        batchDisable: '停用所选',
        batchUninstall: '卸载所选',
        dialogOk: '确认执行',
        dialogCancel: '取消',
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
        opNoFace: 'pluginManager 服务不可用',
        opDone: '批量{op}完成：成功 {ok} · 需重启 {restart} · 失败 {fail} · 跳过 {skip}',
        snapshotDone: '已备份配置快照 {id}',
        restartBanner: '{n} 项变更需重启后生效',
        restoreBtn: '恢复快照',
        restoring: '恢复中…',
        restoreDone: '快照已恢复，重启后生效',
        restoreFail: '恢复失败',
        lastBatchLine: '上次批量快照：{op} · {time}',
        updateNone: '所选中没有可更新的插件（先检查更新）',
        rowUpdate: '更新',
        onlyUpdatable: '只看可更新',
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
        badgeGithub: 'GitHub',
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
        chkUpdate: 'Update {ver}',
        chkIncompatible: 'Incompatible',
        chkNeedDsh: 'needs dsh {range}',
        chkError: 'Check failed',
        chkNoRelease: 'No release anchor',
        chkUnknownVer: 'Unknown version',
        checkDone: 'Checked: {update} updatable · {latest} latest · {error} failed',
        settingsTitle: 'Check settings',
        proxyLabel: 'GitHub API proxy',
        proxyPlaceholder: 'http://127.0.0.1:33210 (empty = direct)',
        proxyHint: 'Applies to GitHub checks (api.github.com) only; npm registry is always direct. http(s) proxy supported.',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved',
        saveFailed: 'Save failed',
        installBtn: 'Install',
        installing: 'Installing…',
        installDone: 'Installed {name}, refresh the list to see it',
        installRestart: 'Installed {name}, takes effect after restart',
        installFailed: 'Install failed',
        installBad: 'Unrecognized repository address',
        installPlaceholder: 'owner/repo or GitHub URL',
        // ---- M2 batch ----
        batchUpdate: 'Update selected',
        batchEnable: 'Enable selected',
        batchDisable: 'Disable selected',
        batchUninstall: 'Uninstall selected',
        dialogOk: 'Confirm',
        dialogCancel: 'Cancel',
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
        opNoFace: 'pluginManager service unavailable',
        opDone: 'Batch {op} done: ok {ok} · restart {restart} · failed {fail} · skipped {skip}',
        snapshotDone: 'Config snapshot saved: {id}',
        restartBanner: '{n} change(s) take effect after restart',
        restoreBtn: 'Restore snapshot',
        restoring: 'Restoring…',
        restoreDone: 'Snapshot restored, takes effect after restart',
        restoreFail: 'Restore failed',
        lastBatchLine: 'Last batch snapshot: {op} · {time}',
        updateNone: 'No updatable plugin in selection (check updates first)',
        rowUpdate: 'Update',
        onlyUpdatable: 'Updatable only',
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
.dpk-root{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px;display:flex;flex-direction:column;gap:16px;min-width:0;}
.dpk-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.dpk-summary{color:var(--dsw-alias-label-secondary);font-size:13px;min-width:0;}
.dpk-spacer{flex:1;}
.dpk-btn{border:1px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-md,8px);padding:3px 12px;font:inherit;font-size:13px;line-height:20px;cursor:pointer;}
.dpk-btn:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-btn:disabled{opacity:.5;cursor:default;}
.dpk-btn.is-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}
.dpk-btn.is-primary:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-btn.is-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}
.dpk-btn.is-danger:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-overlay);display:flex;align-items:center;justify-content:center;z-index:9999;}
.dpk-modal{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,12px);padding:16px 18px;width:380px;max-width:calc(100vw - 48px);display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.25);}
.dpk-mtitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);}
.dpk-mlist{max-height:200px;overflow:auto;font-size:12px;color:var(--dsw-alias-label-secondary);line-height:20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:8px 10px;background:var(--dsw-alias-bg-layer-2);border-radius:var(--dsw-radius-md,8px);}
.dpk-mfoot{display:flex;justify-content:flex-end;gap:8px;}
.dpk-btn.is-mini{padding:1px 10px;font-size:12px;line-height:18px;}
.dpk-lastcheck{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
.dpk-check{font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);white-space:nowrap;flex:none;}
.dpk-check.is-latest{color:var(--dsw-alias-label-tertiary);}
.dpk-check.is-update{color:var(--dsw-alias-brand-primary);}
.dpk-check.is-warn{color:var(--dsw-alias-state-warn-primary);}
.dpk-check.is-err{color:var(--dsw-alias-state-error-primary);}
.dpk-settings{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);padding:10px 14px;}
.dpk-settings>summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);user-select:none;}
.dpk-settings>summary:hover{color:var(--dsw-alias-brand-primary);}
.dpk-setbody{display:flex;flex-direction:column;gap:8px;padding-top:10px;}
.dpk-setrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.dpk-setlabel{font-size:13px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.dpk-input{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-md,8px);padding:4px 10px;font:inherit;font-size:13px;line-height:20px;min-width:280px;}
.dpk-input:focus{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:0;}
.dpk-input::placeholder{color:var(--dsw-alias-label-caption);}
.dpk-hint{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:18px;}
.dpk-savedok{font-size:12px;color:var(--dsw-alias-state-success-primary);}
.dpk-savederr{font-size:12px;color:var(--dsw-alias-state-error-primary);}
.dpk-err{color:var(--dsw-alias-state-error-primary);font-size:13px;}
.dpk-banner{font-size:12px;color:var(--dsw-alias-state-warn-primary);line-height:18px;}
.dpk-banner.is-ok{color:var(--dsw-alias-state-success-primary);}
.dpk-group{display:flex;flex-direction:column;gap:6px;min-width:0;}
.dpk-ghead{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;}
.dpk-garrow{font-size:11px;color:var(--dsw-alias-label-tertiary);width:12px;flex:none;text-align:center;}
.dpk-gtitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}
.dpk-gcount{font-size:12px;color:var(--dsw-alias-label-tertiary);}
.dpk-rows{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);overflow:hidden;}
.dpk-row{display:block;padding:7px 14px;min-width:0;}
.dpk-rowmain{display:flex;align-items:center;gap:12px;min-width:0;}
.dpk-rowdesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:26px;margin-top:1px;}
.dpk-onlyup{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;}
.dpk-onlyup input{accent-color:var(--dsw-alias-brand-primary);margin:0;width:13px;height:13px;}
.dpk-row + .dpk-row{border-top:1px solid var(--dsw-alias-border-l1);}
.dpk-row:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-row.is-official{opacity:.72;}
.dpk-row.is-selected{background:var(--dsw-alias-bg-layer-1);}
.dpk-cb{accent-color:var(--dsw-alias-brand-primary);margin:0;flex:none;width:14px;height:14px;cursor:pointer;}
.dpk-cb:disabled{cursor:default;opacity:.4;}
.dpk-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-caption);flex:none;}
.dpk-dot.on{background:var(--dsw-alias-state-success-primary);}
.dpk-name{font-family:${MONO};font-size:13px;white-space:nowrap;}
.dpk-ver{font-family:${MONO};font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.dpk-badge{font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none;}
.dpk-badge.is-gh{color:var(--dsw-alias-brand-primary);}
.dpk-state{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;}
.dpk-op{font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;white-space:nowrap;flex:none;max-width:260px;overflow:hidden;text-overflow:ellipsis;}
.dpk-op.is-ok{color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-bg-layer-2);}
.dpk-op.is-restart{color:var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-bg-layer-2);}
.dpk-op.is-fail{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-2);}
.dpk-op.is-skip{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);}
.dpk-batchbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,10px);padding:8px 12px;background:var(--dsw-alias-bg-layer-1);}
.dpk-ledger{display:flex;flex-direction:column;gap:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);padding:10px 14px;}
.dpk-ledrow{display:flex;align-items:center;gap:8px;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary);}
.dpk-ledrow .dpk-name{font-size:12px;}
.dpk-empty{color:var(--dsw-alias-label-tertiary);font-size:13px;}
`;
    let cssTag = null;
    function injectCss() {
      if (cssTag) return;
      cssTag = document.createElement('style');
      cssTag.id = CSS_ID;
      cssTag.textContent = CSS;
      document.head.appendChild(cssTag);
    }

    // ---------- RPC ----------

    let rpcFace = null; // remote.dsh-plugin-keeper face，由装配段注入
    let pmFace = null; // remote.pluginManager（官方）face，批量操作直接调用

    // typert face 的返回值可能是 {ok,value} 信封，也可能是裸值（取决于 result codec）。
    // 统一拆一次：成功取 value，失败/异常取 null。
    function unwrapEnvelope(r) {
      if (r && typeof r === 'object' && 'ok' in r && 'value' in r) return r.ok ? (r.value ?? null) : null;
      return r ?? null;
    }

    // 一键检查更新：返回 {at, checked, counts, results} 或 null
    async function callCheckUpdates() {
      try {
        return unwrapEnvelope(await rpcFace?.checkUpdates());
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
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

    // 行内检查徽标：entry.check = {status, latest, note}
    function checkBadgeOf(entry) {
      const c = normCheck(entry);
      if (!c) return null;
      const note = c.note ? { title: c.note } : {};
      switch (c.status) {
        case 'latest':
          return h('span', { className: 'dpk-check is-latest', ...note }, t('chkLatest'));
        case 'update':
          return h('span', { className: 'dpk-check is-update', ...note },
            t('chkUpdate', { ver: c.latest ?? '?' }));
        case 'incompatible':
          return h('span', { className: 'dpk-check is-warn', ...note },
            c.note ? t('chkIncompatible') : t('chkNeedDsh', { range: c.note }));
        case 'error':
          return h('span', { className: 'dpk-check is-err', ...note }, t('chkError'));
        case 'no-release':
          return h('span', { className: 'dpk-check', ...note }, t('chkNoRelease'));
        default:
          return h('span', { className: 'dpk-check', ...note }, t('chkUnknownVer'));
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
    const GROUP_TITLE_KEY = {
      official: 'groupOfficial',
      npm: 'groupNpm',
      github: 'groupGithub',
      local: 'groupLocal',
      unknown: 'groupUnknown',
    };

    // 批量更新目标 spec：npm → name@latest；github → github:repo#tag（已是最新则无目标）
    function updateSpecOf(entry) {
      const c = normCheck(entry);
      if (!c || c.status !== 'update') return null;
      const kind = entry.source?.kind;
      if (kind === 'npm') return `${entry.name}@${c.latest}`;
      if (kind === 'github') {
        const repo = entry.source?.repo ?? '';
        return c.tag && /^[^/]+\/[^/]+$/.test(repo) ? `github:${repo}#${c.tag}` : null;
      }
      return null;
    }

    const OP_LABEL_KEY = { update: 'opUpdate', enable: 'opEnable', disable: 'opDisable', uninstall: 'opUninstall' };

    function Row({ entry, checked, disabled, onToggle, opStatus, onUpdate, busy }) {
      const gk = groupKeyOf(entry);
      const badgeText = gk === 'official' ? t('badgeOfficial')
        : gk === 'github' ? (entry.source?.repo || t('badgeGithub'))
          : gk === 'local' ? t('badgeLocal') : null;
      const rowProps = {
        className: `dpk-row${entry.official ? ' is-official' : ''}${checked ? ' is-selected' : ''}`,
      };
      if (entry.official) rowProps.title = t('officialReadonly');
      const chip = opStatus
        ? h('span', {
          className: `dpk-op is-${opStatus.status}`,
          title: opStatus.note || undefined,
        }, t(`op${opStatus.status === 'ok' ? 'Applied' : opStatus.status === 'restart' ? 'Restart' : opStatus.status === 'failed' ? 'Failed' : 'Skipped'}`)
          + (opStatus.note && opStatus.status !== 'ok' ? ` · ${opStatus.note}` : ''))
        : null;
      const spec = updateSpecOf(entry);
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
          h('span', { className: `dpk-dot${entry.started && entry.enabled !== false ? ' on' : ''}` }),
          h('span', { className: 'dpk-name' }, entry.name),
          entry.version ? h('span', { className: 'dpk-ver' }, `v${entry.version}`) : null,
          badgeText ? h('span', { className: `dpk-badge${gk === 'github' ? ' is-gh' : ''}` }, badgeText) : null,
          checkBadgeOf(entry),
          spec && onUpdate
            ? h('button', {
              className: 'dpk-btn is-mini',
              type: 'button',
              disabled: Boolean(busy),
              onClick: () => onUpdate(entry),
            }, t('rowUpdate'))
            : null,
          chip,
          h('span', { className: 'dpk-state' }, entry.enabled === false ? t('stateDisabled') : entry.started ? t('stateOn') : t('stateOff')),
        ),
        entry.description ? h('div', { className: 'dpk-rowdesc', title: entry.description }, entry.description) : null,
      );
    }

    // ---------- 组件 ----------

    function PluginKeeperSection() {
      const [snap, setSnap] = React.useState(null);
      const [err, setErr] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [checking, setChecking] = React.useState(false);
      const [checkInfo, setCheckInfo] = React.useState(null); // {update, latest, error}
      const [saving, setSaving] = React.useState(false);
      const [saveFlash, setSaveFlash] = React.useState(null); // 'ok' | {err}
      const proxyRef = React.useRef(null);
      const [installing, setInstalling] = React.useState(false);
      const installRef = React.useRef(null);
      // M2 批量状态
      const [selected, setSelected] = React.useState(() => new Set());
      const [confirmOp, setConfirmOp] = React.useState(null); // 待二次确认的批量操作
      const [batch, setBatch] = React.useState(null); // {op, running, done, total, results:[{name,status,note}], snapshotId}
      const [banner, setBanner] = React.useState(null); // {text, ok}
      const [restoring, setRestoring] = React.useState(false);
      const batchResultsRef = React.useRef([]); // 循环内累积，避免闭包陈旧
      // 语言切换 = <html lang> 属性变化 → 强制重渲染（文案实时跟随）
      const [langTick, setLangTick] = React.useState(0);
      React.useEffect(() => {
        const obs = new MutationObserver(() => setLangTick((x) => x + 1));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
        return () => obs.disconnect();
      }, []);
      // 只看可更新（默认关）；分组折叠（会话内记忆）
      const [onlyUpdatable, setOnlyUpdatable] = React.useState(false);
      const [collapsedGroups, setCollapsedGroups] = React.useState(() => new Set());
      const toggleGroupCollapse = React.useCallback((key) => {
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key); else next.add(key);
          return next;
        });
      }, []);

      const load = React.useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
          const data = unwrapEnvelope(await rpcFace?.snapshot());
          if (data && data.ok) setSnap(data);
          else setErr(t('loadFailed'));
        } catch (e) {
          setErr(String(e?.message ?? e));
        } finally {
          setLoading(false);
        }
        // 官方 bundle 启用态并入（listBundles 失败不影响主数据）
        try {
          const bundles = await pmFace?.listBundles?.();
          if (Array.isArray(bundles)) {
            const enMap = new Map(bundles.map((b) => [b.name, b.enabled !== false]));
            setSnap((s) => (s ? { ...s, plugins: (s.plugins ?? []).map((p) => ({ ...p, enabled: enMap.has(p.name) ? enMap.get(p.name) : true })) } : s));
          }
        } catch { /* 忽略：启用态仅影响展示 */ }
      }, []);

      React.useEffect(() => { void load(); }, [load, langTick]);

      // 一键检查更新：跑完拉一次最新快照（服务端已把检查结果并入 snapshot）。
      // 注意先 load 再落错误态——load() 会清 err，顺序反了报错会被瞬间擦掉。
      const doCheck = React.useCallback(async () => {
        setChecking(true);
        setCheckInfo(null);
        setErr(null);
        try {
          const r = await callCheckUpdates();
          await load();
          if (r && r.ok) {
            setCheckInfo({ update: r.counts?.update ?? 0, latest: r.counts?.latest ?? 0, error: r.counts?.error ?? 0 });
          } else {
            setErr(r?.error ?? t('chkError'));
          }
        } finally {
          setChecking(false);
        }
      }, [load]);

      // 保存 GitHub API 代理设置
      const doSave = React.useCallback(async () => {
        setSaving(true);
        setSaveFlash(null);
        const r = await callSaveSettings({ proxyUrl: proxyRef.current?.value ?? '' });
        if (r?.ok) {
          setSaveFlash('ok');
          setSnap((s) => (s ? { ...s, settings: { proxyUrl: r.proxyUrl ?? '' } } : s));
        } else {
          setSaveFlash({ err: r?.error ?? t('saveFailed') });
        }
        setSaving(false);
      }, []);

      // ---------- M3 GitHub 直装 ----------

      // 输入归一化：owner/repo | github:owner/repo#ref | https://github.com/owner/repo(.git)(#ref|/tree/ref)
      const normGithubInput = (raw) => {
        let s = String(raw ?? '').trim();
        if (!s) return null;
        s = s.replace(/^git\+/i, '').replace(/^github:/i, '').replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
        s = s.replace(/\/tree\/([^/]+)$/i, '#$1');
        const m = s.match(/^([\w.-]+)\/([\w.-]+)(?:#([^\s#]+))?$/);
        return m ? { owner: m[1], repo: m[2], ref: m[3] || null } : null;
      };

      const doInstall = React.useCallback(async () => {
        const parsed = normGithubInput(installRef.current?.value);
        if (!parsed) {
          setBanner({ ok: false, text: t('installBad') });
          return;
        }
        const spec = `github:${parsed.owner}/${parsed.repo}${parsed.ref ? `#${parsed.ref}` : ''}`;
        setInstalling(true);
        setBanner(null);
        try {
          const r = unwrapEnvelope(await pmFace?.installBundle?.(spec, { enabled: true }));
          const errText = r?.error?.diagnostic || r?.error?.code || (r?.status === 'refused' ? r?.reason : null);
          if (r?.application === 'restart-required') {
            setBanner({ ok: true, text: t('installRestart', { name: r.target ?? spec }) });
          } else if (r?.application === 'applied' || r?.application === 'overridden') {
            setBanner({ ok: true, text: t('installDone', { name: r.target ?? spec }) });
          } else {
            setBanner({ ok: false, text: `${t('installFailed')}${errText ? `：${errText}` : ''}` });
          }
          if (installRef.current) installRef.current.value = '';
          await load();
        } catch (e) {
          setBanner({ ok: false, text: `${t('installFailed')}：${e?.message ?? e}` });
        } finally {
          setInstalling(false);
        }
      }, [load]);

      // ---------- M2 选择与批量 ----------

      const plugins = Array.isArray(snap?.plugins) ? snap.plugins : [];
      const byName = React.useMemo(() => new Map(plugins.map((p) => [p.name, p])), [plugins]);
      // 「只看可更新」过滤：只留有更新目标（检查结果为 update）的行
      const visiblePlugins = React.useMemo(
        () => (onlyUpdatable ? plugins.filter((p) => !p.official && updateSpecOf(p)) : plugins),
        [plugins, onlyUpdatable],
      );

      const toggleOne = React.useCallback((name) => {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(name)) next.delete(name); else next.add(name);
          return next;
        });
        setArmedOp(null);
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
        setArmedOp(null);
      }, []);

      const selCount = selected.size;
      const enableCount = React.useMemo(() => {
        let n = 0;
        for (const name of selected) {
          const p = byName.get(name);
          if (p && !p.official && (p.enabled === false || !p.started)) n += 1;
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

      // 批量执行：快照 → 官方 pluginManager 逐行调用 → 刷新盘点 → 台账。
      // 顺序执行（pnpm 侧本就串行）；含本插件的操作放最后（中途把自己停了，后面的行没人执行）。
      // namesOverride：行内「更新」按钮只对单行执行，不动勾选集。
      const runBatch = React.useCallback(async (op, namesOverride) => {
        const base = Array.isArray(namesOverride) && namesOverride.length ? namesOverride : [...selected];
        const names = base.filter((n) => {
          const p = byName.get(n);
          return p && !p.official;
        });
        if (!names.length) return;
        names.sort((a, b) => (a === SELF) - (b === SELF)); // self last

        const results = [];
        batchResultsRef.current = results;

        // 更新目标解析：先算 spec，无目标的行记 skipped；快照只为有目标的批量服务
        let targets = [];
        if (op === 'update') {
          for (const name of names) {
            const p = byName.get(name);
            const spec = updateSpecOf(p);
            if (spec) targets.push({ name, spec });
            else results.push({ name, status: 'skipped', note: t('opNoTarget') });
          }
          if (!targets.length) {
            setBanner({ text: t('updateNone'), ok: false });
            return;
          }
        } else {
          targets = names.map((name) => ({ name }));
        }

        setBanner(null);
        setBatch({ op, running: true, done: results.length, total: results.length + targets.length, results: [...results], snapshotId: null });
        const push = (item) => {
          results.push(item);
          setBatch((b) => (b ? { ...b, results: [...results], done: results.length } : b));
        };
        const prep = await callPrepareBatch(op);
        if (!prep?.ok) {
          setErr(prep?.error ?? 'snapshot failed');
          setBatch(null);
          return;
        }

        for (const { name, spec } of targets) {
          try {
            if (op === 'update') {
              // installBundle 对已装包会 refused already-installed：更新 = 先卸后装两步
              try { await callPm('removeBundle', name); } catch { /* 移除失败交给安装步报错 */ }
              push({ name, ...mapChange(await callPm('installBundle', spec, { enabled: true })) });
            }
            else if (op === 'enable') push({ name, ...mapChange(await callPm('setBundleEnabled', name, true)) });
            else if (op === 'disable') push({ name, ...mapChange(await callPm('setBundleEnabled', name, false)) });
            else push({ name, ...mapChange(await callPm('removeBundle', name)) });
          } catch (e) {
            push({ name, status: 'failed', note: String(e?.message ?? e) });
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
        setBatch({
          op,
          running: false,
          done: finalResults.length,
          total: targets.length,
          results: finalResults,
          snapshotId: prep.id,
          counts,
        });
        if (counts.restart > 0) {
          setBanner({ text: t('restartBanner', { n: counts.restart }), ok: false });
        }
        if (!namesOverride) setSelected(new Set());
        await load();
        // 宿主 startedBundles 的热更新是异步落账的，延迟补一刷，行状态才不滞留
        setTimeout(() => { void load(); }, 1500);
      }, [selected, byName, load]);

      // 行内更新（单个可更新插件，不经过勾选集）
      const onRowUpdate = React.useCallback((entry) => {
        if (batch?.running) return;
        void runBatch('update', [entry.name]);
      }, [batch?.running, runBatch]);

      // 恢复最近一次批量快照（把批量前的 package.json / cordis.patch.yml 复制回原位）
      const doRestore = React.useCallback(async (id) => {
        setRestoring(true);
        const r = await callRestoreBatch(id);
        setRestoring(false);
        if (r?.ok) setBanner({ text: t('restoreDone'), ok: true });
        else setBanner({ text: `${t('restoreFail')}：${r?.error ?? '?'}`, ok: false });
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

      const batchRunning = Boolean(batch?.running);
      const busy = loading || checking || batchRunning;

      // 批量工具条：常驻显示（选中与否都在，避免列表跳动）；无选中时按钮禁用。
      // 四个按钮点击后弹二次确认框（列出将处理的插件），确认才执行。
      const batchBar = !batchRunning
        ? h('div', { className: 'dpk-batchbar' },
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
            disabled: busy || selCount === 0,
            onClick: () => onBatchBtn('disable'),
          }, `${t('batchDisable')} (${selCount})`),
          h('button', {
            className: 'dpk-btn is-danger',
            type: 'button',
            disabled: busy || selCount === 0,
            onClick: () => onBatchBtn('uninstall'),
          }, `${t('batchUninstall')} (${selCount})`),
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
            })),
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
            h('span', { className: 'dpk-name' }, r.name),
            h('span', { className: `dpk-op is-${r.status}`, title: r.note || undefined },
              t(`op${r.status === 'ok' ? 'Applied' : r.status === 'restart' ? 'Restart' : r.status === 'failed' ? 'Failed' : 'Skipped'}`)
              + (r.note && r.status !== 'ok' ? ` · ${r.note}` : '')),
          )),
        )
        : null;

      // 跨会话残留的批量快照（状态文件 lastBatch）——只提示存在与恢复入口
      const lastBatchLine = !batch && snap?.lastBatch?.id
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

      const settingsEl = h('details', { className: 'dpk-settings' },
        h('summary', null, t('settingsTitle')),
        h('div', { className: 'dpk-setbody' },
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
              disabled: saving || loading,
              onClick: () => { void doSave(); },
            }, saving ? t('saving') : t('save')),
            saveFlash === 'ok' ? h('span', { className: 'dpk-savedok' }, t('saved')) : null,
            saveFlash && saveFlash.err ? h('span', { className: 'dpk-savederr' }, saveFlash.err) : null,
          ),
          h('div', { className: 'dpk-hint' }, t('proxyHint')),
          h('div', { className: 'dpk-setrow' },
            h('span', { className: 'dpk-setlabel' }, 'GitHub'),
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
        ),
      );

      // 二次确认弹框：列出将要处理的插件名单，确认才真正执行
      const confirmModal = (() => {
        if (!confirmOp) return null;
        const base = [...selected].filter((n) => {
          const p = byName.get(n);
          return p && !p.official;
        });
        const names = (confirmOp === 'update' ? base.filter((n) => updateSpecOf(byName.get(n))) : base)
          .sort((a, b) => (a === SELF) - (b === SELF));
        if (!names.length) return null;
        return h('div', {
          className: 'dpk-mask',
          onClick: (e) => { if (e.target === e.currentTarget) setConfirmOp(null); },
        },
        h('div', { className: 'dpk-modal' },
          h('div', { className: 'dpk-mtitle' }, `${t(OP_LABEL_KEY[confirmOp] ?? 'opUpdate')} (${names.length})`),
          h('div', { className: 'dpk-mlist' }, names.map((n) => h('div', { key: n }, n))),
          h('div', { className: 'dpk-mfoot' },
            h('button', { className: 'dpk-btn', type: 'button', onClick: () => setConfirmOp(null) }, t('dialogCancel')),
            h('button', {
              className: `dpk-btn is-primary${confirmOp === 'uninstall' ? ' is-danger' : ''}`,
              type: 'button',
              onClick: () => { setConfirmOp(null); void runBatch(confirmOp); },
            }, t('dialogOk')),
          ),
        ));
      })();

      return h('div', { className: 'dpk-root' },
        confirmModal,
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
          h('label', { className: 'dpk-onlyup' },
            h('input', {
              type: 'checkbox',
              checked: onlyUpdatable,
              disabled: batchRunning,
              onChange: () => setOnlyUpdatable((v) => !v),
            }),
            t('onlyUpdatable'),
          ),
          h('div', { className: 'dpk-spacer' }),
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
        banner ? h('div', { className: `dpk-banner${banner.ok ? ' is-ok' : ''}` }, banner.text) : null,
        checkInfo ? h('div', { className: 'dpk-hint' }, t('checkDone', checkInfo)) : null,
        err ? h('div', { className: 'dpk-err' }, err) : null,
        batchBar,
        batchProgress,
        loading && !snap
          ? h('div', { className: 'dpk-empty' }, t('loading'))
          : groups.map(([key, list]) => {
            // 勾选限定：只有可更新（有更新目标）的非官方插件可被选中
            const eligible = list.filter((p) => !p.official && updateSpecOf(p));
            const allIn = eligible.length > 0 && eligible.every((p) => selected.has(p.name));
            const collapsed = collapsedGroups.has(key);
            return h('div', { className: 'dpk-group', key },
              h('div', { className: 'dpk-ghead', onClick: () => toggleGroupCollapse(key) },
                h('span', { className: 'dpk-garrow' }, collapsed ? '▸' : '▾'),
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
              ),
              !collapsed
                ? h('div', { className: 'dpk-rows' },
                  list.map((entry) => h(Row, {
                    key: entry.name,
                    entry,
                    checked: selected.has(entry.name),
                    disabled: entry.official || batchRunning || !updateSpecOf(entry),
                    onToggle: toggleOne,
                    onUpdate: onRowUpdate,
                    busy: batchRunning,
                    opStatus: batch && !batch.running
                      ? batch.results?.find((r) => r.name === entry.name) ?? null
                      : null,
                  })),
                )
                : null,
            );
          }),
        ledger,
        lastBatchLine,
        settingsEl,
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
          id: 'dsh-plugin-keeper#dsh-plugin-keeper/saveSettings',
          service: 'PluginKeeperService',
          namespace: 'dsh-plugin-keeper',
          method: 'saveSettings',
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
      ],
    };

    // ---------- 装配 ----------

    function mountSection(rctx) {
      injectCss();
      let disposeEntry = null;
      // settings.section 槽类型是否已声明：由 slots.inject 包裹器首次触发时置位。
      // 语言观察器只在声明后出手，避免启动期（槽类型未就绪）的注册失败噪声。
      let sectionDeclared = false;
      const register = () => {
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
      return () => {
        try {
          disposeInjection?.();
        } catch { /* 忽略 */ }
        try {
          disposeEntry?.();
        } catch { /* 忽略 */ }
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
            rctx.effect(() => mountSection(rctx), 'dsh-plugin-keeper settings section');
            rctx.effect(() => mountPluginsTab(rctx), 'dsh-plugin-keeper plugins tab');
          },
        );
      },
    };
  },
});
