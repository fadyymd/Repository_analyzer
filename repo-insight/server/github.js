const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function headers() {
  const h = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'repo-insight',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

/**
 * Minimal GitHub REST client.
 * `soft` lists status codes that should resolve to null instead of throwing
 * (e.g. 404/409 for an empty repository tree).
 */
export async function gh(path, { soft = [] } = {}) {
  const res = await fetch(API + path, { headers: headers() });

  if (soft.includes(res.status)) return null;

  if (res.status === 404) {
    throw new GitHubError(404, 'المستخدم أو المورد غير موجود على GitHub.');
  }
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const mins = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : null;
      throw new GitHubError(
        429,
        `تم تجاوز حد طلبات GitHub.${mins ? ` أعد المحاولة بعد حوالي ${mins} دقيقة.` : ''} ` +
          'أضف GITHUB_TOKEN في ملف .env لرفع الحد إلى 5000 طلب/ساعة.'
      );
    }
    throw new GitHubError(403, 'رفض GitHub الطلب (403).');
  }
  if (!res.ok) throw new GitHubError(res.status, `خطأ من GitHub (${res.status}).`);
  return res.json();
}

/** Fetch every public repo of a user (up to 500) */
export async function fetchAllRepos(username) {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const chunk = await gh(
      `/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=pushed&page=${page}`
    );
    all.push(...chunk);
    if (chunk.length < 100) break;
  }
  return all;
}

export const fetchUser = (username) => gh(`/users/${encodeURIComponent(username)}`);

/** Flat list of file paths in the default branch, or null when unavailable/empty. */
export async function fetchTreePaths(owner, repo, branch) {
  const data = await gh(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { soft: [404, 409] }
  );
  if (!data || !Array.isArray(data.tree)) return null;
  return data.tree.map((n) => n.path);
}
