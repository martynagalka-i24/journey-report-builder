# Journey Analytics Report Builder — Claude Context

## What this app does

A local browser-based tool for analysts to generate interactive Sankey HTML reports from BigQuery journey data. The analyst uploads CSV exports, configures a project (cohorts, node tags, labels, insights), previews the report, and downloads a fully self-contained HTML file to share with clients.

## Tech stack

- **Backend:** Python 3.11 + FastAPI + Uvicorn, running on port 8000
- **Frontend:** React 18 + Vite 5, running on port 5173 (proxies `/api` → backend)
- **Storage:** JSON files on disk at `backend/projects/{uuid}.json`; CSVs at `backend/data/{project_id}/{file_type}.csv`
- **Output:** Self-contained HTML — all data baked in as JS variables, no CDN dependencies, works offline

## Project structure

```
backend/
  main.py              — FastAPI app, all API routes
  models.py            — Pydantic v2 models for project JSON schema
  report_generator.py  — Builds the self-contained HTML output
  csv_validator.py     — Validates uploaded CSVs against expected column schemas
  projects/            — One JSON file per project (auto-created)
  data/                — Uploaded CSVs, namespaced by project_id

frontend/src/
  App.jsx              — Root: tab navigation, project state, debounced auto-save
  tabs/
    SQLTab.jsx         — 11 BigQuery SQL templates with copy buttons
    UploadTab.jsx      — Drag-and-drop CSV uploader (7 required files)
    ConfigureTab.jsx   — Report details, cohort config, node tagger, layout config
    InsightsTab.jsx    — Per-cohort insight bullets (4 per cohort, 280 char limit)
    PreviewTab.jsx     — Iframe preview + download export button
  styles/theme.css     — All CSS variables and shared utility classes
```

## Running locally

```bash
# Terminal 1 — backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open http://localhost:5173.

## Key API routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/projects` | Create new project (returns UUID) |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/{id}` | Load project JSON |
| PUT | `/api/projects/{id}` | Partial update (only provided fields overwritten) |
| POST | `/api/projects/{id}/upload/{file_type}` | Validate + save a CSV |
| GET | `/api/projects/{id}/nodes` | Unique node names from full_transitions.csv |
| GET | `/api/projects/{id}/preview` | Returns generated report HTML (HTMLResponse) |
| GET | `/api/projects/{id}/export` | Returns HTML as download with Content-Disposition |

## Data model

Seven required CSV files, each with a specific column schema:

| Key | Required columns |
|-----|-----------------|
| `entry_paths` | `page_type`, `cohort`, `unique_users`, `pct_of_cohort` |
| `exit_paths` | same as entry_paths |
| `internal_transitions` | `cohort`, `from_page`, `to_page`, `unique_users`, `total_transitions`, `pct_of_cohort` |
| `pre_entry` | `domain_category`, `cohort`, `unique_users`, `pct_of_cohort` |
| `post_exit` | same as pre_entry |
| `mid_journey` | `domain_category`, `cohort`, `unique_users`, `total_visits`, `pct_of_cohort` |
| `full_transitions` | `cohort`, `from_node`, `to_node`, `unique_users`, `total_transitions`, `pct_of_cohort` |

## Core design decisions

### Sankey renderer — pure vanilla JS, no D3
The exported HTML embeds a custom Sankey layout algorithm (~400 lines of vanilla JS). D3 was deliberately excluded to keep the export self-contained and offline-capable.

### Ribbon colour logic
- Client node → external node = **FOBO** (red `#e74c3c`)
- External node → client node = **Return** (green `#27ae60`)
- Anything else = **Default** (muted purple `#9b95c9`)

"Client node" = any node tagged as a client website node in the Configure tab.

### Node layer assignment
Nodes are auto-assigned to Sankey layers 0–4 using a longest-path algorithm in `report_generator.py:_compute_auto_layers()`. The analyst can override individual nodes via dropdowns in the Configure tab.

### Python f-string + JS template literal escaping
`report_generator.py` builds the entire HTML as a Python f-string. To output JavaScript template literals, use `${{var}}` in Python (produces `${var}` in JS). To output literal `{` / `}` in JS, use `{{` / `}}`.

### Project state and auto-save
`App.jsx` holds project state in React, applies optimistic updates immediately, and debounces PUT calls to the backend by 500ms. The `projectId` is stored in `localStorage` so it survives page refreshes.

### Preview vs export
Both `GET /preview` and `GET /export` call the same `generate_report()` function. The only difference is that export adds a `Content-Disposition: attachment` header and formats the filename as `{client}_{market}_{period}_journey_report.html`.

## Node types

| Type | Visual | Effect on ribbons |
|------|--------|-------------------|
| Client node | Blue/purple, bold label, stronger border | Drives FOBO/Return logic |
| Conversion node | Subset of client nodes, ⭐ marker | Stat display only |
| Competitor node | Red colour, ⚠ marker | Removes client tag if set |

## Colour system (CSS variables)

All colours are defined as CSS variables in `frontend/src/styles/theme.css` and also re-embedded in the exported HTML via `report_generator.py`.

Key variables:
- `--color-cohort-a` / `--color-cohort-b` — cohort toggle active states
- `--color-ribbon-fobo` / `--color-ribbon-return` / `--color-ribbon-default` — ribbon colours
- `--color-node-client` / `--color-node-competitor` — node fill colours

## Interactivity in the exported report

1. **Cohort toggle** — switches all data between Cohort A and B
2. **Min. reach slider** — filters links below X% of cohort (0–35%, default 5%)
3. **Node click to highlight** — dims unconnected flows, shows "✕ Clear highlight" button
4. **Link hover tooltip** — shows `From → To`, `X% of cohort`, flow type
5. **Node hover tooltip** — shows name, in/out flow count, "Click to highlight" hint
