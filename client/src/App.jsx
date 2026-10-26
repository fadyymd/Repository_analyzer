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
        <a className="brand" href="/" aria-label="RepoInsight home">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>Repo<span className="brand-accent">Insight</span></span>
        </a>
        <div className="topbar-right">
          <span className="topbar-note"><span className="live-dot" /> Public GitHub repository insights</span>
          <button className="theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> GITHUB REPOSITORY INTELLIGENCE</span>
          <h1>See your GitHub projects<br /><span>in a new light</span></h1>
          <p>Explore repository health, uncover improvement opportunities, and track account activity—all in one place.</p>
        </div>

        <div className="search-panel">
          <div className="search-panel-top">
            <div className="tabs" role="tablist" aria-label="Analysis mode">
              <button role="tab" aria-selected={tab === 'analyze'} className={tab === 'analyze' ? 'on' : ''} onClick={() => setTab('analyze')}>
                <span aria-hidden="true">⌕</span> Analyze account
              </button>
              <button role="tab" aria-selected={tab === 'compare'} className={tab === 'compare' ? 'on' : ''} onClick={() => setTab('compare')}>
                <span aria-hidden="true">⇄</span> Compare accounts
              </button>
            </div>
            <span className="secure-note"><span aria-hidden="true">◇</span> No sign-in required</span>
          </div>

          {tab === 'analyze' && (
            <>
              <form onSubmit={(e) => { e.preventDefault(); analyze(); }} className="search">
                <label className="search-input-wrap">
                  <span aria-hidden="true">⌕</span>
                  <input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. torvalds or github.com/torvalds" aria-label="GitHub username or profile URL" autoFocus />
                </label>
                <label className="select-wrap" aria-label="Number of repositories to inspect">
                  <span aria-hidden="true">▤</span>
                  <select value={max} onChange={(e) => setMax(Number(e.target.value))} title="Number of repositories to inspect">
                    <option value={15}>Inspect 15 repos</option>
                    <option value={30}>Inspect 30 repos</option>
                    <option value={60}>Inspect 60 repos</option>
                  </select>
                </label>
                <button className="primary-action" disabled={loading || !username.trim()}>
                  {loading ? <><span className="button-spinner" /> Analyzing…</> : <>Analyze account <span aria-hidden="true">→</span></>}
                </button>
              </form>
              <div className="search-hint">
                <span>Try an example:</span>
                <button type="button" className="example-link" dir="ltr" onClick={() => setUsername('torvalds')}>torvalds</button>
                <span className="hint-divider">·</span>
                <span>Enter a username or GitHub profile URL</span>
              </div>
              {recent.length > 0 && (
                <div className="chips recent-searches">
                  <span className="muted small">Recent searches</span>
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
          <div><strong>Analyzing your account</strong><p>We’re gathering repositories and checking their public files. This may take a few seconds.</p></div>
        </section>
      )}
      {tab === 'analyze' && data && !loading && <main className="content"><Analysis data={data} /></main>}
      {tab === 'analyze' && !data && !loading && !error && (
        <section className="welcome-card">
          <div className="welcome-icon" aria-hidden="true">⌁</div>
          <div>
            <span className="eyebrow">GET STARTED</span>
            <h2>Your next project insight is one search away</h2>
            <p>Enter a GitHub username to explore repository stats, quality signals, and actionable ways to improve.</p>
          </div>
          <div className="welcome-points">
            <span><b>01</b> Clear quality signals</span>
            <span><b>02</b> Activity and language insights</span>
            <span><b>03</b> Downloadable reports</span>
          </div>
        </section>
      )}
      <footer className="app-footer">
        <span className="footer-product">RepoInsight</span> <span>·</span> Built by Fadi Medkour
        <div className="footer-copyright">© 2026 Fadi Medkour. All rights reserved.</div>
      </footer>
    </div>
  );
}
