import React, { useState, useRef, useEffect } from 'react'

const FILE_SPECS = [
  {
    key: 'entry_paths',
    label: 'Entry Paths (Q1b)',
    saveAs: 'entry_paths_categorised.csv',
    columns: ['page_type', 'cohort', 'unique_users', 'pct_of_cohort'],
  },
  {
    key: 'exit_paths',
    label: 'Exit Paths (Q2b)',
    saveAs: 'exit_paths_categorised.csv',
    columns: ['page_type', 'cohort', 'unique_users', 'pct_of_cohort'],
  },
  {
    key: 'internal_transitions',
    label: 'Internal Transitions (Q3)',
    saveAs: 'internal_transitions.csv',
    columns: ['cohort', 'from_page', 'to_page', 'unique_users', 'total_transitions', 'pct_of_cohort'],
  },
  {
    key: 'pre_entry',
    label: 'Pre-Entry Categories (Q4b)',
    saveAs: 'pre_entry_categorised.csv',
    columns: ['domain_category', 'cohort', 'unique_users', 'pct_of_cohort'],
  },
  {
    key: 'post_exit',
    label: 'Post-Exit Categories (Q5b)',
    saveAs: 'post_exit_categorised.csv',
    columns: ['domain_category', 'cohort', 'unique_users', 'pct_of_cohort'],
  },
  {
    key: 'mid_journey',
    label: 'Mid-Journey Categories (Q6b)',
    saveAs: 'mid_journey_categorised.csv',
    columns: ['domain_category', 'cohort', 'unique_users', 'total_visits', 'pct_of_cohort'],
  },
  {
    key: 'full_transitions',
    label: 'Full Transitions (Q7)',
    saveAs: 'transitions_full.csv',
    columns: ['cohort', 'from_node', 'to_node', 'unique_users', 'total_transitions', 'pct_of_cohort'],
    highlight: true,
  },
]

function FileUploadSlot({ spec, projectId, fileState, onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  async function uploadFile(file) {
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`/api/projects/${projectId}/upload/${spec.key}`, {
        method: 'POST',
        body: form,
      })
      if (res.ok) {
        const data = await res.json()
        onUploaded(spec.key, { valid: true, ...data })
      } else {
        const err = await res.json()
        onUploaded(spec.key, { valid: false, error: err.detail || 'Upload failed' })
      }
    } catch (e) {
      onUploaded(spec.key, { valid: false, error: 'Network error' })
    }
    setUploading(false)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const isValid = fileState?.valid === true
  const isError = fileState?.valid === false

  return (
    <div style={{
      border: `2px ${dragging ? 'solid' : isValid ? 'solid' : isError ? 'solid' : 'dashed'} ${
        dragging ? 'var(--color-cohort-a-mid)' :
        isValid ? '#27ae60' :
        isError ? '#c0392b' :
        'var(--color-border)'
      }`,
      borderRadius: 10,
      padding: '16px 18px',
      background: isValid ? '#f0fdf4' : isError ? '#fff5f5' : 'var(--color-accent-light)',
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Status icon */}
        <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>
          {isValid ? '✅' : isError ? '❌' : uploading ? '⏳' : spec.highlight ? '⭐' : '📄'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{spec.label}</span>
            {spec.highlight && <span className="badge badge-success" style={{ fontSize: 10 }}>Required for Sankey</span>}
          </div>

          {/* Expected columns */}
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Columns: {spec.columns.map((c, i) => (
              <code key={c} style={{ fontSize: 10, background: 'rgba(0,0,0,0.04)', padding: '1px 4px', borderRadius: 3, marginRight: 3 }}>{c}</code>
            ))}
          </div>

          {/* Status message */}
          {isValid && (
            <div style={{ fontSize: 12, color: '#27ae60', marginBottom: 8 }}>
              ✓ {fileState.filename} · {fileState.row_count} rows
              {fileState.uploaded_at && (
                <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>
                  {new Date(fileState.uploaded_at).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
          {isError && (
            <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 8 }}>
              ✗ {fileState.error}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current.click()}
            style={{
              border: '1.5px dashed var(--color-border)',
              borderRadius: 7,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              background: dragging ? 'var(--color-cohort-a-bg)' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ fontSize: 13 }}>📂</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {uploading ? 'Uploading…' : isValid ? 'Drop to replace' : 'Drop CSV here or click to browse'}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={e => uploadFile(e.target.files[0])}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UploadTab({ projectId, uploadedFiles, setUploadedFiles }) {
  // Load existing file info on mount
  useEffect(() => {
    FILE_SPECS.forEach(async (spec) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/files/${spec.key}/info`)
        if (res.ok) {
          const data = await res.json()
          setUploadedFiles(prev => ({ ...prev, [spec.key]: { valid: true, ...data } }))
        }
      } catch {}
    })
  }, [projectId])

  function handleUploaded(key, data) {
    setUploadedFiles(prev => ({ ...prev, [key]: data }))
  }

  const validCount = FILE_SPECS.filter(s => uploadedFiles[s.key]?.valid).length
  const allValid = validCount === FILE_SPECS.length

  return (
    <div>
      {/* Progress summary */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="section-title" style={{ margin: 0 }}>Upload Data</h2>
          <span className={`badge ${allValid ? 'badge-success' : 'badge-pending'}`}>
            {validCount} / {FILE_SPECS.length} files ready
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          Upload the 7 CSV files exported from BigQuery. Each file is validated against its expected column schema.
          All 7 files must be valid before you can configure and preview the report.
        </p>

        {/* Progress bar */}
        <div style={{ marginTop: 14, height: 6, background: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(validCount / FILE_SPECS.length) * 100}%`,
            background: 'linear-gradient(90deg, #4a3f8f, #27ae60)',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* File upload slots */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FILE_SPECS.map(spec => (
          <FileUploadSlot
            key={spec.key}
            spec={spec}
            projectId={projectId}
            fileState={uploadedFiles[spec.key]}
            onUploaded={handleUploaded}
          />
        ))}
      </div>

      {allValid && (
        <div style={{
          background: '#eafaf1',
          border: '1px solid #27ae60',
          borderRadius: 10,
          padding: '14px 18px',
          marginTop: 16,
          fontSize: 13,
          color: '#1a6b3a',
          fontWeight: 600,
        }}>
          ✅ All files uploaded and validated. Proceed to the Configure tab.
        </div>
      )}
    </div>
  )
}
