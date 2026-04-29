from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class ReportDetails(BaseModel):
    client_name: str = "Client"
    market: str = ""
    report_title: str = "Customer Journey Flow"
    report_subtitle: str = "Cross-domain transitions"
    data_source_label: str = ""
    period: str = ""


class CohortConfig(BaseModel):
    name: str
    share_pct: Optional[float] = None
    total_users: Optional[int] = None


class CohortsConfig(BaseModel):
    a: CohortConfig = Field(default_factory=lambda: CohortConfig(name="Converting"))
    b: CohortConfig = Field(default_factory=lambda: CohortConfig(name="Non-Converting"))


class KeyStats(BaseModel):
    top_entry_page: str = ""
    top_entry_pct: str = ""
    top_transition: str = ""
    top_transition_pct: str = ""
    top_exit_page: str = ""
    top_exit_pct: str = ""


class KeyStatsConfig(BaseModel):
    a: KeyStats = Field(default_factory=KeyStats)
    b: KeyStats = Field(default_factory=KeyStats)


class NodeConfig(BaseModel):
    client_nodes: list[str] = Field(default_factory=list)
    conversion_nodes: list[str] = Field(default_factory=list)
    competitor_nodes: list[str] = Field(default_factory=list)
    key_nodes: list[str] = Field(default_factory=list)


class ColumnLabels(BaseModel):
    col0: str = "Pre-Client"
    col1: str = "Discovery"
    col2: str = "Evaluation"
    col3: str = "Conversion"
    col4: str = "Post-Client"


class NodeLayerOverride(BaseModel):
    node_id: str
    layer: int


class InsightsConfig(BaseModel):
    a: list[str] = Field(default_factory=lambda: ["", "", "", ""])
    b: list[str] = Field(default_factory=lambda: ["", "", "", ""])


class UploadedFiles(BaseModel):
    entry_paths: Optional[str] = None
    exit_paths: Optional[str] = None
    internal_transitions: Optional[str] = None
    pre_entry: Optional[str] = None
    post_exit: Optional[str] = None
    mid_journey: Optional[str] = None
    full_transitions: Optional[str] = None


class ProjectConfig(BaseModel):
    project_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    report_details: ReportDetails = Field(default_factory=ReportDetails)
    cohorts: CohortsConfig = Field(default_factory=CohortsConfig)
    key_stats: KeyStatsConfig = Field(default_factory=KeyStatsConfig)
    node_config: NodeConfig = Field(default_factory=NodeConfig)
    column_labels: ColumnLabels = Field(default_factory=ColumnLabels)
    node_layer_overrides: list[NodeLayerOverride] = Field(default_factory=list)
    insights: InsightsConfig = Field(default_factory=InsightsConfig)
    uploaded_files: UploadedFiles = Field(default_factory=UploadedFiles)


class UpdateProjectRequest(BaseModel):
    report_details: Optional[ReportDetails] = None
    cohorts: Optional[CohortsConfig] = None
    key_stats: Optional[KeyStatsConfig] = None
    node_config: Optional[NodeConfig] = None
    column_labels: Optional[ColumnLabels] = None
    node_layer_overrides: Optional[list[NodeLayerOverride]] = None
    insights: Optional[InsightsConfig] = None
