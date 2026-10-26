export function createRateLimiter(maxRequests, windowMs, { maxKeys = 10_000, now = Date.now } = {}) {
  if (!Number.isInteger(maxRequests) || maxRequests < 1 ||
      !Number.isFinite(windowMs) || windowMs < 1 ||
      !Number.isInteger(maxKeys) || maxKeys < 1) {
    throw new TypeError('Rate limit requires positive request, time window, and client limits.');
  }

  const clients = new Map();
  const cleanup = setInterval(() => {
    const current = now();
    for (const [key, bucket] of clients) {
      if (current - bucket.startedAt >= windowMs) clients.delete(key);
    }
  }, Math.min(windowMs, 60_000)).unref();

  function middleware(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const current = now();
    let bucket = clients.get(key);

    if (!bucket || current - bucket.startedAt >= windowMs) {
      if (!bucket && clients.size >= maxKeys) clients.delete(clients.keys().next().value);
      bucket = { startedAt: current, count: 0 };
      clients.set(key, bucket);
    }

    bucket.count++;
    if (bucket.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a few minutes.' });
    }
    next();
  }

  middleware.close = () => clearInterval(cleanup);
  return middleware;
}
