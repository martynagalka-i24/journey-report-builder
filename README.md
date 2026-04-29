# Journey Analytics Report Builder

A local web app for generating interactive customer journey Sankey reports from BigQuery data. You upload manually exported CSVs, configure the report, and download a single self-contained HTML file ready to share with clients.

---

## Prerequisites

Before you start, make sure you have the following installed:

| Tool | Minimum version | Check with |
|------|----------------|-----------|
| Python | 3.11+ | `python3 --version` |
| pip | bundled with Python | `pip3 --version` |
| Node.js | 18+ | `node --version` |
| npm | bundled with Node.js | `npm --version` |

If you don't have these, install them first:
- **Python:** https://www.python.org/downloads/
- **Node.js (includes npm):** https://nodejs.org/

---

## Getting the code

### Option A — Download a ZIP (no git required)

1. Go to the repository page on GitHub
2. Click the green **Code** button → **Download ZIP**
3. Unzip the file somewhere on your computer (e.g. your Desktop or Documents folder)

### Option B — Clone with git

```bash
git clone <repository-url>
cd journey-report-builder
```

---

## Setup (one-time, after downloading)

Open your terminal and run the following commands. You only need to do this once.

### 1. Install Python dependencies

```bash
cd backend
pip3 install -r requirements.txt
```

This installs FastAPI, Uvicorn, pandas, and other backend libraries.

> **Tip:** If you want to keep things tidy, use a virtual environment first:
> ```bash
> python3 -m venv .venv
> source .venv/bin/activate   # Windows: .venv\Scripts\activate
> pip install -r requirements.txt
> ```

### 2. Install Node.js dependencies

Open a second terminal window (keep the first one for the backend):

```bash
cd frontend
npm install
```

This installs React, Vite, and other frontend libraries. It may take a minute.

---

## Running the app

You need **two terminal windows** running at the same time.

### Terminal 1 — Start the backend

```bash
cd backend
python3 -m uvicorn main:app --reload --port 8000
```

You should see output like:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

### Terminal 2 — Start the frontend

```bash
cd frontend
npm run dev
```

You should see output like:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 3. Open the app

Go to **http://localhost:5173** in your browser (Chrome or Firefox recommended).

> The backend must be running for the frontend to work. If you see a blank screen or API errors, check that both terminals are running.

---

## How to use the app

The app has five tabs. Work through them in order.

### Tab 1 — SQL Queries

Copy the ready-made BigQuery SQL templates. Fill in the placeholders (marked with `{{PLACEHOLDER}}`) with your project's details and run them in BigQuery.

**Workflow for external domain queries (Q4, Q5, Q6):**
1. Run the raw version first (Q4a, Q5a, Q6a) — these show raw domain names
2. Review the raw domains (you can paste results into Claude to help define categories)
3. Fill in `{{CLIENT_SPECIFIC_CATEGORIES}}` in the categorised version (Q4b, Q5b, Q6b)
4. Run the categorised versions and export the results

### Tab 2 — Upload Data

Export your BigQuery query results as CSV files and upload them here. The app expects 7 specific files:

| Query | File to upload |
|-------|---------------|
| Q1b — Entry Paths (Categorised) | entry paths CSV |
| Q2b — Exit Paths (Categorised) | exit paths CSV |
| Q3 — Internal Transitions | internal transitions CSV |
| Q4b — Pre-Entry Domains (Categorised) | pre-entry domains CSV |
| Q5b — Post-Exit Domains (Categorised) | post-exit domains CSV |
| Q6b — Mid-Journey Domains (Categorised) | mid-journey domains CSV |
| Q7 — Full Cross-Domain Transitions | full transitions CSV |

Each file is validated on upload — you'll see a green tick or a red error with the specific issue. You can re-upload any file to replace it.

### Tab 3 — Configure

Fill in the report details and classify your nodes:

1. **Report Details** — client name, market, title, subtitle, data source label, period
2. **Cohort Configuration** — names and share percentages for your two cohorts
3. **Key Stats** — top entry page, top transition, and top exit page per cohort (fill these from your data)
4. **Node Classification** — tag each node as a Client page, Conversion point, or Competitor. This drives the ribbon colours and visual treatment in the Sankey
5. **Sankey Layout** — rename the 5 column headers; optionally override the auto-assigned layer for any node

### Tab 4 — Insights

Write up to 4 insight bullets per cohort. These appear below the Sankey diagram in the exported report. Use `**double asterisks**` for bold text. Each insight has a 280 character limit.

### Tab 5 — Preview & Export

- **Preview** — see the full interactive report in the browser. Click "↺ Refresh Preview" after making changes in other tabs
- **Download Report** — downloads a single `.html` file that is fully self-contained (no internet connection required to view it)

**To share the report publicly:**
Drag and drop the downloaded HTML file onto [Netlify Drop](https://app.netlify.com/drop). You'll get a shareable public URL in under 30 seconds.

---

## Project files

Your project is saved automatically as you work. Project data is stored locally in:
- `backend/projects/{project-id}.json` — all configuration
- `backend/data/{project-id}/` — uploaded CSV files

The app remembers your current project when you refresh the page. To start a fresh project, click **New Project** in the top-right corner of the app.

---

## Troubleshooting

**"Failed to fetch" or blank data in the app**
The backend isn't running. Make sure Terminal 1 shows Uvicorn running on port 8000.

**"Module not found" on backend startup**
You haven't installed Python dependencies yet. Run `pip3 install -r requirements.txt` inside the `backend/` folder.

**"Cannot find module" on frontend startup**
You haven't installed Node dependencies yet. Run `npm install` inside the `frontend/` folder.

**CSV upload shows column errors**
Make sure you're uploading the right query result for each slot. Column names must match exactly (case-sensitive). Export from BigQuery as CSV without renaming columns.

**The preview is blank or shows an error**
You need at least the Full Transitions file (Q7) uploaded before the preview will render. Check the Upload tab — all 7 files should show a green tick.

---

## Project structure

```
journey-report-builder/
├── backend/
│   ├── main.py              # FastAPI app and all API routes
│   ├── models.py            # Pydantic data models
│   ├── report_generator.py  # Builds the self-contained HTML report
│   ├── csv_validator.py     # CSV column validation logic
│   ├── requirements.txt     # Python dependencies
│   └── projects/            # Auto-created: one JSON file per project
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component, tab navigation, auto-save
│   │   ├── tabs/            # One file per tab
│   │   └── styles/
│   │       └── theme.css    # All CSS variables and utility classes
│   ├── package.json
│   └── vite.config.js       # Proxies /api to localhost:8000
├── CLAUDE.md                # Technical context for AI assistants
├── SPEC.md                  # Original product specification
└── README.md
```

---

## Glossary

### Journey terms

| Term | Definition |
|------|-----------|
| **Conversion** | A user action signalling commercial intent — e.g. reaching a checkout page, completing a booking, or signing up. Defined per project via `{{CONVERSION_CONDITIONS}}` in the SQL. |
| **Converting / Non-Converting** | The two cohorts the app always splits data into. A user is Converting if they ever triggered the conversion condition during the observation window. |
| **Entry (first touch)** | The first page a user visits on the client website in the observation window. Captured by Q1b. |
| **Exit (last touch)** | The last client page a user visits before the observation window ends or they leave permanently. Captured by Q2b. |
| **Internal transition** | Navigation between two pages within the client domain — not crossing to an external site. Captured by Q3. |
| **Pre-client** | External domains visited before the user's first visit to the client site. Captured by Q4. |
| **Post-client** | External domains visited after the user's last visit to the client site. Captured by Q5. |
| **Mid-journey external** | External domains visited between the user's first and last client touch. Captured by Q6. |
| **Reach / pct\_of\_cohort** | The percentage of users in a cohort who made a given transition. Controls the Min. Reach slider in the exported report. |

### Sankey layers

| Layer | Name | What it contains |
|-------|------|-----------------|
| 0 | Pre-Client | External domains visited before the first client touch |
| 1 | Discovery | Client pages that are primarily entry points |
| 2 | Evaluation | Client pages visited mid-journey (appear in both entry and exit data) |
| 3 | Conversion | Client pages tagged ⭐ Conversion in the configurator |
| 4 | Post-Client | External domains visited after the last client touch |

### Ribbon colours

| Colour | Name | Meaning |
|--------|------|---------|
| Red | FOBO — Fear Of Better Options | A user leaves a Key Page or Conversion page to visit an external site |
| Green | Return | A user comes back to a Key Page or Conversion page after visiting an external site |
| Purple | Other flow | Any transition not involving a Key Page or Conversion page |

### Node types

| Tag | Marker | Effect |
|-----|--------|--------|
| Client node | Blue border | Marks a page as belonging to the client site. Drives layer assignment. |
| Key Page | 🔑 | An important client page that triggers FOBO / Return ribbon colouring. |
| Conversion | ⭐ | A client page representing a conversion action. Always placed in Layer 3. |
| Competitor | ⚠ | An external domain that is a direct competitor. Highlighted in red. |

### Categorisation notes

- **`[ME] Other`** — Always end your `{{PAGE_TYPE_CASE}}` block with `ELSE '[ME] Other'` to keep the client catch-all label consistent across Q1b, Q2b, Q3 and Q7.
- **Search** — Covers major global engines (Google, Bing, DuckDuckGo, etc.). Add regional variants relevant to your market if needed (e.g. Yandex, Naver, Baidu).
- **Other (external)** — Catch-all for uncategorised external domains. Always run Q4a and Q5a first, review the raw domain list, and promote significant domains into named categories before running Q4b and Q5b.

---

## v2 Roadmap

- Direct BigQuery connection (replace manual CSV export)
- Hosting integration — publish reports to a hosting solution so clients can open a simple link instead of receiving an HTML file or needing local server access
- Multi-project dashboard
- Report versioning
