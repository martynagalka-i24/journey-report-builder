"""Generates a fully self-contained interactive Sankey HTML report."""

import json
from models import ProjectConfig


def _assign_layers_from_files(csv_data: dict) -> dict[str, int]:
    """
    Assign Sankey layers based on which uploaded file each node appears in.

    Layer 0 — pre_entry domain_categories      (external, before first client touch)
    Layer 1 — entry_paths page_types           (client discovery pages)
    Layer 2 — internal_transitions page_types  (client evaluation pages, not entry/exit)
    Layer 3 — exit_paths page_types            (client conversion/exit pages)
    Layer 4 — post_exit domain_categories      (external, after last client touch)

    Mid-journey external → layer 0 (external bounce during journey).
    Nodes in multiple files → most specific assignment wins (entry > exit > internal > external).
    """
    entry_nodes: set[str] = set()
    exit_nodes: set[str] = set()
    internal_nodes: set[str] = set()
    pre_entry_nodes: set[str] = set()
    post_exit_nodes: set[str] = set()
    mid_journey_nodes: set[str] = set()

    for r in csv_data.get("entry_paths", []):
        if r.get("page_type"):
            entry_nodes.add(str(r["page_type"]))

    for r in csv_data.get("exit_paths", []):
        if r.get("page_type"):
            exit_nodes.add(str(r["page_type"]))

    for r in csv_data.get("internal_transitions", []):
        for col in ("from_page", "to_page"):
            if r.get(col):
                internal_nodes.add(str(r[col]))

    for r in csv_data.get("pre_entry", []):
        if r.get("domain_category"):
            pre_entry_nodes.add(str(r["domain_category"]))

    for r in csv_data.get("post_exit", []):
        if r.get("domain_category"):
            post_exit_nodes.add(str(r["domain_category"]))

    for r in csv_data.get("mid_journey", []):
        if r.get("domain_category"):
            mid_journey_nodes.add(str(r["domain_category"]))

    # Collect all nodes from full_transitions
    all_nodes: set[str] = set()
    for r in csv_data.get("full_transitions", []):
        if r.get("from_node"):
            all_nodes.add(str(r["from_node"]))
        if r.get("to_node"):
            all_nodes.add(str(r["to_node"]))

    layer_map: dict[str, int] = {}
    for node in all_nodes:
        if node in entry_nodes and node not in exit_nodes:
            layer_map[node] = 1
        elif node in exit_nodes and node not in entry_nodes:
            layer_map[node] = 3
        elif node in entry_nodes and node in exit_nodes:
            # appears as both entry and exit — mid evaluation layer
            layer_map[node] = 2
        elif node in internal_nodes:
            layer_map[node] = 2
        elif node in post_exit_nodes:
            layer_map[node] = 4
        elif node in pre_entry_nodes or node in mid_journey_nodes:
            layer_map[node] = 0
        else:
            layer_map[node] = 0  # unknown external → layer 0

    return layer_map


def _get_ribbon_type(from_node: str, to_node: str, client_nodes: list[str], fobo_nodes: set) -> str:
    src_is_client = from_node in client_nodes
    tgt_is_client = to_node in client_nodes
    if from_node in fobo_nodes and not tgt_is_client:
        return "fobo"
    if not src_is_client and to_node in fobo_nodes:
        return "return"
    return "default"


def generate_report(project: ProjectConfig, csv_data: dict) -> str:
    rd = project.report_details
    cohorts = project.cohorts
    key_stats = project.key_stats
    node_cfg = project.node_config
    col_labels = project.column_labels
    insights = project.insights

    full_transitions = csv_data.get("full_transitions", [])

    # Build layer map from uploaded files, then apply manual overrides
    auto_layers = _assign_layers_from_files(csv_data)
    override_map = {o.node_id: o.layer for o in project.node_layer_overrides}
    layer_map = {**auto_layers, **override_map}

    # Client-tagged nodes must never sit in external layers (0 or 4)
    client_nodes_set = set(node_cfg.client_nodes)
    for node, layer in list(layer_map.items()):
        if node in client_nodes_set and layer in (0, 4):
            layer_map[node] = 2

    # Conversion-tagged nodes always go to layer 3 (the conversion column)
    for node in node_cfg.conversion_nodes:
        if node in layer_map:
            layer_map[node] = 3

    # Collect unique nodes from transitions
    all_nodes_set = set()
    for r in full_transitions:
        if r.get("from_node"):
            all_nodes_set.add(str(r["from_node"]))
        if r.get("to_node"):
            all_nodes_set.add(str(r["to_node"]))

    # Build nodes list for JS
    nodes_js = []
    for nid in sorted(all_nodes_set):
        layer = layer_map.get(nid, 2)
        node_type = "external"
        if nid in node_cfg.client_nodes:
            node_type = "client"
        if nid in node_cfg.competitor_nodes:
            node_type = "competitor"
        nodes_js.append({
            "id": nid,
            "layer": layer,
            "type": node_type,
            "isConversion": nid in node_cfg.conversion_nodes,
            "isCompetitor": nid in node_cfg.competitor_nodes,
        })

    # FOBO/Return triggers only for conversion-tagged and key-tagged nodes
    fobo_nodes = set(node_cfg.conversion_nodes) | set(node_cfg.key_nodes)

    # Build links list for JS (one entry per cohort)
    links_js = []
    for r in full_transitions:
        from_node = str(r.get("from_node", ""))
        to_node = str(r.get("to_node", ""))
        if not from_node or not to_node:
            continue
        links_js.append({
            "source": from_node,
            "target": to_node,
            "cohort": str(r.get("cohort", "")),
            "value": float(r.get("unique_users", 0)),
            "pct": float(r.get("pct_of_cohort", 0)),
            "ribbonType": _get_ribbon_type(from_node, to_node, node_cfg.client_nodes, fobo_nodes),
        })

    report_data = {
        "reportDetails": {
            "clientName": rd.client_name,
            "market": rd.market,
            "reportTitle": rd.report_title,
            "reportSubtitle": rd.report_subtitle,
            "dataSourceLabel": rd.data_source_label,
            "period": rd.period,
        },
        "cohorts": {
            "a": {"name": cohorts.a.name, "sharePct": cohorts.a.share_pct, "totalUsers": cohorts.a.total_users},
            "b": {"name": cohorts.b.name, "sharePct": cohorts.b.share_pct, "totalUsers": cohorts.b.total_users},
        },
        "keyStats": {
            "a": key_stats.a.model_dump(),
            "b": key_stats.b.model_dump(),
        },
        "columnLabels": {
            "0": col_labels.col0,
            "1": col_labels.col1,
            "2": col_labels.col2,
            "3": col_labels.col3,
            "4": col_labels.col4,
        },
        "insights": {"a": insights.a, "b": insights.b},
        "nodes": nodes_js,
        "links": links_js,
    }

    data_json = json.dumps(report_data, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{rd.client_name} {rd.market} — {rd.report_title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {{
  --color-bg:           #f4f5f9;
  --color-surface:      #ffffff;
  --color-border:       #e8e6f5;
  --color-text:         #1a1a2e;
  --color-text-muted:   #9b95c9;
  --color-text-sub:     #b0acd0;
  --color-accent-light: #f0f0f8;
  --color-cohort-a:        #4a3f8f;
  --color-cohort-a-mid:    #6c63d5;
  --color-cohort-a-light:  #a89df5;
  --color-cohort-a-bg:     #f8f8fd;
  --color-cohort-b:        #6b3fa0;
  --color-cohort-b-mid:    #9b59b6;
  --color-cohort-b-bg:     #f8f8fd;
  --color-node-client:     #4a3f8f;
  --color-node-competitor: #c0392b;
  --color-node-post:       #7b68d4;
  --color-node-external:   #7f8c8d;
  --color-ribbon-fobo:     #e74c3c;
  --color-ribbon-return:   #27ae60;
  --color-ribbon-default:  #9b95c9;
}}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{
  font-family: 'Inter', sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  min-height: 100vh;
  padding: 24px;
}}
.report-container {{
  max-width: 1100px;
  margin: 0 auto;
}}
/* Header */
.report-header {{
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(80,80,160,0.07);
  padding: 24px 28px;
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}}
.brand-tag {{
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #4a3f8f, #6c63d5);
  color: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
}}
.report-title {{ font-size: 20px; font-weight: 700; color: var(--color-text); margin-bottom: 4px; }}
.report-subtitle {{ font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }}
/* Stats */
.stats-row {{
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}}
.stat-card {{
  background: #f8f8fd;
  border-left: 3px solid var(--color-cohort-a);
  border-radius: 0 8px 8px 0;
  padding: 12px 16px;
  transition: border-color 0.2s;
}}
.stat-card.cohort-b {{ border-left-color: var(--color-cohort-b); }}
.stat-label {{
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}}
.stat-value {{ font-size: 19px; font-weight: 700; color: var(--color-text); }}
.stat-sub {{ font-size: 12px; font-weight: 600; color: var(--color-text-muted); margin-top: 2px; }}
/* Controls */
.controls-card {{
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(80,80,160,0.07);
  padding: 16px 28px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 28px;
  flex-wrap: wrap;
}}
.toggle-group {{ display: flex; align-items: center; gap: 8px; }}
.toggle-label {{ font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }}
.toggle-container {{
  background: #f0f0f8;
  border-radius: 8px;
  padding: 4px;
  display: flex;
  gap: 2px;
}}
.toggle-btn {{
  border: none;
  background: transparent;
  color: #9b95c9;
  border-radius: 5px;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
  font-family: 'Inter', sans-serif;
}}
.toggle-btn.active-a {{
  background: linear-gradient(135deg, #4a3f8f, #6c63d5);
  color: #fff;
  box-shadow: 0 2px 8px rgba(108,99,213,0.3);
}}
.toggle-btn.active-b {{
  background: linear-gradient(135deg, #6b3fa0, #9b59b6);
  color: #fff;
  box-shadow: 0 2px 8px rgba(107,63,160,0.3);
}}
.slider-group {{ display: flex; align-items: center; gap: 12px; flex: 1; }}
.slider-label-text {{ font-size: 11px; font-weight: 600; color: var(--color-text-muted); white-space: nowrap; text-transform: uppercase; letter-spacing: 0.08em; }}
input[type=range] {{
  -webkit-appearance: none;
  width: 160px;
  height: 4px;
  border-radius: 2px;
  background: #e0dff5;
  outline: none;
  cursor: pointer;
}}
input[type=range]::-webkit-slider-thumb {{
  -webkit-appearance: none;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a3f8f, #6c63d5);
  box-shadow: 0 1px 4px rgba(108,99,213,0.3);
  cursor: pointer;
}}
.slider-value {{ font-size: 12px; font-weight: 600; color: var(--color-cohort-a-mid); min-width: 36px; }}
.clear-btn {{
  border: 1px solid #e0dff5;
  background: #fff;
  color: var(--color-text-muted);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  display: none;
  font-family: 'Inter', sans-serif;
}}
.clear-btn.visible {{ display: inline-block; }}
/* Sankey card */
.sankey-card {{
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(80,80,160,0.07);
  padding: 24px 28px;
  margin-bottom: 16px;
  overflow-x: auto;
}}
/* Legend */
.legend {{
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}}
.legend-item {{
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-muted);
}}
.legend-node {{
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border-width: 2px;
  border-style: solid;
}}
.legend-line {{
  width: 20px;
  height: 3px;
  border-radius: 2px;
}}
/* Tooltip */
#tooltip {{
  position: fixed;
  background: #ffffff;
  border: 1px solid #e0dff5;
  border-radius: 8px;
  padding: 10px 14px;
  box-shadow: 0 4px 16px rgba(80,80,160,0.13);
  max-width: 320px;
  line-height: 1.7;
  font-size: 12px;
  pointer-events: none;
  z-index: 9999;
  display: none;
  color: var(--color-text);
}}
#tooltip .tip-title {{ font-weight: 600; margin-bottom: 2px; }}
#tooltip .tip-sub {{ color: var(--color-text-muted); font-size: 11px; }}
#tooltip .tip-badge {{
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  margin-top: 4px;
  letter-spacing: 0.04em;
}}
#tooltip .badge-fobo {{ background: #fdecea; color: #c0392b; }}
#tooltip .badge-return {{ background: #eafaf1; color: #27ae60; }}
/* Insights */
.insights-card {{
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(80,80,160,0.07);
  padding: 24px 28px;
  margin-bottom: 16px;
}}
.insights-inner {{
  background: #f8f8fd;
  border: 1px solid #e8e6f5;
  border-radius: 10px;
  padding: 18px 22px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}}
.insight-item {{
  background: #ffffff;
  border-left: 3px solid var(--color-cohort-a);
  border-radius: 8px;
  padding: 13px 15px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text);
}}
.insight-item.cohort-b {{ border-left-color: var(--color-cohort-b); }}
.insight-cohort-label {{
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}}
.section-title {{
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  margin-bottom: 14px;
}}
/* SVG nodes */
.node-rect {{ cursor: pointer; }}
.node-rect:hover {{ opacity: 0.9; }}
.node-label {{ pointer-events: none; }}
.link-path {{ cursor: pointer; }}
</style>
</head>
<body>
<div class="report-container">

  <!-- Header -->
  <div class="report-header">
    <div>
      <div class="brand-tag" id="brandTag"></div>
      <div class="report-title" id="reportTitle"></div>
      <div class="report-subtitle" id="reportSubtitle"></div>
    </div>
    <div style="text-align:right; flex-shrink:0;">
      <div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px;" id="dataSourceLabel"></div>
      <div style="font-size:11px;color:var(--color-text-sub);" id="periodLabel"></div>
    </div>
  </div>

  <!-- Stat cards -->
  <div class="stats-row" id="statsRow"></div>

  <!-- Controls -->
  <div class="controls-card">
    <div class="toggle-group">
      <span class="toggle-label">Cohort</span>
      <div class="toggle-container">
        <button class="toggle-btn" id="btnA" onclick="setCohort('a')"></button>
        <button class="toggle-btn" id="btnB" onclick="setCohort('b')"></button>
      </div>
    </div>
    <div class="slider-group">
      <span class="slider-label-text">Min. Reach</span>
      <input type="range" id="thresholdSlider" min="0" max="5" step="0.1" value="0.3" oninput="onSlider(this.value)">
      <span class="slider-value" id="sliderVal">0.3%</span>
    </div>
    <button class="clear-btn" id="clearBtn" onclick="clearHighlight()">✕ Clear highlight</button>
  </div>

  <!-- Sankey -->
  <div class="sankey-card">
    <!-- Legend -->
    <div class="legend">
      <div class="legend-item">
        <div class="legend-node" style="background:rgba(74,63,143,0.13);border-color:rgba(74,63,143,0.85);"></div>
        <span id="legendClientLabel">Client pages</span>
      </div>
      <div class="legend-item">
        <div class="legend-node" style="background:rgba(127,140,141,0.07);border-color:rgba(127,140,141,0.55);"></div>
        <span>External category</span>
      </div>
      <div class="legend-item">
        <div class="legend-line" style="background:#e74c3c;"></div>
        <span>FOBO — left client site</span>
      </div>
      <div class="legend-item">
        <div class="legend-line" style="background:#27ae60;"></div>
        <span>Return — came back</span>
      </div>
      <div class="legend-item">
        <div class="legend-line" style="background:#9b95c9;"></div>
        <span>Other flow</span>
      </div>
      <div class="legend-item"><span>⭐ Conversion point</span></div>
      <div class="legend-item"><span>⚠ Competitor</span></div>
    </div>
    <svg id="sankeysvg" style="width:100%;display:block;"></svg>
  </div>

  <!-- Insights -->
  <div class="insights-card" id="insightsCard"></div>

</div>

<div id="tooltip"></div>

<script>
const DATA = {data_json};

let currentCohort = 'a';
let threshold = 0.3;
let highlightedNode = null;

function setCohort(c) {{
  currentCohort = c;
  document.getElementById('btnA').className = 'toggle-btn' + (c==='a' ? ' active-a' : '');
  document.getElementById('btnB').className = 'toggle-btn' + (c==='b' ? ' active-b' : '');
  highlightedNode = null;
  document.getElementById('clearBtn').classList.remove('visible');
  renderAll();
}}

function onSlider(v) {{
  threshold = parseFloat(v);
  document.getElementById('sliderVal').textContent = threshold + '%';
  renderAll();
}}

function clearHighlight() {{
  highlightedNode = null;
  document.getElementById('clearBtn').classList.remove('visible');
  renderAll();
}}

function renderAll() {{
  renderStats();
  renderSankey();
  renderInsights();
}}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats() {{
  const c = currentCohort;
  const cohort = DATA.cohorts[c];
  const stats = DATA.keyStats[c];
  const isA = c === 'a';
  const cls = isA ? '' : ' cohort-b';

  const cards = [
    {{ label: 'Cohort Share', value: cohort.sharePct != null ? cohort.sharePct + '%' : '—', sub: cohort.name }},
    {{ label: 'Top Entry Page', value: stats.top_entry_page || '—', sub: stats.top_entry_pct || '' }},
    {{ label: 'Top Transition', value: stats.top_transition || '—', sub: stats.top_transition_pct || '' }},
    {{ label: 'Top Exit Page', value: stats.top_exit_page || '—', sub: stats.top_exit_pct || '' }},
  ];

  document.getElementById('statsRow').innerHTML = cards.map(card => `
    <div class="stat-card${{cls}}">
      <div class="stat-label">${{card.label}}</div>
      <div class="stat-value">${{card.value}}</div>
      ${{card.sub ? `<div class="stat-sub">${{card.sub}}</div>` : ''}}
    </div>
  `).join('');
}}

// ── Insights ───────────────────────────────────────────────────────────────
function renderInsights() {{
  const c = currentCohort;
  const cohortName = DATA.cohorts[c].name;
  const insightList = DATA.insights[c] || [];
  const isA = c === 'a';
  const cls = isA ? '' : ' cohort-b';
  const borderColor = isA ? 'var(--color-cohort-a)' : 'var(--color-cohort-b)';

  const items = insightList.filter(s => s && s.trim()).map(text => `
    <div class="insight-item${{cls}}">
      <div class="insight-cohort-label">${{cohortName}}</div>
      <div>${{renderMarkdown(text)}}</div>
    </div>
  `).join('');

  document.getElementById('insightsCard').innerHTML = `
    <div class="section-title">Key Insights — ${{cohortName}}</div>
    <div class="insights-inner">${{items || '<div style="color:var(--color-text-muted);font-size:13px;">No insights added yet.</div>'}}</div>
  `;
}}

function renderMarkdown(text) {{
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}}

// ── Sankey ─────────────────────────────────────────────────────────────────
function computeLayout(nodes, links, W, H) {{
  const NODE_W = 110;
  const NODE_PAD = 10;
  const NUM_LAYERS = 5;
  const COL_GAP = (W - NODE_W) / (NUM_LAYERS - 1);
  const MARGIN_TOP = 40;
  const USABLE_H = H - MARGIN_TOP - 20;

  // Assign x
  nodes.forEach(n => {{
    n.x0 = n.layer * COL_GAP;
    n.x1 = n.x0 + NODE_W;
  }});

  // Compute node values
  const nodeMap = {{}};
  nodes.forEach(n => {{ nodeMap[n.id] = n; n.inValue = 0; n.outValue = 0; }});
  links.forEach(l => {{
    if (nodeMap[l.source]) nodeMap[l.source].outValue += l.value;
    if (nodeMap[l.target]) nodeMap[l.target].inValue += l.value;
  }});
  nodes.forEach(n => {{ n.value = Math.max(n.inValue, n.outValue) || 1; }});

  // Group by layer
  const byLayer = {{}};
  nodes.forEach(n => {{
    if (!byLayer[n.layer]) byLayer[n.layer] = [];
    byLayer[n.layer].push(n);
  }});

  // Proportional column heights: the column with the most total flow fills USABLE_H;
  // sparse columns scale down so their nodes don't stretch unnecessarily.
  const layerTotals = {{}};
  for (let lay = 0; lay < NUM_LAYERS; lay++) {{
    const ln = byLayer[lay] || [];
    layerTotals[lay] = ln.reduce((s, n) => s + n.value, 0);
  }}
  const maxLayerTotal = Math.max(...Object.values(layerTotals).filter(v => v > 0), 1);

  // Assign y per layer
  for (let layer = 0; layer < NUM_LAYERS; layer++) {{
    const layerNodes = byLayer[layer] || [];
    if (!layerNodes.length) continue;
    layerNodes.sort((a, b) => b.value - a.value);

    const totalPad = NODE_PAD * (layerNodes.length - 1);
    const layerFraction = layerTotals[layer] / maxLayerTotal;
    const allocated = Math.max(layerNodes.length * 30 + totalPad, layerFraction * USABLE_H);
    const available = allocated - totalPad;
    const totalVal = layerTotals[layer];

    layerNodes.forEach(n => {{
      n.height = Math.max(24, (n.value / totalVal) * available);
    }});

    const totalH = layerNodes.reduce((s, n) => s + n.height, 0);
    if (totalH > USABLE_H - totalPad) {{
      const scale = (USABLE_H - totalPad) / totalH;
      layerNodes.forEach(n => {{ n.height = Math.max(24, n.height * scale); }});
    }}

    const realTotal = layerNodes.reduce((s, n) => s + n.height, 0) + totalPad;
    let y = MARGIN_TOP + (USABLE_H - realTotal) / 2;
    layerNodes.forEach(n => {{
      n.y0 = y;
      n.y1 = y + n.height;
      y += n.height + NODE_PAD;
    }});
  }}

  // Assign link offsets
  nodes.forEach(n => {{
    const outgoing = links.filter(l => l.source === n.id);
    outgoing.sort((a, b) => {{
      const ya = nodeMap[a.target] ? (nodeMap[a.target].y0 + nodeMap[a.target].y1) / 2 : 0;
      const yb = nodeMap[b.target] ? (nodeMap[b.target].y0 + nodeMap[b.target].y1) / 2 : 0;
      return ya - yb;
    }});
    const totalOut = outgoing.reduce((s, l) => s + l.value, 0);
    let sy = n.y0;
    outgoing.forEach(l => {{
      const lh = totalOut > 0 ? (l.value / totalOut) * n.height : n.height / outgoing.length;
      l.sy0 = sy; l.sy1 = sy + lh;
      sy += lh;
    }});

    const incoming = links.filter(l => l.target === n.id);
    incoming.sort((a, b) => {{
      const ya = nodeMap[a.source] ? (nodeMap[a.source].y0 + nodeMap[a.source].y1) / 2 : 0;
      const yb = nodeMap[b.source] ? (nodeMap[b.source].y0 + nodeMap[b.source].y1) / 2 : 0;
      return ya - yb;
    }});
    const totalIn = incoming.reduce((s, l) => s + l.value, 0);
    let ty = n.y0;
    incoming.forEach(l => {{
      const lh = totalIn > 0 ? (l.value / totalIn) * n.height : n.height / incoming.length;
      l.ty0 = ty; l.ty1 = ty + lh;
      ty += lh;
    }});
  }});

  return nodeMap;
}}

function ribbonPath(l, nodeMap) {{
  const s = nodeMap[l.source];
  const t = nodeMap[l.target];
  if (!s || !t) return '';
  const x0 = s.x1, x1 = t.x0;
  const xi = (x0 + x1) / 2;
  const sy0 = l.sy0 ?? (s.y0 + s.y1) / 2;
  const sy1 = l.sy1 ?? sy0 + 2;
  const ty0 = l.ty0 ?? (t.y0 + t.y1) / 2;
  const ty1 = l.ty1 ?? ty0 + 2;
  return [
    `M ${{x0}} ${{sy0}}`,
    `C ${{xi}} ${{sy0}}, ${{xi}} ${{ty0}}, ${{x1}} ${{ty0}}`,
    `L ${{x1}} ${{ty1}}`,
    `C ${{xi}} ${{ty1}}, ${{xi}} ${{sy1}}, ${{x0}} ${{sy1}}`,
    'Z'
  ].join(' ');
}}

function nodeColor(node) {{
  if (node.type === 'client') return '#4a3f8f';
  if (node.type === 'competitor') return '#c0392b';
  return '#7f8c8d';
}}

function nodeFillOpacity(node) {{
  if (node.type === 'client') return 0.13;
  if (node.type === 'competitor') return 0.07;
  return 0.07;
}}

function nodeBorderOpacity(node) {{
  if (node.type === 'client') return 0.85;
  return 0.55;
}}

function nodeBorderWidth(node) {{
  return node.type === 'client' ? 2 : 1.5;
}}

function nodeLabelWeight(node) {{
  return node.type === 'client' ? 700 : 500;
}}

function ribbonColor(type) {{
  if (type === 'fobo') return '#e74c3c';
  if (type === 'return') return '#27ae60';
  return '#9b95c9';
}}

function ribbonOpacity(type) {{
  if (type === 'fobo' || type === 'return') return 0.4;
  return 0.13;
}}

function renderSankey() {{
  const svg = document.getElementById('sankeysvg');
  const W = svg.parentElement.clientWidth - 56;
  const rawNodes = DATA.nodes;
  const rawLinks = DATA.links.filter(l => l.cohort === DATA.cohorts[currentCohort].name && l.pct >= threshold);

  // Only include nodes that appear in filtered links
  const activeNodeIds = new Set();
  rawLinks.forEach(l => {{ activeNodeIds.add(l.source); activeNodeIds.add(l.target); }});
  const activeNodes = rawNodes.filter(n => activeNodeIds.has(n.id)).map(n => ({{...n}}));
  const activeLinks = rawLinks.map(l => ({{...l}}));

  if (activeNodes.length === 0) {{
    svg.setAttribute('height', '200');
    svg.innerHTML = `<text x="${{W/2}}" y="100" text-anchor="middle" font-size="14" fill="#9b95c9">No data to display. Upload Full Transitions (Q7) and adjust the threshold.</text>`;
    return;
  }}

  const tmpByLayer = {{}};
  activeNodes.forEach(n => {{
    if (!tmpByLayer[n.layer]) tmpByLayer[n.layer] = [];
    tmpByLayer[n.layer].push(n);
  }});
  const maxNodesInLayer = Math.max(...Object.values(tmpByLayer).map(a => a.length), 1);
  const H = Math.max(500, maxNodesInLayer * 55 + 80);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${{W}} ${{H}}`);

  const nodeMap = computeLayout(activeNodes, activeLinks, W, H);

  // Determine highlighted connections
  const connectedNodes = new Set();
  const connectedLinks = new Set();
  if (highlightedNode) {{
    connectedNodes.add(highlightedNode);
    activeLinks.forEach((l, i) => {{
      if (l.source === highlightedNode || l.target === highlightedNode) {{
        connectedNodes.add(l.source);
        connectedNodes.add(l.target);
        connectedLinks.add(i);
      }}
    }});
  }}

  let html = '';

  // Column labels
  html += '<g class="col-labels">';
  for (let layer = 0; layer < 5; layer++) {{
    const layerNodes = activeNodes.filter(n => n.layer === layer);
    if (!layerNodes.length) continue;
    const x = layerNodes[0].x0 + 55;
    html += `<text x="${{x}}" y="22" text-anchor="middle" font-size="10" font-weight="600" fill="#9b95c9" letter-spacing="0.08em" text-transform="uppercase"
      style="text-transform:uppercase;">${{DATA.columnLabels[layer] || ''}}</text>`;
  }}
  html += '</g>';

  // Links
  html += '<g class="links">';
  activeLinks.forEach((l, i) => {{
    const path = ribbonPath(l, nodeMap);
    if (!path) return;
    const color = ribbonColor(l.ribbonType);
    let opacity = ribbonOpacity(l.ribbonType);
    if (highlightedNode) {{
      opacity = connectedLinks.has(i) ? (l.ribbonType !== 'default' ? 0.85 : 0.52) : 0.03;
    }}
    html += `<path class="link-path" d="${{path}}" fill="${{color}}" fill-opacity="${{opacity}}"
      data-from="${{l.source}}" data-to="${{l.target}}" data-pct="${{l.pct}}" data-type="${{l.ribbonType}}"
      onmouseenter="showLinkTip(event,this)" onmouseleave="hideTip()"></path>`;
  }});
  html += '</g>';

  // Nodes
  html += '<g class="nodes">';
  activeNodes.forEach(n => {{
    const color = nodeColor(n);
    const fillOp = nodeFillOpacity(n);
    const borderOp = nodeBorderOpacity(n);
    const borderW = nodeBorderWidth(n);
    const labelW = nodeLabelWeight(n);
    let rectOp = 1;
    if (highlightedNode && !connectedNodes.has(n.id)) rectOp = 0.2;

    const mid = (n.y0 + n.y1) / 2;
    const label = n.id.length > 18 ? n.id.slice(0, 17) + '…' : n.id;

    html += `<g class="node-group" data-id="${{n.id}}" opacity="${{rectOp}}"
      onclick="toggleHighlight('${{n.id}}')" style="cursor:pointer"
      onmouseenter="showNodeTip(event,'${{n.id}}')" onmouseleave="hideTip()">
      <rect x="${{n.x0}}" y="${{n.y0}}" width="${{n.x1 - n.x0}}" height="${{n.height}}"
        fill="${{color}}" fill-opacity="${{fillOp}}"
        stroke="${{color}}" stroke-opacity="${{borderOp}}" stroke-width="${{borderW}}"
        rx="4"></rect>
      <text x="${{n.x0 + 55}}" y="${{mid}}" text-anchor="middle" dominant-baseline="middle"
        font-size="10" font-weight="${{labelW}}" fill="${{color}}" fill-opacity="0.9"
        class="node-label">${{label}}</text>
      ${{n.isConversion ? `<text x="${{n.x1 - 4}}" y="${{n.y0 + 4}}" text-anchor="end" dominant-baseline="hanging" font-size="11">⭐</text>` : ''}}
      ${{n.isCompetitor ? `<text x="${{n.x1 - 4}}" y="${{n.y0 + 4}}" text-anchor="end" dominant-baseline="hanging" font-size="11">⚠</text>` : ''}}
    </g>`;
  }});
  html += '</g>';

  // Click-off background
  svg.onclick = function(e) {{
    if (e.target === svg) clearHighlight();
  }};

  svg.innerHTML = html;
}}

function toggleHighlight(nodeId) {{
  if (highlightedNode === nodeId) {{
    clearHighlight();
  }} else {{
    highlightedNode = nodeId;
    document.getElementById('clearBtn').classList.add('visible');
    renderSankey();
  }}
}}

// ── Tooltips ───────────────────────────────────────────────────────────────
const tip = document.getElementById('tooltip');

function showLinkTip(e, el) {{
  const from = el.getAttribute('data-from');
  const to = el.getAttribute('data-to');
  const pct = el.getAttribute('data-pct');
  const type = el.getAttribute('data-type');
  let badge = '';
  if (type === 'fobo') badge = `<div class="tip-badge badge-fobo">FOBO — left client site</div>`;
  else if (type === 'return') badge = `<div class="tip-badge badge-return">Return — came back</div>`;
  tip.innerHTML = `
    <div class="tip-title">${{from}} → ${{to}}</div>
    <div class="tip-sub">${{pct}}% of cohort</div>
    ${{badge}}
  `;
  positionTip(e);
  tip.style.display = 'block';
}}

function showNodeTip(e, nodeId) {{
  const links = DATA.links.filter(l => l.cohort === DATA.cohorts[currentCohort].name && l.pct >= threshold);
  const incoming = links.filter(l => l.target === nodeId).sort((a, b) => b.pct - a.pct);
  const outgoing = links.filter(l => l.source === nodeId).sort((a, b) => b.pct - a.pct);
  const MAX = 5;
  function fmtFlows(flows, isIn) {{
    let html = '';
    flows.slice(0, MAX).forEach(l => {{
      const label = isIn ? l.source : l.target;
      html += '<div style="display:flex;justify-content:space-between;gap:10px;padding:1px 0;font-size:11px;">'
        + '<span style="color:var(--color-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
        + (isIn ? '← ' : '→ ') + label + '</span>'
        + '<span style="flex-shrink:0;color:var(--color-text-muted);">' + l.pct + '%</span></div>';
    }});
    if (flows.length > MAX) {{
      html += '<div style="font-size:10px;color:var(--color-text-muted);margin-top:2px;">+' + (flows.length - MAX) + ' more</div>';
    }}
    return html;
  }}
  let html = '<div class="tip-title">' + nodeId + '</div>';
  if (incoming.length) {{
    html += '<div style="margin-top:6px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);">Incoming (' + incoming.length + ')</div>'
      + fmtFlows(incoming, true);
  }}
  if (outgoing.length) {{
    html += '<div style="margin-top:6px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);">Outgoing (' + outgoing.length + ')</div>'
      + fmtFlows(outgoing, false);
  }}
  html += '<div class="tip-sub" style="margin-top:6px;font-style:italic;">Click to highlight</div>';
  tip.innerHTML = html;
  positionTip(e);
  tip.style.display = 'block';
}}

function hideTip() {{
  tip.style.display = 'none';
}}

function positionTip(e) {{
  let x = e.clientX + 14, y = e.clientY - 10;
  if (x + 250 > window.innerWidth) x = e.clientX - 264;
  if (y + 120 > window.innerHeight) y = e.clientY - 130;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}}

// ── Init ───────────────────────────────────────────────────────────────────
(function init() {{
  const rd = DATA.reportDetails;
  document.getElementById('brandTag').textContent = rd.clientName + (rd.market ? ' · ' + rd.market : '');
  document.getElementById('reportTitle').textContent = rd.reportTitle;
  document.getElementById('reportSubtitle').textContent = rd.reportSubtitle;
  document.getElementById('dataSourceLabel').textContent = rd.dataSourceLabel;
  document.getElementById('periodLabel').textContent = rd.period;
  document.getElementById('btnA').textContent = DATA.cohorts.a.name;
  document.getElementById('btnB').textContent = DATA.cohorts.b.name;
  document.getElementById('legendClientLabel').textContent = rd.clientName + ' pages';

  setCohort('a');
  window.addEventListener('resize', renderSankey);
}})();
</script>
</body>
</html>"""
