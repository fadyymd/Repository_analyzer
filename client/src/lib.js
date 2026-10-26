export const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16', '#14b8a6', '#f97316'];

export const LABELS = {
  description: 'Description',
  readme: 'README',
  readmeDepth: 'README depth',
  license: 'LICENSE',
  tests: 'Tests',
  topics: 'Topics',
  activity: 'Activity',
  ci: 'CI',
  gitignore: '.gitignore',
};

export const TIPS = {
  description: 'Add a clear, complete sentence (20+ characters) explaining what the project does.',
  readme: 'Add a README that explains the project and how to install and run it.',
  readmeDepth: 'Expand the README with screenshots, usage examples, and setup instructions (500+ bytes).',
  license: 'Add a LICENSE file (such as MIT) from choosealicense.com.',
  tests: 'Add essential tests (Vitest, Jest, pytest, or similar) for the core functionality.',
  topics: 'Add repository topics to make the project easier to discover.',
  activity: 'Update the project regularly, or archive it if it is no longer maintained.',
  ci: 'Add a GitHub Actions workflow to run tests and builds on each push.',
  gitignore: 'Add a .gitignore file to keep node_modules and sensitive files out of version control.',
};

export const scoreColor = (s) => (s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626');
export const gradeOf = (s) => (s == null ? '-' : s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F');
export const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '-');
export const cleanName = (v) => v.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').split('/')[0];

export async function fetchAnalysis(name, max = 30) {
  const res = await fetch(`/api/analyze/${encodeURIComponent(name)}?max=${max}`);
  let json = {};
  try { json = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new Error(json.error || 'Analysis failed. Please try again.');
  return json;
}

const KEY = 'repo-insight:recent';
export function loadRecent() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
export function saveRecent(name) {
  try {
    const list = [name, ...loadRecent().filter((n) => n.toLowerCase() !== name.toLowerCase())].slice(0, 6);
    localStorage.setItem(KEY, JSON.stringify(list));
    return list;
  } catch { return [name]; }
}
