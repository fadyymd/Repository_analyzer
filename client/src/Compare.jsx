import React, { useState } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts';
import { LABELS, cleanName, fetchAnalysis, scoreColor } from './lib.js';

const METRICS = [
  ['Repositories', (s) => s.totalRepos, true],
  ['Stars', (s) => s.totalStars, true],
  ['Forks', (s) => s.totalForks, true],
  ['Languages', (s) => s.languagesCount, true],
  ['Average completeness', (s) => s.avgScore ?? -1, true, (v) => (v < 0 ? '-' : `${v}%`)],
  ['Inactive projects', (s) => s.staleCount, false],
  ['Missing README', (s) => s.missingReadme, false],
  ['Missing tests', (s) => s.missingTests, false],
];

export default function Compare() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState(null);

  async function run(e) {
    e.preventDefault();
    const na = cleanName(a), nb = cleanName(b);
    if (!na || !nb) return;
    setLoading(true); setError('');
    try {
      const [x, y] = await Promise.all([fetchAnalysis(na, 20), fetchAnalysis(nb, 20)]);
      setRes([x, y]);
    } catch (err) { setRes(null); setError(err.message); } finally { setLoading(false); }
  }

  const radar = res && Object.keys(LABELS).map((k) => ({ label: LABELS[k], [res[0].user.login]: res[0].coverage[k], [res[1].user.login]: res[1].coverage[k] }));

  return (
    <section className="comparison">
      <div className="comparison-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow-line" /> ACCOUNT COMPARISON</span>
          <h2>How do these accounts compare?</h2>
          <p>Compare repository health, activity, and completeness side by side.</p>
        </div>
      </div>
      <form onSubmit={run} className="search comparison-search">
        <input dir="ltr" value={a} onChange={(e) => setA(e.target.value)} placeholder="First GitHub username" aria-label="First GitHub username" />
        <span className="vs">VS</span>
        <input dir="ltr" value={b} onChange={(e) => setB(e.target.value)} placeholder="Second GitHub username" aria-label="Second GitHub username" />
        <button disabled={loading || !a.trim() || !b.trim()}>{loading ? 'Comparing…' : 'Compare'}</button>
      </form>
      {error && <div className="error" role="alert">⚠ {error}</div>}
      {loading && <div className="loading" role="status" aria-live="polite">Analyzing both accounts…</div>}

      {res && !loading && (
        <>
          <div className="notice score-note">
            Completeness scores are indicative and use verifiable criteria only. Unknown checks are not counted as missing, and scores do not judge code quality or whether every criterion suits a project.
          </div>
          <section className="card">
            <table className="cmp">
              <thead>
                <tr>
                  <th></th>
                  {res.map((r) => (
                    <th key={r.user.login}><img src={r.user.avatar} alt="" width="40" height="40" /><div dir="ltr">@{r.user.login}</div></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map(([label, get, higherBetter, fmt]) => {
                  const [x, y] = res.map((r) => get(r.summary));
                  const win = x === y ? -1 : (x > y) === higherBetter ? 0 : 1;
                  return (
                    <tr key={label}>
                      <td className="muted">{label}</td>
                      {[x, y].map((v, i) => (
                        <td key={i} className={win === i ? 'win' : ''}>{fmt ? fmt(v) : v}{win === i && ' 🏆'}</td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <td className="muted">Grade</td>
                  {res.map((r) => <td key={r.user.login} style={{ color: scoreColor(r.summary.avgScore ?? 0), fontWeight: 700 }}>{r.summary.grade || '-'}</td>)}
                </tr>
              </tbody>
            </table>
          </section>
          <section className="card">
            <h3>Repository quality comparison</h3>
            <div className="chart" dir="ltr">
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radar} outerRadius={110}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey={res[0].user.login} stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                  <Radar dataKey={res[1].user.login} stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                  <Legend />
                  <Tooltip formatter={(v) => `${v}%`} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
