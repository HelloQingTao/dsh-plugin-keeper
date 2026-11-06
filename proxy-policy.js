/**
 * 代理策略 —— host 半区唯一入口。
 *
 * 两档语义：
 *  - 未配置（''）：检查更新用 EnvHttpProxyAgent 跟随系统 HTTP(S)_PROXY/NO_PROXY；
 *    安装侧撤掉本插件注入的键，让宿主 scrubbedParentEnv() 的系统默认生效。
 *  - 已配置：检查更新用 ProxyAgent(url)（含 npm registry）；安装侧把代理写进
 *    profileContext.packageManager.env —— 宿主 installBundle 的 git ls-remote 与
 *    pnpm add 都按 {...scrubbedParentEnv(), ...options.env} 取 env，该对象优先级最高。
 *
 * 不改 process.env、不写 ~/.dsh/.env、不碰宿主全局 dispatcher。
 */

import { EnvHttpProxyAgent, ProxyAgent, interceptors } from 'undici';

const PROXY_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'];
const BYPASS_KEYS = ['NO_PROXY', 'no_proxy'];
const ALL_KEYS = [...PROXY_KEYS, ...BYPASS_KEYS];
const LOOPBACK_BYPASS = 'localhost,127.0.0.1,::1';
const ENV_MARKER = '\u0000system-env';

let pnpmCommand = 'pnpm';
let contextVerified = false;
const snapshots = new WeakMap();

export function setPnpmCommand(value) {
  if (typeof value === 'string' && value.trim()) pnpmCommand = value.trim();
}

export function setContextVerified(value) {
  contextVerified = value === true;
}

export function getContextVerified() {
  return contextVerified;
}

/** 裸 host:port 自动补 http://；留空表示系统默认。失败抛带原因的 Error。 */
export function normalizeProxyUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) throw new Error('请写成 host:port，例如 127.0.0.1:7890');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) {
    throw new Error('仅支持 http(s) 代理，socks/其它协议不支持');
  }
  let candidate = s;
  if (!/^https?:\/\//i.test(candidate)) candidate = `http://${candidate.replace(/^\/\//, '')}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`代理地址不合法：${s}`);
  }
  if (!url.hostname) throw new Error(`代理地址缺少主机名：${s}`);
  if (url.port && !/^\d+$/.test(url.port)) throw new Error(`代理端口不合法：${url.port}`);
  return candidate;
}

const decode = (s) => {
  try { return decodeURIComponent(s); } catch { return s; }
};

/**
 * 从代理 URL 拆出「无凭据地址 + 账号 + 密码」，供旧配置迁移和用户直接粘
 * 带 userinfo 的地址时使用。返回的地址永远不含凭据。
 */
export function splitProxyCredentials(proxyUrl) {
  const base = normalizeProxyUrl(proxyUrl);
  if (!base) return { proxyUrl: '', proxyUser: '', proxyPass: '' };
  const u = new URL(base);
  const user = u.username ? decode(u.username) : '';
  const pass = u.password ? decode(u.password) : '';
  if (!user && !pass) return { proxyUrl: base, proxyUser: '', proxyPass: '' };
  const path = u.pathname === '/' ? '' : u.pathname;
  return {
    proxyUrl: `${u.protocol}//${u.host}${path}${u.search}`,
    proxyUser: user,
    proxyPass: pass,
  };
}

/** 把独立字段组装成带 userinfo 的代理 URL；userinfo 按 RFC 3986 百分号编码。 */
export function composeProxyUrl(proxyUrl, user, pass) {
  const base = normalizeProxyUrl(proxyUrl);
  if (!base) return '';
  const u = new URL(base);
  // 地址里已带 userinfo（用户直接粘完整 URL）时以它为准
  if (!user && (u.username || u.password)) return base;
  if (!user) return base;
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(pass ?? '')}`;
  const path = u.pathname === '/' ? '' : u.pathname;
  return `${u.protocol}//${auth}@${u.host}${path}${u.search}`;
}

/** 本插件注入到安装子进程 env 的键集合（未配置代理时为空）。 */
export function proxyEnvOverlay(proxyUrl) {
  if (!proxyUrl) return {};
  const out = {};
  for (const k of PROXY_KEYS) out[k] = proxyUrl;
  const inherited = [process.env.NO_PROXY, process.env.no_proxy].filter(Boolean).join(',');
  const bypass = [inherited, LOOPBACK_BYPASS].filter(Boolean).join(',');
  for (const k of BYPASS_KEYS) out[k] = bypass;
  return out;
}

/**
 * 把策略增量写进 profileContext.packageManager.env。
 * 只增删本插件负责的键；launcher 原有的其它 env 键与代理原始值一律保留，
 * 未配置代理时按快照还原，而不是写 undefined 去屏蔽系统代理。
 */
export function applyInstallProxy(profile, proxyUrl) {
  if (!profile || typeof profile !== 'object') {
    return { ok: false, reason: 'no-profile-context' };
  }
  if (!profile.packageManager || typeof profile.packageManager !== 'object') {
    profile.packageManager = { command: pnpmCommand, args: [], env: {} };
  }
  const pm = profile.packageManager;
  if (!pm.env || typeof pm.env !== 'object') pm.env = {};
  const env = pm.env;

  if (!snapshots.has(env)) {
    const original = {};
    for (const k of ALL_KEYS) if (Object.hasOwn(env, k)) original[k] = env[k];
    snapshots.set(env, { original, added: [] });
  }
  const state = snapshots.get(env);

  // 撤掉上一次注入，再按原始值复原
  for (const k of state.added) {
    if (!Object.hasOwn(state.original, k)) delete env[k];
  }
  state.added = [];
  for (const k of ALL_KEYS) {
    if (Object.hasOwn(state.original, k)) env[k] = state.original[k];
    else delete env[k];
  }

  const overlay = proxyEnvOverlay(proxyUrl);
  for (const [k, v] of Object.entries(overlay)) {
    env[k] = v;
    if (!Object.hasOwn(state.original, k)) state.added.push(k);
  }

  // 回读校验：注入没生效就明确报错，不静默当成成功
  const expected = proxyUrl || null;
  const actual = proxyUrl ? env.HTTPS_PROXY : null;
  if (actual !== expected) {
    return { ok: false, reason: 'env-readback-mismatch' };
  }
  return {
    ok: true,
    verified: contextVerified,
    reason: contextVerified ? null : 'host-context-not-verified',
    proxyUrl,
    keys: Object.keys(overlay),
  };
}

/** 插件卸载时还原原始 env，不留残留。 */
export function releaseInstallProxy(profile) {
  const env = profile?.packageManager?.env;
  const state = env && snapshots.get(env);
  if (!state) return;
  for (const k of state.added) if (!Object.hasOwn(state.original, k)) delete env[k];
  for (const k of ALL_KEYS) {
    if (Object.hasOwn(state.original, k)) env[k] = state.original[k];
    else delete env[k];
  }
  state.added = [];
  snapshots.delete(env);
}

let dispatcherKey = null;
let dispatcher = null;

/** 检查更新用的 dispatcher：配了代理走 ProxyAgent，没配跟随系统环境。 */
export function dispatcherFor(_url, proxyUrl) {
  const key = proxyUrl || ENV_MARKER;
  if (key === dispatcherKey && dispatcher) return dispatcher;
  const previous = dispatcher;
  const base = proxyUrl ? new ProxyAgent(proxyUrl) : new EnvHttpProxyAgent();
  dispatcher = base.compose(interceptors.redirect({ maxRedirections: 3 }));
  dispatcherKey = key;
  if (previous) {
    try {
      Promise.resolve(previous.close?.()).catch(() => {});
    } catch { /* 旧 dispatcher 关闭失败不影响新请求 */ }
  }
  return dispatcher;
}

/** 自检用：当前 dispatcher 档位。 */
export function dispatcherStatus() {
  return { key: dispatcherKey === ENV_MARKER ? 'system-env' : dispatcherKey };
}
