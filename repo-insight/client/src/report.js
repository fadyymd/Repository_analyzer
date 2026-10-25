const LABELS = {
  description: 'الوصف',
  readme: 'README',
  license: 'LICENSE',
  tests: 'الاختبارات',
  topics: 'المواضيع (Topics)',
  activity: 'النشاط',
};

export const issueLabel = (k) => LABELS[k] || k;
const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '-');

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
  const head = ['name', 'language', 'stars', 'forks', 'score', 'readme', 'description', 'license', 'tests', 'topics', 'last_push', 'idle_days', 'url'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = data.repos.map((r) =>
    [
      r.name,
      r.language || '',
      r.stars,
      r.forks,
      r.score ?? '',
      r.checks?.readme ?? '',
      r.checks?.description ?? '',
      r.checks?.license ?? '',
      r.checks?.tests ?? '',
      r.checks?.topics ?? '',
      fmtDate(r.pushedAt),
      r.idleDays ?? '',
      r.url,
    ].map(esc).join(',')
  );
  // BOM so Excel opens UTF-8 correctly
  download(`${data.user.login}-repos.csv`, '\uFEFF' + [head.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
}

export function buildMarkdown(data) {
  const { user, summary: s, languages, topStarred, staleRepos, repos } = data;
  const scored = repos.filter((r) => r.score !== null).sort((a, b) => a.score - b.score);
  const L = [];

  L.push(`# تقرير مستودعات GitHub: ${user.name || user.login} (@${user.login})`);
  L.push('', `تاريخ التقرير: ${fmtDate(data.meta.generatedAt)}  `, `الحساب: ${user.url}`, '');

  L.push('## ملخص عام', '');
  L.push(`- عدد المستودعات العامة: **${s.totalRepos}** (منها ${s.forkedRepos} Fork)`);
  L.push(`- إجمالي Stars: **${s.totalStars}** | إجمالي Forks: **${s.totalForks}**`);
  L.push(`- عدد اللغات المستخدمة: **${s.languagesCount}**`);
  L.push(`- المستودعات التي تم فحصها بعمق: **${s.scannedRepos}**`);
  L.push(`- متوسط درجة الاكتمال: **${s.avgScore ?? '-'} / 100**`);
  L.push(`- مستودعات لم تُحدَّث منذ أكثر من ${data.meta.staleDays} يومًا: **${s.staleCount}**`, '');

  L.push('## توزيع اللغات', '', '| اللغة | عدد المستودعات | النسبة |', '|---|---|---|');
  languages.forEach((l) => L.push(`| ${l.name} | ${l.count} | ${l.percent}% |`));
  L.push('');

  if (topStarred.length) {
    L.push('## الأكثر حصولًا على Stars', '', '| المستودع | Stars | Forks |', '|---|---|---|');
    topStarred.forEach((r) => L.push(`| [${r.name}](${r.url}) | ${r.stars} | ${r.forks} |`));
    L.push('');
  }

  L.push('## مشاكل الجودة', '');
  L.push(`- بدون README: ${s.missingReadme}`);
  L.push(`- وصف ناقص أو غير واضح: ${s.missingDescription}`);
  L.push(`- بدون LICENSE: ${s.missingLicense}`);
  L.push(`- بدون ملفات اختبار: ${s.missingTests}`, '');

  L.push('## درجة اكتمال كل مستودع', '', '| المستودع | الدرجة | النواقص |', '|---|---|---|');
  scored.forEach((r) =>
    L.push(`| [${r.name}](${r.url}) | ${r.score} | ${r.issues.length ? r.issues.map(issueLabel).join('، ') : '✔ مكتمل'} |`)
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
