import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line,
} from 'recharts';
import { downloadCSV, downloadJSON, downloadMarkdown, downloadHTML, badgeMarkdown } from './report.js';
import { COLORS, LABELS, TIPS, scoreColor, fmtDate } from './lib.js';

const CHECK_COLUMNS = ['readme', 'description', 'license', 'tests', 'ci'];

export function Badge({ state }) {
  const map = { ok: ['✔', 'ok'], weak: ['~', 'weak'], missing: ['✘', 'bad'], stale: ['✘', 'bad'], unknown: ['?', 'unk'] };
  const [sym, cls] = map[state] || map.unknown;
  return <span className={`badge ${cls}`} title={state}>{sym}</span>;
}

export function Card({ label, value, hint, color }) {
  return (
    <div className="card stat">
      <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function coverageData(coverage) {
  return Object.keys(LABELS).map((k) => ({ key: k, label: LABELS[k], value: coverage[k] ?? 0 }));
}

export default function Analysis({ data }) {
  const [sort, setSort] = useState({ key: 'stars', dir: 'desc' });
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [hideForks, setHideForks] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => {
    let list = data.repos.filter((r) => (hideForks ? !r.fork : true));
    if (onlyIssues) list = list.filter((r) => r.issues.length > 0);
    if (query.trim()) list = list.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()));
    const { key, dir } = sort;
    const val = (r) => (key === 'name' ? r.name.toLowerCase() : r[key] ?? -1);
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (dir === 'asc' ? 1 : -1));
  }, [data, sort, onlyIssues, hideForks, query]);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  const arrow = (key) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');

  async function copyBadge() {
    try {
      await navigator.clipboard.writeText(badgeMarkdown(data.user.login));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  }

  const s = data.summary;
  const langs = data.languages.slice(0, 10);
  const history = data.history || [];

  return (
    <>
      <section className="card profile">
        <img src={data.user.avatar} alt="" width="72" height="72" />
        <div className="profile-info">
          <h2>
            <a href={data.user.url} target="_blank" rel="noreferrer">{data.user.name || data.user.login}</a>
            <small dir="ltr"> @{data.user.login}</small>
          </h2>
          {data.user.bio && <p>{data.user.bio}</p>}
          <p className="muted small">
            {data.user.followers.toLocaleString()} followers
            {data.meta.rateRemaining != null && ` · GitHub API requests remaining: ${data.meta.rateRemaining}/${data.meta.rateLimit}`}
            {data.cached && ' · Cached result'}
          </p>
        </div>
        <div className="downloads">
          <button onClick={() => downloadMarkdown(data)}>⬇ Markdown</button>
          <button onClick={() => downloadHTML(data)}>⬇ HTML</button>
          <button onClick={() => downloadCSV(data)}>⬇ CSV</button>
          <button onClick={() => downloadJSON(data)}>⬇ JSON</button>
          <button className="ghost" onClick={copyBadge} title="Copy an SVG badge for your README">{copied ? '✔ Copied' : '🏷 Copy README badge'}</button>
        </div>
      </section>

      <section className="grid stats">
        <Card label="Public repositories" value={s.totalRepos} hint={`${s.forkedRepos} forks`} />
        <Card label="Total stars" value={s.totalStars.toLocaleString()} />
        <Card label="Total forks" value={s.totalForks.toLocaleString()} />
        <Card label="Languages" value={s.languagesCount} />
        <Card label="Average completeness" value={s.avgScore !== null ? `${s.avgScore}%` : '-'} hint={`Across ${s.scannedRepos} scanned repositories`} color={s.avgScore !== null ? scoreColor(s.avgScore) : undefined} />
        <Card label="Overall grade" value={s.grade || '-'} color={s.avgScore !== null ? scoreColor(s.avgScore) : undefined} />
        <Card label="Inactive projects" value={s.staleCount} hint={`Older than ${data.meta.staleDays} days`} />
      </section>

      <div className="notice score-note">
        The completeness score is an indicative signal based on verifiable public files and metadata—not a judgment of code quality or project suitability. Unknown checks are not counted as missing, and some project types may not need every criterion.
      </div>

      {s.partialTreeRepos > 0 && (
        <div className="notice">
          GitHub truncated the file tree for {s.partialTreeRepos} repositories. Checks that could not be verified are marked as unknown instead of missing.
        </div>
      )}

      {s.limited && (
        <div className="notice">To conserve GitHub API requests, only the {s.scannedRepos} most recently updated repositories were scanned. You can increase the scan limit above.</div>
      )}

      <section className="card">
        <h3>Score history · Last 90 days</h3>
        {history.length ? (
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="analyzedAt" tickFormatter={(value) => value.slice(0, 10)} />
                <YAxis domain={[0, 100]} />
                <Tooltip labelFormatter={(value) => new Date(value).toLocaleString('en-US')} formatter={(value) => [`${value}/100`, 'Score']} />
                <Line type="monotone" dataKey="avgScore" name="Score" stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="muted">Your score trend will appear after new analyses. One snapshot is saved for each uncached analysis.</p>}
        <p className="muted small">This server-wide history stores only the average score and repository counts—not repository details—for 90 days.</p>
      </section>

      <section className="grid charts">
        <div className="card">
          <h3>Repositories by language</h3>
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={langs} dataKey="count" nameKey="name" outerRadius={95} label={(d) => d.name}>
                  {langs.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} repositories`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Most-starred repositories</h3>
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
          ) : <p className="muted">No repositories have stars yet.</p>}
        </div>

        <div className="card">
          <h3>Repositories passing each quality check</h3>
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={coverageData(data.coverage)} outerRadius={90}>
                <PolarGrid />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" name="%" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
                <Tooltip formatter={(v) => [`${v}%`, 'Passing']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Completeness score distribution</h3>
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.scoreBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} repositories`, 'Count']} />
                <Bar dataKey="count" name="Count">
                  {data.scoreBuckets.map((_, i) => <Cell key={i} fill={['#dc2626', '#d97706', '#65a30d', '#16a34a'][i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Repositories created by year</h3>
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.createdByYear}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} repositories`, 'Count']} />
                <Bar dataKey="count" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Key improvement opportunities</h3>
          <ul className="gaps">
            <li><b>{s.missingReadme}</b> repositories without a README</li>
            <li><b>{s.missingDescription}</b> with a missing or unclear description</li>
            <li><b>{s.missingLicense}</b> without a license</li>
            <li><b>{s.missingTests}</b> without test files</li>
            <li><b>{s.missingCI}</b> without CI</li>
          </ul>
          {data.staleRepos.length > 0 && (
            <>
              <h4>Projects that have been inactive</h4>
              <ul className="stale">
                {data.staleRepos.slice(0, 6).map((r) => (
                  <li key={r.name}>
                    <a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
                    <span className="muted"> · {Math.round(r.idleDays / 30)} months</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {data.topTopics.length > 0 && (
            <>
              <h4>Most-used topics</h4>
              <div className="chips">{data.topTopics.map((t) => <span key={t.name} className="chip">{t.name} · {t.count}</span>)}</div>
            </>
          )}
        </div>
      </section>

      {data.recommendations.length > 0 && (
        <section className="card">
          <h3>🛠 What to improve first · Ranked by potential score gain</h3>
          <ol className="recs">
            {data.recommendations.map((r) => (
              <li key={r.key}>
                <div><b>{LABELS[r.key]}</b> — {r.count} repositories <span className="gain">+{r.gain} points</span></div>
                <div className="muted small">{TIPS[r.key]}</div>
                <div className="chips">
                  {r.repos.map((n) => <span key={n} className="chip" dir="ltr">{n}</span>)}
                  {r.count > r.repos.length && <span className="chip">+{r.count - r.repos.length}</span>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card">
        <div className="table-head">
          <h3>Repository details ({rows.length})</h3>
          <input className="filter" dir="ltr" placeholder="Search repositories…" aria-label="Search repositories" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Show repositories with issues only</label>
          <label><input type="checkbox" checked={hideForks} onChange={(e) => setHideForks(e.target.checked)} /> Hide forks</label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')}>Repository{arrow('name')}</th>
                <th>Language</th>
                <th onClick={() => toggleSort('stars')}>⭐{arrow('stars')}</th>
                <th onClick={() => toggleSort('forks')}>Forks{arrow('forks')}</th>
                {CHECK_COLUMNS.map((k) => <th key={k}>{LABELS[k]}</th>)}
                <th onClick={() => toggleSort('score')}>Score{arrow('score')}</th>
                <th onClick={() => toggleSort('pushedAt')}>Last updated{arrow('pushedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.name}>
                  <tr className={r.fork ? 'fork' : ''} onClick={() => r.checks && setOpen(open === r.name ? null : r.name)}>
                    <td>
                      <a href={r.url} target="_blank" rel="noreferrer" dir="ltr" onClick={(e) => e.stopPropagation()}>{r.name}</a>
                      {r.fork && <span className="tag">Fork</span>}
                      {r.archived && <span className="tag">Archived</span>}
                      {r.issues.length > 0 && <div className="muted small">Needs: {r.issues.map((k) => LABELS[k]).join(', ')}</div>}
                    </td>
                    <td>{r.language || '-'}</td>
                    <td>{r.stars}</td>
                    <td>{r.forks}</td>
                    {CHECK_COLUMNS.map((k) => (
                      <td key={k}>{r.checks ? <Badge state={r.checks[k]} /> : <span className="muted">—</span>}</td>
                    ))}
                    <td>
                      {r.score !== null ? (
                        <div className="score">
                          <div className="bar"><div style={{ width: `${r.score}%`, background: scoreColor(r.score) }} /></div>
                          <span style={{ color: scoreColor(r.score) }}>{r.score} · {r.grade}</span>
                        </div>
                      ) : <span className="muted">Not scanned</span>}
                    </td>
                    <td className={r.idleDays > data.meta.staleDays && !r.archived ? 'stale-cell' : ''}>{fmtDate(r.pushedAt)}</td>
                  </tr>
                  {open === r.name && r.checks && (
                    <tr className="detail">
                      <td colSpan={5 + CHECK_COLUMNS.length + 1}>
                        <div className="detail-grid">
                          {Object.keys(LABELS).map((k) => (
                            <div key={k}><Badge state={r.checks[k]} /> {LABELS[k]} <span className="muted small">({r.checks[k] === 'unknown' ? 'not scored' : `${r.points[k]}/${data.meta.weights[k]}`})</span></div>
                          ))}
                        </div>
                        <p className="muted small">The score uses {r.scoreCoverage}% of the criteria weights that could be verified.</p>
                        {r.issues.length > 0 && <ul className="small">{r.issues.map((k) => <li key={k}>{TIPS[k]}</li>)}</ul>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Select a row to see score details and improvement tips.</p>
      </section>

      <footer className="muted small">
        Score out of 100: {Object.entries(data.meta.weights).map(([k, v]) => `${LABELS[k]} ${v}`).join(' · ')}. Forks are not scored, and archived repositories are not penalized for inactivity.
      </footer>
    </>
  );
}
