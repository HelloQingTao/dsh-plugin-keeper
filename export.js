/**
 * dsh-plugin-keeper — 导出（插件包 + 可选配置）。
 *
 * 产物是一个 zip（导出包），结构：
 *   manifest.json              元数据：导出源、插件清单、配置清单、冲突提示、完整性校验
 *   plugins/<name>-<ver>.tgz   每个插件一个 npm pack 产物（本地源插件也打进去 → 可移植）
 *   config/patch/<id>.yml      该插件在 profile cordis.patch.yml 里的 config 片段（YAML 原样文本）
 *   config/home/<file>         插件的独立配置文件（$DSH_HOME 顶层文件）
 *   config/home/<dir>/…        插件的独立配置目录（$DSH_HOME 顶层目录）
 *   INSTALL.md                 怎么装：dsh plugin add file:plugins/xxx.tgz + 配置片段贴回哪
 *
 * 三个不变量（与本仓其它模块同一口径）：
 *  1. **零新增依赖**：zip 用 node:zlib + 手写 CRC32；YAML 片段用行级文本切分（原样保留注释与格式，
 *     不重新序列化）；版本判定用已有的 semver。
 *  2. **不静默失败**：任一插件打包失败 → 该插件进 warnings 并在 manifest 里如实标注，
 *     其余继续；配置项一律在 plan 里列出来让用户确认，不猜。
 *  3. **不碰用户数据**：导出只读源文件；产物写在 $DSH_HOME/plugin-keeper-exports/ 下。
 */

import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { promisify } from 'node:util';
import { tryNormalizeGithubSpec } from './github-spec.js';

/** 导出包里的可安装 spec：统一成 github:owner/repo[#ref]，无效则回退到本地 tarball。 */
export function githubInstallSpec(plugin, fallback) {
  if (plugin?.source?.kind !== 'github') return fallback;
  const g = tryNormalizeGithubSpec(plugin.source?.spec) ?? tryNormalizeGithubSpec(plugin.source?.repo);
  return g ? g.spec : fallback;
}

const execFileAsync = promisify(execFile);

/** 导出包 schema 版本（破坏性变更时 +1）。 */
export const EXPORT_SCHEMA_VERSION = 1;

/** 导出产物目录名（相对 $DSH_HOME）。 */
export const EXPORT_DIR_NAME = 'plugin-keeper-exports';

/** 单个插件 tarball 的体积上限（超过则跳过并告警，防异常巨大的插件撑爆导出）。 */
export const MAX_TARBALL_BYTES = 120 * 1024 * 1024;

/** 导出包总体积上限。 */
export const MAX_EXPORT_BYTES = 400 * 1024 * 1024;

/** 单个配置文件上限（独立配置通常很小；超限按可疑处理并跳过）。 */
export const MAX_CONFIG_FILE_BYTES = 8 * 1024 * 1024;

/** 保留最近多少份导出产物。 */
export const KEEP_EXPORTS = 10;

// ---------------------------------------------------------------------------
// ZIP 写出（node:zlib + 手写 CRC32，零依赖）
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC32（ZIP 目录项与本地头都要）。 */
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS 时间/日期字段。 */
function dosDateTime() {
  const d = new Date();
  return {
    time: ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f),
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f),
  };
}

/**
 * 归档条目名安全化：只允许 `[A-Za-z0-9._@/-]`，杜绝 `..` 与绝对路径。
 * @returns {string|null} 合法名；不合法返回 null（调用方跳过该条目，绝不「尽力而为」）。
 */
export function safeEntryName(name) {
  if (typeof name !== 'string' || name === '') return null;
  const v = name.replace(/\\/g, '/');
  if (v.startsWith('/') || /^[A-Za-z]:/.test(v)) return null;
  for (const seg of v.split('/')) {
    if (seg === '' || seg === '.' || seg === '..') return null;
  }
  if (!/^[A-Za-z0-9._@/+-]+$/.test(v)) return null;
  return v;
}

/**
 * 把条目列表打成 zip 字节流。
 * @param {Array<{name: string, data: Buffer|string}>} entries
 * @returns {Buffer}
 */
export function buildZip(entries) {
  const { time, date } = dosDateTime();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = safeEntryName(entry.name);
    if (name === null) throw new Error(`非法的归档条目名：${entry.name}`);
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const compressed = deflateRawSync(raw, { level: 6 });
    const useDeflate = compressed.length < raw.length;
    const body = useDeflate ? compressed : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // 文件名 UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

// ---------------------------------------------------------------------------
// patch 配置抽取（行级文本处理，YAML 原样保留）
// ---------------------------------------------------------------------------

/**
 * 把 profile 的 patch 文档切成「顶层行」。
 *
 * 为什么不用 YAML 解析器：DSH 的 patch 文档是**顶层序列**（`PROFILE_PATCH_FILENAME`），
 * 行首 `- ` 就是一条记录；我们要的是「某插件那行里的 config 块原样文本」——
 * 重新序列化会丢注释、改缩进、甚至改键序（用户手改的 patch 会被我们搅乱）。
 * 逐行切分能保证**导出的片段与源文件逐字一致**。
 *
 * @param {string} text 整个 patch 文档
 * @returns {Array<{start: number, lines: string[], indent: number}>}
 */
export function splitPatchRows(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const rows = [];
  let current = null;
  for (const line of lines) {
    if (/^- /.test(line)) {
      if (current !== null) rows.push(current);
      current = { start: 0, lines: [line], indent: 2 };
    } else if (current !== null) {
      current.lines.push(line);
    }
  }
  if (current !== null) rows.push(current);
  return rows;
}

/** 行首缩进宽度（tab 记 2）。 */
function indentOf(line) {
  let n = 0;
  for (const ch of line) {
    if (ch === ' ') n += 1;
    else if (ch === '\t') n += 2;
    else break;
  }
  return n;
}

/**
 * 从一行 patch 记录里取 `id:`、`name:` 与 `config:` 块。
 *
 * 判定口径：
 *  - 行级键在 YAML 里位于「`- ` 之后」的第 2 列（序列项的内容列）；
 *  - `config` 块延伸到缩进大于键缩进的行（空行归入块，尾随空行剔除）；
 *  - 片段文本**原样保留**（含注释与缩进），导入端可直接贴回。
 * @returns {{id: string|null, name: string|null, config: string|null}}
 */
export function parsePatchRow(row) {
  const lines = row.lines;
  let id = null;
  let name = null;
  let config = null;

  // 行级键的缩进：序列项内容列 = 「- 」之后的列（YAML 里恒为 2）
  const KEY_INDENT = 2;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    // 序列项首行：`- id: x` → 去掉 "- " 后按 KEY_INDENT 列算
    const isSeqHead = raw.startsWith('- ');
    const body = isSeqHead ? raw.slice(2) : raw;
    const bodyIndent = isSeqHead ? KEY_INDENT : indentOf(raw);
    if (body.trim() === '') continue;
    if (bodyIndent !== KEY_INDENT) continue;
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(body.trimStart());
    if (m === null) continue;
    const key = m[1];
    const value = m[2].trim();
    if (key === 'id' && id === null) id = unquote(value);
    else if (key === 'name' && name === null) name = unquote(value);
    else if (key === 'config' && config === null) {
      const block = [];
      if (value !== '') block.push(raw);
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j];
        if (next.trim() === '') { block.push(next); continue; }
        if (indentOf(next) <= KEY_INDENT) break;
        block.push(next);
      }
      while (block.length > 0 && block[block.length - 1].trim() === '') block.pop();
      config = block.length > 0 ? `${block.join('\n')}\n` : null;
    }
  }
  return { id, name, config };
}

/** 去 YAML 标量外层的引号。 */
function unquote(value) {
  const v = String(value ?? '').trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

// ---------------------------------------------------------------------------
// $DSH_HOME 独立配置发现（启发式）
// ---------------------------------------------------------------------------

/** 永远不导出的文件名/目录名（公共数据、凭据、宿主自己的东西）。 */
const NEVER_EXPORT = new Set([
  '.credentials.yaml',
  '.anonymous-user-id',
  'AGENTS.md',
  'profiles',
  'sessions',
  'attachments',
  'cache',
]);

/** 永不导出的目录名（备份/日志/市场/数据库 —— 是数据与派生物，不是「配置」）。 */
const NEVER_EXPORT_DIRS = new Set([
  'plugin-keeper-backups',
  'exports',
  'backups',
  'snapshots',
  'logs',
  'market',
  'transactions',
  'rollback-points',
  'migration-history',
]);

/** 疑似凭据的文件名片段（命中则跳过并在 plan 里警告）。 */
const SECRET_HINTS = ['auth', 'credential', 'token', 'secret', 'password', 'accounts'];

/** 启发式里不算特征的通用词（出现不代表就是这个插件的）。 */
const GENERIC_TOKENS = new Set(['dsh', 'plugin', 'state', 'config', 'settings', 'store', 'data']);

/** 插件名 → 特征词（去 scope、去 dsh- 前缀、去通用词）。 */
function tokensOf(pluginName) {
  const stem = pluginName.replace(/^@[^/]+\//, '').replace(/^dsh-/, '');
  return stem
    .split(/[-_.]+/)
    .map((x) => x.toLowerCase())
    .filter((x) => x.length >= 3 && !GENERIC_TOKENS.has(x));
}

/** 候选名 → 特征词（同样去通用词）。 */
function tokensOfCandidate(base) {
  return base
    .split(/[-_.]+/)
    .map((x) => x.toLowerCase())
    .filter((x) => x.length >= 3 && !GENERIC_TOKENS.has(x));
}

/**
 * 候选（$DSH_HOME 顶层文件/目录）↔ 插件的匹配分。
 *
 * 口径（越高越可信）：
 *  - 100：候选名与插件 stem 完全相等（`dream-skin.json` ↔ `dsh-dream-skin`）
 *  - 80：候选的**全部特征词**都出现在插件名里，且至少 2 个特征词
 *    （`fallback-queue-state.json` ↔ `dsh-model-fallback-queue` —— 插件名多了
 *    一个修饰词、候选名多了个通用词，这是「该插件的状态文件」的典型形态）
 *  - 70：插件的**全部特征词**都出现在候选名里，且至少 2 个特征词
 *  - 40：只共享 1 个特征词（弱提示，可能属于别的插件 —— 界面上要标「可能相关」）
 *  - 0：不相关
 */
export function matchScore(candidateBase, pluginName) {
  const stem = pluginName.replace(/^@[^/]+\//, '').replace(/^dsh-/, '').toLowerCase();
  const cb = candidateBase.toLowerCase();
  if (cb === stem) return 100;
  const pt = tokensOf(pluginName);
  const ct = tokensOfCandidate(candidateBase);
  if (pt.length === 0 || ct.length === 0) return 0;
  const shared = ct.filter((tok) => pt.includes(tok));
  if (shared.length >= 2) {
    if (ct.every((tok) => pt.includes(tok))) return 80;
    if (pt.every((tok) => ct.includes(tok))) return 70;
  }
  if (shared.length >= 1) return 40;
  return 0;
}

/** 目录里出现数据库文件 → 是数据存储，不是「配置」。 */
async function containsDatabase(dir) {
  const walk = async (current, depth) => {
    if (depth > 2) return false;
    let entries = [];
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return false; }
    for (const entry of entries) {
      if (entry.isFile() && /\.(sqlite3?|db)$/i.test(entry.name)) return true;
      if (entry.isDirectory()) {
        // 备份/日志类子目录不算「配置」
        if (NEVER_EXPORT_DIRS.has(entry.name)) continue;
        if (await walk(join(current, entry.name), depth + 1)) return true;
      }
    }
    return false;
  };
  return walk(dir, 0);
}

/**
 * 扫描 $DSH_HOME 顶层，找出可能属于某插件的独立配置项。
 *
 * @param {string} home $DSH_HOME 绝对路径
 * @param {string[]} pluginNames 待检查的插件名
 * @returns {Promise<Array<{path: string, rel: string, kind: 'file'|'dir', sizeBytes: number, score: number, plugin: string, suspicious: boolean}>>}
 */
export async function discoverHomeConfig(home, pluginNames) {
  let entries = [];
  try {
    entries = await readdir(home, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith('.') && name !== '.credentials.yaml') continue;
    if (NEVER_EXPORT.has(name)) continue;
    if (entry.isDirectory() && NEVER_EXPORT_DIRS.has(name)) continue;
    const abs = join(home, name);
    let sizeBytes = 0;
    if (entry.isDirectory()) {
      // 目录：含 backups/exports 等子目录的判为「数据目录」，不作为配置带走
      let sub = [];
      try { sub = await readdir(abs); } catch { /* 读不到 → 跳过 */ }
      if (sub.some((s) => NEVER_EXPORT_DIRS.has(s))) continue;
      // 目录里有数据库文件 → 是数据存储，不是配置
      if (await containsDatabase(abs)) continue;
      sizeBytes = await dirSize(abs);
    } else {
      try {
        const st = await stat(abs);
        sizeBytes = st.size;
      } catch { continue; }
    }
    const base = name.replace(/\.[^.]+$/, '');
    let best = { plugin: null, score: 0 };
    for (const plugin of pluginNames) {
      const score = matchScore(base, plugin);
      if (score > best.score) best = { plugin, score };
    }
    if (best.plugin === null) continue;
    const suspicious = SECRET_HINTS.some((hint) => name.toLowerCase().includes(hint));
    out.push({
      path: abs,
      rel: name,
      kind: entry.isDirectory() ? 'dir' : 'file',
      sizeBytes,
      score: best.score,
      plugin: best.plugin,
      suspicious,
    });
  }
  return out.sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel));
}

/** 目录体积（递归，超 64MB 提前停）。 */
async function dirSize(dir) {
  let total = 0;
  const walk = async (current) => {
    if (total > 64 * 1024 * 1024) return;
    let entries = [];
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const p = join(current, entry.name);
      if (entry.isDirectory()) await walk(p);
      else {
        try { total += (await stat(p)).size; } catch { /* 忽略 */ }
      }
    }
  };
  await walk(dir);
  return total;
}

// ---------------------------------------------------------------------------
// 插件打包
// ---------------------------------------------------------------------------

/** npm 生命周期脚本名（命中则需要「复制到临时目录 + 剥离 scripts」再 pack）。 */
const LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'postpack', 'prepublish', 'prepublishOnly'];

/** 包是否带生命周期脚本。 */
export function hasLifecycleScripts(manifest) {
  const scripts = manifest?.scripts;
  if (scripts === null || typeof scripts !== 'object') return false;
  return LIFECYCLE_SCRIPTS.some((name) => typeof scripts[name] === 'string');
}

/**
 * 复制目录（排除嵌套 node_modules）到目标。
 * @returns {Promise<void>}
 */
async function copyExcludingNodeModules(src, dest) {
  await cp(src, dest, {
    recursive: true,
    dereference: true,
    filter: (from) => {
      const rel = relative(src, from);
      if (rel === '') return true;
      return !rel.split(sep).includes('node_modules');
    },
  });
}

/** 从 `npm pack --json` 的 stdout 里取产物文件名（取不到返回 null）。 */
export function parsePackFilename(stdout) {
  const text = String(stdout ?? '').trim();
  if (text === '') return null;
  const start = text.indexOf('[');
  const slice = start >= 0 ? text.slice(start) : text;
  try {
    const parsed = JSON.parse(slice);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    const filename = first?.filename;
    if (typeof filename === 'string' && filename !== '') return filename;
  } catch { /* 落到文本兜底 */ }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  const last = lines[lines.length - 1];
  return last !== undefined && last.endsWith('.tgz') ? last : null;
}

/** 包名 → 归档内安全文件名片段（`@scope/name` → `@scope__name`，绝不含路径分隔符）。 */
export function safePackageFragment(name) {
  return name.replace(/[/\\]/g, '__').replace(/[^A-Za-z0-9@._-]/g, '-');
}

/**
 * 把一个插件打成 tarball。
 *
 * 关键坑（实测）：`npm pack --ignore-scripts` **不能**跳过 `prepare` / `prepack` ——
 * 已安装包里 `dsh-config-manager`（prepare → `tsc: not found`）与 `billion-context`
 * （prepare → check-dist-ready.mjs）直接 pack 必然失败。所以带生命周期脚本的包
 * 先复制到临时目录、**删掉 package.json 的 scripts 字段**再 pack（已实测 24/24 全绿）。
 *
 * @param {object} options
 * @param {string} options.sourceDir 插件源码/安装目录
 * @param {string} options.workDir 临时工作目录
 * @param {number} options.timeoutMs
 * @returns {Promise<{ok: boolean, data?: Buffer, filename?: string, reason?: string}>}
 */
export async function packPlugin({ sourceDir, workDir, timeoutMs = 300000 }) {
  let packTarget = sourceDir;
  let staging = null;
  try {
    const manifest = JSON.parse(await readFile(join(sourceDir, 'package.json'), 'utf8'));
    if (hasLifecycleScripts(manifest)) {
      staging = join(workDir, 'stage', safePackageFragment(manifest.name ?? 'pkg'));
      await mkdir(dirname(staging), { recursive: true });
      await copyExcludingNodeModules(sourceDir, staging);
      const manifestPath = join(staging, 'package.json');
      const patched = JSON.parse(await readFile(manifestPath, 'utf8'));
      delete patched.scripts;
      await writeFile(manifestPath, `${JSON.stringify(patched, null, 2)}\n`, 'utf8');
      packTarget = staging;
    }
  } catch (e) {
    return { ok: false, reason: `读取插件 manifest 失败：${e?.message ?? e}` };
  }

  const outDir = join(workDir, 'out');
  try {
    await mkdir(outDir, { recursive: true });
    const { stdout } = await execFileAsync(
      'npm',
      ['pack', packTarget, '--pack-destination', outDir, '--json'],
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
    );
    const filename = parsePackFilename(stdout);
    if (filename === null) return { ok: false, reason: 'npm pack 未产出可识别的文件名' };
    const data = await readFile(join(outDir, filename));
    if (data.byteLength > MAX_TARBALL_BYTES) {
      return { ok: false, reason: `tarball 超过体积上限（${MAX_TARBALL_BYTES} 字节）` };
    }
    return { ok: true, data, filename };
  } catch (e) {
    const stderr = e?.stderr ? String(e.stderr).split('\n').filter(Boolean).slice(-2).join(' / ') : '';
    return { ok: false, reason: `npm pack 失败：${e?.message ?? e}${stderr ? `（${stderr}）` : ''}` };
  } finally {
    if (staging !== null) await rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// 导出产物
// ---------------------------------------------------------------------------

/** sha256（hex）。 */
function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** 导出包内的 INSTALL.md（人读的安装说明）。 */
function renderInstallDoc(manifest) {
  const lines = [
    '# DSH 插件导出包',
    '',
    `导出时间：${manifest.exportedAt}`,
    `导出源：DSH ${manifest.source.dshVersion} · profile ${manifest.source.profile}`,
    `插件数量：${manifest.plugins.length}`,
    '',
    '## 安装方式',
    '',
    '### 方式一：dsh 命令（推荐）',
    '',
    '```bash',
    ...manifest.plugins.map((p) => `dsh plugin add "${p.installSpec}"`),
    '```',
    '',
    '### 方式二：图形界面',
    '',
    '在目标机的「插件运维」页点「导入所选」，选择本 zip 即可。',
    '',
    '## 插件清单',
    '',
    '| 插件 | 版本 | 本机安装源 | 打包产物 |',
    '|---|---|---|---|',
    ...manifest.plugins.map((p) => `| ${p.name} | ${p.version ?? '-'} | ${p.sourceKind} | \`${p.tarball ?? '-'}\` |`),
    '',
  ];
  if (manifest.config.items.length > 0) {
    lines.push('## 随包配置', '');
    for (const item of manifest.config.items) {
      lines.push(`- \`${item.rel}\`（${item.kind}，归属 ${item.plugin}）`);
    }
    lines.push('', '配置片段需按目标机实际路径落位；patch 片段可整段贴回 profile 的 cordis.patch.yml 对应行。', '');
  }
  return lines.join('\n');
}

/**
 * 生成导出包并落盘。
 *
 * @param {object} options
 * @param {string} options.home $DSH_HOME
 * @param {string} options.profileName
 * @param {string} options.dshVersion
 * @param {Array<object>} options.plugins 目标插件（collectInventory 的条目 + localPath）
 * @param {Array<object>} options.configItems 选中的配置项（{rel, kind, path, plugin}）
 * @returns {Promise<{ok: boolean, id?: string, filename?: string, sizeBytes?: number, path?: string, manifest?: object, warnings?: string[]}>}
 */
export async function createExport({ home, profileName, dshVersion, plugins, configItems }) {
  const warnings = [];
  const workDir = await mkdtemp(join(tmpdir(), 'dpk-export-'));
  const entries = [];
  const pluginRecords = [];
  const usedNames = new Set();

  try {
    for (const plugin of plugins) {
      const sourceDir = plugin.localPath ?? plugin.installedPath;
      if (sourceDir === null || sourceDir === undefined) {
        warnings.push(`${plugin.name}：找不到插件目录，已跳过`);
        pluginRecords.push({
          name: plugin.name,
          version: plugin.version ?? null,
          spec: plugin.source?.spec ?? '',
          sourceKind: plugin.source?.kind ?? 'unknown',
          tarball: null,
          packed: false,
          reason: '找不到插件目录',
        });
        continue;
      }
      const packed = await packPlugin({ sourceDir, workDir });
      if (!packed.ok) {
        warnings.push(`${plugin.name}：${packed.reason}`);
        pluginRecords.push({
          name: plugin.name,
          version: plugin.version ?? null,
          spec: plugin.source?.spec ?? '',
          sourceKind: plugin.source?.kind ?? 'unknown',
          tarball: null,
          packed: false,
          reason: packed.reason,
        });
        continue;
      }
      let entryName = `plugins/${safePackageFragment(plugin.name)}-${packed.filename}`;
      // 同名（不同版本）去重
      let n = 1;
      while (usedNames.has(entryName)) {
        n += 1;
        entryName = `plugins/${safePackageFragment(plugin.name)}-${n}-${packed.filename}`;
      }
      usedNames.add(entryName);
      entries.push({ name: entryName, data: packed.data });
      pluginRecords.push({
        name: plugin.name,
        version: plugin.version ?? null,
        spec: plugin.source?.spec ?? '',
        sourceKind: plugin.source?.kind ?? 'unknown',
        tarball: entryName,
        tarballBytes: packed.data.byteLength,
        tarballSha256: sha256(packed.data),
        packed: true,
        // 目标机可直接执行的安装命令（本地 tarball 需先解包，故给 npm/github 源优先）
        installSpec: plugin.source?.kind === 'npm' && plugin.source?.spec
          ? `${plugin.name}@${plugin.version ?? 'latest'}`
          : githubInstallSpec(plugin, `file:${entryName}`),
      });
    }

    // 配置条目
    const configRecords = [];
    for (const item of configItems ?? []) {
      // patch 片段：调用方直接给了 YAML 文本（原样保留，不重新序列化）
      if (item.kind === 'patch') {
        const safe = safeEntryName(`config/${item.rel.startsWith('patch/') ? item.rel : `patch/${item.rel}`}`);
        if (safe === null) continue;
        entries.push({ name: safe, data: item.text ?? '' });
        configRecords.push({ rel: item.rel, kind: 'patch', plugin: item.plugin, files: 1 });
        continue;
      }
      try {
        const st = await stat(item.path);
        if (st.isDirectory()) {
          const files = [];
          const walk = async (dir, prefix) => {
            let entriesIn = [];
            try { entriesIn = await readdir(dir, { withFileTypes: true }); } catch { return; }
            for (const e of entriesIn) {
              const p = join(dir, e.name);
              const rel = `${prefix}${e.name}`;
              if (e.isDirectory()) await walk(p, `${rel}/`);
              else {
                const data = await readFile(p);
                if (data.byteLength > MAX_CONFIG_FILE_BYTES) {
                  warnings.push(`配置 ${rel} 超过体积上限，已跳过`);
                  continue;
                }
                const safe = safeEntryName(`config/home/${item.rel}/${rel}`);
                if (safe === null) continue;
                files.push({ name: safe, data });
              }
            }
          };
          await walk(item.path, '');
          for (const f of files) entries.push(f);
          configRecords.push({ rel: item.rel, kind: 'dir', plugin: item.plugin, files: files.length });
        } else {
          if (st.size > MAX_CONFIG_FILE_BYTES) {
            warnings.push(`配置 ${item.rel} 超过体积上限，已跳过`);
            continue;
          }
          const safe = safeEntryName(`config/home/${item.rel}`);
          if (safe === null) continue;
          entries.push({ name: safe, data: await readFile(item.path) });
          configRecords.push({ rel: item.rel, kind: 'file', plugin: item.plugin, files: 1 });
        }
      } catch (e) {
        warnings.push(`配置 ${item.rel}：读取失败（${e?.message ?? e}）`);
      }
    }

    const manifest = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exporter: { name: 'dsh-plugin-keeper', version: '0.3.0' },
      source: {
        dshVersion: dshVersion ?? 'unknown',
        profile: profileName ?? null,
        platform: process.platform,
        arch: process.arch,
      },
      exportedAt: new Date().toISOString(),
      plugins: pluginRecords,
      config: {
        included: configRecords.length > 0,
        items: configRecords,
      },
      security: {
        containsSecrets: false,
        note: '仅导出插件与其配置；不含 .credentials.yaml 等凭据文件',
      },
      warnings,
    };
    entries.push({ name: 'manifest.json', data: `${JSON.stringify(manifest, null, 2)}\n` });
    entries.push({ name: 'INSTALL.md', data: renderInstallDoc(manifest) });

    const zip = buildZip(entries);
    if (zip.byteLength > MAX_EXPORT_BYTES) {
      return { ok: false, error: `导出包超过体积上限（${MAX_EXPORT_BYTES} 字节）` };
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `${stamp}-${randomBytes(3).toString('hex')}`;
    const filename = `dsh-plugins-${stamp}.zip`;
    const outDir = join(home, EXPORT_DIR_NAME);
    await mkdir(outDir, { recursive: true });
    const outPath = join(outDir, filename);
    await writeFile(outPath, zip);

    // 只保留最近 KEEP_EXPORTS 份
    try {
      const existing = (await readdir(outDir)).filter((f) => f.endsWith('.zip')).sort();
      while (existing.length > KEEP_EXPORTS) {
        const victim = existing.shift();
        if (victim !== undefined) await rm(join(outDir, victim), { force: true });
      }
    } catch { /* 清理失败不影响主流程 */ }

    return {
      ok: true,
      id,
      filename,
      path: outPath,
      sizeBytes: zip.byteLength,
      manifest,
      warnings,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
