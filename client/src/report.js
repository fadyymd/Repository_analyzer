import { LABELS, fmtDate } from './lib.js';

export const issueLabel = (k) => LABELS[k] || k;

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadJSON(data) {
  download(`${data.user.login}-repo-report.json`, JSON.stringify(data, null, 2), 'application/json');
}

export function downloadCSV(data) {
  const head = ['name', 'language', 'stars', 'forks', 'score', 'grade', ...Object.keys(LABELS), 'last_push', 'idle_days', 'url'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = data.repos.map((r) =>
    [
      r.name, r.language || '', r.stars, r.forks, r.score ?? '', r.grade ?? '',
      ...Object.keys(LABELS).map((k) => r.checks?.[k] ?? ''),
      fmtDate(r.pushedAt), r.idleDays ?? '', r.url,
    ].map(esc).join(',')
  );
  // BOM so Excel opens UTF-8 correctly
  download(`${data.user.login}-repos.csv`, '\uFEFF' + [head.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
}

export function buildMarkdown(data) {
  const { user, summary: s, languages, topStarred, staleRepos, repos, recommendations } = data;
  const scored = repos.filter((r) => r.score !== null).sort((a, b) => a.score - b.score);
  const L = [];

  L.push(`# GitHub Repository Report: ${user.name || user.login} (@${user.login})`);
  L.push('', `Report date: ${fmtDate(data.meta.generatedAt)}  `, `Account: ${user.url}`, '');

  L.push('## Overview', '');
  L.push(`- Public repositories: **${s.totalRepos}** (${s.forkedRepos} forks)`);
  L.push(`- Total stars: **${s.totalStars}** | Total forks: **${s.totalForks}**`);
  L.push(`- Languages used: **${s.languagesCount}**`);
  L.push(`- Repositories deeply scanned: **${s.scannedRepos}**`);
  L.push(`- Average completeness: **${s.avgScore ?? '-'} / 100** (grade ${s.grade ?? '-'})`);
  L.push('', '> This indicative score uses verifiable criteria only. It does not measure code quality, and unknown checks are not counted as missing.', '');
  L.push(`- Repositories inactive for more than ${data.meta.staleDays} days: **${s.staleCount}**`, '');

  L.push('## Language distribution', '', '| Language | Repositories | Share |', '|---|---:|---:|');
  languages.forEach((l) => L.push(`| ${l.name} | ${l.count} | ${l.percent}% |`));
  L.push('');

  if (topStarred.length) {
    L.push('## Most-starred repositories', '', '| Repository | Stars | Forks |', '|---|---:|---:|');
    topStarred.forEach((r) => L.push(`| [${r.name}](${r.url}) | ${r.stars} | ${r.forks} |`));
    L.push('');
  }

  L.push('## Repositories passing each quality check', '', '| Criterion | Pass rate |', '|---|---:|');
  Object.entries(data.coverage).forEach(([k, v]) => L.push(`| ${issueLabel(k)} | ${v}% |`));
  L.push('');

  if (recommendations.length) {
    L.push('## Recommended improvements', '');
    recommendations.forEach((r, i) =>
      L.push(`${i + 1}. **${issueLabel(r.key)}** — ${r.count} repositories (+${r.gain} potential points): ${r.repos.join(', ')}`)
    );
    L.push('');
  }

  L.push('## Repository completeness scores', '', '| Repository | Score | Grade | Issues |', '|---|---:|---|---|');
  scored.forEach((r) =>
    L.push(`| [${r.name}](${r.url}) | ${r.score} | ${r.grade} | ${r.issues.length ? r.issues.map(issueLabel).join(', ') : '✔ Complete'} |`)
  );
  L.push('');

  if (staleRepos.length) {
    L.push('## Inactive repositories', '', '| Repository | Last updated | Days inactive |', '|---|---|---:|');
    staleRepos.forEach((r) => L.push(`| [${r.name}](${r.url}) | ${fmtDate(r.pushedAt)} | ${r.idleDays} |`));
    L.push('');
  }

  L.push('## Scoring criteria (out of 100)', '');
  Object.entries(data.meta.weights).forEach(([k, v]) => L.push(`- ${issueLabel(k)}: ${v} points`));
  L.push('', '---', '', 'Built by Fadi Medkour  ', '© 2026 Fadi Medkour. All rights reserved.');
  return L.join('\n');
}

export function downloadMarkdown(data) {
  download(`${data.user.login}-repo-report.md`, buildMarkdown(data), 'text/markdown;charset=utf-8');
}

/** Standalone, print-friendly HTML report */
export function downloadHTML(data) {
  const e = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const { user, summary: s } = data;
  const scored = data.repos.filter((r) => r.score !== null).sort((a, b) => a.score - b.score);
  const col = (n) => (n >= 80 ? '#16a34a' : n >= 50 ? '#d97706' : '#dc2626');
  const html = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(user.login)} · Repository report</title>
<style>body{font-family:Inter,Segoe UI,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#1e1b3a}
table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:start}
.k{display:flex;gap:12px;flex-wrap:wrap}.k div{flex:1;min-width:130px;background:#f4f5fb;border-radius:10px;padding:10px;text-align:center}
.k b{display:block;font-size:1.5rem;color:#6366f1}.report-footer{margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.8rem}@media print{body{margin:0}}</style></head><body>
<h1>GitHub Repository Report: ${e(user.name || user.login)} (@${e(user.login)})</h1><p>${fmtDate(data.meta.generatedAt)}</p>
<p style="color:#6b7280">The completeness score is an indicative signal based on verifiable criteria only. It does not measure code quality, and unknown checks are not counted as missing.</p>
<div class="k"><div><b>${s.totalRepos}</b>Repositories</div><div><b>${s.totalStars}</b>Stars</div><div><b>${s.totalForks}</b>Forks</div>
<div><b>${s.languagesCount}</b>Languages</div><div><b>${s.avgScore ?? '-'}</b>Average completeness (${s.grade ?? '-'})</div><div><b>${s.staleCount}</b>Inactive</div></div>
<h2>Languages</h2><table>${data.languages.map((l) => `<tr><td>${e(l.name)}</td><td>${l.count}</td><td>${l.percent}%</td></tr>`).join('')}</table>
<h2>Recommended improvements</h2><ol>${data.recommendations.map((r) => `<li><b>${e(issueLabel(r.key))}</b> — ${r.count} repositories (+${r.gain} potential points): ${e(r.repos.join(', '))}</li>`).join('')}</ol>
<h2>Repository scores</h2><table><tr><th>Repository</th><th>Score</th><th>Grade</th><th>Issues</th></tr>
${scored.map((r) => `<tr><td><a href="${e(r.url)}">${e(r.name)}</a></td><td style="color:${col(r.score)};font-weight:700">${r.score}</td><td>${r.grade}</td><td>${e(r.issues.map(issueLabel).join(', ') || '✔ Complete')}</td></tr>`).join('')}</table>
<p style="color:#6b7280;font-size:.85rem">To save as PDF, press Ctrl+P and choose “Save as PDF”.</p>
<footer class="report-footer">Built by Fadi Medkour · © 2026 Fadi Medkour. All rights reserved.</footer></body></html>`;
  download(`${data.user.login}-repo-report.html`, html, 'text/html;charset=utf-8');
}

export const badgeMarkdown = (login) =>
  `![repo health](${window.location.origin}/api/badge/${login}.svg)`;
