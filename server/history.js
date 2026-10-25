import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export const HISTORY_RETENTION_DAYS = 90;

export function createHistoryStore(filename, { retentionDays = HISTORY_RETENTION_DAYS, now = Date.now } = {}) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });

  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_history (
      id INTEGER PRIMARY KEY,
      login TEXT NOT NULL COLLATE NOCASE,
      analyzed_at TEXT NOT NULL,
      avg_score INTEGER,
      grade TEXT,
      scanned_repos INTEGER NOT NULL,
      total_repos INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS analysis_history_login_date
      ON analysis_history (login, analyzed_at);
  `);

  const insert = db.prepare(`
    INSERT INTO analysis_history (login, analyzed_at, avg_score, grade, scanned_repos, total_repos)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const select = db.prepare(`
    SELECT analyzed_at AS analyzedAt, avg_score AS avgScore, grade,
           scanned_repos AS scannedRepos, total_repos AS totalRepos
    FROM analysis_history
    WHERE login = ? COLLATE NOCASE AND analyzed_at >= ?
    ORDER BY analyzed_at ASC
    LIMIT 100
  `);
  const removeExpired = db.prepare('DELETE FROM analysis_history WHERE analyzed_at < ?');

  function purgeExpired() {
    const cutoff = new Date(now() - retentionDays * 86400000).toISOString();
    return removeExpired.run(cutoff).changes;
  }

  purgeExpired();

  return {
    save({ login, analyzedAt, avgScore, grade, scannedRepos, totalRepos }) {
      if (!login || avgScore == null) return;
      insert.run(login, analyzedAt, avgScore, grade, scannedRepos, totalRepos);
      purgeExpired();
    },
    list(login) {
      const cutoff = new Date(now() - retentionDays * 86400000).toISOString();
      return select.all(login, cutoff);
    },
    close() {
      db.close();
    },
  };
}
