# Stale Issue Sweeper

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![CI](https://github.com/localhost94/stale-issue-sweeper/actions/workflows/ci.yml/badge.svg)](https://github.com/localhost94/stale-issue-sweeper/actions/workflows/ci.yml)

> A smart GitHub Probot app that uses semantic analysis to automatically detect
> and resolve stale issues. Instead of blindly closing issues after a timeout,
> it analyzes commit history and issue content to determine whether an issue
> has actually been fixed.

---

## What It Does

Triage stale issues is a chore every maintainer faces. Traditional stale-bots
just comment "Is this still relevant?" and auto-close after a timeout — they
have no understanding of whether the issue was actually fixed.

**Stale Issue Sweeper** goes further:

1. **Detects stale issues** — issues with no activity for N days.
2. **Analyzes semantically** — extracts keywords, fetches recent commits, and
   checks if fix-related commits reference the issue's topics.
3. **Auto-closes with evidence** — if confidence is high enough, it posts a
   summary comment explaining *why* it thinks the issue is fixed, then closes it.
4. **Labels ambiguous cases** — if there's related activity but no clear fix,
   it adds a `still-relevant` or `needs-more-info` label for human review.

### Example Scenario

Imagine an issue titled *"Login timeout on OAuth2 redirect"* filed 90 days ago.
Since then, a contributor pushed commit `fix: resolve OAuth2 login timeout`.
The sweeper detects this match, posts:

> **Analysis:** Found 1 relevant commit with fix keywords. Issue may be resolved.
> **Related changes:** - `abc1234`

...and closes the issue with `state_reason: 'completed'`.

No more manually checking "wait, was this already fixed?".

---

## Architecture

```
                 ┌─────────────┐
                 │   GitHub    │
                 │    Events   │
                 └──────┬──────┘
                        │
              ┌─────────▼──────────┐
              │   Probot App       │
              │   (src/app.ts)     │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │    Sweeper         │
              │   (src/sweeper.ts) │
              └──┬─────────────┬───┘
                 │             │
      ┌──────────▼──┐   ┌─────▼────────┐
      │  Semantic   │   │   GitHub     │
      │  Analyzer   │   │   Client     │
      │ (analyzer/) │   │ (github/)    │
      └──────┬──────┘   └──────┬───────┘
             │                  │
     ┌───────▼───────┐  ┌──────▼───────┐
     │  Keyword/LLM  │  │  Octokit     │
     │  Analysis     │  │  (REST API)  │
     └───────────────┘  └──────────────┘
```

### Key Components

| Component | Description |
| --------- | ----------- |
| **app.ts** | Probot entry point — registers webhook handlers and HTTP routes |
| **sweeper.ts** | Orchestrates scanning and analysis |
| **analyzer/semantic.ts** | Keyword extraction, heuristic analysis, LLM prompt builder |
| **analyzer/commit-diff.ts** | Compares file contents across commit history |
| **github/client.ts** | Octokit wrapper with throttling and pagination |
| **actions/close.ts** | Safe auto-close with summary comments |
| **actions/label.ts** | Label management (create if missing, add to issues) |

---

## Quick Start

### 1. Install as a GitHub App

1. Go to **Settings > Developer settings > GitHub Apps > New GitHub App**.
2. Fill in the details using [app.yml](app.yml) as a reference.
3. Set the **Webhook URL** to `https://your-domain.com/api/github/webhooks`.
4. Subscribe to the **Issues** and **Issue comment** events.
5. Generate a **private key** and note the **App ID**.
6. Install the app on your repositories.

### 2. Configure

Create a `.env` file based on [`.env.example`](.env.example):

```env
APP_ID=123456
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
WEBHOOK_SECRET=your_webhook_secret
LLM_PROVIDER=local
STALE_DAYS=60
CLOSE_THRESHOLD=0.85
MAX_ISSUES_PER_RUN=20
```

### 3. Deploy

```bash
npm install
npm run build
npm start
```

Or use Docker / a cloud platform like Fly.io, Railway, or Render.

---

## Configuration

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `APP_ID` | — | GitHub App ID |
| `PRIVATE_KEY` | — | GitHub App private key (PEM) |
| `WEBHOOK_SECRET` | — | Webhook secret for payload verification |
| `LLM_PROVIDER` | `local` | Analysis backend: `local` (heuristic) or `openai` |
| `OPENAI_API_KEY` | — | Required if `LLM_PROVIDER=openai` |
| `STALE_DAYS` | `60` | Days without activity before an issue is stale |
| `CLOSE_THRESHOLD` | `0.85` | Minimum confidence score to auto-close (0.0–1.0) |
| `MAX_ISSUES_PER_RUN` | `20` | Max issues to process per scan cycle |
| `LABEL_STALE` | `stale` | Label that triggers analysis when applied |
| `LABEL_CONFIRMED` | `still-relevant` | Label for issues confirmed still relevant |
| `LABEL_NEEDS_INFO` | `needs-more-info` | Label for issues needing more investigation |

---

## How the AI Analysis Works

### Heuristic Mode (default, `LLM_PROVIDER=local`)

1. **Keyword extraction** — Issue title and body are parsed; stopwords and
   short words are removed.
2. **Commit fetch** — Recent commits (within `STALE_DAYS`) are fetched via the
   GitHub API.
3. **Relevance filter** — Commits whose messages contain any issue keywords are
   kept.
4. **Fix detection** — Relevant commits are checked for fix/resolve/close
   keywords. If found, confidence is set to ~0.75. If only related but not
   fix-related, confidence is ~0.5.

### LLM Mode (`LLM_PROVIDER=openai`)

A prompt is constructed with the issue title, body, and recent commit messages,
then sent to OpenAI. The response is parsed from a structured format:

```
FIXED: yes/no
CONFIDENCE: 0.0-1.0
SUMMARY: explanation here
```

> **Note:** LLM integration is a scaffold. You'll need to add the OpenAI SDK
> and complete the `analyzeIssue` function for full LLM support.

---

## Local Development

```bash
# Clone the repo
git clone https://github.com/localhost94/stale-issue-sweeper.git
cd stale-issue-sweeper

# Install dependencies
npm install

# Copy and edit environment config
cp .env.example .env

# Run in dev mode with hot reload
npm run dev

# Run tests
npm test

# Lint check
npm run lint
```

For Probot development, you can use [smee.io](https://smee.io) to forward
webhooks to your local machine:

```bash
npx smee -u https://smee.io/your-channel -t http://localhost:3000/api/github/webhooks
```

---

## Trigger Methods

### Automatic (webhook)

- Adding a `stale` label to any issue triggers `analyzeIssue`.
- Posting a comment containing `/sweep-stale` triggers a full repo scan.

### Manual (HTTP)

```bash
curl -X POST https://your-app.com/trigger-sweep \
  -H "Content-Type: application/json" \
  -d '{"owner": "owner-name", "repo": "repo-name"}'
```

### Cron

Use a cron job or GitHub Actions scheduled workflow to call the trigger
endpoint periodically.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup
- Coding standards (TypeScript strict, conventional commits)
- Pull request process

---

## License

[MIT](LICENSE) &copy; 2026 Arya Kusuma

---

## Security

See [SECURITY.md](SECURITY.md) for instructions on reporting vulnerabilities.
