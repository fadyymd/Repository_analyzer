import { fetchAllRepos, fetchUser, fetchTree, rate } from './github.js';

/* ---------- scoring rules (total = 100) ---------- */
export const WEIGHTS = {
  description: 12,
  readme: 20,
  readmeDepth: 5,
  license: 12,
  tests: 15,
  topics: 8,
  activity: 13,
  ci: 10,
  gitignore: 5,
};

export const STALE_DAYS = 365; // not updated for a year => stale
export const ACTIVE_DAYS = 180; // updated within 6 months => full activity points
const MIN_DESCRIPTION_LENGTH = 20;
const MIN_README_BYTES = 500;

const README_RE = /^readme(\.[a-z0-9]+)?$/i;
const LICENSE_RE = /^(license|licence|copying|unlicense)(\.[a-z0-9]+)?$/i;
const TEST_PATTERNS = [
  /(^|\/)(tests?|__tests__|specs?|e2e|cypress)\//i,
  /\.(test|spec)\.[cm]?[jt]sx?$/i,
  /(^|\/)test_[^/]+\.py$/i,
  /_test\.(py|go|rb|rs)$/i,
  /(^|\/)[^/]+Tests?\.(java|kt|cs|swift)$/,
];
const CI_PATTERNS = [
  /^\.github\/workflows\/[^/]+\.ya?ml$/i,
  /^\.gitlab-ci\.ya?ml$/i,
  /^\.travis\.ya?ml$/i,
  /^\.circleci\/config\.ya?ml$/i,
  /^jenkinsfile$/i,
  /^azure-pipelines\.ya?ml$/i,
];

export const gradeOf = (s) => (s === null || s === undefined ? null : s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F');

export const daysSince = (iso, now = Date.now()) =>
  iso ? Math.floor((now - new Date(iso).getTime()) / 86400000) : Infinity;

/** Accepts ['a/b.js', ...] or [{path, size}, ...] */
export function detectFiles(nodes) {
  const list = nodes.map((n) => (typeof n === 'string' ? { path: n, size: 0 } : n));
  const root = list.filter((n) => !n.path.includes('/'));
  const readme = root.find((n) => README_RE.test(n.path));
  return {
    hasReadme: Boolean(readme),
    readmeSize: readme ? readme.size || 0 : 0,
    hasLicenseFile: root.some((n) => LICENSE_RE.test(n.path)),
    hasTests: list.some((n) => TEST_PATTERNS.some((re) => re.test(n.path))),
    hasCI: list.some((n) => CI_PATTERNS.some((re) => re.test(n.path))),
    hasGitignore: root.some((n) => n.path === '.gitignore'),
  };
}

const EMPTY_FILES = { hasReadme: false, readmeSize: 0, hasLicenseFile: false, hasTests: false, hasCI: false, hasGitignore: false };

/**
 * Score one repository.
 * `files` = result of detectFiles() or null when the tree could not be read.
 */
export function evaluateRepo(repo, files, now = Date.now()) {
  const desc = (repo.description || '').trim();
  const idle = daysSince(repo.pushed_at, now);
  const known = (ok) => (files ? (ok ? 'ok' : 'missing') : 'unknown');

  const checks = {
    description: desc.length >= MIN_DESCRIPTION_LENGTH ? 'ok' : desc.length > 0 ? 'weak' : 'missing',
    readme: known(files?.hasReadme),
    readmeDepth: !files ? 'unknown' : !files.hasReadme ? 'missing' : files.readmeSize >= MIN_README_BYTES ? 'ok' : 'weak',
    license: repo.license || files?.hasLicenseFile ? 'ok' : files ? 'missing' : 'unknown',
    tests: known(files?.hasTests),
    topics: (repo.topics || []).length > 0 ? 'ok' : 'missing',
    // archived repos are intentionally frozen, so they are not penalised for inactivity
    activity: repo.archived || idle <= ACTIVE_DAYS ? 'ok' : idle <= STALE_DAYS ? 'weak' : 'stale',
    ci: known(files?.hasCI),
    gitignore: known(files?.hasGitignore),
  };

  const points = {};
  for (const [key, w] of Object.entries(WEIGHTS)) {
    points[key] = checks[key] === 'ok' ? w : checks[key] === 'weak' ? Math.round(w / 2) : 0;
  }

  const score = Object.values(points).reduce((a, b) => a + b, 0);
  const issues = Object.entries(checks)
    .filter(([, v]) => v === 'missing' || v === 'weak' || v === 'stale')
    .map(([k]) => k);

  return { checks, points, score, grade: gradeOf(score), issues };
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
      const tree = await fetchTree(r.owner.login, r.name, r.default_branch);
      files = tree ? detectFiles(tree) : { ...EMPTY_FILES, empty: true };
    } catch (e) {
      if (e.status === 429) throw e; // surface rate-limit to the user
      files = null;
    }
    scanned.set(r.id, files);
  });

  const repos = rawRepos.map((r) => {
    const base = shape(r);
    if (r.fork || !scanSet.has(r.id)) return { ...base, scanned: false, score: null, grade: null, checks: null, points: null, issues: [] };
    const files = scanned.get(r.id);
    return { ...base, scanned: files !== null, ...evaluateRepo(r, files, now) };
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

  const countMissing = (key) => scored.filter((r) => r.checks[key] === 'missing').length;
  const stale = repos
    .filter((r) => !r.fork && !r.archived && r.idleDays !== null && r.idleDays > STALE_DAYS)
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

  // % of scanned repos that pass each check (feeds the radar chart)
  const coverage = {};
  for (const key of Object.keys(WEIGHTS)) {
    const rel = scored.filter((r) => r.checks[key] !== 'unknown');
    coverage[key] = rel.length ? Math.round((rel.filter((r) => r.checks[key] === 'ok').length / rel.length) * 100) : 0;
  }

  // what to fix first: biggest total points available across repos
  const recommendations = Object.keys(WEIGHTS)
    .map((key) => {
      const failing = scored.filter((r) => ['missing', 'weak', 'stale'].includes(r.checks[key]));
      const gain = failing.reduce((s, r) => s + (WEIGHTS[key] - r.points[key]), 0);
      return { key, count: failing.length, gain, repos: failing.slice(0, 6).map((r) => r.name) };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.gain - a.gain);

  const yearMap = new Map();
  for (const r of repos.filter((x) => !x.fork)) {
    const y = new Date(r.createdAt).getUTCFullYear();
    yearMap.set(y, (yearMap.get(y) || 0) + 1);
  }
  const createdByYear = [...yearMap.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year: String(year), count }));

  const topicMap = new Map();
  for (const r of repos.filter((x) => !x.fork)) for (const t of r.topics) topicMap.set(t, (topicMap.get(t) || 0) + 1);
  const topTopics = [...topicMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count }));

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
      grade: gradeOf(avgScore),
      staleCount: stale.length,
      missingReadme: countMissing('readme'),
      missingDescription: scored.filter((r) => r.checks.description !== 'ok').length,
      missingLicense: countMissing('license'),
      missingTests: countMissing('tests'),
      missingCI: countMissing('ci'),
      limited: own.length > toScan.length,
    },
    languages,
    topStarred: [...repos].sort((a, b) => b.stars - a.stars).slice(0, 8).filter((r) => r.stars > 0),
    staleRepos: stale.map((r) => ({ name: r.name, url: r.url, idleDays: r.idleDays, pushedAt: r.pushedAt })),
    scoreBuckets: buckets,
    coverage,
    recommendations,
    createdByYear,
    topTopics,
    repos,
    meta: {
      generatedAt: new Date().toISOString(),
      staleDays: STALE_DAYS,
      weights: WEIGHTS,
      rateRemaining: rate.remaining,
      rateLimit: rate.limit,
    },
  };
}
