export const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16', '#14b8a6', '#f97316'];

export const LABELS = {
  description: 'الوصف',
  readme: 'README',
  readmeDepth: 'محتوى README',
  license: 'LICENSE',
  tests: 'الاختبارات',
  topics: 'Topics',
  activity: 'النشاط',
  ci: 'CI',
  gitignore: '.gitignore',
};

export const TIPS = {
  description: 'أضف وصفًا واضحًا من جملة كاملة (20 حرفًا فأكثر) يشرح ماذا يفعل المشروع.',
  readme: 'أنشئ ملف README يشرح المشروع وطريقة التثبيت والتشغيل.',
  readmeDepth: 'وسّع README: أضف لقطات شاشة وأمثلة استخدام وقسم تثبيت (500 بايت فأكثر).',
  license: 'أضف ملف LICENSE (مثل MIT) من choosealicense.com.',
  tests: 'أضف اختبارات أساسية (Vitest / Jest / pytest) لأهم الوظائف.',
  topics: 'أضف Topics من صفحة المستودع ليسهل اكتشافه.',
  activity: 'حدّث المشروع، أو أرشفه (Archive) إن توقف العمل عليه.',
  ci: 'أضف GitHub Actions بسيط يشغّل الاختبارات والبناء عند كل Push.',
  gitignore: 'أضف .gitignore لتجنب رفع node_modules والملفات الحساسة.',
};

export const scoreColor = (s) => (s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626');
export const gradeOf = (s) => (s == null ? '-' : s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F');
export const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '-');
export const cleanName = (v) => v.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').split('/')[0];

export async function fetchAnalysis(name, max = 30) {
  const res = await fetch(`/api/analyze/${encodeURIComponent(name)}?max=${max}`);
  let json = {};
  try { json = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw new Error(json.error || 'فشل التحليل');
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
