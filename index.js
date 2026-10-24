/**
 * dsh-plugin-keeper — Host half（Node 侧）。
 *
 * 职责（M0）：
 * - 盘点当前 profile 的插件：读 profile package.json 的 dependencies（spec 天然记录来源）
 *   + 每个包自己的 package.json（版本、dsh 元数据），汇成快照给浏览器半区。
 * - 官方包（dsh / @deepseek-ai/*）只标记，不做任何写操作；本插件自身也不写任何文件。
 *
 * M1+ 预留：检查更新（npm registry / GitHub releases）、批量更新/停用/卸载
 * （停用直调官方 pluginManager 服务；更新走 pnpm add，装前快照、失败回滚）。
 *
 * 依赖解析：@deepseek-ai/dsh-typert-protocol 走 peerDependencies（^0.2.0-rc.2），
 * 宿主 ResolutionRouter 会把它路由到安装域的同一份副本，保证类标记一致。
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

/**
 * 运行态 RPC 服务：浏览器半区经 ctx.remote['dsh-plugin-keeper'].snapshot() 调用。
 */
class PluginKeeperService extends TypertRemoteService {
  static inject = [];

  constructor(ctx) {
    super(ctx, 'PluginKeeperService', { namespace: 'dsh-plugin-keeper' });
    if (!serviceBridge) throw new Error('dsh-plugin-keeper: service bridge missing');
    this.profile = serviceBridge.profile;
  }

  /**
   * 来源分组盘点快照。只读：碰的文件只有 profile package.json 与
   * node_modules/<name>/package.json，不做任何写操作。
   */
  async snapshot() {
    const errors = [];
    const dir = this.profile?.dir ?? null;
    const profileName = this.profile?.name ?? null;
    const pkg = dir ? await readJsonSafe(join(dir, 'package.json'), errors) : null;
    const deps = pkg?.dependencies ?? {};
    const started = new Set(Array.isArray(this.profile?.startedBundles) ? this.profile.startedBundles : []);

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

    return {
      ok: true,
      profileName,
      pluginCount: plugins.length,
      startedBundles: [...started],
      plugins,
      errors,
      generatedAt: new Date().toISOString(),
    };
  }
}

markRemoteMethods(PluginKeeperService.prototype, ['snapshot']);

export const inject = ['profileContext'];

export function apply(ctx) {
  const profile = ctx.profileContext ?? null;
  serviceBridge = { profile };
  ctx.effect(() => ctx.plugin(PluginKeeperService), 'dsh-plugin-keeper rpc service');
  ctx.effect(() => () => {
    serviceBridge = null;
  }, 'dsh-plugin-keeper bridge cleanup');
}
