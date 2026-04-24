import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response

from models import ProjectConfig, UpdateProjectRequest
from csv_validator import validate_csv, parse_csv_to_records, FILE_SCHEMAS
from report_generator import generate_report

PROJECTS_DIR = Path(__file__).parent / "projects"
DATA_DIR = Path(__file__).parent / "data"
PROJECTS_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Journey Report Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _project_path(project_id: str) -> Path:
    return PROJECTS_DIR / f"{project_id}.json"


def _data_dir(project_id: str) -> Path:
    d = DATA_DIR / project_id
    d.mkdir(exist_ok=True)
    return d


def _load_project(project_id: str) -> ProjectConfig:
    path = _project_path(project_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectConfig(**json.loads(path.read_text()))


def _save_project(project: ProjectConfig) -> None:
    project.updated_at = datetime.utcnow().isoformat()
    _project_path(project.project_id).write_text(
        project.model_dump_json(indent=2)
    )


# ── Project CRUD ──────────────────────────────────────────────────────────────

@app.post("/api/projects", response_model=ProjectConfig)
def create_project():
    project = ProjectConfig()
    _save_project(project)
    return project


@app.get("/api/projects")
def list_projects():
    projects = []
    for p in sorted(PROJECTS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(p.read_text())
            projects.append({
                "project_id": data["project_id"],
                "client_name": data.get("report_details", {}).get("client_name", ""),
                "market": data.get("report_details", {}).get("market", ""),
                "updated_at": data.get("updated_at", ""),
            })
        except Exception:
            pass
    return projects


@app.get("/api/projects/{project_id}", response_model=ProjectConfig)
def get_project(project_id: str):
    return _load_project(project_id)


@app.put("/api/projects/{project_id}", response_model=ProjectConfig)
def update_project(project_id: str, body: UpdateProjectRequest):
    project = _load_project(project_id)
    if body.report_details is not None:
        project.report_details = body.report_details
    if body.cohorts is not None:
        project.cohorts = body.cohorts
    if body.key_stats is not None:
        project.key_stats = body.key_stats
    if body.node_config is not None:
        project.node_config = body.node_config
    if body.column_labels is not None:
        project.column_labels = body.column_labels
    if body.node_layer_overrides is not None:
        project.node_layer_overrides = body.node_layer_overrides
    if body.insights is not None:
        project.insights = body.insights
    _save_project(project)
    return project


# ── File Upload ───────────────────────────────────────────────────────────────

@app.post("/api/projects/{project_id}/upload/{file_type}")
async def upload_file(project_id: str, file_type: str, file: UploadFile = File(...)):
    if file_type not in FILE_SCHEMAS:
        raise HTTPException(status_code=400, detail=f"Unknown file type: {file_type}")

    project = _load_project(project_id)
    content = await file.read()

    result = validate_csv(file_type, content)
    if not result["valid"]:
        raise HTTPException(status_code=422, detail=result["error"])

    # Save raw CSV
    dest = _data_dir(project_id) / f"{file_type}.csv"
    dest.write_bytes(content)

    # Update uploaded_files record
    setattr(project.uploaded_files, file_type, file.filename)
    _save_project(project)

    return {
        "file_type": file_type,
        "filename": file.filename,
        "row_count": result["row_count"],
        "columns": result["columns"],
        "uploaded_at": datetime.utcnow().isoformat(),
    }


@app.get("/api/projects/{project_id}/files/{file_type}/info")
def get_file_info(project_id: str, file_type: str):
    project = _load_project(project_id)
    filename = getattr(project.uploaded_files, file_type, None)
    if not filename:
        raise HTTPException(status_code=404, detail="File not uploaded")

    path = _data_dir(project_id) / f"{file_type}.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File data missing")

    result = validate_csv(file_type, path.read_bytes())
    return {
        "filename": filename,
        "row_count": result.get("row_count", 0),
        "columns": result.get("columns", []),
    }


# ── Node discovery ────────────────────────────────────────────────────────────

@app.get("/api/projects/{project_id}/nodes")
def get_nodes(project_id: str):
    path = _data_dir(project_id) / "full_transitions.csv"
    if not path.exists():
        return {"nodes": []}

    records = parse_csv_to_records(path.read_bytes())
    node_set = set()
    for r in records:
        if r.get("from_node"):
            node_set.add(str(r["from_node"]))
        if r.get("to_node"):
            node_set.add(str(r["to_node"]))

    return {"nodes": sorted(node_set)}


# ── Report generation ─────────────────────────────────────────────────────────

def _load_csv_data(project_id: str) -> dict:
    data = {}
    for file_type in FILE_SCHEMAS:
        path = _data_dir(project_id) / f"{file_type}.csv"
        if path.exists():
            try:
                data[file_type] = parse_csv_to_records(path.read_bytes())
            except Exception:
                data[file_type] = []
        else:
            data[file_type] = []
    return data


@app.get("/api/projects/{project_id}/preview", response_class=HTMLResponse)
def preview_report(project_id: str):
    project = _load_project(project_id)
    csv_data = _load_csv_data(project_id)
    html = generate_report(project, csv_data)
    return HTMLResponse(content=html)


@app.get("/api/projects/{project_id}/export")
def export_report(project_id: str):
    project = _load_project(project_id)
    csv_data = _load_csv_data(project_id)
    html = generate_report(project, csv_data)

    rd = project.report_details
    parts = [rd.client_name, rd.market, rd.period.replace(" ", "_"), "journey_report"]
    filename = "_".join(p for p in parts if p) + ".html"
    filename = filename.replace(" ", "_").replace("·", "").replace("/", "-")

    return Response(
        content=html.encode("utf-8"),
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
