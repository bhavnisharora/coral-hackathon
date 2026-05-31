# Coral Agent — Full Project Blueprint

## What Is This?

Coral Agent is an **AI-powered bug triage tool** for engineering teams.

When a bug is found in production, instead of manually reading through 20+ pull requests to find the culprit, you open the Coral Agent dashboard, describe the bug in plain English, and the AI analyzes all recently merged PRs (with their actual code diffs) and tells you exactly which PR, which file, and which developer most likely introduced the bug.

---

## The Problem Being Solved

- A team of ~20 developers all push PRs to the same repo
- A bug surfaces 5–10 days after it was introduced
- No one knows which PR caused it
- Currently: manual, slow, error-prone investigation
- With Coral Agent: describe the bug → AI pinpoints the PR in seconds

---

## Tech Stack

| Layer              | Technology                              |
|--------------------|-----------------------------------------|
| Frontend           | Next.js 16 (App Router) + Tailwind CSS  |
| Backend            | Node.js + Express.js                    |
| Database           | MongoDB Atlas (Mongoose)                |
| AI                 | Groq API (llama-3.3-70b-versatile)      |
| SQL Query Engine   | Coral (local-first SQL runtime)         |
| GitHub Integration | GitHub Webhooks + GitHub REST API       |
| Notifications      | Slack Webhooks                          |
| Project Tracking   | Jira REST API                           |
| Tunnel (dev)       | ngrok                                   |

---

## Full System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                         │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Bug Triage     │  │  Analysis Results│  │  PR Table     │  │
│  │  textarea +     │  │  suspected PRs   │  │  history +    │  │
│  │  days slider +  │  │  confidence badge│  │  risk scores  │  │
│  │  Coral toggle   │  │  files + reason  │  │  jira tickets │  │
│  └────────┬────────┘  └──────────────────┘  └───────────────┘  │
└───────────┼─────────────────────────────────────────────────────┘
            │ POST /api/incidents/analyze        (MongoDB mode)
            │ POST /api/incidents/analyze-coral  (Coral mode)
            │ GET  /api/github/prs
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express)                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  POST /api/incidents/analyze-coral (Coral-powered)        │  │
│  │  1. Accept { bugDescription, daysBack }                   │  │
│  │  2. coralService → SQL query → GitHub API (real-time)     │  │
│  │  3. Normalize field names (Coral lowercases aliases)      │  │
│  │  4. Fetch diffs from MongoDB (fallback for diff content)  │  │
│  │  5. Send enriched context to Groq AI                      │  │
│  │  6. Save Incident → Slack alert → return to UI            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  POST /api/incidents/analyze (MongoDB fallback)           │  │
│  │  1. Accept { bugDescription, daysBack }                   │  │
│  │  2. Fetch PRs from MongoDB (last N days)                  │  │
│  │  3. Build prompt with all diffs                           │  │
│  │  4. Call Groq AI → get suspected PRs as JSON              │  │
│  │  5. Save Incident → Slack alert → return to UI            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  POST /api/github/webhook (GitHub calls this on PR merge) │  │
│  │  1. Verify action = closed + merged = true                │  │
│  │  2. Fetch file diffs from GitHub API                      │  │
│  │  3. Fetch commit messages → extract Jira ticket via regex │  │
│  │  4. Call Jira API → get ticket status                     │  │
│  │  5. Call Groq AI → generate risk score 1-10               │  │
│  │  6. Save full PR + diffs to MongoDB                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
         ┌─────────────────────┼──────────────────────┐
         ▼                     ▼                      ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Coral Runtime│    │    MongoDB       │    │  Slack / Jira    │
│ coral.exe    │    │  PullRequests    │    │  Webhooks + API  │
│      ↓       │    │  Incidents       │    │                  │
│ GitHub API   │    └──────────────────┘    └──────────────────┘
│ (real-time)  │              ↑
│ Jira API     │    ┌──────────────────┐
│ (future)     │    │   Groq AI        │
└──────────────┘    │  llama-3.3-70b   │
                    └──────────────────┘
```

---

## What is Coral Query Engine?

Coral is a **local-first SQL runtime** that converts external APIs into SQL-queryable tables.

Instead of writing manual API calls with pagination, auth, and data transformation, you write SQL:

```sql
SELECT number, title, user__login, merged_at
FROM github.pulls
WHERE owner = 'your-username'
  AND repo = 'your-repo'
  AND state = 'closed'
ORDER BY merged_at DESC
LIMIT 10
```

Coral automatically calls the GitHub API, handles auth, paginates, and returns clean JSON.

### Why Coral in This Project

| Without Coral | With Coral |
|---|---|
| Only webhook-ingested PRs available | Any PR in repo history, real-time |
| Stale data (stored at webhook time) | Live data from GitHub API |
| Manual Jira API call per PR | SQL LEFT JOIN with jira.issues |
| Limited to 50 stored PRs | Works with entire repo history |
| Multiple SDKs needed | Single SQL layer for all sources |

### Coral Architecture in This Project

```
Bug Description entered
        ↓
coralService.js → runCoralQuery()
        ↓
Writes SQL to temp .bat file (Windows)
        ↓
Executes coral.exe sql "..." --format json
        ↓
Coral calls GitHub REST API internally
        ↓
Returns JSON → normalize lowercase field names
        ↓
Date filter in JavaScript
        ↓
MongoDB fallback for diff content
        ↓
Groq AI analysis
```

**Important:** Coral lowercases all SQL aliases. `mergedAt` becomes `mergedat`, `prId` becomes `prid`. The normalization in `coralService.js` handles this.

---

## Data Flow — Bug Analysis (Coral Mode)

```
User types: "Payment is failing at checkout for users with promo codes"
Coral toggle: ON
                          │
                          ▼
            POST /api/incidents/analyze-coral
            { bugDescription: "...", daysBack: 7 }
                          │
                          ▼
            coralService.searchRelevantPRs()
            SQL → github.pulls → real-time GitHub API
            Returns: [PR#3, PR#4, PR#8, PR#9...]
                          │
                          ▼
            For each PR: fetchPRDiffs()
            → Coral tries github.pull_files (not available)
            → Falls back to MongoDB diffData
                          │
                          ▼
            Build AI prompt with enriched context:
            ┌──────────────────────────────────────────┐
            │ Bug: "Payment failing at checkout..."    │
            │                                          │
            │ PR #3 — bhavnisharora                   │
            │ Files: src/payment/promoService.js       │
            │ Jira: SCRUM-5 (In Progress)              │
            │ Diff: - if (!code) return cart;          │
            │       + const discount = getDiscount()   │
            └──────────────────────────────────────────┘
                          │
                          ▼
            Groq llama-3.3-70b responds:
            {
              suspectedPRs: [{
                prId: 3,
                author: "bhavnisharora",
                files: ["src/payment/promoService.js"],
                reason: "Modified promo validation logic...",
                confidence: 91,
                jiraTicket: "SCRUM-5",
                jiraStatus: "In Progress"
              }]
            }
                          │
                          ▼
            Save Incident to MongoDB (source: "coral")
            Send Slack alert
            Return result to Dashboard
```

---

## Data Flow — PR Ingestion (Automatic via Webhook)

```
Developer merges PR on GitHub
              │
              ▼
GitHub sends webhook → POST /api/github/webhook
              │
              ▼
Verify: action = "closed" AND pr.merged = true
              │
              ▼
Call GitHub API → fetch file diffs
GET /repos/{owner}/{repo}/pulls/{number}/files
Returns: [{ filename, patch, additions, deletions }]
              │
              ▼
Call GitHub API → fetch commit messages
GET /repos/{owner}/{repo}/pulls/{number}/commits
Scan title + body + all commit messages for Jira ticket
Regex: /[A-Z]+-\d+/ → finds "SCRUM-5", "CORAL-12" etc.
              │
              ▼
If Jira ticket found → call Jira REST API
GET https://{domain}.atlassian.net/rest/api/3/issue/{ticket}
Returns: { status: "In Progress", assignee: "..." }
              │
              ▼
Call Groq AI → generatePRSummary()
Returns: { riskScore: 8, summary: "High risk: modifies payment logic..." }
              │
              ▼
Save to MongoDB:
{
  prId, title, author, reviewers,
  repoOwner, repoName,
  jiraTicket: "SCRUM-5",
  jiraStatus: "In Progress",
  filesChanged: ["src/payment/promoService.js"],
  diffData: [{ filename, patch }],
  mergedAt, riskScore, aiSummary
}
```

---

## File Structure

```
coral-agent/
├── frontend/
│   └── src/app/
│       ├── page.js                    — Main dashboard layout + navbar
│       ├── globals.css                — Dark theme CSS variables
│       ├── layout.js                  — Root layout + Toaster
│       ├── components/
│       │   ├── DashboardCards.jsx     — 4 stat cards (PRs, analyses, risk)
│       │   ├── BugAnalyzer.jsx        — Bug input + Coral toggle + results
│       │   └── PRTable.jsx            — PR history table with risk badges
│       └── services/
│           └── api.js                 — Axios instance → localhost:5000/api
│
└── backend/
    ├── server.js                      — Express + MongoDB + routes
    ├── models/
    │   ├── PullRequest.js             — PR schema with diffData, jiraTicket
    │   └── Incident.js                — Incident schema with suspectedPRs, source
    ├── controllers/
    │   ├── githubController.js        — Webhook handler + getPullRequests
    │   └── incidentController.js      — analyzeIncident + analyzeIncidentWithCoral
    ├── services/
    │   ├── aiService.js               — Groq: generatePRSummary + analyzeBugAcrossPRs
    │   ├── coralService.js            — Coral SQL runner + PR fetching
    │   ├── jiraService.js             — Jira REST API ticket fetcher
    │   └── slackService.js            — Slack webhook alert sender
    └── routes/
        ├── githubRoutes.js            — POST /webhook, GET /prs
        ├── incidentRoutes.js          — POST /analyze, POST /analyze-coral, GET /
        └── seedRoutes.js              — POST /seed/prs, DELETE /seed/prs (dev only)
```

---

## API Endpoints

```
POST /api/github/webhook          — GitHub sends merged PR events here
GET  /api/github/prs              — Returns all stored PRs (dashboard table)
POST /api/incidents/analyze       — MongoDB mode: { bugDescription, daysBack }
POST /api/incidents/analyze-coral — Coral mode:   { bugDescription, daysBack }
GET  /api/incidents               — Returns all past bug analyses
POST /api/seed/prs                — Injects 4 fake PRs for testing
DELETE /api/seed/prs              — Wipes all PRs (clean slate)
```

---

## Environment Variables

Create `backend/.env` with these values:

```env
PORT=5000

# GitHub Personal Access Token (repo scope)
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=your-repo-name

# MongoDB Atlas connection string
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=ClusterName

# Groq API (free at console.groq.com)
GROQ_API_KEY=gsk_your_key_here

# Jira (optional — for ticket status)
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_DOMAIN=your-jira-domain

# Slack Webhook (optional — for alerts)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# Coral executable path (Windows)
CORAL_PATH=C:\Users\YourName\.local\bin\coral.exe
```

---

## Prerequisites — Install Everything First

### 1. Node.js
Download and install from https://nodejs.org (v18 or higher)

```bash
node --version   # should show v18+
npm --version
```

### 2. MongoDB Atlas
1. Go to https://cloud.mongodb.com
2. Create a free cluster
3. Create a database user with read/write access
4. Get the connection string → paste into `MONGO_URI` in `.env`
5. Whitelist your IP in Network Access (or allow 0.0.0.0/0 for dev)

### 3. Groq API Key (Free)
1. Go to https://console.groq.com
2. Sign up → API Keys → Create API Key
3. Paste into `GROQ_API_KEY` in `.env`
4. Free tier: 14,400 requests/day — more than enough

### 4. GitHub Personal Access Token
1. Go to GitHub → Settings → Developer Settings
2. Personal Access Tokens → Tokens (classic)
3. Generate new token → select `repo` scope
4. Paste into `GITHUB_TOKEN` in `.env`

### 5. ngrok (for GitHub Webhook in local dev)

**Windows:**
1. Download from https://ngrok.com/download
2. Extract `ngrok.exe` to any folder
3. Sign up at https://ngrok.com → get your auth token
4. Run:
```cmd
ngrok config add-authtoken your_token_here
```

**Start tunnel:**
```cmd
ngrok http 5000
```

Copy the `https://abc123.ngrok-free.app` URL — this is your webhook URL.

**Important:** ngrok gives a new URL every restart. Update GitHub webhook URL each time.

### 6. Coral Query Engine

**Install:**
```bash
curl -fsSL https://withcoral.com/install.sh | sh
```

**Verify:**
```bash
coral --version
```

**Find the executable path (Windows):**
```powershell
Get-Command coral | Select-Object Source
```

Copy the path (e.g. `C:\Users\YourName\.local\bin\coral.exe`) → paste into `CORAL_PATH` in `.env`

**Add GitHub as a data source:**
```bash
coral source add github
```

Set your token:
```powershell
$env:GITHUB_TOKEN="ghp_your_token_here"
```

**Test GitHub connection:**
```bash
coral sql "SELECT number, title FROM github.pulls WHERE owner = 'your-username' AND repo = 'your-repo' LIMIT 5"
```

**Add Jira as a data source:**
```bash
coral source add jira
```

Set credentials:
```powershell
$env:JIRA_API_TOKEN="your_jira_token"
$env:JIRA_DOMAIN="your-domain"
```

**Verify all sources:**
```bash
coral source list
```

Should show:
```
Source  Version  Origin
------  -------  -------
github  1.1.6    bundled
jira    0.1.0    bundled
```

### 7. Slack Webhook (Optional)
1. Go to https://api.slack.com/apps
2. Create new app → Incoming Webhooks → Activate
3. Add to a channel → copy webhook URL
4. Paste into `SLACK_WEBHOOK_URL` in `.env`

### 8. Jira Setup (Optional)
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create API token → copy it
3. Paste into `JIRA_API_TOKEN` in `.env`
4. Set `JIRA_DOMAIN` to your Atlassian subdomain (e.g. `my-company` for `my-company.atlassian.net`)
5. Create tickets in Jira matching your commit message IDs (e.g. `SCRUM-5`)

---

## How to Run

### Backend
```bash
cd backend
npm install
npm run dev
```

Should print:
```
MongoDB Connected
Server Running on Port 5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### ngrok (separate terminal)
```bash
ngrok http 5000
```

---

## GitHub Webhook Setup

1. Go to your GitHub repo → Settings → Webhooks → Add webhook
2. Fill in:
   - Payload URL: `https://your-ngrok-url/api/github/webhook`
   - Content type: `application/json`
   - Secret: leave empty
   - Events: select "Let me select individual events" → tick **Pull requests** only
3. Click Add webhook
4. GitHub sends a ping — you should see a green tick

**Verify webhook is working:**
- Open `http://127.0.0.1:4040` (ngrok dashboard)
- Merge a PR → a POST request should appear within seconds

---

## How to Test (Quick Demo)

### Option A — Seed fake PRs (no webhook needed)
```bash
curl -X POST http://localhost:5000/api/seed/prs
```

Then go to `localhost:3000` → Bug Triage → type:
```
Payment is failing at checkout when users apply a promo code. Getting a 500 error.
```
Set slider to 7 days → Analyze PRs

Expected: PR #47 by john_doe, 85%+ confidence

### Option B — Real webhook flow
1. Start ngrok → update GitHub webhook URL
2. Create a branch → make a code change → commit with Jira ticket ID:
   ```bash
   git commit -m "SCRUM-5 fix null discount causing 500 at checkout"
   ```
3. Push → open PR on GitHub → merge it
4. Backend terminal should show:
   ```
   [WEBHOOK] Processing merged PR #X
   [WEBHOOK] Jira ticket found: SCRUM-5 | Status: In Progress
   [WEBHOOK] AI risk score: 8
   [WEBHOOK] PR saved to MongoDB
   ```
5. Refresh dashboard → PR appears in table with Jira ticket + risk score
6. Describe the bug → Analyze PRs → AI returns the PR as suspect
7. Check Slack → alert received with PR details

---

## Jira Ticket Integration Notes

- Jira ticket ID is extracted from **PR title + PR body + all commit messages**
- Regex pattern: `/[A-Z]+-\d+/` — matches `SCRUM-5`, `CORAL-12`, `ABC-1` etc.
- Must be **uppercase** — `scrum-5` will NOT match
- The ticket must **exist in your Jira project** for status to populate
- If ticket not found in Jira, `jiraTicket` is saved but `jiraStatus` is null

---

## Coral Query Engine Notes

- Coral must be running on the same machine as the backend
- Set `CORAL_PATH` in `.env` to the full path of `coral.exe`
- Coral lowercases all SQL column aliases — handled automatically in `coralService.js`
- PR diffs are fetched from MongoDB (Coral's GitHub schema has no diff table)
- If Coral query fails, the Coral analysis endpoint returns an error — use the regular `/analyze` endpoint as fallback
- The "Use Coral Query Engine" toggle in the dashboard switches between both modes

---

## Known Issues

| Issue | Cause | Fix |
|---|---|---|
| Jira shows N/A in Slack | Ticket doesn't exist in Jira project | Create real Jira tickets matching commit IDs |
| Coral "Access is denied" | Windows permission issue | Run terminal as Administrator |
| ngrok URL changes on restart | ngrok free tier limitation | Update GitHub webhook URL after each ngrok restart |
| No PRs in dashboard | Seed was run and wiped real PRs | Redeliver webhooks from GitHub → Settings → Webhooks → Recent Deliveries |
| Coral returns 0 PRs | Date filter too strict | Coral mode falls back to all recent PRs automatically |

---

## What Success Looks Like

1. Bug reported in production at 2pm
2. Engineer opens Coral Agent dashboard at `localhost:3000`
3. Types: *"Users are getting 500 errors when applying discount codes at checkout"*
4. Enables Coral toggle → sets look back to 7 days → clicks Analyze PRs
5. Within 10 seconds sees:

```
🔴 TOP SUSPECT — PR #3 by bhavnisharora (91% confidence)
Files: src/payment/promoService.js
Jira: SCRUM-5 (In Progress)
Reason: PR #3 modified the promo code validation logic and removed
a null check on the discount object which would cause a 500 error
when an invalid promo code is passed at checkout.
```

6. Slack channel receives:
```
🪸 Coral-Powered Bug Triage Alert
Bug: Users getting 500 errors at checkout with discount codes

Top Suspect: PR #3 by bhavnisharora (91% confidence)
Files: src/payment/promoService.js
Jira: SCRUM-5
Reason: Modified promo validation logic...
```

7. Team goes directly to PR #3, confirms the bug, reverts or patches

---

## Future Improvements

- Add Slack as Coral source — query Slack discussions about the bug for extra AI context
- Add Datadog/Sentry via Coral — correlate PRs with production error spikes
- Add Jira JOIN in Coral SQL — live ticket priority + status in every analysis
- Add vector DB embeddings for faster semantic PR search
- Add PR author Slack DM notification
- Add timeline chart of risk scores over time (recharts already installed)
- Add GitHub Actions integration to auto-trigger analysis on incident alerts
- Add false positive feedback button to improve AI accuracy over time
- Add authentication before exposing to wider team
