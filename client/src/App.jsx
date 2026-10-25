import React, { useEffect, useState } from 'react';
import Analysis from './Analysis.jsx';
import Compare from './Compare.jsx';
import { cleanName, fetchAnalysis, loadRecent, saveRecent } from './lib.js';

function initialTheme() {
  try {
    const saved = localStorage.getItem('repo-insight:theme');
    if (saved) return saved;
  } catch { /* storage blocked */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [tab, setTab] = useState('analyze');
  const [username, setUsername] = useState('');
  const [max, setMax] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState(loadRecent());
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('repo-insight:theme', theme); } catch { /* ignore */ }
  }, [theme]);

  async function analyze(raw, limit = max) {
    const name = cleanName(raw ?? username);
    if (!name) return;
    setUsername(name);
    setLoading(true);
    setError('');
    try {
      const json = await fetchAnalysis(name, limit);
      setData(json);
      setRecent(saveRecent(json.user.login));
      window.history.replaceState(null, '', `?user=${encodeURIComponent(json.user.login)}`);
    } catch (err) {
      setData(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // open /?user=name directly
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get('user');
    if (u) analyze(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <button className="theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="تبديل المظهر">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <header className="hero">
        <h1>🔎 RepoInsight</h1>
        <p>حلّل المستودعات العامة لأي حساب GitHub وقيّم جودتها.</p>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'analyze'} className={tab === 'analyze' ? 'on' : ''} onClick={() => setTab('analyze')}>تحليل حساب</button>
          <button role="tab" aria-selected={tab === 'compare'} className={tab === 'compare' ? 'on' : ''} onClick={() => setTab('compare')}>مقارنة حسابين</button>
        </div>

        {tab === 'analyze' && (
          <>
            <form onSubmit={(e) => { e.preventDefault(); analyze(); }} className="search">
              <input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="مثال: torvalds" aria-label="اسم مستخدم GitHub" autoFocus />
              <select value={max} onChange={(e) => setMax(Number(e.target.value))} title="عدد المستودعات التي يُفحص محتواها">
                <option value={15}>فحص 15 مستودعًا</option>
                <option value={30}>فحص 30 مستودعًا</option>
                <option value={60}>فحص 60 مستودعًا</option>
              </select>
              <button disabled={loading || !username.trim()}>{loading ? 'جارٍ التحليل…' : 'حلّل'}</button>
            </form>
            {recent.length > 0 && (
              <div className="chips center">
                <span className="muted small">آخر عمليات البحث:</span>
                {recent.map((n) => <button key={n} className="chip btn" dir="ltr" onClick={() => analyze(n)}>{n}</button>)}
              </div>
            )}
          </>
        )}
        {tab === 'analyze' && error && <div className="error">⚠ {error}</div>}
      </header>

      {tab === 'compare' && <Compare />}
      {tab === 'analyze' && loading && <div className="loading">يتم جلب المستودعات وفحص ملفاتها، قد يستغرق ذلك بضع ثوانٍ…</div>}
      {tab === 'analyze' && data && !loading && <main><Analysis data={data} /></main>}
    </div>
  );
}
