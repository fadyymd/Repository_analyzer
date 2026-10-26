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
      <header className="topbar">
        <a className="brand" href="/" aria-label="RepoInsight، الصفحة الرئيسية">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>Repo<span className="brand-accent">Insight</span></span>
        </a>
        <div className="topbar-right">
          <span className="topbar-note"><span className="live-dot" /> تحليل مستودعات GitHub العامة</span>
          <button className="theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن'} title={theme === 'dark' ? 'المظهر الفاتح' : 'المظهر الداكن'}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> GITHUB REPOSITORY INTELLIGENCE</span>
          <h1>رؤية أوضح لمشاريعك<br /><span>على GitHub</span></h1>
          <p>حلّل جودة المستودعات، اكتشف فرص التحسين، وتابع نشاط الحساب في مكان واحد.</p>
        </div>

        <div className="search-panel">
          <div className="search-panel-top">
            <div className="tabs" role="tablist" aria-label="نوع التحليل">
              <button role="tab" aria-selected={tab === 'analyze'} className={tab === 'analyze' ? 'on' : ''} onClick={() => setTab('analyze')}>
                <span aria-hidden="true">⌕</span> تحليل حساب
              </button>
              <button role="tab" aria-selected={tab === 'compare'} className={tab === 'compare' ? 'on' : ''} onClick={() => setTab('compare')}>
                <span aria-hidden="true">⇄</span> مقارنة حسابين
              </button>
            </div>
            <span className="secure-note"><span aria-hidden="true">◇</span> لا حاجة لتسجيل الدخول</span>
          </div>

          {tab === 'analyze' && (
            <>
              <form onSubmit={(e) => { e.preventDefault(); analyze(); }} className="search">
                <label className="search-input-wrap">
                  <span aria-hidden="true">⌕</span>
                  <input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="مثال: torvalds أو github.com/torvalds" aria-label="اسم مستخدم GitHub" autoFocus />
                </label>
                <label className="select-wrap" aria-label="عدد المستودعات التي يفحص محتواها">
                  <span aria-hidden="true">▤</span>
                  <select value={max} onChange={(e) => setMax(Number(e.target.value))} title="عدد المستودعات التي يُفحص محتواها">
                    <option value={15}>15 مستودعًا</option>
                    <option value={30}>30 مستودعًا</option>
                    <option value={60}>60 مستودعًا</option>
                  </select>
                </label>
                <button className="primary-action" disabled={loading || !username.trim()}>
                  {loading ? <><span className="button-spinner" /> جارٍ التحليل…</> : <>ابدأ التحليل <span aria-hidden="true">←</span></>}
                </button>
              </form>
              <div className="search-hint">
                <span>مثال سريع:</span>
                <button type="button" className="example-link" dir="ltr" onClick={() => setUsername('torvalds')}>torvalds</button>
                <span className="hint-divider">·</span>
                <span>أدخل اسم المستخدم أو رابط حساب GitHub</span>
              </div>
              {recent.length > 0 && (
                <div className="chips recent-searches">
                  <span className="muted small">عمليات حديثة</span>
                  {recent.map((n) => <button key={n} className="chip btn" dir="ltr" onClick={() => analyze(n)}>{n}</button>)}
                </div>
              )}
            </>
          )}
          {tab === 'analyze' && error && <div className="error" role="alert"><span aria-hidden="true">!</span> {error}</div>}
        </div>
      </section>

      {tab === 'compare' && <main className="content"><Compare /></main>}
      {tab === 'analyze' && loading && (
        <section className="loading-state" role="status" aria-live="polite">
          <span className="loader-ring" aria-hidden="true" />
          <div><strong>نحلّل الحساب الآن</strong><p>نجمع المستودعات ونفحص ملفاتها العامة. قد يستغرق ذلك بضع ثوانٍ.</p></div>
        </section>
      )}
      {tab === 'analyze' && data && !loading && <main className="content"><Analysis data={data} /></main>}
      {tab === 'analyze' && !data && !loading && !error && (
        <section className="welcome-card">
          <div className="welcome-icon" aria-hidden="true">⌁</div>
          <div>
            <span className="eyebrow">ابدأ من هنا</span>
            <h2>ملفك التالي يستحق نظرة أعمق</h2>
            <p>اكتب اسم مستخدم GitHub لاكتشاف إحصائيات المشاريع، مؤشرات الاكتمال، وأهم فرص التحسين.</p>
          </div>
          <div className="welcome-points">
            <span><b>01</b> مؤشرات جودة واضحة</span>
            <span><b>02</b> تحليل النشاط واللغات</span>
            <span><b>03</b> تقارير قابلة للتنزيل</span>
          </div>
        </section>
      )}
      <footer className="app-footer">RepoInsight <span>·</span> رؤى عملية لمشاريع مفتوحة المصدر</footer>
    </div>
  );
}
