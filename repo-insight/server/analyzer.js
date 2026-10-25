import { fetchAllRepos, fetchUser, fetchTreePaths } from './github.js';

/* ---------- scoring rules (total = 100) ---------- */
export const WEIGHTS = {
  description: 15,
  readme: 25,
  license: 15,
  tests: 20,
  topics: 10,
  activity: 15,
};

export const STALE_DAYS = 365; // not updated for a year => stale
export const ACTIVE_DAYS = 180; // updated within 6 months => full activity points
const MIN_DESCRIPTION_LENGTH = 20;

const README_RE = /^readme(\.[a-z0-9]+)?$/i;
const LICENSE_RE = /^(license|licence|copying|unlicense)(\.[a-z0-9]+)?$/i;
const TEST_PATTERNS = [
  /(^|\/)(tests?|__tests__|specs?|e2e|cypress)\//i,
  /\.(test|spec)\.[cm]?[jt]sx?$/i,
  /(^|\/)test_[^/]+\.py$/i,
  /_test\.(py|go|rb|rs)$/i,
  /(^|\/)[^/]+Tests?\.(java|kt|cs|swift)$/,
];

export const daysSince = (iso, now = Date.now()) =>
  iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : Infinity;

export function detectFiles(paths) {
  const root = paths.filter((p) => !p.includes('/'));
  return {
    hasReadme: root.some((p) => README_RE.test(p)),
    hasLicenseFile: root.some((p) => LICENSE_RE.test(p)),
    hasTests: paths.some((p) => TEST_PATTERNS.some((re) => re.test(p))),
  };
}

/**
 * Score one repository.
 * `files` = result of detectFiles() or null when the tree could not be read.
 */
export function evaluateRepo(repo, files, now = Date.now()) {
  const desc = (repo.description || '').trim();
  const idle = daysSince(repo.pushed_at, now);

  const checks = {
    description: desc.length >= MIN_DESCRIPTION_LENGTH ? 'ok' : desc.length > 0 ? 'weak' : 'missing',
    readme: files ? (files.hasReadme ? 'ok' : 'missing') : 'unknown',
    license: repo.license || (files && files.hasLicenseFile) ? 'ok' : files ? 'missing' : 'unknown',
    tests: files ? (files.hasTests ? 'ok' : 'missing') : 'unknown',
    topics: (repo.topics || []).length > 0 ? 'ok' : 'missing',
    activity: idle <= ACTIVE_DAYS ? 'ok' : idle <= STALE_DAYS ? 'weak' : 'stale',
  };

  const points = {
    description: checks.description === 'ok' ? WEIGHTS.description : checks.description === 'weak' ? Math.round(WEIGHTS.description / 2) : 0,
    readme: checks.readme === 'ok' ? WEIGHTS.readme : 0,
    license: checks.license === 'ok' ? WEIGHTS.license : 0,
    tests: checks.tests === 'ok' ? WEIGHTS.tests : 0,
    topics: checks.topics === 'ok' ? WEIGHTS.topics : 0,
    activity: checks.activity === 'ok' ? WEIGHTS.activity : checks.activity === 'weak' ? Math.round(WEIGHTS.activity / 2) : 0,
  };

  const score = Object.values(points).reduce((a, b) => a + b, 0);
  const issues = Object.entries(checks)
    .filter(([, v]) => v === 'missing' || v === 'weak' || v === 'stale')
    .map(([k]) => k);

  return { checks, points, score, issues };
}

/* ---------- helpers ---------- */
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

const shape = (r) => ({
  name: r.name,
  url: r.html_url,
  description: r.description || '',
  language: r.language || null,
  stars: r.stargazers_count,
  forks: r.forks_count,
  openIssues: r.open_issues_count,
  sizeKb: r.size,
  fork: r.fork,
  archived: r.archived,
  topics: r.topics || [],
  license: r.license ? r.license.spdx_id || r.license.name : null,
  createdAt: r.created_at,
  pushedAt: r.pushed_at,
  idleDays: Number.isFinite(daysSince(r.pushed_at)) ? daysSince(r.pushed_at) : null,
});

/* ---------- main entry ---------- */
export async function analyzeUser(username, { max = 30 } = {}) {
  const [user, rawRepos] = await Promise.all([fetchUser(username), fetchAllRepos(username)]);
  const now = Date.now();

  const own = rawRepos.filter((r) => !r.fork);
  // deep-scan the most recently pushed repos first, within the requested cap
  const toScan = [...own].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)).slice(0, max);
  const scanSet = new Set(toScan.map((r) => r.id));

  const scanned = new Map();
  await mapPool(toScan, 5, async (r) => {
    let files = null;
    try {
      const paths = await fetchTreePaths(r.owner.login, r.name, r.default_branch);
      files = paths ? detectFiles(paths) : { hasReadme: false, hasLicenseFile: false, hasTests: false, empty: true };
    } catch (e) {
      if (e.status === 429) throw e; // surface rate-limit to the user
      files = null;
    }
    scanned.set(r.id, files);
  });

  const repos = rawRepos.map((r) => {
    const base = shape(r);
    if (r.fork || !scanSet.has(r.id)) return { ...base, scanned: false, score: null, checks: null, issues: [] };
    const files = scanned.get(r.id);
    const ev = evaluateRepo(r, files, now);
    return { ...base, scanned: files !== null, ...ev };
  });

  /* aggregates */
  const langMap = new Map();
  for (const r of repos) {
    const key = r.language || 'غير محدد';
    langMap.set(key, (langMap.get(key) || 0) + 1);
  }
  const languages = [...langMap.entries()]
    .map(([name, count]) => ({ name, count, percent: +((count / repos.length) * 100).toFixed(1) }))
    .sort((a, b) => b.count - a.count);

  const scored = repos.filter((r) => r.score !== null);
  const avgScore = scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : null;

  const countMissing = (key) => scored.filter((r) => r.checks && r.checks[key] === 'missing').length;
  const stale = repos
    .filter((r) => !r.fork && r.idleDays !== null && r.idleDays > STALE_DAYS)
    .sort((a, b) => b.idleDays - a.idleDays);

  const buckets = [
    { range: '0-39', count: 0 },
    { range: '40-59', count: 0 },
    { range: '60-79', count: 0 },
    { range: '80-100', count: 0 },
  ];
  for (const r of scored) {
    if (r.score < 40) buckets[0].count++;
    else if (r.score < 60) buckets[1].count++;
    else if (r.score < 80) buckets[2].count++;
    else buckets[3].count++;
  }

  return {
    user: {
      login: user.login,
      name: user.name,
      avatar: user.avatar_url,
      url: user.html_url,
      bio: user.bio,
      followers: user.followers,
      publicRepos: user.public_repos,
    },
    summary: {
      totalRepos: repos.length,
      ownRepos: own.length,
      forkedRepos: repos.length - own.length,
      totalStars: repos.reduce((s, r) => s + r.stars, 0),
      totalForks: repos.reduce((s, r) => s + r.forks, 0),
      languagesCount: languages.filter((l) => l.name !== 'غير محدد').length,
      scannedRepos: scored.length,
      avgScore,
      staleCount: stale.length,
      missingReadme: countMissing('readme'),
      missingDescription: scored.filter((r) => r.checks.description !== 'ok').length,
      missingLicense: countMissing('license'),
      missingTests: countMissing('tests'),
      limited: own.length > toScan.length,
    },
    languages,
    topStarred: [...repos].sort((a, b) => b.stars - a.stars).slice(0, 8).filter((r) => r.stars > 0),
    staleRepos: stale.map((r) => ({ name: r.name, url: r.url, idleDays: r.idleDays, pushedAt: r.pushedAt })),
    scoreBuckets: buckets,
    repos,
    meta: { generatedAt: new Date().toISOString(), staleDays: STALE_DAYS, weights: WEIGHTS },
  };
}
