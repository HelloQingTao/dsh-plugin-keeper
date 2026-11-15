// 安装队列的落盘存储（纯函数 + 文件 I/O，便于单独测试）。
// 队列重启后仍保留历史（尤其失败项）；重启前未跑完的条目统一落成「中断失败」，不自动重跑。
import { readFile, writeFile, chmod, rename } from 'node:fs/promises';

const ACTIVE_STATUS = new Set(['queued', 'running']);

/** 把任意来源的条目归一化成队列条目；不可用返回 null。 */
export function normalizeQueueItem(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const status = typeof raw.status === 'string' ? raw.status : 'failed';
  const interrupted = ACTIVE_STATUS.has(status);
  return {
    id: raw.id,
    name: raw.name,
    spec: typeof raw.spec === 'string' ? raw.spec : raw.name,
    registry: typeof raw.registry === 'string' && raw.registry ? raw.registry : null,
    status: interrupted ? 'failed' : status,
    requestId: null,
    queuedAt: typeof raw.queuedAt === 'string' ? raw.queuedAt : now,
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : null,
    finishedAt: interrupted ? now : (typeof raw.finishedAt === 'string' ? raw.finishedAt : null),
    error: interrupted ? '因 dsh 重启中断，未完成' : (typeof raw.error === 'string' ? raw.error : null),
    code: interrupted ? 'interrupted' : (typeof raw.code === 'string' ? raw.code : null),
    application: typeof raw.application === 'string' ? raw.application : null,
    target: typeof raw.target === 'string' ? raw.target : null,
    installedVersion: typeof raw.installedVersion === 'string' ? raw.installedVersion : null,
  };
}

/** 读盘：文件不存在/损坏 → 空数组；兼容裸数组与 { items } 两种外壳。 */
export async function loadQueueFile(path) {
  let raw = null;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return [];
  }
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  const now = new Date().toISOString();
  const out = [];
  for (const it of list) {
    const normalized = normalizeQueueItem(it, now);
    if (normalized) out.push(normalized);
  }
  return out;
}

/** 写盘：先写临时文件再 rename，避免写一半崩溃留下坏 JSON。 */
export async function saveQueueFile(path, items) {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(items, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(tmp, path);
  await chmod(path, 0o600).catch(() => {});
}
