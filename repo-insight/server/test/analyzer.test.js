import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFiles, evaluateRepo, WEIGHTS } from '../analyzer.js';

const NOW = new Date('2026-10-25').getTime();
const isoDaysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

test('detectFiles finds README, LICENSE and tests', () => {
  const f = detectFiles(['README.md', 'LICENSE', 'src/index.js', 'src/app.test.js']);
  assert.deepEqual(f, { hasReadme: true, hasLicenseFile: true, hasTests: true });
});

test('detectFiles ignores nested README and finds nothing in a bare repo', () => {
  const f = detectFiles(['docs/README.md', 'index.js']);
  assert.equal(f.hasReadme, false);
  assert.equal(f.hasLicenseFile, false);
  assert.equal(f.hasTests, false);
});

test('a complete, active repo scores 100', () => {
  const repo = { description: 'A well documented utility library', topics: ['js'], license: { spdx_id: 'MIT' }, pushed_at: isoDaysAgo(10) };
  const ev = evaluateRepo(repo, { hasReadme: true, hasLicenseFile: true, hasTests: true }, NOW);
  assert.equal(ev.score, 100);
  assert.deepEqual(ev.issues, []);
});

test('an empty stale repo scores 0 and lists every issue', () => {
  const repo = { description: '', topics: [], license: null, pushed_at: isoDaysAgo(800) };
  const ev = evaluateRepo(repo, { hasReadme: false, hasLicenseFile: false, hasTests: false }, NOW);
  assert.equal(ev.score, 0);
  assert.equal(ev.issues.length, 6);
});

test('weak description and mid-age activity give half points', () => {
  const repo = { description: 'short', topics: [], license: null, pushed_at: isoDaysAgo(300) };
  const ev = evaluateRepo(repo, { hasReadme: false, hasLicenseFile: false, hasTests: false }, NOW);
  assert.equal(ev.points.description, Math.round(WEIGHTS.description / 2));
  assert.equal(ev.points.activity, Math.round(WEIGHTS.activity / 2));
});

test('weights add up to 100', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});
