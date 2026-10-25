import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHistoryStore } from '../history.js';

test('history persists score snapshots and isolates usernames case-insensitively', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-insight-history-'));
  const filename = path.join(dir, 'history.sqlite');
  let store = createHistoryStore(filename);
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  store.save({
    login: 'Example',
    analyzedAt: '2026-10-01T12:00:00.000Z',
    avgScore: 72,
    grade: 'C',
    scannedRepos: 5,
    totalRepos: 10,
  });

  assert.deepEqual(store.list('example'), [{
    analyzedAt: '2026-10-01T12:00:00.000Z',
    avgScore: 72,
    grade: 'C',
    scannedRepos: 5,
    totalRepos: 10,
  }]);
  store.close();

  store = createHistoryStore(filename);
  assert.equal(store.list('EXAMPLE').length, 1);
  assert.equal(store.list('someone-else').length, 0);
});

test('history removes snapshots older than its retention period', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-insight-history-'));
  const filename = path.join(dir, 'history.sqlite');
  const now = Date.parse('2026-10-25T12:00:00.000Z');
  const store = createHistoryStore(filename, { retentionDays: 90, now: () => now });
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  store.save({
    login: 'example',
    analyzedAt: '2026-07-27T11:59:59.000Z',
    avgScore: 50,
    grade: 'F',
    scannedRepos: 1,
    totalRepos: 1,
  });
  store.save({
    login: 'example',
    analyzedAt: '2026-07-27T12:00:00.000Z',
    avgScore: 60,
    grade: 'C',
    scannedRepos: 1,
    totalRepos: 1,
  });

  assert.deepEqual(store.list('example').map((row) => row.avgScore), [60]);
});
