import React, { useState, useEffect, useCallback, useRef } from 'react'
import SQLTab from './tabs/SQLTab'
import UploadTab from './tabs/UploadTab'
import ConfigureTab from './tabs/ConfigureTab'
import InsightsTab from './tabs/InsightsTab'
import PreviewTab from './tabs/PreviewTab'

const TABS = [
  { id: 'sql', label: 'SQL Queries' },
  { id: 'upload', label: 'Upload Data' },
  { id: 'configure', label: 'Configure' },
  { id: 'insights', label: 'Insights' },
  { id: 'preview', label: 'Preview & Export' },
]

const API = '/api'

export default function App() {
  const [activeTab, setActiveTab] = useState('sql')
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState({})
  const saveTimerRef = useRef(null)

  // Load or create project on mount
  useEffect(() => {
    const saved = localStorage.getItem('journeyProjectId')
    if (saved) {
      fetch(`${API}/projects/${saved}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setProject(data)
          } else {
            return createProject()
          }
        })
        .catch(() => createProject())
        .finally(() => setLoading(false))
    } else {
      createProject().finally(() => setLoading(false))
    }
  }, [])

  async function createProject() {
    const res = await fetch(`${API}/projects`, { method: 'POST' })
    const data = await res.json()
    localStorage.setItem('journeyProjectId', data.project_id)
    setProject(data)
    return data
  }

  // Debounced save
  const saveProject = useCallback((updates) => {
    if (!project) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/projects/${project.project_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (res.ok) {
          const updated = await res.json()
          setProject(updated)
        }
      } catch (e) {
        console.error('Save failed', e)
      }
    }, 500)
  }, [project])

  function updateProject(patch) {
    setProject(prev => {
      const next = deepMerge(prev, patch)
      saveProject(patch)
      return next
    })
  }

  // Compute tab completion status
  function getTabStatus() {
    if (!project) return {}
    const files = uploadedFiles
    const allUploaded = Object.keys({
      entry_paths: 1, exit_paths: 1, internal_transitions: 1,
      pre_entry: 1, post_exit: 1, mid_journey: 1, full_transitions: 1,
    }).every(k => files[k]?.valid)

    const rd = project.report_details
    const configDone = rd.client_name && rd.market && rd.report_title

    return {
      sql: true,
      upload: allUploaded,
      configure: allUploaded && configDone,
      insights: allUploaded && configDone,
      preview: allUploaded,
    }
  }

  const tabStatus = getTabStatus()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-muted)' }}>
        Loading…
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>Could not connect to backend. Make sure uvicorn is running on port 8000.</p>
          <button className="btn btn-primary" onClick={() => { localStorage.removeItem('journeyProjectId'); window.location.reload() }}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* App header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        height: 56,
        flexShrink: 0,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #4a3f8f, #6c63d5)',
          color: '#fff',
          borderRadius: 6,
          padding: '3px 10px',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}>
          Journey Builder
        </div>

        {/* Tab bar */}
        <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
          {TABS.map((tab, i) => {
            const done = tabStatus[tab.id]
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: active ? 'var(--color-accent-light)' : 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--color-cohort-a-mid)' : '2px solid transparent',
                  borderRadius: '6px 6px 0 0',
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--color-cohort-a)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {done && <span style={{ color: '#27ae60', fontSize: 12 }}>✓</span>}
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Project info + new project */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {project.report_details.client_name || 'New Project'}
            {project.report_details.market ? ` · ${project.report_details.market}` : ''}
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: 11 }}
            onClick={async () => {
              if (!confirm('Start a new project? Current project will be saved.')) return
              localStorage.removeItem('journeyProjectId')
              await createProject()
              setUploadedFiles({})
              setActiveTab('sql')
            }}
          >
            New Project
          </button>
        </div>
      </header>

      {/* Tab content */}
      <main style={{ flex: 1, padding: '24px 32px', maxWidth: 1200, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
        {activeTab === 'sql' && <SQLTab />}
        {activeTab === 'upload' && (
          <UploadTab
            projectId={project.project_id}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
          />
        )}
        {activeTab === 'configure' && (
          <ConfigureTab
            project={project}
            updateProject={updateProject}
            projectId={project.project_id}
          />
        )}
        {activeTab === 'insights' && (
          <InsightsTab
            project={project}
            updateProject={updateProject}
          />
        )}
        {activeTab === 'preview' && (
          <PreviewTab projectId={project.project_id} />
        )}
      </main>
    </div>
  )
}

function deepMerge(base, patch) {
  const result = { ...base }
  for (const key of Object.keys(patch)) {
    if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key]) && base[key]) {
      result[key] = deepMerge(base[key], patch[key])
    } else {
      result[key] = patch[key]
    }
  }
  return result
}
