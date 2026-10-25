import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// load ../.env if present (Node >= 20.12); silently ignore otherwise
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* no .env */ }

const { analyzeUser } = await import('./analyzer.js');
const { GitHubError } = await import('./github.js');

const app = express();
app.disable('x-powered-by');
app.use(cors());

const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const cache = new Map(); // key -> { at, data }
const TTL = 10 * 60 * 1000;

/* tiny per-IP rate limiter so the public instance can't burn the GitHub quota */
const hits = new Map();
const limiter = (max, windowMs) => (req, res, next) => {
  const now = Date.now();
  const arr = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(req.ip, arr);
  if (arr.length > max) return res.status(429).json({ error: 'طلبات كثيرة جدًا. حاول بعد بضع دقائق.' });
  next();
};
setInterval(() => hits.clear(), 60 * 60 * 1000).unref();

async function getAnalysis(username, max) {
  const key = `${username.toLowerCase()}:${max}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { ...hit.data, cached: true };
  const data = await analyzeUser(username, { max });
  cache.set(key, { at: Date.now(), data });
  return data;
}

function handleError(err, res) {
  if (err instanceof GitHubError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: 'حدث خطأ غير متوقع أثناء التحليل.' });
}

app.get('/api/health', (_req, res) => res.json({ ok: true, token: Boolean(process.env.GITHUB_TOKEN) }));

app.get('/api/analyze/:username', limiter(40, 10 * 60 * 1000), async (req, res) => {
  const { username } = req.params;
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'اسم مستخدم GitHub غير صالح.' });
  const max = Math.min(Math.max(parseInt(req.query.max, 10) || 30, 5), 60);
  try {
    res.json(await getAnalysis(username, max));
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

app.get('/api/badge/:file', limiter(120, 10 * 60 * 1000), async (req, res) => {
  const username = req.params.file.replace(/\.svg$/i, '');
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600');
  if (!USERNAME_RE.test(username)) return res.send(badge('repo health', 'invalid', '#9ca3af'));
  try {
    const { summary } = await getAnalysis(username, 30);
    const s = summary.avgScore;
    const color = s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626';
    res.send(badge('repo health', s === null ? 'n/a' : `${s}% ${summary.grade}`, s === null ? '#9ca3af' : color));
  } catch {
    res.send(badge('repo health', 'n/a', '#9ca3af'));
  }
});

// serve the built client in production
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`RepoInsight server running on http://localhost:${PORT}`));
