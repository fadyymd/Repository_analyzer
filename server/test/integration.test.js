import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUser } from '../analyzer.js';

const iso = (d) => new Date(Date.now() - d * 86400000).toISOString();
const repo = (id, name, extra = {}) => ({
  id, name, html_url: `https://github.com/u/${name}`, owner: { login: 'u' }, default_branch: 'main',
  description: '', language: 'JavaScript', stargazers_count: 0, forks_count: 0, open_issues_count: 0, size: 10,
  fork: false, archived: false, topics: [], license: null, created_at: iso(900), pushed_at: iso(5), ...extra,
});

const REPOS = [
  repo(1, 'good', { description: 'A complete, well documented project', topics: ['x'], license: { spdx_id: 'MIT' }, stargazers_count: 12, forks_count: 3 }),
  repo(2, 'bare', { language: 'Python', pushed_at: iso(700) }),
  repo(3, 'forked', { fork: true, language: null }),
  repo(4, 'empty', { language: null }),
];
const TREES = {
  good: [
    { path: 'README.md', size: 900 }, { path: 'LICENSE', size: 1000 }, { path: 'src/a.test.js', size: 5 },
    { path: '.github/workflows/ci.yml', size: 5 }, { path: '.gitignore', size: 5 },
  ],
  bare: [{ path: 'main.py', size: 5 }],
};

test('analyzeUser aggregates a mocked GitHub account', async () => {
  globalThis.fetch = async (url) => {
    const u = String(url);
    const json = (body, status = 200) => ({ ok: status < 400, status, headers: new Headers(), json: async () => body });
    if (u.includes('/users/u/repos')) return json(REPOS);
    if (u.endsWith('/users/u')) return json({ login: 'u', name: 'U', avatar_url: '', html_url: 'https://github.com/u', followers: 1, public_repos: 4 });
    const m = u.match(/repos\/u\/([^/]+)\/git\/trees/);
    if (m && TREES[m[1]]) return json({ tree: TREES[m[1]] });
    return json({}, 409); // empty repo
  };

  const out = await analyzeUser('u', { max: 30 });
  assert.equal(out.summary.totalRepos, 4);
  assert.equal(out.summary.forkedRepos, 1);
  assert.equal(out.summary.totalStars, 12);
  assert.equal(out.summary.scannedRepos, 3);
  assert.equal(out.summary.staleCount, 1);
  assert.equal(out.summary.missingReadme, 2);
  assert.equal(out.repos.find((r) => r.name === 'good').score, 100);
  assert.equal(out.repos.find((r) => r.name === 'forked').score, null);
  assert.equal(out.topStarred[0].name, 'good');
  assert.equal(out.languages.find((l) => l.name === 'JavaScript').count, 1);
  assert.equal(out.languages.find((l) => l.name === 'Python').count, 1);
  assert.equal(out.summary.missingCI, 2);
  assert.equal(out.summary.grade, 'F');
  assert.equal(out.coverage.readme, 33);
  assert.ok(out.recommendations.length > 0 && out.recommendations[0].gain >= out.recommendations.at(-1).gain);
  assert.ok(out.createdByYear.length > 0);
});
