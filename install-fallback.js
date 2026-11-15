/**
 * 安装失败结果的「连接/代理类」判定 —— 纯函数，无宿主依赖，便于单测。
 *
 * 背景：宿主 installBundle 失败时**不抛异常**，而是 resolve 成
 *   { application: 'failed', error: { code, diagnostic } }
 * 所以「代理失败 → 直连兜底」不能只写在 catch 分支里；必须在拿到 failed 结果后，
 * 用本模块判定它是不是连接/代理类失败（tunnel / ECONN / 403 …），再决定是否摘代理直连重试。
 */

/** 连接/代理类失败的文本特征（pnpm 输出 / git 报错 / undici 错误通用）。 */
export const CONNECT_FAIL_RE = /econn|etimedout|enotfound|eai_again|network|proxy|tunnel|socket hang up|fetch failed|client error|\b50[234]\b|connect.*fail|unsuccessful/i;

/** 判定一段文本是否像连接/代理类失败。 */
export function isConnectFailureText(text) {
  return CONNECT_FAIL_RE.test(String(text ?? ''));
}

/**
 * 判定「宿主 installBundle 的失败结果」是否属连接/代理类失败。
 * 只看 application==='failed'，并把 error 的 code/name/message/diagnostic 拼起来匹配。
 * 注意：明确的结构化业务错误（incompatible-version / not-bundle / already-installed …）
 * 不算连接失败，不做直连重试。
 */
export function isInstallConnectFailure(result) {
  if (!result || result.application !== 'failed') return false;
  const e = result.error ?? {};
  const code = typeof e.code === 'string' ? e.code : '';
  const nonNetwork = [
    'incompatible-version',
    'not-bundle',
    'already-installed',
    'ambiguous-install',
    'invalid-spec',
    'unsupported-platform',
    'unexpected-package',
    'cancelled',
  ];
  if (nonNetwork.includes(code)) return false;
  const text = [e.code, e.name, e.message, e.diagnostic]
    .filter((v) => typeof v === 'string' && v)
    .join('\n');
  return CONNECT_FAIL_RE.test(text);
}
