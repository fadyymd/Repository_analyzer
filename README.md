# RepoInsight

**RepoInsight** analyzes the public repositories of any GitHub account and turns repository metadata into clear, actionable insights. Explore account statistics, repository health checks, activity trends, recommendations, account comparisons, and downloadable reports.

> Enter a GitHub username such as `torvalds` to generate an interactive analysis dashboard.

**Built by Fadi Medkour**

**© 2026 Fadi Medkour. All rights reserved.**

---

## Features

### Account insights
- Public repository, star, fork, and language totals.
- Repository counts by language and creation year.
- Most-starred projects, frequently used topics, and inactive repositories.
- Repository search, sortable columns, issue-only filtering, and fork visibility controls.
- Dark theme, recent searches, and shareable account URLs.

### Repository health checks

| Check | How it is detected |
|---|---|
| README | A `README*` file in the repository root |
| README depth | README file is at least 500 bytes |
| Description | Description contains at least 20 characters |
| License | A license is registered on GitHub or a license file exists |
| Tests | Common test directories and test/spec filename patterns |
| CI | GitHub Actions, GitLab CI, Travis, CircleCI, Jenkins, or Azure Pipelines |
| `.gitignore` | A `.gitignore` file exists in the repository root |
| Topics | The repository has at least one topic |
| Activity | Last push within 180 days earns full points; activity up to one year earns partial points |

### Completeness score

Scores are normalized to the criteria that can be verified. Unknown checks are not treated as missing.

| Criterion | Points |
|---|---:|
| README | 20 |
| Tests | 15 |
| Activity | 13 |
| Description | 12 |
| License | 12 |
| CI | 10 |
| Topics | 8 |
| README depth | 5 |
| `.gitignore` | 5 |

Grades: **A** ≥ 90 · **B** ≥ 75 · **C** ≥ 60 · **D** ≥ 40 · **F** < 40.

- Forks are not scored because they are not original work by the account owner.
- Archived repositories are not penalized for inactivity.
- Select a repository row to inspect score details and improvement tips.
- Scores are indicative signals based on public metadata; they do not judge code quality or project suitability.

### Compare and export
- Compare two GitHub accounts side by side with a radar chart.
- Download reports in Markdown, print-friendly HTML, CSV, or JSON.
- Copy an SVG repository-health badge for a README.
- Review score-history snapshots retained for up to 90 days.

---

## Tech stack

- **Frontend:** React 18, Vite, Recharts, and CSS.
- **Backend:** Node.js and Express.
- **Data source:** GitHub REST API.
- **History:** SQLite.

## Getting started

Requirements: **Node.js 20.12 or later**.

```bash
# Install dependencies
npm run install:all

# Optional: configure a GitHub token
cp .env.example .env
# Add GITHUB_TOKEN to .env

# Start the development servers
npm run dev
```

- Frontend: http://localhost:5173
- API server: http://localhost:4000

### Production

```bash
npm run build
npm start
```

The production server serves the frontend and API at http://localhost:4000.

### Docker

```bash
GITHUB_TOKEN=your_token docker compose up --build
```

### GitHub API token

Unauthenticated GitHub API requests are limited to **60 per hour**. A read-only token without additional scopes raises the limit to **5,000 requests per hour** and is recommended for larger accounts or frequent use. Create a token at [GitHub Settings](https://github.com/settings/tokens) and store it in `.env`; never commit the token to source control.

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/analyze/:username?max=30` | Analyze an account. `max` controls the number of deeply scanned repositories (5–60). |
| `GET /api/history/:username` | Return score snapshots for the last 90 days. |
| `GET /api/badge/:username.svg` | Generate an SVG completeness badge. |
| `GET /api/health` | Return service health information. |

Analysis results are cached in bounded memory for 10 minutes, and concurrent requests for the same account are coalesced to reduce GitHub API usage. A compact SQLite snapshot stores average scores and repository counts—never repository details—and expires after 90 days. The default database path is `server/data/repo-insight.sqlite`; override it with `HISTORY_DB_PATH`.

## Security and deployment

- Browser security headers are enabled, and cross-origin access is denied by default. To allow trusted origins, set `CORS_ALLOWED_ORIGINS` to a comma-separated list of exact HTTP(S) origins, such as `https://example.com` (without paths).
- Per-IP request limits and a global cap of ten concurrent account analyses protect the GitHub API quota and server resources.
- GitHub API requests time out after 15 seconds.
- `/api/health` does not reveal whether a GitHub token or proxy configuration is present.
- `TRUST_PROXY_HOPS=0` is the safe default. If the app is behind a trusted reverse proxy, configure the exact number of proxy hops only when every request follows the same trusted network path. Do not use unrestricted proxy trust.
- Docker Compose stores the database in a persistent volume. On other platforms, mount persistent storage or set `HISTORY_DB_PATH` to a persistent location.

### Add a repository badge

After deploying the service, add this to a GitHub profile or repository README:

```markdown
![repo health](https://YOUR-HOST/api/badge/YOUR-USERNAME.svg)
```

The **Copy README badge** action in the dashboard generates this Markdown for the analyzed account.

---

## Project structure

```text
.
├── server/
│   ├── index.js        # Express routes, cache, and badge endpoint
│   ├── github.js       # GitHub REST client and rate-limit tracking
│   ├── analyzer.js     # Repository checks, scoring, and aggregation
│   ├── limits.js       # Bounded per-IP rate limiter
│   └── test/           # Node.js test suite
├── client/
│   └── src/
│       ├── App.jsx      # Layout, navigation, theme, and account search
│       ├── Analysis.jsx # Analysis dashboard
│       ├── Compare.jsx  # Account comparison
│       ├── report.js    # Markdown, HTML, CSV, and JSON exports
│       └── lib.js       # Labels and shared helpers
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Configuration

- **Scoring weights:** `WEIGHTS` in `server/analyzer.js` (must total 100).
- **Inactivity thresholds:** `STALE_DAYS` and `ACTIVE_DAYS` in `server/analyzer.js`.
- **Test and CI detection:** `TEST_PATTERNS` and `CI_PATTERNS` in the same file.
- **CORS allowlist:** `CORS_ALLOWED_ORIGINS` in `.env`.
- **Proxy hops:** `TRUST_PROXY_HOPS` in `.env`.

## Tests

```bash
npm test
```

The test suites cover file detection, score calculation, truncated repository trees, rate limiting, GitHub request timeouts, SQLite history, mocked account analysis, and interface navigation. Tests run without live GitHub API requests.

## Limitations

- Scores are indicative signals based on verifiable public files and metadata; they are not a measure of code quality, test quality, or suitability for a particular project.
- GitHub may truncate file trees for large repositories. Unverifiable checks are reported as unknown rather than missing.
- The most recently pushed repositories are scanned first, up to the selected limit (15, 30, or 60).
- Empty repositories are treated as having no files. If a repository tree cannot be read, its file-based checks are marked unknown.
- RepoInsight reads **public data only** and does not require access to your GitHub account.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

**Built by Fadi Medkour**

**© 2026 Fadi Medkour. All rights reserved.**
