import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { downloadCSV, downloadJSON, downloadMarkdown, issueLabel } from './report.js';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16', '#14b8a6', '#f97316'];
const scoreColor = (s) => (s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626');
const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '-');

const CHECK_COLUMNS = [
  ['readme', 'README'],
  ['description', 'وصف'],
  ['license', 'LICENSE'],
  ['tests', 'اختبارات'],
];

function Badge({ state }) {
  const map = {
    ok: ['✔', 'ok'],
    weak: ['~', 'weak'],
    missing: ['✘', 'bad'],
    stale: ['✘', 'bad'],
    unknown: ['?', 'unk'],
  };
  const [sym, cls] = map[state] || map.unknown;
  return <span className={`badge ${cls}`}>{sym}</span>;
}

function Card({ label, value, hint }) {
  return (
    <div className="card stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState('');
  const [max, setMax] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [sort, setSort] = useState({ key: 'stars', dir: 'desc' });
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [hideForks, setHideForks] = useState(false);

  async function analyze(e) {
    e?.preventDefault();
    const name = username.trim().replace(/^@/, '');
    if (!name) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/analyze/${encodeURIComponent(name)}?max=${max}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'فشل التحليل');
      setData(json);
    } catch (err) {
      setData(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (!data) return [];
    let list = data.repos.filter((r) => (hideForks ? !r.fork : true));
    if (onlyIssues) list = list.filter((r) => r.issues.length > 0);
    const { key, dir } = sort;
    const val = (r) => (key === 'name' ? r.name.toLowerCase() : r[key] ?? -1);
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (dir === 'asc' ? 1 : -1));
  }, [data, sort, onlyIssues, hideForks]);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  const arrow = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div className="app">
      <header className="hero">
        <h1>🔎 RepoInsight</h1>
        <p>أدخل اسم مستخدم GitHub وسنحلل مستودعاته العامة ونقيّم جودتها.</p>
        <form onSubmit={analyze} className="search">
          <input
            dir="ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="مثال: torvalds"
            aria-label="اسم مستخدم GitHub"
            autoFocus
          />
          <select value={max} onChange={(e) => setMax(Number(e.target.value))} title="عدد المستودعات التي يُفحص محتواها">
            <option value={15}>فحص 15 مستودعًا</option>
            <option value={30}>فحص 30 مستودعًا</option>
            <option value={60}>فحص 60 مستودعًا</option>
          </select>
          <button disabled={loading || !username.trim()}>{loading ? 'جارٍ التحليل…' : 'حلّل'}</button>
        </form>
        {error && <div className="error">⚠ {error}</div>}
      </header>

      {loading && <div className="loading">يتم جلب المستودعات وفحص ملفاتها، قد يستغرق ذلك بضع ثوانٍ…</div>}

      {data && !loading && (
        <main>
          <section className="card profile">
            <img src={data.user.avatar} alt="" width="72" height="72" />
            <div className="profile-info">
              <h2>
                <a href={data.user.url} target="_blank" rel="noreferrer">{data.user.name || data.user.login}</a>
                <small dir="ltr"> @{data.user.login}</small>
              </h2>
              {data.user.bio && <p>{data.user.bio}</p>}
              <p className="muted">المتابعون: {data.user.followers}</p>
            </div>
            <div className="downloads">
              <button onClick={() => downloadMarkdown(data)}>⬇ تقرير Markdown</button>
              <button onClick={() => downloadCSV(data)}>⬇ CSV</button>
              <button onClick={() => downloadJSON(data)}>⬇ JSON</button>
            </div>
          </section>

          <section className="grid stats">
            <Card label="المستودعات العامة" value={data.summary.totalRepos} hint={`${data.summary.forkedRepos} منها Fork`} />
            <Card label="إجمالي Stars" value={data.summary.totalStars} />
            <Card label="إجمالي Forks" value={data.summary.totalForks} />
            <Card label="عدد اللغات" value={data.summary.languagesCount} />
            <Card label="متوسط الاكتمال" value={data.summary.avgScore !== null ? `${data.summary.avgScore}%` : '-'} hint={`على ${data.summary.scannedRepos} مستودعًا`} />
            <Card label="مشاريع متوقفة" value={data.summary.staleCount} hint={`أكثر من ${data.meta.staleDays} يومًا`} />
          </section>

          {data.summary.limited && (
            <div className="notice">
              تم فحص محتوى أحدث {data.summary.scannedRepos} مستودعًا فقط لتوفير طلبات GitHub. زد العدد من القائمة أعلاه إن أردت.
            </div>
          )}

          <section className="grid charts">
            <div className="card">
              <h3>توزيع المشاريع حسب اللغة</h3>
              <div className="chart" dir="ltr">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.languages.slice(0, 10)} dataKey="count" nameKey="name" outerRadius={95} label={(d) => d.name}>
                      {data.languages.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} مستودع`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3>الأكثر حصولًا على Stars</h3>
              {data.topStarred.length ? (
                <div className="chart" dir="ltr">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.topStarred} layout="vertical" margin={{ left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="stars" name="Stars" fill="#f59e0b" />
                      <Bar dataKey="forks" name="Forks" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="muted">لا توجد مستودعات حاصلة على Stars بعد.</p>}
            </div>

            <div className="card">
              <h3>توزيع درجات الاكتمال</h3>
              <div className="chart" dir="ltr">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.scoreBuckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(v) => [`${v} مستودع`, 'العدد']} />
                    <Bar dataKey="count" name="العدد">
                      {data.scoreBuckets.map((_, i) => <Cell key={i} fill={['#dc2626', '#d97706', '#65a30d', '#16a34a'][i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3>أبرز النواقص</h3>
              <ul className="gaps">
                <li><b>{data.summary.missingReadme}</b> مستودع بدون README</li>
                <li><b>{data.summary.missingDescription}</b> بوصف ناقص أو غير واضح</li>
                <li><b>{data.summary.missingLicense}</b> بدون LICENSE</li>
                <li><b>{data.summary.missingTests}</b> بدون ملفات اختبار</li>
              </ul>
              {data.staleRepos.length > 0 && (
                <>
                  <h4>مشاريع لم تُحدَّث منذ فترة</h4>
                  <ul className="stale">
                    {data.staleRepos.slice(0, 6).map((r) => (
                      <li key={r.name}>
                        <a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
                        <span className="muted"> — {Math.round(r.idleDays / 30)} شهرًا</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>

          <section className="card">
            <div className="table-head">
              <h3>إحصائيات كل مستودع ({rows.length})</h3>
              <label><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> المستودعات ذات النواقص فقط</label>
              <label><input type="checkbox" checked={hideForks} onChange={(e) => setHideForks(e.target.checked)} /> إخفاء الـ Forks</label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('name')}>المستودع{arrow('name')}</th>
                    <th>اللغة</th>
                    <th onClick={() => toggleSort('stars')}>⭐{arrow('stars')}</th>
                    <th onClick={() => toggleSort('forks')}>Forks{arrow('forks')}</th>
                    {CHECK_COLUMNS.map(([, label]) => <th key={label}>{label}</th>)}
                    <th onClick={() => toggleSort('score')}>الدرجة{arrow('score')}</th>
                    <th onClick={() => toggleSort('idleDays')}>آخر تحديث{arrow('idleDays')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className={r.fork ? 'fork' : ''}>
                      <td>
                        <a href={r.url} target="_blank" rel="noreferrer" dir="ltr">{r.name}</a>
                        {r.fork && <span className="tag">Fork</span>}
                        {r.archived && <span className="tag">أرشيف</span>}
                        {r.issues.length > 0 && <div className="muted small">ينقصه: {r.issues.map(issueLabel).join('، ')}</div>}
                      </td>
                      <td>{r.language || '-'}</td>
                      <td>{r.stars}</td>
                      <td>{r.forks}</td>
                      {CHECK_COLUMNS.map(([k]) => (
                        <td key={k}>{r.checks ? <Badge state={r.checks[k]} /> : <span className="muted">—</span>}</td>
                      ))}
                      <td>
                        {r.score !== null ? (
                          <div className="score">
                            <div className="bar"><div style={{ width: `${r.score}%`, background: scoreColor(r.score) }} /></div>
                            <span style={{ color: scoreColor(r.score) }}>{r.score}</span>
                          </div>
                        ) : <span className="muted">لم يُفحص</span>}
                      </td>
                      <td className={r.idleDays > data.meta.staleDays ? 'stale-cell' : ''}>{fmtDate(r.pushedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="muted small">
            الدرجة من 100: README 25 · Tests 20 · الوصف 15 · LICENSE 15 · النشاط 15 · Topics 10. الـ Forks لا تُقيَّم لأنها ليست من عملك.
          </footer>
        </main>
      )}
    </div>
  );
}
