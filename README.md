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

## Project structure

```
journey-report-builder/
├── backend/
│   ├── main.py              # FastAPI app, routes
│   ├── models.py            # Pydantic models for project config
│   ├── report_generator.py  # Builds the self-contained HTML output
│   ├── csv_validator.py     # Validates uploaded CSVs
│   └── projects/            # JSON project files (one per project)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── tabs/
│   │   │   ├── SQLTab.jsx
│   │   │   ├── UploadTab.jsx
│   │   │   ├── ConfigureTab.jsx
│   │   │   ├── InsightsTab.jsx
│   │   │   └── PreviewTab.jsx
│   │   └── styles/
│   │       └── theme.css
│   └── public/
└── README.md
```

## v2 Roadmap
- Direct BigQuery connection (replace manual CSV export)
- Netlify API integration for one-click public link generation
- Multi-project dashboard
- Report versioning
