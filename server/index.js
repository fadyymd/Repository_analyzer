import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRateLimiter } from './limits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// load ../.env if present (Node >= 20.12); silently ignore otherwise
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* no .env */ }

const { analyzeUser } = await import('./analyzer.js');
const { GitHubError } = await import('./github.js');
const { createHistoryStore, HISTORY_RETENTION_DAYS } = await import('./history.js');

const app = express();
app.disable('x-powered-by');

const trustProxyHops = process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : 0;
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
  throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10.');
}
app.set('trust proxy', trustProxyHops);

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
for (const origin of allowedOrigins) {
  let parsed;
  try { parsed = new URL(origin); } catch { throw new Error(`Invalid CORS origin: ${origin}`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
    throw new Error(`CORS_ALLOWED_ORIGINS must contain exact HTTP(S) origins: ${origin}`);
  }
}
const allowedOriginSet = new Set(allowedOrigins);
app.use(cors({
  origin(origin, callback) {
    callback(null, Boolean(origin && allowedOriginSet.has(origin)));
  },
  methods: ['GET', 'HEAD'],
  maxAge: 600,
}));
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' https://avatars.githubusercontent.com data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

const historyPath = path.resolve(
  __dirname,
  process.env.HISTORY_DB_PATH || path.join('data', 'repo-insight.sqlite')
);
const historyStore = createHistoryStore(historyPath);

const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const cache = new Map(); // key -> { at, data }
const TTL = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const MAX_CONCURRENT_ANALYSES = 10;
const inFlight = new Map();
const analyzeLimiter = createRateLimiter(40, 10 * 60 * 1000);
const historyLimiter = createRateLimiter(60, 10 * 60 * 1000);
const badgeLimiter = createRateLimiter(120, 10 * 60 * 1000);
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

async function getAnalysis(username, max) {
  const key = `${username.toLowerCase()}:${max}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    cache.delete(key);
    cache.set(key, hit);
    return { ...hit.data, cached: true };
  }
  if (hit) cache.delete(key);

  const pending = inFlight.get(key);
  if (pending) return { ...(await pending), cached: true };
  if (inFlight.size >= MAX_CONCURRENT_ANALYSES) {
    throw new GitHubError(503, 'الخادم مشغول حاليًا. حاول مرة أخرى بعد قليل.');
  }

  const analysis = (async () => {
    const data = await analyzeUser(username, { max });
    historyStore.save({
      login: data.user.login,
      analyzedAt: data.meta.generatedAt,
      avgScore: data.summary.avgScore,
      grade: data.summary.grade,
      scannedRepos: data.summary.scannedRepos,
      totalRepos: data.summary.totalRepos,
    });
    while (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), data });
    return data;
  })();
  inFlight.set(key, analysis);
  try {
    return await analysis;
  } finally {
    if (inFlight.get(key) === analysis) inFlight.delete(key);
  }
}

function handleError(err, res) {
  if (err instanceof GitHubError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: 'حدث خطأ غير متوقع أثناء التحليل.' });
}

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  historyRetentionDays: HISTORY_RETENTION_DAYS,
}));

app.get('/api/analyze/:username', analyzeLimiter, async (req, res) => {
  const { username } = req.params;
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'اسم مستخدم GitHub غير صالح.' });
  const maxParam = req.query.max;
  if (maxParam !== undefined && (typeof maxParam !== 'string' || !/^\d+$/.test(maxParam))) {
    return res.status(400).json({ error: 'عدد المستودعات يجب أن يكون رقمًا صحيحًا بين 5 و60.' });
  }
  const max = Math.min(Math.max(maxParam === undefined ? 30 : Number(maxParam), 5), 60);
  try {
    const data = await getAnalysis(username, max);
    res.set('Cache-Control', 'no-store').json({ ...data, history: historyStore.list(data.user.login) });
  } catch (err) {
    handleError(err, res);
  }
});

app.get('/api/history/:username', historyLimiter, (req, res) => {
  if (!USERNAME_RE.test(req.params.username)) {
    return res.status(400).json({ error: 'اسم مستخدم GitHub غير صالح.' });
  }
  try {
    res.set('Cache-Control', 'no-store').json({ login: req.params.username, history: historyStore.list(req.params.username) });
  } catch (err) {
    handleError(err, res);
  }
});

/* README badge:  ![health](https://your-host/api/badge/USERNAME.svg)  */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function badge(label, value, color) {
  const lw = Math.round(label.length * 6.4 + 14);
  const vw = Math.round(value.length * 6.8 + 14);
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
<rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="${lw / 2}" y="14">${esc(label)}</text><text x="${lw + vw / 2}" y="14">${esc(value)}</text></g></svg>`;
}

app.get('/api/badge/:file', badgeLimiter, async (req, res) => {
  const username = req.params.file.replace(/\.svg$/i, '');
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600');
  if (!USERNAME_RE.test(username)) return res.send(badge('repo health', 'invalid', '#9ca3af'));
  try {
    const { summary } = await getAnalysis(username, 30);
    const s = summary.avgScore;
    const color = s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626';
    res.send(badge('repo health', s === null ? 'n/a' : `${s}% ${summary.grade}`, s === null ? '#9ca3af' : color));
  } catch (err) {
    res.set('Cache-Control', 'no-store');
    handleError(err, res);
  }
});

// serve the built client in production
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  app.get('*', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`RepoInsight server running on http://localhost:${PORT}`));
