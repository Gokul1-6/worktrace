# WorkTrace — AI Work Intelligence Console

WorkTrace is a hackathon-ready software MVP for **Future of Work & Automation**. It analyzes a team's task/dependency data, detects workflow bottlenecks, identifies likely root causes, measures downstream impact, and recommends the next action.

## What the MVP demonstrates

1. Load real task data from CSV.
2. Build a dependency graph from `depends_on` relationships.
3. Detect blocked/waiting/overdue/stale/high-impact tasks.
4. Score workflow risk.
5. Explain the root cause using observable task signals.
6. Show downstream tasks affected by the bottleneck.
7. Generate a concrete next-action recommendation.
8. Display everything in a research-style control console.

## Project structure

```text
worktrace/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── data/
│   └── tasks.csv
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── tests/
├── requirements.txt
└── README.md
```

## Run on Windows

### 1. Open terminal in the project folder

```powershell
cd worktrace
```

### 2. Create and activate virtual environment

```powershell
py -m venv .venv
.\.venv\Scripts\activate
```

### 3. Install backend dependencies

```powershell
pip install -r backend\requirements.txt
```

### 4. Start API

```powershell
uvicorn backend.main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

### 5. Start frontend

Open another terminal:

```powershell
cd worktrace\frontend
py -m http.server 5500
```

Open:

`http://127.0.0.1:5500`

## CSV format

The importer expects these headers:

```text
id,title,owner,status,priority,deadline,depends_on,last_update,description
```

Example:

```csv
T-101,Backend API,Asha,Delayed,High,2026-10-01T12:00:00,,2026-09-29T08:00:00,Authentication service
T-102,Frontend Integration,Ravi,Blocked,High,2026-10-02T12:00:00,T-101,2026-09-29T09:00:00,Connect frontend to API
```

## API endpoints

- `GET /api/health` — service health
- `GET /api/tasks` — demo task data
- `POST /api/analyze` — analyze supplied tasks
- `POST /api/analyze/demo` — analyze bundled demo data
- `POST /api/tasks/import` — analyze CSV text
- `GET /api/sample-csv` — retrieve bundled sample CSV

FastAPI docs are available at `http://127.0.0.1:8000/docs`.

## Important product note

This is a **functional MVP**, not a claim that an LLM is required for every detection. The current engine deliberately uses transparent, reproducible signals so the demo has no fabricated dashboard numbers. An LLM can be added as a second layer later for natural-language reasoning and message generation.

## Suggested hackathon demo

1. Open the dashboard.
2. Show the project health and task stream.
3. Point to the Authentication API as the root blocker.
4. Show the downstream chain: Frontend → Testing → Deployment → Demo.
5. Click **RUN ANALYSIS**.
6. Explain that WorkTrace converts a status such as “Delayed” into a root-cause and impact explanation.
7. Import a second CSV to demonstrate that the system works with external data, not only the bundled example.

## Next upgrade path

- GitHub Issues/PR integration
- Jira integration
- PostgreSQL persistence
- NetworkX/Neo4j dependency graph
- LLM explanation layer with structured JSON output
- Slack/Teams/email action generation
- Historical bottleneck analytics
- Team-level permissions and audit logs

## Dashboard navigation

The sidebar is fully functional in v1.1:
- Overview: health metrics, critical findings, workflow snapshot, task stream.
- Workflow Graph: full dependency chain and dependency edges.
- Blockers: every detected blocker/root cause with downstream impact.
- Actions: recommended resolution actions with copy-to-clipboard.

The Import CSV button parses the CSV locally in the browser and sends the real rows to the analysis API. Reset Demo restores the bundled dataset.


## Navigation troubleshooting
If the browser shows an older UI, stop any existing static server and start a fresh server from the `frontend` folder. This build uses a cache-busted app.js URL and direct navigation handlers. Hard refresh with Ctrl+Shift+R.
