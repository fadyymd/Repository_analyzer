import { describe, expect, it } from 'vitest';
import { buildMarkdown, downloadHTML } from './report.js';

const data = {
  user: { name: 'Fadi', login: 'fadi', url: 'https://github.com/fadi' },
  summary: {
    totalRepos: 1, forkedRepos: 0, totalStars: 10, totalForks: 2,
    languagesCount: 1, scannedRepos: 1, avgScore: 90, grade: 'A', staleCount: 0,
  },
  meta: {
    generatedAt: '2026-10-26T00:00:00.000Z',
    staleDays: 365,
    weights: { readme: 100 },
  },
  languages: [{ name: 'JavaScript', count: 1, percent: 100 }],
  topStarred: [],
  staleRepos: [],
  repos: [{ name: 'sample', url: 'https://github.com/fadi/sample', score: 90, grade: 'A', issues: [] }],
  recommendations: [],
  coverage: {},
};

describe('English report exports', () => {
  it('generates an English Markdown report with developer attribution', () => {
    const markdown = buildMarkdown(data);
    expect(markdown).toContain('# GitHub Repository Report');
    expect(markdown).toContain('Built by Fadi Medkour');
    expect(markdown).toContain('All rights reserved.');
    expect(markdown).not.toMatch(/[\u0600-\u06FF]/);
  });

  it('generates an English, left-to-right HTML report with copyright', async () => {
    let exportedBlob;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (blob) => { exportedBlob = blob; return 'blob:report'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = () => {};

    try {
      downloadHTML(data);
      expect(exportedBlob).toBeInstanceOf(Blob);
      expect(exportedBlob.type).toContain('text/html');
      const html = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(exportedBlob);
      });
      expect(html).toContain('<html lang="en" dir="ltr">');
      expect(html).toContain('© 2026 Fadi Medkour. All rights reserved.');
      expect(html).not.toMatch(/[\u0600-\u06FF]/);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
});
