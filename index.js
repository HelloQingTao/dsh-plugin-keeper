/**
 * dsh-plugin-keeper — Host half（Node 侧）。
 *
 * 职责：
 * - 盘点当前 profile 的插件：读 profile package.json 的 dependencies（spec 天然记录来源）
 *   + 每个包自己的 package.json（版本、dsh 元数据），汇成快照给浏览器半区。
 * - 官方包（dsh / @deepseek-ai/*）只标记，不做任何写操作。
 * - M1：一键检查更新——npm registry /latest 与 GitHub releases→tags 双通道，
 *   engines.dsh 兼容预判，结果持久化到 $DSH_HOME/plugin-keeper.json。
 * - 代理：页签里配置 http(s) 代理后，检查更新（GitHub API + npm registry）与
 *   GitHub 安装都走它；留空则跟随系统 HTTP(S)_PROXY / NO_PROXY / git 配置。
 *   账号/密码是独立字段，host 半区按 RFC 3986 编码组装 userinfo，密码不回浏览器。
 * - GitHub 安装地址归一化见 github-spec.js（带/不带 github: 前缀统一收敛）。
 *
 * 依赖解析：@deepseek-ai/dsh-typert-protocol 走 peerDependencies（^0.2.0-rc.2），
 * 宿主 ResolutionRouter 会把它路由到安装域的同一份副本，保证类标记一致。
 * undici / semver 是本插件自己的 dependencies，装在插件目录 node_modules。
 */

import { readFile, writeFile, chmod, copyFile, mkdir, readdir, rm, stat, realpath } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname, basename, isAbsolute, normalize } from 'node:path';
import { homedir } from 'node:os';
import { request } from 'undici';
import { gt, satisfies, valid } from 'semver';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import {
  dispatcherFor,
  normalizeProxyUrl,
  composeProxyUrl,
  splitProxyCredentials,
  applyInstallProxy,
  releaseInstallProxy,
  setPnpmCommand,
  setContextVerified,
} from './proxy-policy.js';
import { normalizeGithubSpec as parseGithubSpec, tryNormalizeGithubSpec, githubRepoKey } from './github-spec.js';
import {
  createExport,
  discoverHomeConfig,
  parsePatchRow,
  splitPatchRows,
} from './export.js';
import { EXPORT_DIR_NAME } from './export.js';
import {
  IMPORT_DIR_NAME,
  MAX_IMPORT_BYTES,
  analyzeImportPackage,
  applyPatchConfig,
  cleanupImportStage,
  stageImportPackage,
} from './import.js';

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
export function parseSource(spec) {
  if (typeof spec !== 'string' || spec === '') return { kind: 'unknown', spec: String(spec ?? '') };
  if (/^(file|link|workspace):/.test(spec)) return { kind: 'local', spec };
  // 带/不带 github: 前缀、完整 URL、SSH、.git、#ref 都收敛成 owner/repo + ref
  const g = tryNormalizeGithubSpec(spec);
  if (g) return { kind: 'github', spec, repo: `${g.owner}/${g.repo}`, ref: g.ref };
  if (/^https?:/i.test(spec)) return { kind: 'github', spec, repo: spec };
  return { kind: 'npm', spec };
}

/**
 * 本地来源（file:/link:）spec → 插件源码目录绝对路径。
 * `file:/abs` 按绝对路径；其余（`file:./x`、`file:../x`、`file:x`、`link:…`）
 * 相对 profile dir 解析。scheme 大小写与 parseSource 同口径（区分，npm spec 惯例小写）。
 * workspace: 指向 monorepo 包、无法从 spec 定位，返回 null。
 */
function localSpecPath(spec, dir) {
  const m = /^(file|link):(.+)$/.exec(String(spec ?? ''));
  if (!m || !dir) return null;
  const rest = m[2].trim();
  if (isAbsolute(rest)) return normalize(rest);
  return normalize(join(dir, rest.replace(/^\.\//, '')));
}

/**
 * 本地插件的「插件所在路径」：spec 解析出的源码目录存在则用之；
 * 否则（workspace: 或 spec 路径已挪走）回退到 node_modules 安装位 symlink
 * 的真实目标；两者都拿不到返回 null（前端不显示图标）。
 */
async function localPluginPath(name, source, dir) {
  const fromSpec = localSpecPath(source?.spec, dir);
  if (fromSpec) {
    try {
      const s = await stat(fromSpec);
      if (s.isDirectory()) return fromSpec;
    } catch { /* spec 路径不存在，走回退 */ }
  }
  if (dir) {
    try {
      return await realpath(join(dir, 'node_modules', ...name.split('/')));
    } catch { /* 未安装 */ }
  }
  return null;
}

async function readJsonSafe(path, errors) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (e) {
    errors?.push({ path, message: e?.message ?? String(e) });
    return null;
  }
}

// ---------- 导出：配置抽取 ----------

/** 读文件（不存在返回 null，不记错）。 */
async function readFileSafe(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * 从 profile 的 patch 文档里抽出「属于这些插件的 config 片段」。
 *
 * 精确口径：patch 行里的 `name:` 与插件包名相等才算命中（不是模糊匹配 ——
 * 模糊匹配会把「配置属于别的插件」这种错配写进导出包，比漏配更难查）。
 *
 * @returns {Array<{rel: string, kind: 'patch', plugin: string, path: string, text: string, id: string|null}>}
 */
function collectPatchConfig(patchText, plugins) {
  const names = new Set(plugins.map((p) => p.name));
  const out = [];
  for (const row of splitPatchRows(patchText)) {
    const parsed = parsePatchRow(row);
    if (parsed.name === null || !names.has(parsed.name)) continue;
    if (parsed.config === null) continue;
    const rel = `patch/${parsed.name}.yml`;
    out.push({
      rel,
      kind: 'patch',
      plugin: parsed.name,
      path: null, // 片段是内存文本，落盘时另写
      text: parsed.config,
      id: parsed.id,
    });
  }
  return out;
}

/**
 * 读插件自述声明的 dsh.dataDirs（配置目录）。
 * 契约见 dsh-config-manager 的 docs/spec/plugin-data-declaration.md：
 *   { "dsh": { "dataDirs": [ { "path": ".my-plugin", "role": "config" } ] } }
 * 形状不认识就跳过（绝不猜路径）。
 */
async function readDeclaredDataDirs(plugin) {
  const out = [];
  const manifestPath = plugin.installedPath
    ? join(plugin.installedPath, 'package.json')
    : null;
  if (manifestPath === null) return out;
  const raw = await readJsonSafe(manifestPath);
  const declared = raw?.dsh?.dataDirs;
  if (!Array.isArray(declared)) return out;
  for (const item of declared) {
    if (item === null || typeof item !== 'object') continue;
    const rel = typeof item.path === 'string' ? item.path.trim() : '';
    // 只接受 POSIX 相对路径（拒绝绝对路径 / .. / 空段）
    if (rel === '' || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) continue;
    if (rel.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) continue;
    const abs = join(homedir(), rel);
    let sizeBytes = 0;
    try {
      const st = await stat(abs);
      sizeBytes = st.size;
    } catch {
      continue; // 目录不存在 → 跳过
    }
    out.push({ rel, role: item.role === 'assets' ? 'assets' : 'config', sizeBytes });
  }
  return out;
}

// ---------- 导入：包读取与豁免表 ----------

/** 导入暂存目录（相对 $DSH_HOME）。 */
function importsRootOf() {
  const home = serviceBridge?.profile?.home
    || process.env.DSH_HOME
    || join(homedir(), '.dsh');
  return join(home, IMPORT_DIR_NAME);
}

/**
 * 读导入批次里的包字节。
 * @returns {Promise<Buffer|null>}
 */
async function readImportBuffer(home, id) {
  if (!/^[\w.-]+$/.test(id)) return null;
  try {
    const data = await readFile(join(home, IMPORT_DIR_NAME, id, 'package.zip'));
    return data;
  } catch {
    return null;
  }
}

/**
 * 读 profile 的兼容豁免表（compatibility.json）。
 *
 * 口径与宿主 readProfileCompatibility 一致：键必须是精确的 `<pkg>@<version>`，
 * 值必须是 DSH 精确版本数组；不认识的记录**忽略**（不猜）。
 */
function readProfileExemptions(profileDir) {
  const out = {};
  if (!profileDir) return out;
  let text;
  try {
    text = readFileSync(join(profileDir, 'compatibility.json'), 'utf8');
  } catch {
    return out;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return out;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, versions] of Object.entries(value)) {
    const at = key.lastIndexOf('@');
    if (at <= 0) continue;
    if (!Array.isArray(versions)) continue;
    if (!versions.every((v) => typeof v === 'string')) continue;
    out[key] = versions;
  }
  return out;
}

// ---------- 状态文件（$DSH_HOME/plugin-keeper.json）----------

function statePathOf() {
  const home = serviceBridge?.profile?.home
    || process.env.DSH_HOME
    || join(homedir(), '.dsh');
  return join(home, 'plugin-keeper.json');
}

const STATE_DEFAULT = Object.freeze({
  proxyUrl: '',
  proxyUser: '',
  proxyPass: '',
  // 「在设置页也显示插件运维」：默认关（插件页 Tab 常驻，设置页不重复出现）。
  showInSettings: false,
  lastCheck: null,
  lastBatch: null,
});

/** 对外可见的设置：密码永不返回浏览器，只给一个 hasProxyPass 标记。 */
export function publicProxySettings(state) {
  return {
    proxyUrl: state?.proxyUrl ?? '',
    proxyUser: state?.proxyUser ?? '',
    hasProxyPass: Boolean(state?.proxyPass),
    showInSettings: state?.showInSettings === true,
  };
}

async function readState() {
  const raw = await readJsonSafe(statePathOf());
  const user = typeof raw?.proxyUser === 'string' ? raw.proxyUser : '';
  const pass = typeof raw?.proxyPass === 'string' ? raw.proxyPass : '';
  // 旧配置 / 用户直接粘的带 userinfo 地址 → 就地迁移成三个字段，
  // 下次 writeState 落盘即为拆分后的形态，凭据不再散落两处。
  const split = splitProxyCredentials(typeof raw?.proxyUrl === 'string' ? raw.proxyUrl : '');
  return {
    proxyUrl: split.proxyUrl,
    proxyUser: user || split.proxyUser,
    proxyPass: pass || split.proxyPass,
    // 缺字段 = 旧状态文件 → 按默认（false）处理，不当成 true
    showInSettings: raw?.showInSettings === true,
    lastCheck: raw?.lastCheck && typeof raw.lastCheck === 'object' ? raw.lastCheck : null,
    lastBatch: raw?.lastBatch && typeof raw.lastBatch === 'object' ? raw.lastBatch : null,
  };
}

async function writeState(state) {
  const path = statePathOf();
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  // mode 只在新建时生效；历史文件是 644，含凭据时必须显式收紧
  await chmod(path, 0o600).catch(() => {});
}

// 状态文件读改写互斥：所有 lastCheck/lastBatch/proxyUrl 的"读→合并→写"走同一条
// promise 链。否则并发写（批量上报 vs 检查更新 vs 改代理）会整文件覆盖互相抹写。
let stateQueue = Promise.resolve();
function withStateLock(fn) {
  const run = stateQueue.then(fn, fn); // 前序失败不阻断后续写入
  stateQueue = run.catch(() => {});
  return run;
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

// ---------- HTTP（undici；代理策略见 proxy-policy.js）----------

// 配了代理 → 所有请求（含 npm registry）走 ProxyAgent；
// 留空 → EnvHttpProxyAgent 跟随系统 HTTP(S)_PROXY / NO_PROXY。
// dispatcherFor 由 proxy-policy.js 提供并按 proxyUrl 缓存；undici v7 起
// request 不再收 maxRedirections，重定向拦截器在策略模块里挂到 dispatcher 上。

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

/**
 * 并发映射：固定 worker 数消费下标队列，结果按输入顺序返回。
 * 异常在 fn 内捕获（与旧 runPool 同约定：调用方负责兜底）。
 */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** 检查结果计数：update / latest / error / other。 */
function countResults(results) {
  const counts = { update: 0, latest: 0, error: 0, other: 0 };
  for (const r of Object.values(results ?? {})) {
    if (r.status === 'update') counts.update += 1;
    else if (r.status === 'latest') counts.latest += 1;
    else if (r.status === 'error') counts.error += 1;
    else counts.other += 1;
  }
  return counts;
}

// ---------- 代理策略应用（幂等，多个入口共用） ----------

let lastProxyStatus = { ok: false, verified: false, reason: 'not-applied', mode: 'unknown' };
let loggedProxyMode = null;

/** 按落盘的三个字段组装代理 URL 并应用安装通道；检查通道由 dispatcherFor 按同值懒切换。 */
async function applyProxyPolicy(stateOverride) {
  let state;
  try {
    state = stateOverride ?? await readState();
  } catch (e) {
    lastProxyStatus = { ok: false, verified: false, reason: `state-read-failed: ${e?.message ?? e}`, mode: 'unknown' };
    return lastProxyStatus;
  }
  const effective = composeProxyUrl(state.proxyUrl, state.proxyUser, state.proxyPass);
  const applied = applyInstallProxy(serviceBridge?.profile, effective);
  // 不把含凭据的 URL 放进状态：它会经 snapshot 返回浏览器
  lastProxyStatus = {
    ok: applied.ok,
    verified: applied.verified ?? false,
    reason: applied.reason ?? null,
    mode: effective ? (state.proxyUser ? 'proxy-with-auth' : 'proxy') : 'system-default',
  };
  // 只在档位变化时打点：启动期一条，便于从宿主日志确认凭据是否真的被采用
  if (loggedProxyMode !== lastProxyStatus.mode) {
    loggedProxyMode = lastProxyStatus.mode;
    console.log(`[dsh-plugin-keeper] proxy policy: mode=${loggedProxyMode} ok=${lastProxyStatus.ok} verified=${lastProxyStatus.verified}`);
  }
  return lastProxyStatus;
}

function proxyStatus() {
  return { ...lastProxyStatus };
}

// ---------- 检查更新 ----------

function repoOf(plugin) {
  const repo = plugin.source?.repo ?? '';
  // parseSource 已统一成 owner/repo；这里只兜底旧快照里的 URL 形态
  return githubRepoKey(repo) ?? repo.replace(/\.git$/i, '');
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
    const { notFound, json } = await fetchJson(`https://registry.npmjs.org/${plugin.name}/latest`, { proxyUrl });
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

/**
 * 单个来源分组的检查：组内并发（npm 8 / github 3），异常归一为 error 结果。
 * 返回 { results, checked }；checked = 本组实际发起检查的包数。
 */
async function checkGroupInternal(kind, plugins, state, dshVersion) {
  const targets = plugins.filter((p) => !p.official && p.source?.kind === kind);
  const limit = kind === 'npm' ? 8 : 3;
  const results = {};
  await mapLimit(targets, limit, async (p) => {
    try {
      results[p.name] = await checkOne(p, state, dshVersion);
    } catch (e) {
      // note 附带 e.code/e.name 前缀（如 TimeoutError/UND_ERR_CONNECT_TIMEOUT），
      // 客户端据此识别连接类失败并提示代理问题
      const msg = e?.message ?? String(e);
      const tag = e?.code ?? e?.name;
      results[p.name] = { status: 'error', note: tag ? `${tag} ${msg}` : msg };
    }
  });
  return { results, checked: targets.length };
}

// ---------- 盘点（snapshot 与 checkUpdates 共用）----------

async function collectInventory() {
  const errors = [];
  const dir = serviceBridge?.profile?.dir ?? null;
  const profileName = serviceBridge?.profile?.name ?? null;
  const started = new Set(Array.isArray(serviceBridge?.profile?.startedBundles)
    ? serviceBridge.profile.startedBundles : []);
  if (!dir) return { errors, profileName, plugins: [], started };

  const pkg = await readJsonSafe(join(dir, 'package.json'), errors);
  const deps = pkg?.dependencies ?? {};
  const entries = Object.entries(deps).filter(([name]) => name !== 'dsh'); // 宿主本体不是插件

  // 组内并发读包元数据：串行时每个包一次 readFile（+本地路径 stat/realpath），
  // 慢盘上会线性放大；并发后整轮盘点与包数基本无关。
  const plugins = (await mapLimit(entries, 8, async ([name, spec]) => {
    const meta = await readJsonSafe(join(dir, 'node_modules', ...name.split('/'), 'package.json'), errors);
    if (!meta || !meta.dsh) return null; // 没有 dsh 元数据的依赖不是插件（react、cordis 之类）
    const source = parseSource(spec);
    return {
      name,
      version: typeof meta.version === 'string' ? meta.version : null,
      description: typeof meta.description === 'string' ? meta.description : null,
      official: isOfficial(name),
      started: started.has(name),
      source,
      // 本地插件附「插件所在路径」（打开图标 hover/复制用），其余来源恒为 null
      localPath: source.kind === 'local' ? await localPluginPath(name, source, dir) : null,
      // 安装位目录（导出打包用；本地源优先用 localPath —— 那才是真实源码）
      installedPath: join(dir, 'node_modules', ...name.split('/')),
      hasClient: Boolean(meta.dsh?.client),
      hasPatch: Boolean(meta.dsh?.bundle?.patch),
    };
  })).filter(Boolean);

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
    try {
      await copyFile(src, dest);
    } catch {
      // 源文件不存在（新建 profile / 缺 package.json）不算失败 ——
      // 快照能备多少备多少，缺的那份本来就不存在，恢复时也无从破坏。
      continue;
    }
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
export class PluginKeeperService extends TypertRemoteService {
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
    const t0 = Date.now();
    const { errors, profileName, plugins, started } = await collectInventory();
    const t1 = Date.now();
    const state = await readState();
    await applyProxyPolicy(state);
    const t2 = Date.now();
    for (const p of plugins) {
      p.check = state.lastCheck?.results?.[p.name] ?? null;
    }
    // 打点：区分「读盘慢」与「状态文件慢」，用于定位开页签的等待来源
    console.debug(`[dsh-plugin-keeper] snapshot inventory=${t1 - t0}ms state=${t2 - t1}ms plugins=${plugins.length}`);
    return {
      ok: true,
      profileName,
      pluginCount: plugins.length,
      startedBundles: [...started],
      plugins,
      errors,
      lastCheckAt: state.lastCheck?.at ?? null,
      lastBatch: state.lastBatch,
      settings: publicProxySettings(state),
      proxy: proxyStatus(),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 按来源分组检查更新（npm / github 两组各自独立）。
   * 组内并发：npm 组 8（registry 无严格限流），github 组 3（API 限流 + 代理）。
   * 各组互不阻塞：npm 组慢/失败不影响 github 组出结果。
   */
  async checkGroup(input) {
    const kind = typeof input?.kind === 'string' ? input.kind : '';
    if (kind !== 'npm' && kind !== 'github') throw new Error(`不支持的分组：${kind || '(空)'}`);
    const { plugins } = await collectInventory();
    const state = await readState();
    const dshVersion = probeDshVersion();
    const effectiveState = { ...state, proxyUrl: composeProxyUrl(state.proxyUrl, state.proxyUser, state.proxyPass) };
    const { results, checked } = await checkGroupInternal(kind, plugins, effectiveState, dshVersion);
    const at = new Date().toISOString();
    await withStateLock(async () => {
      const latest = await readState();
      const prev = latest.lastCheck ?? {};
      await writeState({
        ...latest,
        lastCheck: {
          at,
          byGroup: { ...(prev.byGroup ?? {}), [kind]: at },
          // 合并而非覆盖：只查一组时保留另一组的历史结果
          results: { ...(prev.results ?? {}), ...results },
        },
      });
    });
    return { ok: true, kind, at, checked, counts: countResults(results), results };
  }

  /** 一键检查更新：npm+GitHub 两组并行检查，结果落盘（保留兼容入口）。 */
  async checkUpdates() {
    const { plugins } = await collectInventory();
    const state = await readState();
    const dshVersion = probeDshVersion();
    const effectiveState = { ...state, proxyUrl: composeProxyUrl(state.proxyUrl, state.proxyUser, state.proxyPass) };
    const groups = await Promise.all(['npm', 'github']
      .map((kind) => checkGroupInternal(kind, plugins, effectiveState, dshVersion)));
    const results = Object.assign({}, ...groups.map((g) => g.results));
    const at = new Date().toISOString();
    await withStateLock(async () => {
      const latest = await readState();
      await writeState({ ...latest, lastCheck: { at, results } });
    });
    return {
      ok: true,
      at,
      dshVersion,
      checked: groups.reduce((n, g) => n + g.checked, 0),
      counts: countResults(results),
      results,
    };
  }

  async getSettings() {
    const state = await readState();
    return { ok: true, ...publicProxySettings(state) };
  }

  /** GitHub 安装地址归一化的唯一入口；顺便在安装前同步一次代理策略。 */
  async normalizeGithubSpec(input) {
    await applyProxyPolicy();
    try {
      return { ok: true, ...parseGithubSpec(input?.raw ?? input) };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  }

  /**
   * 保存设置：
   *  - proxyUrl：'' = 跟随系统代理；填 host:port 自动补 http://
   *  - proxyUser / proxyPass：HTTP Basic 凭据。密码传空串 = 保持原值（不回显）；
   *    账号清空 = 取消认证，同时清掉密码。地址里直接粘 userinfo 会自动拆分。
   *  - showInSettings：是否在设置页也显示本插件
   * 只更新显式传入的字段（点开关不会清空代理）；保存后立即应用策略。
   */
  async saveSettings(input) {
    const has = (k) => Object.hasOwn(input ?? {}, k);
    let proxyUrl = null;
    let proxyUser = null;
    let proxyPass = null;
    if (has('proxyUrl')) {
      const split = splitProxyCredentials(normalizeProxyUrl(input.proxyUrl));
      proxyUrl = split.proxyUrl;
      // 用户直接粘了带 userinfo 的完整地址 → 同步拆到独立字段
      if (split.proxyUser) { proxyUser = split.proxyUser; proxyPass = split.proxyPass; }
    }
    if (has('proxyUser')) proxyUser = String(input.proxyUser ?? '').trim();
    if (has('proxyPass')) {
      const v = String(input.proxyPass ?? '');
      if (v !== '') proxyPass = v;
    }
    const clearCredentials = has('proxyUser') && proxyUser === '';
    const showInSettings = typeof input?.showInSettings === 'boolean' ? input.showInSettings : null;
    await withStateLock(async () => {
      const state = await readState();
      await writeState({
        ...state,
        ...(proxyUrl === null ? {} : { proxyUrl }),
        ...(proxyUser === null ? {} : { proxyUser }),
        ...(proxyPass === null ? {} : { proxyPass }),
        ...(clearCredentials ? { proxyPass: '' } : {}),
        ...(showInSettings === null ? {} : { showInSettings }),
      });
    });
    const latest = await readState();
    await applyProxyPolicy(latest);
    return { ok: true, ...publicProxySettings(latest) };
  }

  /**
   * 批量操作前备份 profile 配置。op ∈ update|enable|disable|uninstall；
   * 只落备份目录与自己的状态文件，真正的安装/启停由浏览器半区调官方
   * pluginManager 服务执行（本插件不碰 pnpm）。
   */
  async prepareBatch(input) {
    const op = typeof input?.op === 'string' ? input.op : '';
    if (!BATCH_OPS.has(op)) throw new Error(`不支持的操作：${op || '(空)'}`);
    await applyProxyPolicy();
    const manifest = await prepareBatchSnapshot(op);
    await withStateLock(async () => {
      const state = await readState();
      await writeState({ ...state, lastBatch: { id: manifest.id, at: manifest.at, op: manifest.op } });
    });
    return { ok: true, id: manifest.id, op: manifest.op, at: manifest.at, files: manifest.files };
  }

  /**
   * 导入预演：解包 → 兼容性预检 → 冲突检测，返回给弹框展示。
   *
   * 输入是导出包的文件名（浏览器把文件传到宿主半的导入暂存目录后，
   * 用本方法给出的 id 引用）。这里只读不写 —— 真正的安装与配置写入
   * 由 executeImport 在用户确认策略后执行。
   */
  async planImport(input) {
    const id = typeof input?.id === 'string' ? input.id : '';
    if (!/^[\w.-]+$/.test(id)) return { ok: false, error: '非法的导入批次 id' };
    const home = serviceBridge?.profile?.home ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
    const buffer = await readImportBuffer(home, id);
    if (buffer === null) return { ok: false, error: '导入包不存在或已被清理' };

    const { plugins } = await collectInventory();
    const exemptions = readProfileExemptions(serviceBridge?.profile?.dir ?? '');
    try {
      const analysis = await analyzeImportPackage(buffer, {
        profileDir: serviceBridge?.profile?.dir ?? '',
        home,
        runtimeVersion: probeDshVersion() ?? '0.0.0',
        exemptions,
        installed: plugins.map((p) => ({ name: p.name, version: p.version })),
        satisfies: (v, r) => satisfies(v, r, { includePrerelease: true }),
      });
      return { ok: true, id, ...analysis };
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  }

  /**
   * 执行导入：按用户选定的策略装插件 + 写配置。
   *
   * 策略（每个冲突项独立选）：
   *  - 插件（同名已装）：'replace' 卸本机再装包内 tarball / 'keep' 跳过 / 'skip-incompatible' 跳过不兼容
   *  - 配置（patch / 独立文件）：'import' 以导出包为准 / 'keep' 以本机为准
   *
   * 覆盖动作前先做 profile 快照（prepareBatchSnapshot），可一键恢复。
   */
  async executeImport(input) {
    const id = typeof input?.id === 'string' ? input.id : '';
    if (!/^[\w.-]+$/.test(id)) return { ok: false, error: '非法的导入批次 id' };
    const home = serviceBridge?.profile?.home ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
    const profileDir = serviceBridge?.profile?.dir ?? '';
    const buffer = await readImportBuffer(home, id);
    if (buffer === null) return { ok: false, error: '导入包不存在或已被清理' };

    const { plugins } = await collectInventory();
    const exemptions = readProfileExemptions(profileDir);
    const runtimeVersion = probeDshVersion() ?? '0.0.0';
    let analysis;
    try {
      analysis = await analyzeImportPackage(buffer, {
        profileDir,
        home,
        runtimeVersion,
        exemptions,
        installed: plugins.map((p) => ({ name: p.name, version: p.version })),
        satisfies: (v, r) => satisfies(v, r, { includePrerelease: true }),
      });
    } catch (e) {
      return { ok: false, error: String(e?.message ?? e) };
    }

    // 暂存 tarball（官方 installBundle 要求绝对路径的 file: spec）
    const staged = await stageImportPackage(buffer, home, id);
    const pluginStrategies = new Map(
      (Array.isArray(input?.pluginStrategies) ? input.pluginStrategies : [])
        .filter((s) => s && typeof s.name === 'string')
        .map((s) => [s.name, typeof s.strategy === 'string' ? s.strategy : 'keep']),
    );
    const configStrategies = new Map(
      (Array.isArray(input?.configStrategies) ? input.configStrategies : [])
        .filter((s) => s && typeof s.rel === 'string')
        .map((s) => [s.rel, typeof s.strategy === 'string' ? s.strategy : 'keep']),
    );

    const results = [];
    let snapshot = null;
    const needSnapshot = analysis.config.some((c) => configStrategies.get(c.rel) === 'import');
    if (needSnapshot) {
      snapshot = await prepareBatchSnapshot('import');
      await withStateLock(async () => {
        const state = await readState();
        await writeState({ ...state, lastBatch: { id: snapshot.id, at: snapshot.at, op: 'import' } });
      });
    }

    // ---- 插件 ----
    for (const p of analysis.plugins) {
      const strategy = pluginStrategies.get(p.name) ?? 'keep';
      if (strategy === 'keep') {
        results.push({ name: p.name, op: 'import', status: 'skipped', note: '按策略保留本机版本' });
        continue;
      }
      if (!p.hasTarball) {
        results.push({ name: p.name, op: 'import', status: 'failed', note: '导出包里没有该插件的 tarball' });
        continue;
      }
      if (p.compatibility.status === 'incompatible') {
        results.push({
          name: p.name,
          op: 'import',
          status: 'skipped',
          note: `不兼容：${p.compatibility.note}`,
        });
        continue;
      }
      if (p.integrityOk === false) {
        results.push({ name: p.name, op: 'import', status: 'failed', note: 'tarball 完整性校验失败（sha256 不符）' });
        continue;
      }
      const tarballPath = staged.tarballs.get(p.tarball);
      if (tarballPath === undefined) {
        results.push({ name: p.name, op: 'import', status: 'failed', note: 'tarball 暂存失败' });
        continue;
      }
      results.push({
        name: p.name,
        op: 'import',
        status: 'ok',
        note: `待安装（${p.version ?? '?'}）· ${tarballPath}`,
        tarballPath,
        version: p.version,
      });
    }

    // ---- 配置 ----
    // profile.patchPath 是宿主的权威路径（PROFILE_PATCH_FILENAME）；缺了再按约定拼。
    const patchPath = serviceBridge?.profile?.patchPath ?? join(profileDir, 'cordis.patch.yml');
    let patchText = await readFileSafe(patchPath);
    let patchChanged = false;
    for (const c of analysis.config) {
      const strategy = configStrategies.get(c.rel) ?? 'keep';
      if (strategy !== 'import') {
        results.push({ name: c.rel, op: 'config', status: 'skipped', note: '按策略保留本机配置' });
        continue;
      }
      if (c.kind === 'patch') {
        if (patchText === null) {
          results.push({ name: c.rel, op: 'config', status: 'failed', note: '读不到 profile 的 cordis.patch.yml' });
          continue;
        }
        const applied = applyPatchConfig(patchText, {
          pluginName: c.plugin,
          patchId: c.patchId ?? c.localId ?? null,
          newConfig: c.importedText,
        });
        patchText = applied.text;
        patchChanged = applied.changed;
        results.push({
          name: c.rel,
          op: 'config',
          status: 'ok',
          note: `profile 配置${applied.action === 'inserted' ? '新增' : '已替换'}`,
        });
      } else {
        try {
          await mkdir(dirname(c.localPath), { recursive: true });
          await writeFile(c.localPath, c.importedText, 'utf8');
          results.push({ name: c.rel, op: 'config', status: 'ok', note: '已写入独立配置文件' });
        } catch (e) {
          results.push({ name: c.rel, op: 'config', status: 'failed', note: String(e?.message ?? e) });
        }
      }
    }
    if (patchChanged && patchText !== null) {
      try {
        await writeFile(patchPath, patchText, 'utf8');
      } catch (e) {
        results.push({ name: 'cordis.patch.yml', op: 'config', status: 'failed', note: String(e?.message ?? e) });
      }
    }

    return {
      ok: true,
      id,
      results,
      snapshotId: snapshot?.id ?? null,
      tarballs: Object.fromEntries(staged.tarballs),
      runtimeVersion,
    };
  }

  /**
   * 导出预演：列出「将导出哪些插件 + 哪些配置」，供弹框确认。
   *
   * 返回三类配置候选（都要在弹框里如实列出，用户可逐项取消）：
   *  - patch：profile cordis.patch.yml 里该插件的 config 片段（精确，按 name 匹配）
   *  - home：$DSH_HOME 顶层的独立配置文件/目录（启发式，带置信度）
   *  - declared：插件自述声明的 dsh.dataDirs（本机暂无插件声明，接口先备好）
   */
  async planExport(input) {
    const names = Array.isArray(input?.names) ? input.names.filter((n) => typeof n === 'string') : [];
    const { plugins, profileName } = await collectInventory();
    const byName = new Map(plugins.map((p) => [p.name, p]));
    const targets = names.map((n) => byName.get(n)).filter((p) => p && !p.official);

    const home = serviceBridge?.profile?.home ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
    const patchPath = serviceBridge?.profile?.patchPath ?? join(serviceBridge?.profile?.dir ?? '', 'cordis.patch.yml');
    const patchText = await readFileSafe(patchPath);
    const patchItems = patchText === null ? [] : collectPatchConfig(patchText, targets);

    const homeItems = await discoverHomeConfig(home, targets.map((p) => p.name));
    const declaredItems = [];
    for (const p of targets) {
      const declared = await readDeclaredDataDirs(p);
      for (const d of declared) {
        declaredItems.push({
          rel: d.rel,
          kind: 'dir',
          plugin: p.name,
          path: join(homedir(), d.rel),
          sizeBytes: d.sizeBytes,
          role: d.role,
          source: 'declared',
        });
      }
    }

    return {
      ok: true,
      profileName,
      plugins: targets.map((p) => ({
        name: p.name,
        version: p.version,
        spec: p.source?.spec ?? '',
        sourceKind: p.source?.kind ?? 'unknown',
        localPath: p.localPath,
        hasConfig: patchItems.some((i) => i.plugin === p.name)
          || homeItems.some((i) => i.plugin === p.name)
          || declaredItems.some((i) => i.plugin === p.name),
      })),
      config: {
        patch: patchItems,
        home: homeItems.map((i) => ({
          rel: i.rel,
          kind: i.kind,
          plugin: i.plugin,
          path: i.path,
          sizeBytes: i.sizeBytes,
          score: i.score,
          suspicious: i.suspicious,
          source: 'home',
        })),
        declared: declaredItems,
      },
      warnings: [],
    };
  }

  /**
   * 执行导出：把所选插件打成 zip（可选带配置），落到 $DSH_HOME/plugin-keeper-exports/。
   * 返回产物路径与文件名，浏览器再走 loopback 路由下载。
   */
  async exportPlugins(input) {
    const names = Array.isArray(input?.names) ? input.names.filter((n) => typeof n === 'string') : [];
    const includeConfig = input?.includeConfig === true;
    const configRels = Array.isArray(input?.configRels) ? input.configRels.filter((r) => typeof r === 'string') : [];
    const { plugins, profileName } = await collectInventory();
    const byName = new Map(plugins.map((p) => [p.name, p]));
    const targets = names.map((n) => byName.get(n)).filter((p) => p && !p.official);
    if (targets.length === 0) return { ok: false, error: '没有可导出的插件（官方插件不参与导出）' };

    const home = serviceBridge?.profile?.home ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
    const patchPath = serviceBridge?.profile?.patchPath ?? join(serviceBridge?.profile?.dir ?? '', 'cordis.patch.yml');
    const configItems = [];
    if (includeConfig && configRels.length > 0) {
      const patchText = await readFileSafe(patchPath);
      const patchItems = patchText === null ? [] : collectPatchConfig(patchText, targets);
      const homeItems = await discoverHomeConfig(home, targets.map((p) => p.name));
      const allow = new Set(configRels);
      for (const item of patchItems) {
        if (!allow.has(item.rel)) continue;
        configItems.push({ rel: item.rel, kind: 'patch', plugin: item.plugin, path: null, text: item.text });
      }
      for (const item of homeItems) {
        if (!allow.has(item.rel)) continue;
        if (item.suspicious) continue; // 疑似凭据：即使勾选也不带走
        configItems.push({ rel: item.rel, kind: item.kind, plugin: item.plugin, path: item.path });
      }
    }

    const result = await createExport({
      home,
      profileName,
      dshVersion: probeDshVersion(),
      plugins: targets,
      configItems,
    });
    if (!result.ok) return { ok: false, error: result.error ?? '导出失败' };
    return {
      ok: true,
      id: result.id,
      filename: result.filename,
      sizeBytes: result.sizeBytes,
      manifest: result.manifest,
      warnings: result.warnings,
    };
  }

  /**
   * 把某次批量前的配置快照复制回原位（恢复后需重启生效）。
   * 快照被消费后清除 lastBatch：恢复入口随之消失，客户端恢复 effect 不会弹回旧台账。
   */
  async restoreBatch(input) {
    const r = await restoreBatchSnapshot(typeof input?.id === 'string' ? input.id : '');
    await withStateLock(async () => {
      const state = await readState();
      await writeState({ ...state, lastBatch: null });
    });
    return { ok: true, ...r };
  }

  /**
   * 批量执行结束后由浏览器半区上报结果台账，落盘到 lastBatch（含 results/counts），
   * 供页面切换/重开后恢复展示与「需重启」提醒。id 须与 prepareBatch 写入的一致，
   * 防止过期报告覆盖新一轮批量。
   */
  async reportBatch(input) {
    const op = typeof input?.op === 'string' ? input.op : '';
    const id = typeof input?.id === 'string' ? input.id : '';
    if (!BATCH_OPS.has(op)) throw new Error(`不支持的操作：${op || '(空)'}`);
    // 结果形状白名单：status 限合法值，note/name 限字符串并截断，防脏数据入库失真
    const STATUS_OK = new Set(['ok', 'restart', 'failed', 'skipped']);
    const results = Array.isArray(input?.results)
      ? input.results
        .filter((r) => r && typeof r === 'object' && typeof r.name === 'string' && STATUS_OK.has(r.status))
        .slice(0, 500)
        .map((r) => ({
          name: r.name.slice(0, 200),
          op: typeof r.op === 'string' ? r.op.slice(0, 20) : '',
          status: r.status,
          note: typeof r.note === 'string' ? r.note.slice(0, 500) : '',
        }))
      : [];
    const raw = input?.counts && typeof input.counts === 'object' ? input.counts : {};
    const clamp = (v) => (Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);
    const counts = {
      ok: clamp(raw.ok),
      restart: clamp(raw.restart),
      fail: clamp(raw.fail),
      skip: clamp(raw.skip),
    };
    let mismatch = false;
    await withStateLock(async () => {
      const state = await readState();
      if (state.lastBatch?.id !== id) {
        mismatch = true; // 已有更新的批量记录，忽略过期上报
        return;
      }
      await writeState({ ...state, lastBatch: { id, at: state.lastBatch?.at ?? null, op, results, counts } });
    });
    if (mismatch) return { ok: false, error: 'batch id mismatch（已有更新的批量记录，忽略本次上报）' };
    return { ok: true, id, op, count: results.length };
  }
}

markRemoteMethods(PluginKeeperService.prototype, [
  'snapshot',
  'checkUpdates',
  'checkGroup',
  'getSettings',
  'saveSettings',
  'normalizeGithubSpec',
  'prepareBatch',
  'restoreBatch',
  'reportBatch',
  'planExport',
  'exportPlugins',
  'planImport',
  'executeImport',
]);

export const inject = ['profileContext'];

/**
 * 导出包下载路由（前缀）：/plugin-keeper/api/exports/<id>
 *
 * 为什么要走 HTTP 而不是 RPC：导出包可达几十 MB，base64 塞进 JSON 信封不现实。
 * 宿主 webserver 没有静态目录挂载（实测），所以注册一条 loopback 路由是现成唯一通道
 * （与 dsh-settings-arranger / dsh-railist / dsh-webseek 同款）。
 *
 * 围栏：peer 地址 + Host 头都必须是 loopback —— 这一对组合才挡得住 DNS rebinding。
 */
export const EXPORT_ROUTE_PREFIX = '/plugin-keeper/api/exports';

/** 导入上传路由（exact）：POST 导出包字节，返回批次 id。 */
export const IMPORT_UPLOAD_PATH = '/plugin-keeper/api/imports/upload';

const LOOPBACK_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const LOOPBACK_HOSTNAMES = ['127.0.0.1', 'localhost', '::1'];

/** 请求是否来自 loopback（peer + Host 双重判定）。 */
export function isLoopbackRequest(req) {
  const address = req?.socket?.remoteAddress;
  if (typeof address !== 'string' || !LOOPBACK_ADDRESSES.includes(address)) return false;
  const host = req?.headers?.host;
  if (typeof host !== 'string') return false;
  return LOOPBACK_HOSTNAMES.includes(hostnameOf(host));
}

/** Host 头里的主机名（`host`、`host:port`、`[::1]`、`[::1]:port`）。 */
function hostnameOf(host) {
  const authority = host.trim().toLowerCase();
  if (authority.startsWith('[')) {
    const end = authority.indexOf(']');
    return end === -1 ? '' : authority.slice(1, end);
  }
  const first = authority.indexOf(':');
  if (first === -1) return authority;
  return first === authority.lastIndexOf(':') ? authority.slice(0, first) : authority;
}

/** 导出产物目录（相对 $DSH_HOME）。 */
function exportsRootOf() {
  const home = serviceBridge?.profile?.home
    || process.env.DSH_HOME
    || join(homedir(), '.dsh');
  return join(home, EXPORT_DIR_NAME);
}

/**
 * 下载路由的 handler。
 *
 * 路径形如 /plugin-keeper/api/exports/<文件名>；文件名必须匹配安全字符集，
 * 且必须落在导出产物目录内（防路径穿越）。
 */
export function createExportDownloadHandler() {
  return async function handle(req, res) {
    if (!isLoopbackRequest(req)) {
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ ok: false, error: 'refused: loopback-only' })}\n`);
      return;
    }
    const method = (req.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ ok: false, error: `${method} not allowed` })}\n`);
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    // 归一化重复斜杠（`//x` 会被 URL 解析成 protocol-relative，pathname 丢掉首段）
    let pathname = url.pathname.replace(/\/{2,}/g, '/');
    if (pathname.startsWith(EXPORT_ROUTE_PREFIX)) {
      pathname = pathname.slice(EXPORT_ROUTE_PREFIX.length);
      if (!pathname.startsWith('/')) pathname = `/${pathname}`;
    }
    const filename = decodeURIComponent(pathname.replace(/^\/+/, ''));
    if (!/^[A-Za-z0-9._-]+\.zip$/.test(filename)) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ ok: false, error: 'invalid export filename' })}\n`);
      return;
    }
    const root = exportsRootOf();
    const path = join(root, filename);
    // 双保险：文件名已白名单，这里再确认解析结果仍在导出目录内
    if (!path.startsWith(`${root}/`)) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ ok: false, error: 'path escapes export root' })}\n`);
      return;
    }
    let data;
    try {
      data = await readFile(path);
    } catch {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ ok: false, error: 'export not found' })}\n`);
      return;
    }
    res.writeHead(200, {
      'content-type': 'application/zip',
      'content-length': data.byteLength,
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    });
    if (method === 'HEAD') { res.end(); return; }
    res.end(data);
  };
}

/**
 * 导入上传路由的 handler：POST 原始 zip 字节 → 暂存 → 返回批次 id。
 *
 * 围栏与下载路由同款（peer + Host 都必须 loopback）。体积上限 MAX_IMPORT_BYTES，
 * 超限直接拒绝（不把超大 body 收进内存）。
 */
export function createImportUploadHandler() {
  return async function handle(req, res) {
    if (!isLoopbackRequest(req)) {
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ ok: false, error: 'refused: loopback-only' })}\n`);
      return;
    }
    const method = (req.method ?? 'POST').toUpperCase();
    if (method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ ok: false, error: `${method} not allowed` })}\n`);
      return;
    }
    const chunks = [];
    let size = 0;
    let aborted = false;
    await new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (aborted) return;
        size += chunk.length;
        if (size > MAX_IMPORT_BYTES) {
          // 立刻拒绝：继续收会把内存吃满
          aborted = true;
          resolve();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve());
      req.on('error', () => resolve());
    });
    if (aborted) {
      res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ ok: false, error: `导入包超过体积上限（${MAX_IMPORT_BYTES} 字节）` })}\n`);
      return;
    }
    const home = serviceBridge?.profile?.home
      || process.env.DSH_HOME
      || join(homedir(), '.dsh');
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;
    const dir = join(home, IMPORT_DIR_NAME, id);
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'package.zip'), Buffer.concat(chunks));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ ok: false, error: String(e?.message ?? e) })}\n`);
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`${JSON.stringify({ ok: true, id, sizeBytes: size })}\n`);
  };
}

export function apply(ctx) {
  const profile = ctx.profileContext ?? null;
  serviceBridge = { profile };
  // 启动按落盘设置恢复代理；pluginManager 挂载后校验 profile 是否同源，
  // 并取宿主真实的 pnpmCommand（CLI 启动时 profile.packageManager 可能不存在）。
  void applyProxyPolicy();
  ctx.inject(['pluginManager'], (pmCtx) => {
    const pm = pmCtx.reflect.get('pluginManager');
    setPnpmCommand(pm?.pnpmCommand);
    setContextVerified(Boolean(pm) && pm.profile === profile);
    // 启动期一次性日志：可从 dsh web 输出确认引用校验与注入通道是否真的挂上
    console.log(`[dsh-plugin-keeper] proxy injection ready: context=${pm?.profile === profile ? 'same-ref' : 'MISMATCH'} pnpmCommand=${pm?.pnpmCommand ?? 'default'}`);
    void applyProxyPolicy();
  });
  ctx.effect(() => ctx.plugin(PluginKeeperService), 'dsh-plugin-keeper rpc service');
  ctx.effect(() => () => {
    releaseInstallProxy(profile);
    serviceBridge = null;
  }, 'dsh-plugin-keeper bridge cleanup');

  // 导出包下载 / 导入上传路由：webServer 是可选服务（无 web 端部署也要能装上本插件），
  // 因此放在 ctx.inject(['webServer']) 里，服务未就绪时静默跳过。
  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.reflect.get('webServer');
    webCtx.effect(
      () => webServer.register({
        kind: 'prefix',
        path: EXPORT_ROUTE_PREFIX,
        handler: createExportDownloadHandler(),
      }),
      'dsh-plugin-keeper: export download route',
    );
    webCtx.effect(
      () => webServer.register({
        kind: 'exact',
        path: IMPORT_UPLOAD_PATH,
        handler: createImportUploadHandler(),
      }),
      'dsh-plugin-keeper: import upload route',
    );
  });
}
