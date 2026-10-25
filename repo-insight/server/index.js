import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyzeUser } from './analyzer.js';
import { GitHubError } from './github.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());

const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const cache = new Map(); // key -> { at, data }
const TTL = 10 * 60 * 1000;

app.get('/api/health', (_req, res) => res.json({ ok: true, token: Boolean(process.env.GITHUB_TOKEN) }));

app.get('/api/analyze/:username', async (req, res) => {
  const { username } = req.params;
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'اسم مستخدم GitHub غير صالح.' });
  }
  const max = Math.min(Math.max(parseInt(req.query.max, 10) || 30, 5), 60);
  const key = `${username.toLowerCase()}:${max}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return res.json({ ...hit.data, cached: true });

  try {
    const data = await analyzeUser(username, { max });
    cache.set(key, { at: Date.now(), data });
    res.json(data);
  } catch (err) {
    if (err instanceof GitHubError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ غير متوقع أثناء التحليل.' });
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
