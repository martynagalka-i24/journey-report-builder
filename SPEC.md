# Journey Analytics Report Builder — v1 Specification

## Overview

A browser-based web application that takes manually exported BigQuery CSVs, lets an analyst configure a client project, and generates a self-contained interactive Sankey HTML report ready to share with clients.

**Tech stack:**
- **Backend:** Python + FastAPI — handles file uploads, session/project state, report generation
- **Frontend:** React (Vite) — 5-tab UI, live Sankey preview
- **Output:** Single self-contained HTML file (all data + JS baked in, no dependencies at runtime)
- **Deployment:** Local only for v1. Analyst runs `uvicorn main:app` and opens `localhost:8000`

**No database required.** Project state is stored as JSON files on disk, one per project, in a `/projects` directory.

---

## Core Concepts

### Two-layer journey model
Every report visualises two layers simultaneously:

1. **Client website layer** — granular page-type nodes (Homepage, Model Detail, Configurator etc.), classified via `target_path` patterns configured per project
2. **External domain layer** — category-level nodes (Search, Competitors, AI Platforms etc.), classified via `target_domain` matching

### Cohorts
Every metric is split by two cohorts — names are configurable per project (defaults: "Converting" / "Non-Converting"). The report toggle switches between them.

### Node types
Three special node types drive visual treatment in the report:
- **Client nodes** — Hyundai-style: stronger border, bold label, drives FOBO/return ribbon logic
- **Conversion nodes** — subset of client nodes, marked with ⭐
- **Competitor nodes** — subset of external nodes, marked with ⚠ and red colour

### Ribbon colour logic (auto-derived from node tagging)
- Client node → external node = **FOBO ribbon** (red `#e74c3c`)
- External node → client node = **Return ribbon** (green `#27ae60`)
- Client node → client node = **Default ribbon** (muted purple `#9b95c9`)
- External node → external node = **Default ribbon** (muted purple `#9b95c9`)

---

## App Structure

Five tabs in order. Progress indicator at the top shows which tabs are complete (checkmark when all required fields/uploads are done).

```
[ SQL Queries ] [ Upload Data ] [ Configure ] [ Insights ] [ Preview & Export ]
```

---

## Tab 1: SQL Queries

### Purpose
Provide ready-to-use BigQuery SQL templates with placeholders so the analyst can extract the required data without writing SQL from scratch.

### Placeholders (filled by analyst before running in BigQuery)
| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{DATASET}}` | Full BigQuery dataset path | `insights24.datos_hyundai_com_de_es_01012026_31032026.hyundai_com_de_all_events` |
| `{{DATE_FROM}}` | Start date | `2026-01-01` |
| `{{DATE_TO}}` | End date | `2026-03-31` |
| `{{CLIENT_DOMAINS}}` | Comma-separated client domain strings | `'hyundai.com', 'hyundai.de', 'hyundai-entdecken.de'` |
| `{{CONVERSION_CONDITIONS}}` | SQL WHERE conditions for converting users | `target_path LIKE '%/konfigurator%' OR target_path LIKE '%probefahrt%'` |
| `{{PAGE_TYPE_CASE}}` | CASE WHEN block classifying target_path into page types | See Page Type Taxonomy section |
| `{{COMPETITOR_DOMAINS}}` | Comma-separated competitor domain strings | `'bmw.de', 'volkswagen.de', 'byd.com'` |
| `{{CLIENT_SPECIFIC_CATEGORIES}}` | Additional CASE WHEN rows for client-specific domain categories | See External Taxonomy section |

### Universal domain classifications (pre-filled in templates, not placeholders)
These are hardcoded into every query template and do not require analyst input:

```sql
-- Search engines
WHEN target_domain IN (
  'google.com', 'google.de', 'google.es', 'google.co.uk', 'google.fr',
  'bing.com', 'duckduckgo.com', 'ecosia.org', 'yahoo.com',
  'startpage.com', 'kagi.com', 'brave.com', 'live.com'
) THEN 'Search'

-- AI Platforms
WHEN target_domain IN (
  'chatgpt.com', 'openai.com', 'perplexity.ai',
  'claude.ai', 'gemini.google.com', 'copilot.microsoft.com',
  'deepseek.com', 'meta.ai', 'grok.com', 'you.com'
) THEN 'AI Platforms'

-- Video
WHEN target_domain IN ('youtube.com', 'youtu.be', 'vimeo.com') THEN 'Video'

-- Social Media
WHEN target_domain IN (
  'facebook.com', 'fb.com', 'instagram.com', 'linkedin.com',
  'whatsapp.com', 'x.com', 'twitter.com', 'tiktok.com', 'pinterest.com'
) THEN 'Social Media'

-- Forums
WHEN target_domain IN (
  'reddit.com', 'quora.com'
) THEN 'Forums'
```

### Query templates (11 total)

Display each query in a code block with a **Copy** button. Group into two sections: "Client Website Queries" and "External Domain Queries".

#### Client Website Queries

**Q1a — Entry Paths (Raw)**
First client-domain page per user, raw `target_path`, by cohort. LIMIT 100.

**Q1b — Entry Paths (Categorised)**
Same as Q1a but applies `{{PAGE_TYPE_CASE}}` to classify paths into page types.
Output columns: `page_type`, `cohort`, `unique_users`, `pct_of_cohort`

**Q2a — Exit Paths (Raw)**
Last client-domain page per user, raw `target_path`, by cohort. LIMIT 100.

**Q2b — Exit Paths (Categorised)**
Same as Q2a but applies `{{PAGE_TYPE_CASE}}`.
Output columns: `page_type`, `cohort`, `unique_users`, `pct_of_cohort`

**Q3 — Internal Transitions**
Step-to-step page-type transitions within the client domain only. Deduplicates consecutive same-page-type visits. Applies `{{PAGE_TYPE_CASE}}`.
Output columns: `cohort`, `from_page`, `to_page`, `unique_users`, `total_transitions`, `pct_of_cohort`
LIMIT 150.

#### External Domain Queries

**Q4a — Pre-Entry Domains (Raw)**
Single domain visited immediately before the user's first client-domain touch, by cohort. LIMIT 100.
Output columns: `target_domain`, `cohort`, `unique_users`, `pct_of_cohort`

**Q4b — Pre-Entry Domains (Categorised)**
Same as Q4a but classifies domains into categories using universal classifications + `{{CLIENT_SPECIFIC_CATEGORIES}}`.
Output columns: `domain_category`, `cohort`, `unique_users`, `pct_of_cohort`

**Q5a — Post-Exit Domains (Raw)**
Single domain visited immediately after the user's last client-domain touch, by cohort. LIMIT 100.
Output columns: `target_domain`, `cohort`, `unique_users`, `pct_of_cohort`

**Q5b — Post-Exit Domains (Categorised)**
Same as Q5a with taxonomy applied.
Output columns: `domain_category`, `cohort`, `unique_users`, `pct_of_cohort`

**Q6a — Mid-Journey Domains (Raw)**
All external domains visited between user's first and last client-domain touch, by cohort. LIMIT 100.
Output columns: `target_domain`, `cohort`, `unique_users`, `total_visits`, `pct_of_cohort`

**Q6b — Mid-Journey Domains (Categorised)**
Same as Q6a with taxonomy applied.
Output columns: `domain_category`, `cohort`, `unique_users`, `total_visits`, `pct_of_cohort`

**Q7 — Full Cross-Domain Transitions**
The master query. Classifies every event in the full journey as either a client page-type or an external category. Deduplicates consecutive same-node visits. Counts all step-to-step transitions by cohort.
Output columns: `cohort`, `from_node`, `to_node`, `unique_users`, `total_transitions`, `pct_of_cohort`
LIMIT 200.

### Inline guidance
Below each query, show a small note:
- Which file to save the result as (e.g. `Save as: transitions_full.csv`)
- Whether this is a validation-only file (Q1a, Q2a, Q4a, Q5a, Q6a) or an app upload file (Q1b, Q2b, Q3, Q4b, Q5b, Q6b, Q7)
- A note for Q4a/Q5a/Q6a: "Run this first. Review raw domains with Claude to define your client-specific categories before running the b-version."

---

## Tab 2: Upload Data

### Purpose
Upload the 7 required CSV files. App validates column names on upload and shows a green tick or red error per file.

### Required files and expected columns

| File label | Expected columns |
|-----------|-----------------|
| Entry Paths (Q1b) | `page_type`, `cohort`, `unique_users`, `pct_of_cohort` |
| Exit Paths (Q2b) | `page_type`, `cohort`, `unique_users`, `pct_of_cohort` |
| Internal Transitions (Q3) | `cohort`, `from_page`, `to_page`, `unique_users`, `total_transitions`, `pct_of_cohort` |
| Pre-Entry Categories (Q4b) | `domain_category`, `cohort`, `unique_users`, `pct_of_cohort` |
| Post-Exit Categories (Q5b) | `domain_category`, `cohort`, `unique_users`, `pct_of_cohort` |
| Mid-Journey Categories (Q6b) | `domain_category`, `cohort`, `unique_users`, `total_visits`, `pct_of_cohort` |
| Full Transitions (Q7) | `cohort`, `from_node`, `to_node`, `unique_users`, `total_transitions`, `pct_of_cohort` |

### Validation rules
- All required columns present → green tick, show row count
- Missing or misnamed columns → red error, list missing columns
- Empty file → red error
- All 7 files uploaded and valid → Tab 2 marked complete, unlock Tab 3

### UX
- Drag-and-drop or click-to-upload per file
- Show filename, row count, and upload timestamp once loaded
- Allow re-upload to replace a file

---

## Tab 3: Configure

### Purpose
Set all project-level configuration. This drives the report header, cohort naming, node classification, and visual treatment.

### Section 1: Report Details

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| Client name | Text | Appears in report brand tag | `Hyundai` |
| Market / subtitle | Text | Appears next to client name | `Germany` |
| Report title | Text | Main H1 of the report | `Customer Journey Flow` |
| Report subtitle | Text | Subtitle below H1 | `Cross-domain transitions · Q1 2026` |
| Data source label | Text | Small tag next to brand | `Insights24 · Journey Analysis` |
| Period | Text | Date range shown in report | `Q1 2026 · January–March` |

### Section 2: Cohort Configuration

Two cohort blocks side by side.

**Cohort A (Converting — default):**
| Field | Type | Description |
|-------|------|-------------|
| Cohort name | Text | Label in toggle and stats. Default: `Converting` |
| Cohort share % | Number | % of total users. Shown in stat card. E.g. `78` |
| Total users (optional) | Number | Raw user count if available |

**Cohort B (Non-Converting — default):**
| Field | Type | Description |
|-------|------|-------------|
| Cohort name | Text | Default: `Non-Converting` |
| Cohort share % | Number | E.g. `22` |
| Total users (optional) | Number | |

### Section 3: Key Stats (per cohort)

Four stat cards displayed in the report header area. Analyst fills in the values.

For each cohort:
| Field | Description | Example |
|-------|-------------|---------|
| Top entry page | Page name | `Model Detail` |
| Top entry page % | % of cohort | `37.4%` |
| Top transition | Transition label | `Model Detail → Configurator` |
| Top transition % | % of cohort | `32.2%` |
| Top exit page | Page name | `Configurator` |
| Top exit page % | % of cohort | `45.7%` |

### Section 4: Node Classification

This section reads all unique node names from the uploaded Q7 transitions file and presents them in a list for tagging.

Three tagging actions per node (multi-select checkboxes):

| Tag | Effect in report |
|-----|-----------------|
| ✅ Client website node | Blue/purple node style, bold label, drives FOBO/return ribbon logic |
| ⭐ Conversion point | Star marker in top-right corner of node |
| ⚠ Competitor | Red node colour, warning marker |

**UX:** Show nodes grouped by layer (auto-detected from Q7 data — nodes that only appear as `from_node` early in journey vs `to_node` late). Allow search/filter. Show a preview chip of how each node will look as the analyst tags it.

### Section 5: Sankey Layout

Column labels for the 5 layout layers. Pre-filled with sensible defaults, analyst can rename.

| Layer | Default label |
|-------|--------------|
| 0 | Pre-[Client] |
| 1 | Discovery |
| 2 | Evaluation |
| 3 | Conversion |
| 4 | Post-[Client] |

The app auto-assigns nodes to layers based on their position in Q7 transitions (longest-path algorithm). Analyst can manually override layer assignment per node via a dropdown.

---

## Tab 4: Insights

### Purpose
Write the key insight bullets that appear below the Sankey in the report.

### Structure
Two panels, one per cohort (tabbed). Each panel has 4 insight boxes.

| Field | Type | Notes |
|-------|------|-------|
| Insight 1–4 | Rich text (basic bold/italic) | Supports `**bold**` markdown |

Character limit per insight: 280 characters.

Below the boxes, a live preview shows how the insights panel will look in the report.

---

## Tab 5: Preview & Export

### Purpose
Preview the full interactive report and export it as a standalone HTML file.

### Preview
Full-width iframe showing the generated report. Updates live as analyst changes config/insights without leaving the tab.

The preview is the exact same HTML that will be exported — what you see is what the client gets.

### Export
Single **Download Report** button.

- Generates a fully self-contained HTML file
- All data baked in as JS variables (no external CSV dependencies)
- All D3.js bundled inline (no CDN dependency — works offline)
- Filename format: `{client_name}_{market}_{period}_journey_report.html`
  Example: `Hyundai_Germany_Q1_2026_journey_report.html`

### Share instructions
Below the export button, a short note:
> "To share this report publicly, drag and drop the downloaded file onto [Netlify Drop](https://app.netlify.com/drop). You'll get a public URL in under 30 seconds."

---

## Generated Report Specification

The exported HTML must exactly match the Sankey report built for Hyundai Germany. Full specification below.

### Layout
Five-column Sankey diagram:
- Column 0: Pre-client external categories
- Column 1: Client discovery pages
- Column 2: Client evaluation pages
- Column 3: Client conversion pages
- Column 4: Post-client external categories

Column headers shown above each column inside the SVG.

### Interactivity
1. **Cohort toggle** — switches between Cohort A and Cohort B
2. **Min. reach slider** — filters links below threshold % of cohort. Range 0–35%, default 5%
3. **Node highlight on click** — clicking a node dims all unconnected flows, highlights only direct connections. Click again or click SVG background to clear. "✕ Clear highlight" button appears in controls when active
4. **Link hover tooltip** — shows `From → To`, `X% of cohort`, and flow type (FOBO / Return)
5. **Node hover tooltip** — shows node name, incoming and outgoing flow count, "Click to highlight" hint

### Node visual treatment

| Node type | Fill opacity | Border width | Border opacity | Label weight |
|-----------|-------------|--------------|----------------|--------------|
| Client node | 0.13 | 2px | 0.85 | 700 |
| Competitor node | 0.07 | 1.5px | 0.55 | 500 |
| Post-client node | 0.10 | 1.5px | 0.55 | 500 |
| Default external | 0.07 | 1.5px | 0.55 | 500 |

Special markers positioned top-right corner of node:
- ⭐ for conversion nodes
- ⚠ (red) for competitor nodes

### Ribbon colours

| Flow type | Colour | Opacity (default) | Opacity (hover/highlight) |
|-----------|--------|-------------------|--------------------------|
| FOBO | `#e74c3c` | 0.40 | 0.85 |
| Return | `#27ae60` | 0.40 | 0.85 |
| Default | `#9b95c9` | 0.13 | 0.52 |

### Stat cards
Four cards per cohort shown above the Sankey:
1. Cohort Share (large number, % of total users)
2. Top Entry Page (label + % of cohort as sub-label)
3. Top Transition (label + % of cohort as sub-label)
4. Top Exit Page (label + % of cohort as sub-label)

### Insights panel
Below the Sankey. Four insight cards per cohort, switching with the cohort toggle. Each card has a cohort label, one paragraph of text with bold support.

### Legend
Horizontal row above the Sankey:
- Hyundai pages (purple node sample)
- External category (grey node sample)
- FOBO — left client site (red line)
- Return — came back (green line)
- Other flow (grey line)
- ⭐ Conversion point
- ⚠ Competitor

---

## Colour System

All colours defined as CSS variables at `:root` level. Use these values exactly.

### Brand / UI colours
```css
--color-bg:           #f4f5f9;   /* page background */
--color-surface:      #ffffff;   /* card background */
--color-border:       #e8e6f5;   /* card borders */
--color-text:         #1a1a2e;   /* primary text */
--color-text-muted:   #9b95c9;   /* labels, captions */
--color-text-sub:     #b0acd0;   /* sub-labels */
--color-accent-light: #f0f0f8;   /* toggle background, input backgrounds */
```

### Cohort A (Converting) — blue-purple
```css
--color-cohort-a:        #4a3f8f;   /* primary */
--color-cohort-a-mid:    #6c63d5;   /* gradient end, links */
--color-cohort-a-light:  #a89df5;   /* light accents */
--color-cohort-a-bg:     #f8f8fd;   /* stat card backgrounds */
```

### Cohort B (Non-Converting) — deep purple
```css
--color-cohort-b:        #6b3fa0;   /* primary */
--color-cohort-b-mid:    #9b59b6;   /* gradient end, links */
--color-cohort-b-bg:     #f8f8fd;   /* stat card backgrounds */
```

### Node colours
```css
--color-node-client:     #4a3f8f;   /* client website nodes */
--color-node-competitor: #c0392b;   /* competitor nodes */
--color-node-post:       #7b68d4;   /* post-client external nodes */
--color-node-external:   #7f8c8d;   /* default external nodes */
```

### Ribbon colours
```css
--color-ribbon-fobo:     #e74c3c;   /* FOBO flows */
--color-ribbon-return:   #27ae60;   /* return flows */
--color-ribbon-default:  #9b95c9;   /* all other flows */
```

### Gradients
```css
/* Cohort A toggle active state */
background: linear-gradient(135deg, #4a3f8f, #6c63d5);
box-shadow: 0 2px 8px rgba(108, 99, 213, 0.3);

/* Cohort B toggle active state */
background: linear-gradient(135deg, #6b3fa0, #9b59b6);
box-shadow: 0 2px 8px rgba(107, 63, 160, 0.3);

/* Brand tag */
background: linear-gradient(135deg, #4a3f8f, #6c63d5);
```

### Typography
```css
font-family: 'Inter', sans-serif;  /* loaded from Google Fonts */

/* Sizes */
--font-title:    20px / 700;   /* report H1 */
--font-subtitle: 11px / 400;   /* uppercase subtitle */
--font-stat:     19px / 700;   /* stat card large value */
--font-stat-sm:  12px / 600;   /* stat card text value */
--font-label:    9px  / 600;   /* uppercase card labels */
--font-node:     10px / varies; /* node labels */
--font-tip:      12px / 400;   /* tooltip */
--font-note:     10px / 400;   /* footnote */
```

### Component styling

**Cards:**
```css
background: #ffffff;
border-radius: 12px;
box-shadow: 0 2px 12px rgba(80, 80, 160, 0.07);
padding: 24px 28px;
margin-bottom: 16px;
```

**Stat cards:**
```css
background: #f8f8fd;
border-left: 3px solid var(--color-cohort-a);  /* or cohort-b */
border-radius: 0 8px 8px 0;
padding: 12px 16px;
```

**Toggle buttons:**
```css
/* Container */
background: #f0f0f8;
border-radius: 8px;
padding: 4px;

/* Inactive */
background: transparent;
color: #9b95c9;

/* Active — see gradients above */
border-radius: 5px;
padding: 7px 18px;
```

**Slider:**
```css
/* Track */
height: 4px;
border-radius: 2px;
background: #e0dff5;

/* Thumb */
width: 15px; height: 15px;
border-radius: 50%;
background: linear-gradient(135deg, #4a3f8f, #6c63d5);
box-shadow: 0 1px 4px rgba(108, 99, 213, 0.3);
```

**Tooltip:**
```css
background: #ffffff;
border: 1px solid #e0dff5;
border-radius: 8px;
padding: 10px 14px;
box-shadow: 0 4px 16px rgba(80, 80, 160, 0.13);
max-width: 240px;
line-height: 1.7;
```

**Insights box:**
```css
background: #f8f8fd;
border: 1px solid #e8e6f5;
border-radius: 10px;
padding: 18px 22px;
```

**Insight card:**
```css
background: #ffffff;
border-left: 3px solid var(--color-cohort-a);  /* or cohort-b */
border-radius: 8px;
padding: 13px 15px;
```

---

## File & Project Structure

```
journey-report-builder/
├── backend/
│   ├── main.py              # FastAPI app, routes
│   ├── models.py            # Pydantic models for project config
│   ├── report_generator.py  # Builds the self-contained HTML output
│   ├── csv_validator.py     # Validates uploaded CSVs
│   └── projects/            # JSON project files (one per project)
│       └── {project_id}.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── tabs/
│   │   │   ├── SQLTab.jsx
│   │   │   ├── UploadTab.jsx
│   │   │   ├── ConfigureTab.jsx
│   │   │   ├── InsightsTab.jsx
│   │   │   └── PreviewTab.jsx
│   │   ├── components/
│   │   │   ├── Sankey.jsx        # D3 Sankey, reused in preview + export
│   │   │   ├── StatCard.jsx
│   │   │   ├── InsightCard.jsx
│   │   │   ├── NodeTagger.jsx    # Node classification UI in Configure tab
│   │   │   └── SQLTemplate.jsx   # Query display + copy button
│   │   └── styles/
│   │       └── theme.css         # CSS variables as defined in Colour System
│   └── public/
├── templates/
│   └── report_template.html  # Base HTML shell for exported report
├── requirements.txt
├── package.json
└── README.md
```

---

## Project State (JSON schema)

Stored as `/backend/projects/{project_id}.json`

```json
{
  "project_id": "uuid",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp",

  "report_details": {
    "client_name": "Hyundai",
    "market": "Germany",
    "report_title": "Customer Journey Flow",
    "report_subtitle": "Cross-domain transitions · Converting vs. Non-Converting · Top flows only",
    "data_source_label": "Insights24 · Journey Analysis · Q1 2026",
    "period": "Q1 2026"
  },

  "cohorts": {
    "a": {
      "name": "Converting",
      "share_pct": 78,
      "total_users": 1580
    },
    "b": {
      "name": "Non-Converting",
      "share_pct": 22,
      "total_users": 441
    }
  },

  "key_stats": {
    "a": {
      "top_entry_page": "Model Detail",
      "top_entry_pct": "37.4%",
      "top_transition": "Model Detail → Configurator",
      "top_transition_pct": "32.2%",
      "top_exit_page": "Configurator",
      "top_exit_pct": "45.7%"
    },
    "b": {
      "top_entry_page": "Model Detail",
      "top_entry_pct": "37.0%",
      "top_transition": "Models Overview → Model Detail",
      "top_transition_pct": "14.5%",
      "top_exit_page": "Model Detail",
      "top_exit_pct": "37.4%"
    }
  },

  "node_config": {
    "client_nodes": ["HY: Homepage", "HY: Model Detail", "HY: Configurator"],
    "conversion_nodes": ["HY: Configurator", "HY: Quote / Angebot", "HY: Test Drive"],
    "competitor_nodes": ["Competitors"]
  },

  "column_labels": {
    "0": "Pre-Hyundai",
    "1": "Discovery",
    "2": "Evaluation",
    "3": "Conversion",
    "4": "Post-Hyundai"
  },

  "insights": {
    "a": [
      "Insight 1 text...",
      "Insight 2 text...",
      "Insight 3 text...",
      "Insight 4 text..."
    ],
    "b": [
      "Insight 1 text...",
      "Insight 2 text...",
      "Insight 3 text...",
      "Insight 4 text..."
    ]
  },

  "uploaded_files": {
    "entry_paths": "filename.csv",
    "exit_paths": "filename.csv",
    "internal_transitions": "filename.csv",
    "pre_entry": "filename.csv",
    "post_exit": "filename.csv",
    "mid_journey": "filename.csv",
    "full_transitions": "filename.csv"
  }
}
```

---

## README (to include in repo)

```markdown
# Journey Analytics Report Builder

A local web app for generating interactive customer journey Sankey reports from BigQuery data.

## Setup

### Requirements
- Python 3.11+
- Node.js 18+

### Install

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Run

```bash
# Terminal 1 — backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

1. Go to the **SQL Queries** tab — copy templates, fill placeholders, run in BigQuery
2. For the raw domain queries (Q4a, Q5a, Q6a) — review results with Claude to define your taxonomy before running the categorised versions
3. Export CSVs from BigQuery and upload in the **Upload Data** tab
4. Configure report details and tag nodes in the **Configure** tab
5. Write insights in the **Insights** tab
6. Preview and download the report in the **Preview & Export** tab
7. Share the downloaded HTML via Netlify Drop or any file sharing tool

## v2 Roadmap
- Direct BigQuery connection (replace manual CSV export)
- Netlify API integration for one-click public link generation
- Multi-project dashboard
- Report versioning
```

---

## v1 Scope Boundaries

**In scope:**
- All 5 tabs as described
- 7 CSV upload and validation
- Full Sankey report generation matching Hyundai Germany design
- Node highlight interaction
- Threshold slider
- Cohort toggle
- Project state saved to disk as JSON
- Downloaded HTML is fully self-contained (no CDN, no external dependencies)

**Out of scope for v1:**
- BigQuery direct connection
- Netlify/hosting integration
- Multi-user access
- Authentication
- Report versioning or history
- Multiple projects open simultaneously
- Mobile responsive design (desktop only)
