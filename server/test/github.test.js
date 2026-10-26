import test from 'node:test';
import assert from 'node:assert/strict';
import { gh, GitHubError } from '../github.js';

test('GitHub requests use a timeout and report timed-out requests clearly', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    const error = new Error('request timed out');
    error.name = 'TimeoutError';
    throw error;
  };

  await assert.rejects(gh('/users/example'), (error) => {
    assert.ok(error instanceof GitHubError);
    assert.equal(error.status, 504);
    return true;
  });
});

test('GitHub network failures do not expose upstream error details', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('internal network detail'); };

  await assert.rejects(gh('/users/example'), (error) => {
    assert.ok(error instanceof GitHubError);
    assert.equal(error.status, 502);
    assert.doesNotMatch(error.message, /internal network detail/);
    return true;
  });
});
