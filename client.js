/**
 * dsh-plugin-keeper — Client half (Web UI)。
 *
 * slot：settings.section —— 设置页新增「插件运维」页签。
 * M0 范围：按来源分组盘点（官方 / npm / GitHub / 本地），只读展示；
 * 后续版本在此页签内追加检查更新与批量操作。
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
        officialReadonly: '官方插件：只读，不参与批量操作',
        noPlugins: '没有已安装的插件',
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
        officialReadonly: 'Official plugin: read-only, excluded from batch ops',
        noPlugins: 'No plugins installed',
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
.dpk-err{color:var(--dsw-alias-state-error-primary);font-size:13px;}
.dpk-group{display:flex;flex-direction:column;gap:6px;min-width:0;}
.dpk-ghead{display:flex;align-items:baseline;gap:8px;}
.dpk-gtitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}
.dpk-gcount{font-size:12px;color:var(--dsw-alias-label-tertiary);}
.dpk-rows{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);overflow:hidden;}
.dpk-row{display:flex;align-items:center;gap:12px;padding:9px 14px;min-width:0;}
.dpk-row + .dpk-row{border-top:1px solid var(--dsw-alias-border-l1);}
.dpk-row:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dpk-row.is-official{opacity:.72;}
.dpk-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-caption);flex:none;}
.dpk-dot.on{background:var(--dsw-alias-state-success-primary);}
.dpk-name{font-family:${MONO};font-size:13px;white-space:nowrap;}
.dpk-ver{font-family:${MONO};font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.dpk-badge{font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none;}
.dpk-badge.is-gh{color:var(--dsw-alias-brand-primary);}
.dpk-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:20px;}
.dpk-state{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:none;}
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

    // typert face 的返回值可能是 {ok,value} 信封，也可能是裸值（取决于 result codec）。
    // 统一拆一次：成功取 value，失败/异常取 null。
    function unwrapEnvelope(r) {
      if (r && typeof r === 'object' && 'ok' in r && 'value' in r) return r.ok ? (r.value ?? null) : null;
      return r ?? null;
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

    function Row({ entry }) {
      const gk = groupKeyOf(entry);
      const badgeText = gk === 'official' ? t('badgeOfficial')
        : gk === 'github' ? (entry.source?.repo || t('badgeGithub'))
          : gk === 'local' ? t('badgeLocal') : null;
      const rowProps = entry.official
        ? { className: 'dpk-row is-official', title: t('officialReadonly') }
        : { className: 'dpk-row' };
      return h('div', rowProps,
        h('span', { className: `dpk-dot${entry.started ? ' on' : ''}` }),
        h('span', { className: 'dpk-name' }, entry.name),
        entry.version ? h('span', { className: 'dpk-ver' }, `v${entry.version}`) : null,
        badgeText ? h('span', { className: `dpk-badge${gk === 'github' ? ' is-gh' : ''}` }, badgeText) : null,
        entry.description ? h('span', { className: 'dpk-desc', title: entry.description }, entry.description) : h('span', { className: 'dpk-desc' }),
        h('span', { className: 'dpk-state' }, entry.started ? t('stateOn') : t('stateOff')),
      );
    }

    // ---------- 组件 ----------

    function PluginKeeperSection() {
      const [snap, setSnap] = React.useState(null);
      const [err, setErr] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      // 语言切换 = <html lang> 属性变化 → 强制重渲染（文案实时跟随）
      const [langTick, setLangTick] = React.useState(0);
      React.useEffect(() => {
        const obs = new MutationObserver(() => setLangTick((x) => x + 1));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
        return () => obs.disconnect();
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
      }, []);

      React.useEffect(() => { void load(); }, [load, langTick]);

      const plugins = Array.isArray(snap?.plugins) ? snap.plugins : [];
      const groups = React.useMemo(() => {
        const map = new Map();
        for (const p of plugins) {
          const k = groupKeyOf(p);
          if (!map.has(k)) map.set(k, []);
          map.get(k).push(p);
        }
        return GROUP_ORDER.filter((k) => map.has(k)).map((k) => [k, map.get(k)]);
      }, [plugins]);

      const counts = React.useMemo(() => {
        const c = { official: 0, npm: 0, github: 0, local: 0, unknown: 0 };
        for (const p of plugins) c[groupKeyOf(p)] += 1;
        return c;
      }, [plugins]);

      return h('div', { className: 'dpk-root' },
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
          h('div', { className: 'dpk-spacer' }),
          h('button', {
            className: 'dpk-btn',
            type: 'button',
            disabled: loading,
            onClick: () => { void load(); },
          }, loading ? t('refreshing') : t('refresh')),
        ),
        err ? h('div', { className: 'dpk-err' }, err) : null,
        loading && !snap
          ? h('div', { className: 'dpk-empty' }, t('loading'))
          : groups.map(([key, list]) => h('div', { className: 'dpk-group', key },
            h('div', { className: 'dpk-ghead' },
              h('span', { className: 'dpk-gtitle' }, t(GROUP_TITLE_KEY[key])),
              h('span', { className: 'dpk-gcount' }, String(list.length)),
            ),
            h('div', { className: 'dpk-rows' },
              list.map((entry) => h(Row, { key: entry.name, entry })),
            ),
          )),
      );
    }

    // ---------- Typert Remote 契约（client 描述符走最小 strict codec，同 fallback-queue 形态） ----------

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

    return {
      inject: ['slots', 'remote'],
      async apply(ctx) {
        // 挂自己的 Remote namespace，再在内层 ctx.inject 里拿 face
        const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE);
        ctx.effect(() => () => { void disposeRemote(); }, 'dsh-plugin-keeper remote mount');
        await ctx.inject(
          ['slots', 'remote', 'remote.dsh-plugin-keeper'],
          (rctx) => {
            rpcFace = rctx.remote?.['dsh-plugin-keeper'] ?? null;
            rctx.effect(() => mountSection(rctx), 'dsh-plugin-keeper settings section');
          },
        );
      },
    };
  },
});
