import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFiles, evaluateRepo, gradeOf, WEIGHTS } from '../analyzer.js';

const NOW = new Date('2026-10-25').getTime();
const isoDaysAgo = (d) => new Date(NOW - d * 86400000).toISOString();
const FULL = { hasReadme: true, readmeSize: 900, hasLicenseFile: true, hasTests: true, hasCI: true, hasGitignore: true };
const NONE = { hasReadme: false, readmeSize: 0, hasLicenseFile: false, hasTests: false, hasCI: false, hasGitignore: false };

test('detectFiles finds README, LICENSE, tests, CI and .gitignore', () => {
  const f = detectFiles([
    { path: 'README.md', size: 800 }, { path: 'LICENSE', size: 1000 }, { path: '.gitignore', size: 10 },
    { path: 'src/app.test.js', size: 50 }, { path: '.github/workflows/ci.yml', size: 90 },
  ]);
  assert.deepEqual(f, FULL.hasReadme && { ...FULL, readmeSize: 800 });
});

test('detectFiles ignores nested README and finds nothing in a bare repo', () => {
  assert.deepEqual(detectFiles(['docs/README.md', 'index.js']), NONE);
});

test('a complete, active repo scores 100 (grade A)', () => {
  const repo = { description: 'A well documented utility library', topics: ['js'], license: { spdx_id: 'MIT' }, pushed_at: isoDaysAgo(10) };
  const ev = evaluateRepo(repo, FULL, NOW);
  assert.equal(ev.score, 100);
  assert.equal(ev.grade, 'A');
  assert.deepEqual(ev.issues, []);
});

test('an empty stale repo scores 0 and lists every issue', () => {
  const repo = { description: '', topics: [], license: null, pushed_at: isoDaysAgo(800) };
  const ev = evaluateRepo(repo, NONE, NOW);
  assert.equal(ev.score, 0);
  assert.equal(ev.grade, 'F');
  assert.equal(ev.issues.length, Object.keys(WEIGHTS).length);
});

test('weak description, mid-age activity and tiny README give half points', () => {
  const repo = { description: 'short', topics: [], license: null, pushed_at: isoDaysAgo(300) };
  const ev = evaluateRepo(repo, { ...NONE, hasReadme: true, readmeSize: 100 }, NOW);
  assert.equal(ev.points.description, Math.round(WEIGHTS.description / 2));
  assert.equal(ev.points.activity, Math.round(WEIGHTS.activity / 2));
  assert.equal(ev.points.readmeDepth, Math.round(WEIGHTS.readmeDepth / 2));
});

test('archived repos are not penalised for inactivity', () => {
  const repo = { description: '', topics: [], archived: true, pushed_at: isoDaysAgo(2000) };
  assert.equal(evaluateRepo(repo, NONE, NOW).checks.activity, 'ok');
});

test('unreadable tree yields unknown checks instead of failures', () => {
  const ev = evaluateRepo({ description: '', topics: [], pushed_at: isoDaysAgo(1) }, null, NOW);
  assert.equal(ev.checks.readme, 'unknown');
  assert.ok(!ev.issues.includes('readme'));
});

test('grades and weights', () => {
  assert.deepEqual([95, 80, 65, 45, 10].map(gradeOf), ['A', 'B', 'C', 'D', 'F']);
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});
