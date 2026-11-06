/**
 * GitHub 安装地址归一化 —— host 半区唯一实现。
 *
 * 客户端半区（client.js 是 CommonJS 单文件，不能 import ESM）通过
 * RPC `normalizeGithubSpec` 取结果；盘点、批量更新、导出都复用本文件，
 * 避免多处正则各自漂移。
 *
 * 统一产出 `github:owner/repo[#ref]`。带 github: 前缀、不带前缀、完整 URL、
 * SSH、.git、#ref、/tree/ref 全部收敛到同一种形式。
 */

const GITHUB_URL = /^https?:\/\/(?:www\.)?github\.com\//i;
const BARE_HOST = /^(?:www\.)?github\.com\//i;
const NAME = /^[\w.-]+$/;

/** 归一化，失败抛带原因的 Error。返回 { owner, repo, ref, spec }。 */
export function normalizeGithubSpec(raw) {
  const original = String(raw ?? '').trim();
  let s = original;
  if (!s) throw new Error('地址为空');
  if (/\s/.test(s)) throw new Error('地址不能包含空格');

  // codeload tarball 直链（profile 依赖里常见）：
  // https://codeload.github.com/<owner>/<repo>/tar.gz/<sha-or-tag>
  // 归一出 owner/repo 与 ref，才能让打开图标、复制名称、批量更新都拿到仓库信息。
  const codeload = /^https?:\/\/(?:www\.)?codeload\.github\.com\/([^/]+)\/([^/]+)\/tar\.gz\/(.+)$/i.exec(s);
  if (codeload) {
    const owner = codeload[1];
    const repo = codeload[2].replace(/\.git$/i, '');
    const ref = codeload[3].replace(/\/+$/, '') || null;
    if (!NAME.test(owner) || !NAME.test(repo)) {
      throw new Error(`需要 owner/repo 或 GitHub 链接，收到：${original.slice(0, 120)}`);
    }
    return { owner, repo, ref, spec: `github:${owner}/${repo}${ref ? `#${ref}` : ''}` };
  }

  s = s.replace(/^git\+/i, '');
  if (/^git@github\.com:/i.test(s)) s = `https://github.com/${s.slice('git@github.com:'.length)}`;
  else if (/^ssh:\/\/git@github\.com\//i.test(s)) s = s.replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/');
  else if (/^git:\/\/github\.com\//i.test(s)) s = s.replace(/^git:\/\/github\.com\//i, 'https://github.com/');

  if (/^github:/i.test(s)) {
    s = s.slice(7);
    // 兼容历史导出包里的畸形叠加前缀 github:https://github.com/...
    if (GITHUB_URL.test(s)) s = s.replace(GITHUB_URL, '');
  } else if (GITHUB_URL.test(s)) s = s.replace(GITHUB_URL, '');
  else if (BARE_HOST.test(s)) s = s.replace(BARE_HOST, '');

  // 先摘 #ref，再处理路径，最后才剥 .git —— 顺序反了会把 .git 吞进 repo 名
  let ref = null;
  const hash = s.indexOf('#');
  if (hash >= 0) {
    ref = s.slice(hash + 1).trim();
    s = s.slice(0, hash);
  }
  s = s.split('?')[0].replace(/\/+$/, '');

  const pathRef = /\/(?:tree|releases\/tag|tag)\/(.+)$/i.exec(s);
  if (pathRef) {
    if (!ref) {
      let r = pathRef[1].replace(/\/+$/, '').replace(/\.git$/i, '');
      // refs/tags/v1 这类多段 ref 保留全路径；从 /blob/ 页面粘来的只取第一段
      r = r.startsWith('refs/') ? r : r.split('/')[0];
      ref = r || null;
    }
    s = s.slice(0, pathRef.index);
  }

  s = s.replace(/\.git$/i, '');
  const parts = s.split('/');
  const owner = parts[0];
  const repo = parts[1];
  if (!NAME.test(owner ?? '') || !NAME.test(repo ?? '')) {
    throw new Error(`需要 owner/repo 或 GitHub 链接，收到：${original.slice(0, 120)}`);
  }
  if (ref && !/^[^\s#]+$/.test(ref)) throw new Error(`版本锚点不合法：${ref}`);
  return {
    owner,
    repo,
    ref: ref || null,
    spec: `github:${owner}/${repo}${ref ? `#${ref}` : ''}`,
  };
}

/** 不抛错版本，供盘点时给未知 spec 兜底。 */
export function tryNormalizeGithubSpec(raw) {
  try {
    return normalizeGithubSpec(raw);
  } catch {
    return null;
  }
}

/** 只要 `owner/repo`，供检查更新 / 批量更新 / 导出共用。 */
export function githubRepoKey(raw) {
  const g = tryNormalizeGithubSpec(raw);
  return g ? `${g.owner}/${g.repo}` : null;
}
