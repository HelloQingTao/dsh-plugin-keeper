/**
 * dsh-plugin-keeper — 导入（读导出包 → 兼容性预检 → 冲突检测 → 执行）。
 *
 * 与 export.js 同一套设计约束：
 *  - **零新增依赖**：zip 读用 node:zlib inflateRaw + 自实现 CRC32 校验；
 *    YAML 片段用**行级文本切分**（原样保留用户手改的注释与缩进，绝不重新序列化）。
 *  - **不静默失败**：任何一项都进 plan，逐项带原因。
 *  - **不改用户数据**：所有覆盖动作前先做 profile 快照（复用 index.js 的 prepareBatchSnapshot）。
 *
 * 兼容性判定**复刻宿主官方闸门**（@deepseek-ai/dsh-app-boot 的 evaluatePluginCompatibility）：
 *  - 有 `engines.dsh` → 只看它（peerDependencies 忽略）；
 *  - 否则每个 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer 都要满足；
 *  - `workspace:^` / `workspace:~` / `workspace:*` 的 peer 视为「当前运行时版本」；
 *  - 豁免表 = profile 的 `compatibility.json`（`<pkg>@<ver>` → DSH 版本数组）。
 */

import { createHash } from 'node:crypto';
import { gunzipSync, inflateRawSync } from 'node:zlib';
import { readFile, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { crc32, parsePatchRow, splitPatchRows } from './export.js';

/** 导入包 schema 版本（与 export.js 的 EXPORT_SCHEMA_VERSION 对齐）。 */
export const IMPORT_SCHEMA_VERSION = 1;

/** 导入暂存目录名（相对 $DSH_HOME）。 */
export const IMPORT_DIR_NAME = 'plugin-keeper-imports';

/** zip 安全上限（防 zip bomb）。 */
export const ZIP_LIMITS = {
  maxEntries: 2000,
  maxTotalBytes: 512 * 1024 * 1024,
  maxSingleBytes: 256 * 1024 * 1024,
  maxRatio: 200,
};

/** 导入包体积上限（上传与读取共用）。 */
export const MAX_IMPORT_BYTES = 256 * 1024 * 1024;

// ---------------------------------------------------------------------------
// ZIP 读取（node:zlib inflateRaw + CRC 校验）
// ---------------------------------------------------------------------------

/** ZIP 读取失败（结构损坏 / 超限 / CRC 不符）。 */
export class ZipReadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ZipReadError';
  }
}

/**
 * 解析 zip 字节流，返回条目表。
 *
 * 走 **中央目录**（EOCD）而不是顺序扫本地头：中央目录带压缩后尺寸与 CRC，
 * 可以在解压前就判定「条目数 / 总体积 / 压缩比」是否越限（zip bomb 防线）。
 *
 * @param {Buffer} buf
 * @returns {{entries: Array<{name: string, data: Buffer, crc32: number, compressedSize: number}>}}
 */
export function readZip(buf) {
  if (!Buffer.isBuffer(buf)) throw new ZipReadError('zip 数据必须是 Buffer');
  if (buf.byteLength < 22) throw new ZipReadError('zip 文件过小');

  // 反向找 EOCD（末尾 22 字节 + 最多 65535 字节注释）
  let eocd = -1;
  const scanFrom = Math.max(0, buf.byteLength - 22 - 0xffff);
  for (let i = buf.byteLength - 22; i >= scanFrom; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new ZipReadError('找不到 zip 中央目录（文件不是有效的 zip）');

  const entryCount = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (entryCount > ZIP_LIMITS.maxEntries) {
    throw new ZipReadError(`zip 条目数超限（${entryCount} > ${ZIP_LIMITS.maxEntries}）`);
  }
  if (cdOffset + cdSize > buf.byteLength) throw new ZipReadError('zip 中央目录越界');

  const headers = [];
  let p = cdOffset;
  let total = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (p + 46 > buf.byteLength) throw new ZipReadError('zip 中央目录条目越界');
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new ZipReadError('zip 中央目录条目签名错误');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (uncompressedSize > ZIP_LIMITS.maxSingleBytes) {
      throw new ZipReadError(`zip 条目过大：${name}（${uncompressedSize} 字节）`);
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > ZIP_LIMITS.maxRatio) {
      throw new ZipReadError(`zip 条目压缩比异常（疑似 zip bomb）：${name}`);
    }
    total += uncompressedSize;
    if (total > ZIP_LIMITS.maxTotalBytes) {
      throw new ZipReadError(`zip 解压后总体积超限（${total} 字节）`);
    }
    headers.push({ name, method, crc, compressedSize, uncompressedSize, localOffset });
  }

  const out = [];
  for (const entry of headers) {
    const off = entry.localOffset;
    if (off + 30 > buf.byteLength) throw new ZipReadError(`zip 本地头越界：${entry.name}`);
    if (buf.readUInt32LE(off) !== 0x04034b50) throw new ZipReadError(`zip 本地头签名错误：${entry.name}`);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const dataStart = off + 30 + nameLen + extraLen;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > buf.byteLength) throw new ZipReadError(`zip 条目数据越界：${entry.name}`);
    const raw = buf.subarray(dataStart, dataEnd);
    let data;
    if (entry.method === 0) data = Buffer.from(raw);
    else if (entry.method === 8) {
      try {
        data = inflateRawSync(raw);
      } catch (e) {
        throw new ZipReadError(`zip 条目解压失败：${entry.name}（${e?.message ?? e}）`);
      }
    } else {
      throw new ZipReadError(`不支持的 zip 压缩方式：${entry.method}（${entry.name}）`);
    }
    if (data.byteLength !== entry.uncompressedSize) {
      throw new ZipReadError(`zip 条目尺寸不符：${entry.name}`);
    }
    if (crc32(data) !== entry.crc) {
      throw new ZipReadError(`zip 条目 CRC 校验失败：${entry.name}`);
    }
    out.push({
      name: entry.name,
      data,
      crc32: entry.crc,
      compressedSize: entry.compressedSize,
    });
  }
  return { entries: out };
}

// ---------------------------------------------------------------------------
// 兼容性判定（复刻宿主 evaluatePluginCompatibility）
// ---------------------------------------------------------------------------

/**
 * 判定插件 manifest 与本机 DSH 版本是否兼容。
 *
 * 口径与 @deepseek-ai/dsh-app-boot 的 evaluatePluginCompatibility 一致：
 *  - `engines.dsh` 存在 → **只看它**，peer 忽略；
 *  - 否则每个 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer 都要满足；
 *  - peer 的 `workspace:^` / `workspace:~` / `workspace:*` 视为「当前运行时版本」。
 *
 * @param {object} manifest 插件 package.json
 * @param {string} runtimeVersion 本机 DSH 版本
 * @param {Record<string,string[]>} exemptions 豁免表（`<pkg>@<ver>` → DSH 版本数组）
 * @param {(version: string, range: string) => boolean} satisfies semver.satisfies 注入以便测试
 * @returns {{status: 'compatible'|'incompatible'|'exempted'|'unknown', requirements?: object, note?: string}}
 */
export function checkCompatibility(manifest, runtimeVersion, exemptions, satisfies) {
  const fields = manifest !== null && typeof manifest === 'object' ? manifest : {};
  const requirements = {};
  const engines = fields.engines !== null && typeof fields.engines === 'object' ? fields.engines : {};
  if (Object.hasOwn(engines, 'dsh')) {
    const range = engines.dsh;
    if (typeof range !== 'string') {
      return { status: 'unknown', note: 'engines.dsh 不是字符串' };
    }
    if (!satisfies(runtimeVersion, range)) requirements['engines.dsh'] = range;
  } else if (fields.peerDependencies !== null && typeof fields.peerDependencies === 'object') {
    for (const [name, range] of Object.entries(fields.peerDependencies)) {
      if (typeof range !== 'string') continue;
      if (name !== '@deepseek-ai/dsh' && !name.startsWith('@deepseek-ai/dsh-')) continue;
      const effective = ['workspace:^', 'workspace:~', 'workspace:*'].includes(range)
        ? runtimeVersion
        : range;
      if (!satisfies(runtimeVersion, effective)) requirements[name] = range;
    }
  }
  if (Object.keys(requirements).length === 0) return { status: 'compatible' };

  const name = typeof fields.name === 'string' ? fields.name : null;
  const version = typeof fields.version === 'string' ? fields.version : null;
  const key = name !== null && version !== null ? `${name}@${version}` : null;
  const granted = key !== null ? exemptions?.[key] : undefined;
  const exempted = Array.isArray(granted) && granted.includes(runtimeVersion);
  return {
    status: exempted ? 'exempted' : 'incompatible',
    requirements,
    key,
    note: exempted
      ? `已豁免（${key} → ${runtimeVersion}）`
      : `需 ${Object.entries(requirements).map(([k, v]) => `${k}: ${v}`).join('、')}，本机 ${runtimeVersion}`,
  };
}

// ---------------------------------------------------------------------------
// tar 内的 package.json（npm pack 产物是 ustar）
// ---------------------------------------------------------------------------

/** 读文本文件（不存在返回 null）。 */
async function readTextFile(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * 从 tarball 里读出 package/package.json。
 *
 * **必须先解 gzip**：npm pack 产出的 `.tgz` 是 gzip 压缩的 tar（实测 194 字节的
 * 包解压后是 10240 字节的 tar），不解压的话 tar 头根本读不出来。
 *
 * @param {Buffer} tarball .tgz 字节
 * @returns {object|null} manifest；读不到返回 null
 */
export function readManifestFromTarball(tarball) {
  let tar = tarball;
  // gzip 魔数 1f 8b → 解压
  if (tarball.byteLength >= 2 && tarball[0] === 0x1f && tarball[1] === 0x8b) {
    try {
      tar = gunzipSync(tarball);
    } catch {
      return null;
    }
  }
  let offset = 0;
  while (offset + 512 <= tar.byteLength) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break; // 连续空块 = 结束
    let name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
    const sizeRaw = header.toString('ascii', 124, 136).replace(/[^0-7]/g, '');
    const size = sizeRaw === '' ? 0 : parseInt(sizeRaw, 8);
    const prefix = header.toString('utf8', 345, 500).replace(/\0.*$/, '');
    if (prefix !== '') name = `${prefix}/${name}`;
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (name === 'package/package.json' || name === 'package.json') {
      if (dataEnd > tar.byteLength) break;
      try {
        return JSON.parse(tar.toString('utf8', dataStart, dataEnd));
      } catch (e) {
        return { __parseError: String(e?.message ?? e) };
      }
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 导入包分析
// ---------------------------------------------------------------------------

/**
 * 分析一个导入包：读 zip → 校验 manifest → 兼容性预检 → 冲突检测。
 *
 * @param {Buffer} buffer zip 字节
 * @param {object} ctx
 * @param {string} ctx.profileDir profile 目录
 * @param {string} ctx.home $DSH_HOME
 * @param {string} ctx.runtimeVersion 本机 DSH 版本
 * @param {Record<string,string[]>} ctx.exemptions 豁免表
 * @param {Array<{name: string, version: string|null}>} ctx.installed 本机已装插件
 * @param {(v: string, r: string) => boolean} ctx.satisfies semver.satisfies
 * @returns {Promise<object>} 分析结果（同时是执行阶段的输入）
 */
export async function analyzeImportPackage(buffer, ctx) {
  const { entries } = readZip(buffer);
  const byName = new Map(entries.map((e) => [e.name, e]));

  const manifestEntry = byName.get('manifest.json');
  if (manifestEntry === undefined) throw new ZipReadError('导入包里没有 manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.data.toString('utf8'));
  } catch (e) {
    throw new ZipReadError(`manifest.json 不是合法 JSON：${e?.message ?? e}`);
  }
  if (manifest === null || typeof manifest !== 'object') throw new ZipReadError('manifest.json 形状非法');
  if (manifest.schemaVersion !== IMPORT_SCHEMA_VERSION) {
    throw new ZipReadError(`导入包 schema 版本不匹配（包 ${manifest.schemaVersion}，支持 ${IMPORT_SCHEMA_VERSION}）`);
  }

  const installedByName = new Map((ctx.installed ?? []).map((p) => [p.name, p]));
  const pluginResults = [];
  for (const record of manifest.plugins ?? []) {
    const name = typeof record.name === 'string' ? record.name : '';
    if (name === '') continue;
    const tarballName = typeof record.tarball === 'string' ? record.tarball : null;
    const tarballEntry = tarballName !== null ? byName.get(tarballName) : undefined;

    let pkgManifest = null;
    if (tarballEntry !== undefined) pkgManifest = readManifestFromTarball(tarballEntry.data);
    const compat = pkgManifest !== null
      ? checkCompatibility(pkgManifest, ctx.runtimeVersion, ctx.exemptions, ctx.satisfies)
      : {
        status: 'unknown',
        note: tarballEntry === undefined
          ? '导出包里没有该插件的 tarball'
          : '无法读取 tarball 内的 package.json',
      };

    // 完整性：导出包 manifest 记的 sha256 vs 实际 tarball
    let integrityOk = null;
    if (tarballEntry !== undefined && typeof record.tarballSha256 === 'string') {
      const actual = createHash('sha256').update(tarballEntry.data).digest('hex');
      integrityOk = actual === record.tarballSha256;
    }

    let versionMismatch = false;
    if (pkgManifest !== null && typeof pkgManifest.version === 'string' && typeof record.version === 'string') {
      versionMismatch = pkgManifest.version !== record.version;
    }

    const installed = installedByName.get(name);
    pluginResults.push({
      name,
      version: record.version ?? null,
      tarball: tarballName,
      tarballBytes: tarballEntry?.data.byteLength ?? 0,
      hasTarball: tarballEntry !== undefined,
      pkgEngines: pkgManifest?.engines?.dsh ?? null,
      compatibility: compat,
      integrityOk,
      versionMismatch,
      installed: installed !== undefined,
      installedVersion: installed?.version ?? null,
      // 冲突类型 A：同名已装
      conflict: installed !== undefined ? 'plugin' : null,
    });
  }

  // ---- 冲突类型 B：patch 行 config ----
  const patchText = await readTextFile(join(ctx.profileDir ?? '', 'cordis.patch.yml'));  const localByName = new Map();
  for (const row of splitPatchRows(patchText ?? '')) {
    const parsed = parsePatchRow(row);
    if (parsed.name !== null && parsed.config !== null) localByName.set(parsed.name, parsed);
  }
  const configResults = [];
  for (const item of manifest.config?.items ?? []) {
    if (item.kind !== 'patch') continue;
    const entry = byName.get(`config/${item.rel}`) ?? byName.get(item.rel);
    if (entry === undefined) continue;
    const local = localByName.get(item.plugin);
    configResults.push({
      rel: item.rel,
      kind: 'patch',
      plugin: item.plugin,
      patchId: item.patchId ?? null,
      importedText: entry.data.toString('utf8'),
      localText: local?.config ?? null,
      localId: local?.id ?? null,
      conflict: local?.config != null,
    });
  }

  // ---- 冲突类型 C：独立配置文件 ----
  for (const item of manifest.config?.items ?? []) {
    if (item.kind === 'patch') continue;
    const entry = byName.get(`config/home/${item.rel}`) ?? byName.get(item.rel);
    if (entry === undefined) continue;
    const localPath = join(ctx.home, item.rel);
    let localText = null;
    try {
      localText = await readFile(localPath, 'utf8');
    } catch { localText = null; }
    configResults.push({
      rel: item.rel,
      kind: 'home',
      plugin: item.plugin,
      importedText: entry.data.toString('utf8'),
      localText,
      localPath,
      conflict: localText !== null,
    });
  }

  return {
    ok: true,
    source: manifest.source ?? null,
    exportedAt: manifest.exportedAt ?? null,
    plugins: pluginResults,
    config: configResults,
    warnings: Array.isArray(manifest.warnings) ? manifest.warnings : [],
    security: manifest.security ?? null,
    runtimeVersion: ctx.runtimeVersion,
    sourceDshVersion: manifest.source?.dshVersion ?? null,
  };
}

// ---------------------------------------------------------------------------
// 配置写入（行级文本处理，绝不重新序列化 YAML）
// ---------------------------------------------------------------------------

/** 行首缩进宽度（tab 记 2）。 */
function indentOfLine(line) {
  let n = 0;
  for (const ch of line) {
    if (ch === ' ') n += 1;
    else if (ch === '\t') n += 2;
    else break;
  }
  return n;
}

/** YAML 标量加引号（包名含 @ / : 时必须）。 */
function quoteYamlScalar(value) {
  const v = String(value ?? '');
  if (v === '') return "''";
  if (/^[A-Za-z0-9._-]+$/.test(v)) return v;
  if (v.includes("'")) return `"${v}"`;
  return `'${v}'`;
}

/**
 * 在 patch 文档里替换 / 新增 / 删除某个插件行的 config 块。
 *
 * 纯文本行级操作 —— 不解析 YAML 再序列化（那会丢注释、改缩进、动键序）。
 *
 * @param {string} patchText 整个 patch 文档
 * @param {object} options
 * @param {string} options.pluginName 插件包名（按 name 精确匹配，其次按 id）
 * @param {string|null} options.patchId 行 id（新增行时用）
 * @param {string|null} options.newConfig 新的 config 块文本（null = 删除 config 块）
 * @returns {{text: string, changed: boolean, action: 'replaced'|'inserted'|'removed'|'none'}}
 */
export function applyPatchConfig(patchText, { pluginName, patchId, newConfig }) {
  const text = String(patchText ?? '');
  const lines = text.split(/\r?\n/);

  // 行区间（顶层 `- ` 开头的行到下一个 `- ` 之前）
  const rows = [];
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^- /.test(lines[i])) {
      if (start !== -1) rows.push({ start, end: i - 1 });
      start = i;
    }
  }
  if (start !== -1) rows.push({ start, end: lines.length - 1 });

  let found = null;
  for (const row of rows) {
    const parsed = parsePatchRow({ lines: lines.slice(row.start, row.end + 1) });
    if (parsed.name === pluginName || (patchId !== null && parsed.id === patchId)) {
      found = { row, parsed };
      break;
    }
  }

  if (found === null) {
    // 行不存在 → 追加新行（带 config）
    if (newConfig === null) return { text, changed: false, action: 'none' };
    const id = patchId ?? pluginName;
    const block = [
      `- id: ${id}`,
      `  name: ${quoteYamlScalar(pluginName)}`,
      ...newConfig.replace(/\n$/, '').split('\n'),
    ];
    const next = [...lines];
    while (next.length > 0 && next[next.length - 1].trim() === '') next.pop();
    next.push(...block, '');
    return { text: next.join('\n'), changed: true, action: 'inserted' };
  }

  const { row, parsed } = found;
  const rowLines = lines.slice(row.start, row.end + 1);

  if (parsed.config === null) {
    // 行存在但没有 config 块 → 在行末尾追加
    if (newConfig === null) return { text, changed: false, action: 'none' };
    const next = [...lines];
    next.splice(row.end + 1, 0, ...newConfig.replace(/\n$/, '').split('\n'));
    return { text: next.join('\n'), changed: true, action: 'replaced' };
  }

  // 定位 config 块区间
  const configStart = rowLines.findIndex((l) => /^\s*config:/.test(l));
  if (configStart === -1) {
    const next = [...lines];
    next.splice(row.end + 1, 0, ...newConfig.replace(/\n$/, '').split('\n'));
    return { text: next.join('\n'), changed: true, action: 'replaced' };
  }
  const keyIndent = indentOfLine(rowLines[configStart]);
  let configEnd = configStart;
  for (let i = configStart + 1; i < rowLines.length; i += 1) {
    const line = rowLines[i];
    if (line.trim() === '') { configEnd = i; continue; }
    if (indentOfLine(line) <= keyIndent) break;
    configEnd = i;
  }
  while (configEnd > configStart && rowLines[configEnd].trim() === '') configEnd -= 1;

  const next = [...lines];
  if (newConfig === null) {
    next.splice(row.start + configStart, configEnd - configStart + 1);
    return { text: next.join('\n'), changed: true, action: 'removed' };
  }
  next.splice(
    row.start + configStart,
    configEnd - configStart + 1,
    ...newConfig.replace(/\n$/, '').split('\n'),
  );
  return { text: next.join('\n'), changed: true, action: 'replaced' };
}

// ---------------------------------------------------------------------------
// 导入暂存（把 tarball 落盘，供官方 installBundle 的 file: spec 使用）
// ---------------------------------------------------------------------------

/**
 * 把导入包解到暂存目录，返回每个插件 tarball 的绝对路径。
 *
 * 路径必须**绝对**（官方 parseInstallSpec 明确拒绝相对路径：「a local path must be absolute」）。
 *
 * @param {Buffer} buffer zip 字节
 * @param {string} home $DSH_HOME
 * @param {string} id 暂存 id
 * @returns {Promise<{dir: string, tarballs: Map<string, string>}>}
 */
export async function stageImportPackage(buffer, home, id) {
  const { entries } = readZip(buffer);
  const dir = join(home, IMPORT_DIR_NAME, id);
  await mkdir(dir, { recursive: true });
  const tarballs = new Map();
  for (const entry of entries) {
    if (!entry.name.startsWith('plugins/') || !entry.name.endsWith('.tgz')) continue;
    const safe = basename(entry.name);
    if (!/^[A-Za-z0-9@._-]+\.tgz$/.test(safe)) continue;
    const path = join(dir, safe);
    await writeFile(path, entry.data);
    tarballs.set(entry.name, path);
  }
  return { dir, tarballs };
}

/** 清理暂存目录。 */
export async function cleanupImportStage(home, id) {
  await rm(join(home, IMPORT_DIR_NAME, id), { recursive: true, force: true }).catch(() => {});
}

/** 列出暂存目录（调试用）。 */
export async function listImportStages(home) {
  try {
    return await readdir(join(home, IMPORT_DIR_NAME));
  } catch {
    return [];
  }
}
