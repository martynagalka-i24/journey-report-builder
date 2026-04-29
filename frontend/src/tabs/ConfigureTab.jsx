import React, { useState, useEffect } from 'react'

// ── Section 1: Report Details ──────────────────────────────────────────────
function ReportDetailsSection({ details, onChange }) {
  function update(field, value) {
    onChange({ ...details, [field]: value })
  }

  return (
    <div className="card">
      <h3 className="section-title">Report Details</h3>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Client Name</label>
          <input className="form-input" value={details.client_name} onChange={e => update('client_name', e.target.value)} placeholder="e.g. Hyundai" />
        </div>
        <div className="form-group">
          <label className="form-label">Market / Subtitle</label>
          <input className="form-input" value={details.market} onChange={e => update('market', e.target.value)} placeholder="e.g. Germany" />
        </div>
        <div className="form-group">
          <label className="form-label">Report Title</label>
          <input className="form-input" value={details.report_title} onChange={e => update('report_title', e.target.value)} placeholder="Customer Journey Flow" />
        </div>
        <div className="form-group">
          <label className="form-label">Report Subtitle</label>
          <input className="form-input" value={details.report_subtitle} onChange={e => update('report_subtitle', e.target.value)} placeholder="Cross-domain transitions · Q1 2026" />
        </div>
        <div className="form-group">
          <label className="form-label">Data Source Label</label>
          <input className="form-input" value={details.data_source_label} onChange={e => update('data_source_label', e.target.value)} placeholder="Insights24 · Journey Analysis" />
        </div>
        <div className="form-group">
          <label className="form-label">Period</label>
          <input className="form-input" value={details.period} onChange={e => update('period', e.target.value)} placeholder="Q1 2026 · January–March" />
        </div>
      </div>
    </div>
  )
}

// ── Section 2: Cohort Configuration ───────────────────────────────────────
function CohortSection({ cohorts, onChange }) {
  function updateCohort(cohortKey, field, value) {
    onChange({
      ...cohorts,
      [cohortKey]: { ...cohorts[cohortKey], [field]: value },
    })
  }

  return (
    <div className="card">
      <h3 className="section-title">Cohort Configuration</h3>
      <div className="grid-2">
        {['a', 'b'].map(key => (
          <div key={key} style={{
            background: 'var(--color-accent-light)',
            borderRadius: 10,
            padding: '16px',
            borderLeft: `3px solid ${key === 'a' ? 'var(--color-cohort-a)' : 'var(--color-cohort-b)'}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: key === 'a' ? 'var(--color-cohort-a)' : 'var(--color-cohort-b)', marginBottom: 12 }}>
              Cohort {key.toUpperCase()}
            </div>
            <div className="form-group">
              <label className="form-label">Cohort Name</label>
              <input
                className="form-input"
                value={cohorts[key].name}
                onChange={e => updateCohort(key, 'name', e.target.value)}
                placeholder={key === 'a' ? 'Converting' : 'Non-Converting'}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Share % of total users</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                value={cohorts[key].share_pct ?? ''}
                onChange={e => updateCohort(key, 'share_pct', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="78"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Total Users (optional)</label>
              <input
                className="form-input"
                type="number"
                value={cohorts[key].total_users ?? ''}
                onChange={e => updateCohort(key, 'total_users', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="1580"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section 3: Key Stats ───────────────────────────────────────────────────
function KeyStatsSection({ keyStats, cohortNames, onChange }) {
  function updateStat(cohortKey, field, value) {
    onChange({
      ...keyStats,
      [cohortKey]: { ...keyStats[cohortKey], [field]: value },
    })
  }

  const fields = [
    { key: 'top_entry_page', label: 'Top Entry Page' },
    { key: 'top_entry_pct', label: 'Top Entry Page %' },
    { key: 'top_transition', label: 'Top Transition' },
    { key: 'top_transition_pct', label: 'Top Transition %' },
    { key: 'top_exit_page', label: 'Top Exit Page' },
    { key: 'top_exit_pct', label: 'Top Exit Page %' },
  ]

  return (
    <div className="card">
      <h3 className="section-title">Key Stats</h3>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        These values appear as stat cards above the Sankey diagram in the report.
      </p>
      <div className="grid-2">
        {['a', 'b'].map(key => (
          <div key={key}>
            <div style={{ fontSize: 12, fontWeight: 700, color: key === 'a' ? 'var(--color-cohort-a)' : 'var(--color-cohort-b)', marginBottom: 10 }}>
              {cohortNames[key]}
            </div>
            {fields.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input
                  className="form-input"
                  value={keyStats[key][f.key] ?? ''}
                  onChange={e => updateStat(key, f.key, e.target.value)}
                  placeholder={f.key.endsWith('_pct') ? '37.4%' : f.key.includes('transition') ? 'Model Detail → Configurator' : 'Model Detail'}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section 4: Node Classification ────────────────────────────────────────
function NodeTagger({ nodeConfig, projectId, onChange }) {
  const [nodes, setNodes] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/nodes`)
      .then(r => r.json())
      .then(data => { setNodes(data.nodes || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [projectId])

  function toggleTag(nodeId, tag) {
    const cfg = { ...nodeConfig }
    const key = tag === 'client' ? 'client_nodes'
      : tag === 'conversion' ? 'conversion_nodes'
      : tag === 'key' ? 'key_nodes'
      : 'competitor_nodes'
    const list = cfg[key] || []
    if (list.includes(nodeId)) {
      cfg[key] = list.filter(n => n !== nodeId)
    } else {
      cfg[key] = [...list, nodeId]
      if (tag === 'competitor') {
        cfg.client_nodes = (cfg.client_nodes || []).filter(n => n !== nodeId)
        cfg.key_nodes = (cfg.key_nodes || []).filter(n => n !== nodeId)
      }
      if (tag === 'client') {
        cfg.competitor_nodes = (cfg.competitor_nodes || []).filter(n => n !== nodeId)
      }
      if (tag === 'key') {
        // Key page is implicitly also a client node
        if (!(cfg.client_nodes || []).includes(nodeId)) {
          cfg.client_nodes = [...(cfg.client_nodes || []), nodeId]
        }
      }
    }
    onChange(cfg)
  }

  function getNodePreviewStyle(nodeId) {
    const isClient = nodeConfig.client_nodes?.includes(nodeId)
    const isCompetitor = nodeConfig.competitor_nodes?.includes(nodeId)
    if (isCompetitor) return { color: '#c0392b', borderColor: 'rgba(192,57,43,0.55)', background: 'rgba(192,57,43,0.07)', fontWeight: 500 }
    if (isClient) return { color: '#4a3f8f', borderColor: 'rgba(74,63,143,0.85)', background: 'rgba(74,63,143,0.13)', fontWeight: 700 }
    return { color: '#7f8c8d', borderColor: 'rgba(127,140,141,0.4)', background: 'rgba(127,140,141,0.07)', fontWeight: 500 }
  }

  const filtered = nodes.filter(n => !search || n.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading nodes from Q7 data…</div>

  if (!nodes.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', background: 'var(--color-accent-light)', padding: 16, borderRadius: 8 }}>
        Upload the Full Transitions (Q7) file first to see nodes here.
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          placeholder="Search nodes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{filtered.length} nodes</span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 11, flexWrap: 'wrap' }}>
        <span>✅ Client node</span>
        <span>⭐ Conversion (→ layer 3)</span>
        <span>🔑 Key Page (triggers FOBO / Return ribbons)</span>
        <span>⚠ Competitor</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
        {filtered.map(nodeId => {
          const isClient = nodeConfig.client_nodes?.includes(nodeId)
          const isConversion = nodeConfig.conversion_nodes?.includes(nodeId)
          const isKey = nodeConfig.key_nodes?.includes(nodeId)
          const isCompetitor = nodeConfig.competitor_nodes?.includes(nodeId)
          const previewStyle = getNodePreviewStyle(nodeId)

          return (
            <div key={nodeId} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              flexWrap: 'wrap',
            }}>
              {/* Node preview chip */}
              <div style={{
                ...previewStyle,
                border: `${isClient ? 2 : 1.5}px solid ${previewStyle.borderColor}`,
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 11,
                minWidth: 160,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                {isConversion && <span>⭐</span>}
                {isKey && !isConversion && <span>🔑</span>}
                {isCompetitor && <span>⚠</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodeId}</span>
              </div>

              {/* Checkboxes */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)', userSelect: 'none' }}>
                <input type="checkbox" checked={isClient} onChange={() => toggleTag(nodeId, 'client')} />
                Client node
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)', userSelect: 'none', opacity: isClient ? 1 : 0.4 }}>
                <input type="checkbox" checked={isConversion} onChange={() => isClient && toggleTag(nodeId, 'conversion')} disabled={!isClient} />
                ⭐ Conversion
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)', userSelect: 'none', opacity: isClient ? 1 : 0.4 }}>
                <input type="checkbox" checked={isKey} onChange={() => toggleTag(nodeId, 'key')} disabled={isCompetitor} />
                🔑 Key Page
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)', userSelect: 'none' }}>
                <input type="checkbox" checked={isCompetitor} onChange={() => toggleTag(nodeId, 'competitor')} />
                ⚠ Competitor
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Section 5: Sankey Layout ───────────────────────────────────────────────
function SankeyLayoutSection({ columnLabels, nodeLayerOverrides, projectId, onChange, onOverridesChange }) {
  const [nodes, setNodes] = useState([])

  useEffect(() => {
    fetch(`/api/projects/${projectId}/nodes`)
      .then(r => r.json())
      .then(data => setNodes(data.nodes || []))
      .catch(() => {})
  }, [projectId])

  function updateLabel(col, value) {
    const key = `col${col}`
    onChange({ ...columnLabels, [key]: value })
  }

  function updateNodeLayer(nodeId, layer) {
    const existing = nodeLayerOverrides.filter(o => o.node_id !== nodeId)
    if (layer !== '') {
      existing.push({ node_id: nodeId, layer: parseInt(layer) })
    }
    onOverridesChange(existing)
  }

  const overrideMap = Object.fromEntries((nodeLayerOverrides || []).map(o => [o.node_id, o.layer]))

  const colKeys = [
    { col: 0, key: 'col0' },
    { col: 1, key: 'col1' },
    { col: 2, key: 'col2' },
    { col: 3, key: 'col3' },
    { col: 4, key: 'col4' },
  ]

  return (
    <div>
      <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        Column Labels
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
        {colKeys.map(({ col, key }) => (
          <div key={col} className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Layer {col}</label>
            <input
              className="form-input"
              value={columnLabels[key] ?? ''}
              onChange={e => updateLabel(col, e.target.value)}
              placeholder={['Pre-Client', 'Discovery', 'Evaluation', 'Conversion', 'Post-Client'][col]}
            />
          </div>
        ))}
      </div>

      {nodes.length > 0 && (
        <>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Manual Layer Overrides
          </h4>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Leave blank to use auto-assigned layer (longest-path algorithm).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
            {nodes.map(nodeId => (
              <div key={nodeId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodeId}</span>
                <select
                  style={{
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 12,
                    fontFamily: 'Inter, sans-serif',
                    color: 'var(--color-text)',
                    background: 'var(--color-accent-light)',
                    width: 140,
                  }}
                  value={overrideMap[nodeId] !== undefined ? overrideMap[nodeId] : ''}
                  onChange={e => updateNodeLayer(nodeId, e.target.value)}
                >
                  <option value="">Auto</option>
                  <option value="0">0 — Pre-Client</option>
                  <option value="1">1 — Discovery</option>
                  <option value="2">2 — Evaluation</option>
                  <option value="3">3 — Conversion</option>
                  <option value="4">4 — Post-Client</option>
                </select>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main ConfigureTab ──────────────────────────────────────────────────────
export default function ConfigureTab({ project, updateProject, projectId }) {
  const [autoPopulating, setAutoPopulating] = useState(false)
  const [autoPopulateMsg, setAutoPopulateMsg] = useState(null)

  function saveSection(key, value) {
    updateProject({ [key]: value })
  }

  async function handleAutoPopulate() {
    setAutoPopulating(true)
    setAutoPopulateMsg(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/auto-suggest`)
      if (!res.ok) throw new Error('Failed to fetch suggestions')
      const data = await res.json()
      updateProject({
        node_config: {
          ...project.node_config,
          client_nodes: data.client_nodes,
        },
        key_stats: {
          a: { ...project.key_stats.a, ...data.key_stats.a },
          b: { ...project.key_stats.b, ...data.key_stats.b },
        },
      })
      setAutoPopulateMsg(`Auto-detected ${data.client_nodes.length} client nodes and filled key stats from your uploaded files.`)
    } catch (e) {
      setAutoPopulateMsg('Failed to auto-populate. Make sure entry paths, exit paths, and internal transitions files are uploaded.')
    }
    setAutoPopulating(false)
  }

  return (
    <div>
      {/* Auto-populate banner */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>Auto-populate from uploaded files</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Detects client nodes from entry/exit/internal transition files and fills key stats automatically.
            You can still edit anything manually afterwards.
          </div>
          {autoPopulateMsg && (
            <div style={{ fontSize: 12, color: 'var(--color-cohort-a-mid)', marginTop: 6 }}>{autoPopulateMsg}</div>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleAutoPopulate}
          disabled={autoPopulating}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {autoPopulating ? 'Detecting…' : '✦ Auto-populate'}
        </button>
      </div>

      <ReportDetailsSection
        details={project.report_details}
        onChange={v => saveSection('report_details', v)}
      />

      <CohortSection
        cohorts={project.cohorts}
        onChange={v => saveSection('cohorts', v)}
      />

      <KeyStatsSection
        keyStats={project.key_stats}
        cohortNames={{ a: project.cohorts.a.name, b: project.cohorts.b.name }}
        onChange={v => saveSection('key_stats', v)}
      />

      <div className="card">
        <h3 className="section-title">Node Classification</h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Tag each node from the Q7 transitions file. This drives ribbon colours and visual treatment in the report.
        </p>
        <NodeTagger
          nodeConfig={project.node_config}
          projectId={projectId}
          onChange={v => saveSection('node_config', v)}
        />
      </div>

      <div className="card">
        <h3 className="section-title">Sankey Layout</h3>
        <SankeyLayoutSection
          columnLabels={project.column_labels}
          nodeLayerOverrides={project.node_layer_overrides}
          projectId={projectId}
          onChange={v => saveSection('column_labels', v)}
          onOverridesChange={v => saveSection('node_layer_overrides', v)}
        />
      </div>
    </div>
  )
}
