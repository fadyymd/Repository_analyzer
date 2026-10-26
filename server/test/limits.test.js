import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../limits.js';

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('rate limiter enforces a fixed window and resets after expiry', (t) => {
  let current = 1_000;
  const limit = createRateLimiter(2, 1_000, { now: () => current });
  t.after(() => limit.close());
  const request = { ip: '192.0.2.1' };
  let passed = 0;

  for (let i = 0; i < 2; i++) {
    limit(request, response(), () => passed++);
  }
  const blocked = response();
  limit(request, blocked, () => passed++);
  assert.equal(passed, 2);
  assert.equal(blocked.statusCode, 429);

  current += 1_000;
  const afterExpiry = response();
  limit(request, afterExpiry, () => passed++);
  assert.equal(passed, 3);
  assert.equal(afterExpiry.statusCode, 200);
});

test('rate limiter bounds the number of tracked client addresses', (t) => {
  const limit = createRateLimiter(2, 1_000, { maxKeys: 2 });
  t.after(() => limit.close());

  for (const ip of ['192.0.2.1', '192.0.2.2', '192.0.2.3']) {
    limit({ ip }, response(), () => {});
  }
  const evictedClient = response();
  limit({ ip: '192.0.2.1' }, evictedClient, () => {});
  assert.equal(evictedClient.statusCode, 200);
});
