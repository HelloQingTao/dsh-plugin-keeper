/**
 * dsh-plugin-keeper — Host half（Node 侧）。
 *
 * 职责：
 * - 盘点当前 profile 的插件：读 profile package.json 的 dependencies（spec 天然记录来源）
 *   + 每个包自己的 package.json（版本、dsh 元数据），汇成快照给浏览器半区。
 * - 官方包（dsh / @deepseek-ai/*）只标记，不做任何写操作。
 * - M1：一键检查更新——npm registry /latest 与 GitHub releases→tags 双通道，
 *   engines.dsh 兼容预判，结果持久化到 $DSH_HOME/plugin-keeper.json。
 * - GitHub API 代理：用户在页签里配置 HTTP(S) 代理 URL，仅作用于 api.github.com
 *   （registry 直连；下载侧镜像前缀属 M3）。
 *
 * 依赖解析：@deepseek-ai/dsh-typert-protocol 走 peerDependencies（^0.2.0-rc.2），
 * 宿主 ResolutionRouter 会把它路由到安装域的同一份副本，保证类标记一致。
 * undici / semver 是本插件自己的 dependencies，装在插件目录 node_modules。
 */

import { readFile, writeFile, copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import { request, ProxyAgent, Agent, interceptors } from 'undici';
import { gt, satisfies, valid } from 'semver';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';

// 与 @deepseek-ai/dsh-typert-protocol 内部常量同值（该包不再导出 ./remote-methods
// 子路径，但协议仍是这个字符串键 + {version:1, methods:[...]} 结构；宿主自己的
// dsh-repeat-tool-reminder / dsh-tmux-context 也直接硬编码同一常量）。
const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods';

/** 给原型打 Remote 方法标记（等价于 TS 装饰器编译产物） */
function markRemoteMethods(prototype, methods) {
  Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
    configurable: true,
    value: Object.freeze({
      version: 1,
      methods: Object.freeze(
        methods.map((m) => Object.freeze({ method: m, invocation: Object.freeze({ kind: 'direct' }) })),
      ),
    }),
  });
}

/** 模块级桥：由 apply 设置，Service 构造时取用（cordis 类插件实例化只传 ctx）。 */
let serviceBridge = null; // { profile } | null

/** 官方包判定：dsh 本体与 @deepseek-ai scope。 */
function isOfficial(name) {
  return name === 'dsh' || name.startsWith('@deepseek-ai/');
}

/**
 * 把 profile package.json 里的依赖 spec 解析成来源分组。
 * npm 范围（^1.2.3 / ~2.0 / 1.2.3 / latest…）= npm；github:… = GitHub；
 * file:/link:/workspace: = 本地；http(s):// 直链归入 GitHub 组（同为远端仓库分发）。
 */
function parseSource(spec) {
  if (typeof spec !== 'string' || spec === '') return { kind: 'unknown', spec: String(spec ?? '') };
  if (spec.startsWith('github:')) {
    const rest = spec.slice(7);
    const seg = rest.split('#')[0].split('/');
    const repo = seg.length >= 2 ? `${seg[0]}/${seg[1]}` : rest;
    return { kind: 'github', spec, repo };
  }
  if (/^(file|link|workspace):/.test(spec)) return { kind: 'local', spec };
  if (/^https?:/i.test(spec)) return { kind: 'github', spec, repo: spec };
  return { kind: 'npm', spec };
}

async function readJsonSafe(path, errors) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (e) {
    errors?.push({ path, message: e?.message ?? String(e) });
    return null;
  }
}

// ---------- 状态文件（$DSH_HOME/plugin-keeper.json）----------

function statePathOf() {
  const home = serviceBridge?.profile?.home
    || process.env.DSH_HOME
    || join(homedir(), '.dsh');
  return join(home, 'plugin-keeper.json');
}

const STATE_DEFAULT = Object.freeze({ proxyUrl: '', lastCheck: null, lastBatch: null });

async function readState() {
  const raw = await readJsonSafe(statePathOf());
  return {
    proxyUrl: typeof raw?.proxyUrl === 'string' ? raw.proxyUrl : '',
    lastCheck: raw?.lastCheck && typeof raw.lastCheck === 'object' ? raw.lastCheck : null,
    lastBatch: raw?.lastBatch && typeof raw.lastBatch === 'object' ? raw.lastBatch : null,
  };
}

async function writeState(state) {
  await writeFile(statePathOf(), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

// ---------- 当前 dsh 版本（兼容预判用）----------

let dshVersionCache;
function probeDshVersion() {
  if (dshVersionCache !== undefined) return dshVersionCache;
  try {
    // macOS brew node：/opt/homebrew/bin/node → /opt/homebrew/lib/node_modules/@deepseek-ai/dsh
    const p = join(dirname(process.execPath), '..', 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'package.json');
    dshVersionCache = JSON.parse(readFileSync(p, 'utf8'))?.version ?? null;
  } catch {
    dshVersionCache = null;
  }
  return dshVersionCache;
}

// ---------- HTTP（undici；GitHub 走可选代理）----------

let directAgent = null;
let proxyAgent = null;
let proxyAgentUrl = '';
// undici v7 起 request 不再收 maxRedirections，重定向要靠 dispatcher 上的 redirect 拦截器
const redirectInterceptor = () => interceptors.redirect({ maxRedirections: 3 });

function dispatcherFor(url, proxyUrl) {
  if (proxyUrl && url.startsWith('https://api.github.com/')) {
    if (proxyUrl !== proxyAgentUrl) {
      proxyAgent = new ProxyAgent(proxyUrl).compose(redirectInterceptor());
      proxyAgentUrl = proxyUrl;
    }
    return proxyAgent;
  }
  if (!directAgent) directAgent = new Agent().compose(redirectInterceptor());
  return directAgent;
}

/**
 * GET JSON。404 返回 {notFound:true}（调用方按降级语义处理），4xx/5xx 抛错。
 * 4xx/5xx 的响应体可能是 {"message":"Not Found"} —— 转成错误信息带上。
 */
async function fetchJson(url, { proxyUrl, headers = {}, timeoutMs = 8000 } = {}) {
  const res = await request(url, {
    dispatcher: dispatcherFor(url, proxyUrl),
    headers: { 'user-agent': 'dsh-plugin-keeper', accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const code = res.statusCode;
  if (code === 404) {
    res.body.dump().catch(() => {});
    return { notFound: true };
  }
  if (code >= 400) {
    let hint = '';
    try {
      const j = await res.body.json();
      if (j?.message) hint = `: ${j.message}`;
    } catch { /* 忽略响应体解析失败 */ }
    throw new Error(`HTTP ${code}${code === 403 || code === 429 ? '（限流，可配置代理后重试）' : ''}${hint}`);
  }
  return { json: await res.body.json() };
}

/** 并发池：固定 worker 数消费队列，异常已在 fn 内捕获。 */
async function runPool(items, limit, fn) {
  const queue = [...items];
  const n = Math.min(limit, queue.length);
  await Promise.all(Array.from({ length: n }, () => (async () => {
    while (queue.length) await fn(queue.shift());
  })()));
}

// ---------- 检查更新 ----------

function repoOf(plugin) {
  let repo = plugin.source?.repo ?? '';
  const m = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i.exec(repo);
  if (m) repo = `${m[1]}/${m[2]}`;
  return repo.replace(/\.git$/i, '');
}

function stripV(s) {
  return typeof s === 'string' ? s.replace(/^v/i, '').trim() : s;
}

/**
 * 单包检查。返回 { status, latest?, note? }：
 * latest / update / incompatible / no-release / unknown-version / error
 */
async function checkOne(plugin, { proxyUrl }, dshVersion) {
  const kind = plugin.source?.kind;
  const installed = valid(plugin.version ?? undefined);
  if (kind === 'npm') {
    const { notFound, json } = await fetchJson(`https://registry.npmjs.org/${plugin.name}/latest`);
    if (notFound) return { status: 'no-release', note: 'registry 上没有该包' };
    const latest = valid(stripV(json?.version) ?? undefined);
    if (!latest || !installed) return { status: 'unknown-version', latest: json?.version ?? null };
    if (!gt(latest, installed)) return { status: 'latest', latest };
    const range = typeof json?.engines?.dsh === 'string' ? json.engines.dsh : null;
    if (range && dshVersion && !satisfies(dshVersion, range, { includePrerelease: true })) {
      return { status: 'incompatible', latest, note: `需 dsh ${range}` };
    }
    return { status: 'update', latest };
  }
  if (kind === 'github') {
    const repo = repoOf(plugin);
    if (!/^[^/]+\/[^/]+$/.test(repo)) return { status: 'unknown-version', note: `无法识别仓库：${repo || plugin.source?.spec}` };
    const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
    let r = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`, { proxyUrl, headers });
    if (r.notFound) r = await fetchJson(`https://api.github.com/repos/${repo}/tags?per_page=1`, { proxyUrl, headers });
    if (r.notFound) return { status: 'no-release', note: '仓库没有 release/tag' };
    const tag = Array.isArray(r.json) ? r.json?.[0]?.name : r.json?.tag_name;
    const latest = valid(stripV(tag) ?? undefined);
    if (!latest || !installed) return { status: 'unknown-version', latest: tag ?? null };
    // release/tag 侧拿不到 engines.dsh（除非二次取包内容），GitHub 来源不做兼容预判
    if (!gt(latest, installed)) return { status: 'latest', latest };
    return { status: 'update', latest, tag };
  }
  return { status: 'unknown-version', note: `来源 ${kind} 不支持检查` };
}

// ---------- 盘点（snapshot 与 checkUpdates 共用）----------

async function collectInventory() {
  const errors = [];
  const dir = serviceBridge?.profile?.dir ?? null;
  const profileName = serviceBridge?.profile?.name ?? null;
  const pkg = dir ? await readJsonSafe(join(dir, 'package.json'), errors) : null;
  const deps = pkg?.dependencies ?? {};
  const started = new Set(Array.isArray(serviceBridge?.profile?.startedBundles)
    ? serviceBridge.profile.startedBundles : []);

  const plugins = [];
  for (const [name, spec] of Object.entries(deps)) {
    if (name === 'dsh') continue; // 宿主本体不是插件
    const meta = await readJsonSafe(join(dir, 'node_modules', ...name.split('/'), 'package.json'), errors);
    if (!meta || !meta.dsh) continue; // 没有 dsh 元数据的依赖不是插件（react、cordis 之类）
    plugins.push({
      name,
      version: typeof meta.version === 'string' ? meta.version : null,
      description: typeof meta.description === 'string' ? meta.description : null,
      official: isOfficial(name),
      started: started.has(name),
      source: parseSource(spec),
      hasClient: Boolean(meta.dsh?.client),
      hasPatch: Boolean(meta.dsh?.bundle?.patch),
    });
  }
  // 官方在前，同组内按名字排序，浏览器渲染顺序稳定
  plugins.sort((a, b) => (a.official === b.official
    ? a.name.localeCompare(b.name)
    : a.official ? -1 : 1));

  return { errors, profileName, plugins, started };
}

// ---------- 批量操作快照（M2）----------

const BATCH_OPS = new Set(['update', 'enable', 'disable', 'uninstall']);

/** 快照根目录：$DSH_HOME/plugin-keeper-backups/ */
function backupsRootOf() {
  const home = serviceBridge?.profile?.home
    || process.env.DSH_HOME
    || join(homedir(), '.dsh');
  return join(home, 'plugin-keeper-backups');
}

/**
 * 批量操作前备份 profile 配置（package.json + cordis.patch.yml）。
 * 每次一个目录，manifest.json 记录原路径→快照文件映射；保留最近 10 份。
 */
async function prepareBatchSnapshot(op) {
  const profile = serviceBridge?.profile ?? {};
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${op}`;
  const dir = join(backupsRootOf(), id);
  await mkdir(dir, { recursive: true });
  const sources = [];
  if (profile.dir) sources.push(join(profile.dir, 'package.json'));
  if (profile.patchPath) sources.push(profile.patchPath);
  const files = [];
  for (const src of sources) {
    const dest = join(dir, basename(src));
    await copyFile(src, dest);
    files.push({ from: src, to: dest });
  }
  const manifest = { id, at: new Date().toISOString(), op, profile: profile.name ?? null, files };
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  try {
    const entries = (await readdir(backupsRootOf())).sort();
    while (entries.length > 10) {
      const victim = entries.shift();
      if (victim && victim !== id) await rm(join(backupsRootOf(), victim), { recursive: true, force: true });
    }
  } catch { /* 清理失败不影响主流程 */ }
  return manifest;
}

/** 按快照 id 把备份文件复制回原位（id 白名单字符，杜绝路径穿越）。 */
async function restoreBatchSnapshot(id) {
  if (typeof id !== 'string' || !/^[\w.-]+$/.test(id)) throw new Error('非法快照 id');
  const dir = join(backupsRootOf(), id);
  const manifest = await readJsonSafe(join(dir, 'manifest.json'));
  if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error(`快照不存在或已损坏：${id}`);
  }
  const restored = [];
  for (const f of manifest.files) {
    await copyFile(f.to, f.from);
    restored.push(f.from);
  }
  return { id, op: manifest.op ?? null, at: manifest.at ?? null, restored };
}

/**
 * 运行态 RPC 服务：浏览器半区经 ctx.remote['dsh-plugin-keeper'] 调用。
 */
class PluginKeeperService extends TypertRemoteService {
  static inject = [];

  constructor(ctx) {
    super(ctx, 'PluginKeeperService', { namespace: 'dsh-plugin-keeper' });
    if (!serviceBridge) throw new Error('dsh-plugin-keeper: service bridge missing');
  }

  /**
   * 来源分组盘点快照（附带上次检查结果）。只读：碰的文件只有 profile
   * package.json、node_modules/<name>/package.json 与自己的状态文件。
   */
  async snapshot() {
    const { errors, profileName, plugins, started } = await collectInventory();
    const state = await readState();
    for (const p of plugins) {
      p.check = state.lastCheck?.results?.[p.name] ?? null;
    }
    return {
      ok: true,
      profileName,
      pluginCount: plugins.length,
      startedBundles: [...started],
      plugins,
      errors,
      lastCheckAt: state.lastCheck?.at ?? null,
      lastBatch: state.lastBatch,
      settings: { proxyUrl: state.proxyUrl },
      generatedAt: new Date().toISOString(),
    };
  }

  /** 一键检查更新：npm+GitHub 组全部并发检查，结果落盘。 */
  async checkUpdates() {
    const { plugins } = await collectInventory();
    const state = await readState();
    const dshVersion = probeDshVersion();
    const targets = plugins.filter((p) => !p.official
      && (p.source?.kind === 'npm' || p.source?.kind === 'github'));
    const results = {};
    await runPool(targets, 6, async (p) => {
      try {
        results[p.name] = await checkOne(p, state, dshVersion);
      } catch (e) {
        results[p.name] = { status: 'error', note: e?.message ?? String(e) };
      }
    });
    const at = new Date().toISOString();
    await writeState({ ...state, lastCheck: { at, results } });
    const counts = { update: 0, latest: 0, error: 0, other: 0 };
    for (const r of Object.values(results)) {
      if (r.status === 'update') counts.update += 1;
      else if (r.status === 'latest') counts.latest += 1;
      else if (r.status === 'error') counts.error += 1;
      else counts.other += 1;
    }
    return { ok: true, at, dshVersion, checked: targets.length, counts, results };
  }

  async getSettings() {
    const state = await readState();
    return { ok: true, proxyUrl: state.proxyUrl };
  }

  /** 保存设置：当前仅 GitHub API 代理 URL（'' = 直连）。 */
  async saveSettings(input) {
    const proxyUrl = typeof input?.proxyUrl === 'string' ? input.proxyUrl.trim() : '';
    if (proxyUrl !== '' && !/^https?:\/\/\S+$/i.test(proxyUrl)) {
      throw new Error('代理 URL 需为 http(s):// 开头，或留空表示直连');
    }
    const state = await readState();
    await writeState({ ...state, proxyUrl });
    return { ok: true, proxyUrl };
  }

  /**
   * 批量操作前备份 profile 配置。op ∈ update|enable|disable|uninstall；
   * 只落备份目录与自己的状态文件，真正的安装/启停由浏览器半区调官方
   * pluginManager 服务执行（本插件不碰 pnpm）。
   */
  async prepareBatch(input) {
    const op = typeof input?.op === 'string' ? input.op : '';
    if (!BATCH_OPS.has(op)) throw new Error(`不支持的操作：${op || '(空)'}`);
    const manifest = await prepareBatchSnapshot(op);
    const state = await readState();
    await writeState({ ...state, lastBatch: { id: manifest.id, at: manifest.at, op: manifest.op } });
    return { ok: true, id: manifest.id, op: manifest.op, at: manifest.at, files: manifest.files };
  }

  /** 把某次批量前的配置快照复制回原位（恢复后需重启生效）。 */
  async restoreBatch(input) {
    const r = await restoreBatchSnapshot(typeof input?.id === 'string' ? input.id : '');
    return { ok: true, ...r };
  }
}

markRemoteMethods(PluginKeeperService.prototype, [
  'snapshot',
  'checkUpdates',
  'getSettings',
  'saveSettings',
  'prepareBatch',
  'restoreBatch',
]);

export const inject = ['profileContext'];

export function apply(ctx) {
  const profile = ctx.profileContext ?? null;
  serviceBridge = { profile };
  ctx.effect(() => ctx.plugin(PluginKeeperService), 'dsh-plugin-keeper rpc service');
  ctx.effect(() => () => {
    serviceBridge = null;
  }, 'dsh-plugin-keeper bridge cleanup');
}
