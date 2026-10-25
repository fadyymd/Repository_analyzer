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
            المتابعون: {data.user.followers}
            {data.meta.rateRemaining != null && ` · طلبات GitHub المتبقية: ${data.meta.rateRemaining}/${data.meta.rateLimit}`}
            {data.cached && ' · من الذاكرة المؤقتة'}
          </p>
        </div>
        <div className="downloads">
          <button onClick={() => downloadMarkdown(data)}>⬇ Markdown</button>
          <button onClick={() => downloadHTML(data)}>⬇ HTML</button>
          <button onClick={() => downloadCSV(data)}>⬇ CSV</button>
          <button onClick={() => downloadJSON(data)}>⬇ JSON</button>
          <button className="ghost" onClick={copyBadge} title="شارة SVG تُوضع في README الخاص بك">{copied ? '✔ تم النسخ' : '🏷 نسخ شارة README'}</button>
        </div>
      </section>

      <section className="grid stats">
        <Card label="المستودعات العامة" value={s.totalRepos} hint={`${s.forkedRepos} منها Fork`} />
        <Card label="إجمالي Stars" value={s.totalStars} />
        <Card label="إجمالي Forks" value={s.totalForks} />
        <Card label="عدد اللغات" value={s.languagesCount} />
        <Card label="متوسط الاكتمال" value={s.avgScore !== null ? `${s.avgScore}%` : '-'} hint={`على ${s.scannedRepos} مستودعًا`} color={s.avgScore !== null ? scoreColor(s.avgScore) : undefined} />
        <Card label="التقدير العام" value={s.grade || '-'} color={s.avgScore !== null ? scoreColor(s.avgScore) : undefined} />
        <Card label="مشاريع متوقفة" value={s.staleCount} hint={`أكثر من ${data.meta.staleDays} يومًا`} />
      </section>

      <div className="notice score-note">
        الدرجة مؤشر إرشادي مبني على وجود ملفات وعلامات عامة قابلة للتحقق، وليست حكمًا على جودة الكود أو ملاءمة المشروع. المعايير غير المعروفة لا تُحسب كنواقص، وقد لا تحتاج بعض أنواع المشاريع إلى كل المعايير.
      </div>

      {s.partialTreeRepos > 0 && (
        <div className="notice">
          تعذّر فحص شجرة الملفات كاملة في {s.partialTreeRepos} مستودعًا بسبب حد GitHub؛ عُرضت المعايير التي لم يمكن التحقق منها كـ «غير معروف» بدل اعتبارها مفقودة.
        </div>
      )}

      {s.limited && (
        <div className="notice">تم فحص محتوى أحدث {s.scannedRepos} مستودعًا فقط لتوفير طلبات GitHub. زد العدد من القائمة أعلاه إن أردت.</div>
      )}

      <section className="card">
        <h3>تاريخ تغيّر المؤشر خلال آخر 90 يومًا</h3>
        {history.length ? (
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="analyzedAt" tickFormatter={(value) => value.slice(0, 10)} />
                <YAxis domain={[0, 100]} />
                <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} formatter={(value) => [`${value}/100`, 'المؤشر']} />
                <Line type="monotone" dataKey="avgScore" name="المؤشر" stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="muted">سيظهر الاتجاه بعد إجراء تحليلات جديدة. تُحفظ لقطة واحدة عند كل تحليل غير مخزّن مؤقتًا.</p>}
        <p className="muted small">السجل مشترك على هذا الخادم، ويحتفظ بمتوسط الدرجة وعدد المستودعات فقط، دون حفظ تفاصيل المستودعات، لمدة 90 يومًا.</p>
      </section>

      <section className="grid charts">
        <div className="card">
          <h3>توزيع المشاريع حسب اللغة</h3>
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={langs} dataKey="count" nameKey="name" outerRadius={95} label={(d) => d.name}>
                  {langs.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
          <h3>نسبة المستودعات المستوفية لكل معيار</h3>
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={coverageData(data.coverage)} outerRadius={90}>
                <PolarGrid />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" name="%" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
                <Tooltip formatter={(v) => [`${v}%`, 'مستوفٍ']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
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
          <h3>المستودعات المنشأة كل سنة</h3>
          <div className="chart" dir="ltr">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.createdByYear}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} مستودع`, 'العدد']} />
                <Bar dataKey="count" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>أبرز النواقص</h3>
          <ul className="gaps">
            <li><b>{s.missingReadme}</b> مستودع بدون README</li>
            <li><b>{s.missingDescription}</b> بوصف ناقص أو غير واضح</li>
            <li><b>{s.missingLicense}</b> بدون LICENSE</li>
            <li><b>{s.missingTests}</b> بدون ملفات اختبار</li>
            <li><b>{s.missingCI}</b> بدون CI</li>
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
          {data.topTopics.length > 0 && (
            <>
              <h4>أكثر Topics استخدامًا</h4>
              <div className="chips">{data.topTopics.map((t) => <span key={t.name} className="chip">{t.name} · {t.count}</span>)}</div>
            </>
          )}
        </div>
      </section>

      {data.recommendations.length > 0 && (
        <section className="card">
          <h3>🛠 ما الذي تُصلحه أولًا؟ (مرتبة حسب النقاط التي ستكسبها)</h3>
          <ol className="recs">
            {data.recommendations.map((r) => (
              <li key={r.key}>
                <div><b>{LABELS[r.key]}</b> — {r.count} مستودع <span className="gain">+{r.gain} نقطة</span></div>
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
          <h3>إحصائيات كل مستودع ({rows.length})</h3>
          <input className="filter" dir="ltr" placeholder="بحث بالاسم…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> ذات النواقص فقط</label>
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
                {CHECK_COLUMNS.map((k) => <th key={k}>{LABELS[k]}</th>)}
                <th onClick={() => toggleSort('score')}>الدرجة{arrow('score')}</th>
                <th onClick={() => toggleSort('pushedAt')}>آخر تحديث{arrow('pushedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.name}>
                  <tr className={r.fork ? 'fork' : ''} onClick={() => r.checks && setOpen(open === r.name ? null : r.name)}>
                    <td>
                      <a href={r.url} target="_blank" rel="noreferrer" dir="ltr" onClick={(e) => e.stopPropagation()}>{r.name}</a>
                      {r.fork && <span className="tag">Fork</span>}
                      {r.archived && <span className="tag">أرشيف</span>}
                      {r.issues.length > 0 && <div className="muted small">ينقصه: {r.issues.map((k) => LABELS[k]).join('، ')}</div>}
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
                      ) : <span className="muted">لم يُفحص</span>}
                    </td>
                    <td className={r.idleDays > data.meta.staleDays && !r.archived ? 'stale-cell' : ''}>{fmtDate(r.pushedAt)}</td>
                  </tr>
                  {open === r.name && r.checks && (
                    <tr className="detail">
                      <td colSpan={5 + CHECK_COLUMNS.length + 1}>
                        <div className="detail-grid">
                          {Object.keys(LABELS).map((k) => (
                            <div key={k}><Badge state={r.checks[k]} /> {LABELS[k]} <span className="muted small">({r.checks[k] === 'unknown' ? 'غير محسوب' : `${r.points[k]}/${data.meta.weights[k]}`})</span></div>
                          ))}
                        </div>
                        <p className="muted small">احتُسبت الدرجة من {r.scoreCoverage}% من أوزان المعايير الممكن التحقق منها.</p>
                        {r.issues.length > 0 && <ul className="small">{r.issues.map((k) => <li key={k}>{TIPS[k]}</li>)}</ul>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">اضغط على أي صف لعرض تفصيل الدرجة ونصائح التحسين.</p>
      </section>

      <footer className="muted small">
        الدرجة من 100: {Object.entries(data.meta.weights).map(([k, v]) => `${LABELS[k]} ${v}`).join(' · ')}. الـ Forks لا تُقيَّم لأنها ليست من عملك، والمستودعات المؤرشفة لا تُعاقَب على قلة النشاط.
      </footer>
    </>
  );
}
