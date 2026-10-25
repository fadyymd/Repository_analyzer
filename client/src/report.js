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

  L.push(`# تقرير مستودعات GitHub: ${user.name || user.login} (@${user.login})`);
  L.push('', `تاريخ التقرير: ${fmtDate(data.meta.generatedAt)}  `, `الحساب: ${user.url}`, '');

  L.push('## ملخص عام', '');
  L.push(`- عدد المستودعات العامة: **${s.totalRepos}** (منها ${s.forkedRepos} Fork)`);
  L.push(`- إجمالي Stars: **${s.totalStars}** | إجمالي Forks: **${s.totalForks}**`);
  L.push(`- عدد اللغات المستخدمة: **${s.languagesCount}**`);
  L.push(`- المستودعات التي تم فحصها بعمق: **${s.scannedRepos}**`);
  L.push(`- متوسط درجة الاكتمال: **${s.avgScore ?? '-'} / 100** (التقدير ${s.grade ?? '-'})`);
  L.push(`- مستودعات لم تُحدَّث منذ أكثر من ${data.meta.staleDays} يومًا: **${s.staleCount}**`, '');

  L.push('## توزيع اللغات', '', '| اللغة | عدد المستودعات | النسبة |', '|---|---|---|');
  languages.forEach((l) => L.push(`| ${l.name} | ${l.count} | ${l.percent}% |`));
  L.push('');

  if (topStarred.length) {
    L.push('## الأكثر حصولًا على Stars', '', '| المستودع | Stars | Forks |', '|---|---|---|');
    topStarred.forEach((r) => L.push(`| [${r.name}](${r.url}) | ${r.stars} | ${r.forks} |`));
    L.push('');
  }

  L.push('## نسبة المستودعات المستوفية لكل معيار', '', '| المعيار | النسبة |', '|---|---|');
  Object.entries(data.coverage).forEach(([k, v]) => L.push(`| ${issueLabel(k)} | ${v}% |`));
  L.push('');

  if (recommendations.length) {
    L.push('## ما الذي يجب إصلاحه أولًا', '');
    recommendations.forEach((r, i) =>
      L.push(`${i + 1}. **${issueLabel(r.key)}** — ${r.count} مستودع (+${r.gain} نقطة إجمالًا): ${r.repos.join('، ')}`)
    );
    L.push('');
  }

  L.push('## درجة اكتمال كل مستودع', '', '| المستودع | الدرجة | التقدير | النواقص |', '|---|---|---|---|');
  scored.forEach((r) =>
    L.push(`| [${r.name}](${r.url}) | ${r.score} | ${r.grade} | ${r.issues.length ? r.issues.map(issueLabel).join('، ') : '✔ مكتمل'} |`)
  );
  L.push('');

  if (staleRepos.length) {
    L.push('## مشاريع متوقفة', '', '| المستودع | آخر تحديث | أيام بدون تحديث |', '|---|---|---|');
    staleRepos.forEach((r) => L.push(`| [${r.name}](${r.url}) | ${fmtDate(r.pushedAt)} | ${r.idleDays} |`));
    L.push('');
  }

  L.push('## معايير التقييم (من 100)', '');
  Object.entries(data.meta.weights).forEach(([k, v]) => L.push(`- ${issueLabel(k)}: ${v} نقطة`));
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
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${e(user.login)}</title>
<style>body{font-family:Tahoma,Segoe UI,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#1e1b3a}
table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:start}
.k{display:flex;gap:12px;flex-wrap:wrap}.k div{flex:1;min-width:130px;background:#f4f5fb;border-radius:10px;padding:10px;text-align:center}
.k b{display:block;font-size:1.5rem;color:#6366f1}@media print{body{margin:0}}</style></head><body>
<h1>تقرير مستودعات ${e(user.name || user.login)} (@${e(user.login)})</h1><p>${fmtDate(data.meta.generatedAt)}</p>
<div class="k"><div><b>${s.totalRepos}</b>مستودع</div><div><b>${s.totalStars}</b>Stars</div><div><b>${s.totalForks}</b>Forks</div>
<div><b>${s.languagesCount}</b>لغة</div><div><b>${s.avgScore ?? '-'}</b>متوسط الاكتمال (${s.grade ?? '-'})</div><div><b>${s.staleCount}</b>متوقف</div></div>
<h2>اللغات</h2><table>${data.languages.map((l) => `<tr><td>${e(l.name)}</td><td>${l.count}</td><td>${l.percent}%</td></tr>`).join('')}</table>
<h2>ما يجب إصلاحه أولًا</h2><ol>${data.recommendations.map((r) => `<li><b>${e(issueLabel(r.key))}</b> — ${r.count} مستودع (+${r.gain} نقطة): ${e(r.repos.join('، '))}</li>`).join('')}</ol>
<h2>درجة كل مستودع</h2><table><tr><th>المستودع</th><th>الدرجة</th><th>التقدير</th><th>النواقص</th></tr>
${scored.map((r) => `<tr><td><a href="${e(r.url)}">${e(r.name)}</a></td><td style="color:${col(r.score)};font-weight:700">${r.score}</td><td>${r.grade}</td><td>${e(r.issues.map(issueLabel).join('، ') || '✔')}</td></tr>`).join('')}</table>
<p style="color:#6b7280;font-size:.85rem">للطباعة كـ PDF: Ctrl+P ثم «حفظ كـ PDF».</p></body></html>`;
  download(`${data.user.login}-repo-report.html`, html, 'text/html;charset=utf-8');
}

export const badgeMarkdown = (login) =>
  `![repo health](${window.location.origin}/api/badge/${login}.svg)`;
