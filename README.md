# Bug Pilot — AI-Powered Bug Triage Agent

## What Is Bug Pilot?

Bug Pilot is an **enterprise-grade AI agent** built for engineering teams that ship fast and debug faster.

When a bug surfaces in production, engineers waste hours manually reading through dozens of pull requests trying to find what changed and who changed it. Bug Pilot eliminates that entirely. Describe the bug in plain English — the agent scans every recently merged PR, reads the actual code diffs, cross-references Jira tickets, and tells you exactly which PR, which file, and which developer most likely introduced the bug. In seconds.

This is not a search tool. It is an autonomous triage agent that reasons about code changes the way a senior engineer would.

---

## The Problem It Solves

A team of 20+ developers all push PRs to the same repository. A bug surfaces 5 to 10 days after it was introduced. No one knows which PR caused it. The current process is manual, slow, and error-prone — engineers dig through Git history, read diffs, and guess.

Bug Pilot replaces that entire process with a single text input.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | MongoDB Atlas (Mongoose) |
| AI | Groq API — llama-3.3-70b-versatile |
| Real-time Data | Coral — local-first SQL runtime over GitHub API |
| GitHub Integration | GitHub Webhooks + GitHub REST API |
| Notifications | Slack Webhooks |
| Project Tracking | Jira REST API |
| Dev Tunnel | ngrok |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (Next.js)                 │
│                                                     │
│  Bug description input + day range slider           │
│  Coral toggle (real-time vs stored data)            │
│  Results: suspected PRs, confidence, files, Jira    │
│  PR history table with risk scores                  │
│  Dashboard stats: total PRs, high risk, avg score   │
└──────────────────────┬──────────────────────────────┘
                       │
          POST /api/incidents/analyze-coral   (Coral mode)
          POST /api/incidents/analyze         (MongoDB mode)
          GET  /api/github/prs
                       │
┌──────────────────────▼──────────────────────────────┐
│                  BACKEND (Express)                  │
│                                                     │
│  Coral mode:                                        │
│  1. Ping Coral to verify it is reachable            │
│  2. SQL query → GitHub API → recent merged PRs      │
│  3. Fetch diffs from MongoDB (Coral has no diff     │
│     table — webhook-stored diffs used as context)   │
│  4. Send enriched PR context to Groq AI             │
│  5. Save incident → Slack alert → return result     │
│                                                     │
│  MongoDB mode (fallback):                           │
│  1. Query stored PRs from MongoDB                   │
│  2. Send diffs to Groq AI                           │
│  3. Save incident → Slack alert → return result     │
│                                                     │
│  Webhook handler (on every merged PR):              │
│  1. Receive GitHub webhook event                    │
│  2. Fetch file diffs from GitHub API                │
│  3. Extract Jira ticket from commit messages        │
│  4. Call Groq AI for risk score (1–10)              │
│  5. Save full PR + diffs to MongoDB                 │
└──────┬──────────────────────────┬───────────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼────────┐
│    Coral    │          │    MongoDB      │
│  coral.exe  │          │  PullRequests   │
│      ↓      │          │  Incidents      │
│  GitHub API │          └────────┬────────┘
│  (live)     │                   │
└─────────────┘          ┌────────▼────────┐
                         │    Groq AI      │
                         │ llama-3.3-70b   │
                         └─────────────────┘
```

---

## Data Flow — Bug Analysis (Coral Mode)

```
1. Engineer types:
   "Payment is failing at checkout for users with promo codes"
   Coral toggle ON → daysBack = 7 → click Analyze PRs

2. POST /api/incidents/analyze-coral

3. Backend pings Coral to confirm it is reachable

4. Coral runs SQL against GitHub API in real time:
   SELECT number, title, user__login, merged_at, changed_files
   FROM github.pulls
   WHERE owner = 'your-org' AND repo = 'your-repo'
   AND state = 'closed' AND merged_at IS NOT NULL
   ORDER BY merged_at DESC LIMIT 30

5. JavaScript filters results by daysBack date window

6. For each PR: fetch stored diffs from MongoDB
   (diffs were saved when the PR was merged via webhook)

7. Build AI prompt:
   Bug: "Payment failing at checkout with promo codes"

   PR #47 — john_doe
   Files: src/payment/promoService.js
   Jira: CORAL-12 (In Progress)
   Diff: - if (!code) return cart;
         + const discount = getDiscount(code);

8. Groq AI responds:
   {
     suspectedPRs: [{
       prId: 47,
       author: "john_doe",
       confidence: 91,
       files: ["src/payment/promoService.js"],
       reason: "Removed null check on discount object...",
       jiraTicket: "CORAL-12",
       jiraStatus: "In Progress"
     }]
   }

```

## File Structure

```
bug-pilot/
├── frontend/
│   └── src/app/
│       ├── page.js                  — Dashboard layout and navbar
│       ├── globals.css              — Dark theme CSS variables
│       ├── layout.js                — Root layout with toast notifications
│       ├── components/
│       │   ├── BugAnalyzer.jsx      — Bug input, repo selector, Coral toggle, results
│       │   ├── DashboardCards.jsx   — Stats: total PRs, high risk count, avg risk score
│       │   └── PRTable.jsx          — PR history table with risk badges and Jira tickets
│       └── services/
│           └── api.js               — Axios instance pointing to backend
│
└── backend/
    ├── server.js                    — Express server + MongoDB connection
    ├── loadEnv.js                   — Dotenv loader (must import first)
    ├── models/
    │   ├── PullRequest.js           — PR schema: diffs, jiraTicket, riskScore
    │   └── Incident.js              — Incident schema: suspectedPRs, source
    ├── controllers/
    │   ├── githubController.js      — Webhook handler + getPullRequests
    │   └── incidentController.js    — analyzeIncident + analyzeIncidentWithCoral
    ├── services/
    │   ├── aiService.js             — Groq: risk scoring + bug analysis
    │   ├── coralService.js          — Coral SQL runner + PR fetching + ping check
    │   ├── jiraService.js           — Jira REST API ticket fetcher
    │   └── slackService.js          — Slack webhook alert sender
    └── routes/
        ├── githubRoutes.js          — POST /webhook, GET /prs
        ├── incidentRoutes.js        — POST /analyze, POST /analyze-coral, GET /
        └── seedRoutes.js            — POST /seed/prs, DELETE /seed/prs (dev only)
```

---

## API Endpoints

```
POST /api/github/webhook           — GitHub sends merged PR events here
GET  /api/github/prs               — All stored PRs for the dashboard table
POST /api/incidents/analyze        — MongoDB mode bug analysis
POST /api/incidents/analyze-coral  — Coral mode bug analysis (real-time GitHub data)
GET  /api/incidents                — All past bug analyses
POST /api/seed/prs                 — Inject fake PRs for testing
DELETE /api/seed/prs               — Wipe all PRs
```

---

## Running Locally — Step by Step

### Prerequisites

You need the following before starting:

**Node.js v18+**
Download from https://nodejs.org

**MongoDB Atlas** (free)
1. Go to https://cloud.mongodb.com
2. Create a free cluster
3. Create a database user with read/write access
4. Copy the connection string

**Groq API Key** (free)
1. Go to https://console.groq.com
2. Sign up → API Keys → Create Key

**GitHub Personal Access Token**
1. GitHub → Settings → Developer Settings → Personal Access Tokens (classic)
2. Generate token with `repo` scope

**Coral CLI**
```bash
curl -fsSL https://withcoral.com/install.sh | sh
```
After install, add GitHub as a data source:
```bash
coral source add github
```
Find the executable path on Windows:
```powershell
Get-Command coral | Select-Object Source
```

**ngrok** (for local webhook testing)
Download from https://ngrok.com/download, then:
```cmd
ngrok config add-authtoken your_token_here
```

---

### Step 1 — Clone and configure environment

Create `backend/.env` with the following:

```env
PORT=5000

GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=your-repo-name

# Repo to analyze for bugs (can be different from the webhook repo)
TARGET_REPO_OWNER=your-github-username
TARGET_REPO_NAME=your-project-repo

MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=ClusterName

GROQ_API_KEY=gsk_your_key_here

# Jira (optional)
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_DOMAIN=your-jira-domain

# Slack (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# Use forward slashes on Windows
CORAL_PATH=C:/Users/YourName/.local/bin/coral


# if you dont want to perform the above steps then paste the backend deployed link in frotend .env file

## NEXT_PUBLIC_API_URL=https://coral-hackathon-production.up.railway.app/api

```

---

### Step 2 — Start the backend

```bash
cd backend
npm install
npm run dev
```

Expected output:
```
MongoDB Connected
Server Running on Port 5000

if you have inserted backend deployed link then above step is not needed
```

---

### Step 3 — Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

### Step 4 — Start ngrok tunnel

In a separate terminal:
```bash
ngrok http 5000
```

Copy the `https://abc123.ngrok-free.app` URL.


if you have inserted backend deployed link in frontend then above step is not needed
---

### Step 5 — Configure GitHub Webhook

1. Go to your GitHub repo → Settings → Webhooks → Add webhook
2. Payload URL: `https://your-ngrok-url/api/github/webhook` or `https://playhouse-overtime-mutate.ngrok-free.dev/api/github/webhook`
3. Content type: `application/json`
4. Events: select **Pull requests** only
5. Click Add webhook

---

### Step 6 — Verify Coral is working

Run this directly in any terminal:
```cmd
C:\Users\YourName\.local\bin\coral sql "SELECT number, title, user__login, merged_at FROM github.pulls WHERE owner = 'your-username' AND repo = 'your-repo' AND state = 'closed' LIMIT 3" --format json
```

Expected: JSON array of your merged PRs pulled live from GitHub.
