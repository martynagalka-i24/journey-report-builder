import React, { useState, useRef, useCallback } from 'react'

export default function PreviewTab({ projectId }) {
  const [loading, setLoading] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const iframeRef = useRef()

  const previewUrl = `/api/projects/${projectId}/preview`

  function refresh() {
    setPreviewKey(k => k + 1)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/export`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match ? match[1] : 'journey_report.html'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Export failed: ' + e.message)
    }
    setExporting(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls bar */}
      <div className="card" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>Preview & Export</h2>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Live preview of the generated report. What you see is what the client gets.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={refresh}
            style={{ padding: '7px 14px', fontSize: 12 }}
          >
            ↺ Refresh Preview
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting}
            style={{ padding: '7px 16px', fontSize: 13 }}
          >
            {exporting ? 'Generating…' : '⬇ Download Report'}
          </button>
        </div>
      </div>

      {/* Share note */}
      <div style={{
        background: 'var(--color-accent-light)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: '12px 16px',
        fontSize: 12,
        color: 'var(--color-text-muted)',
        lineHeight: 1.7,
      }}>
        💡 <strong style={{ color: 'var(--color-text)' }}>To share this report publicly:</strong>{' '}
        drag and drop the downloaded file onto{' '}
        <a
          href="https://app.netlify.com/drop"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-cohort-a-mid)', fontWeight: 600 }}
        >
          Netlify Drop
        </a>.
        {' '}You'll get a public URL in under 30 seconds.
      </div>

      {/* Iframe preview */}
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(80,80,160,0.07)',
        overflow: 'hidden',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{
          background: 'var(--color-accent-light)',
          borderBottom: '1px solid var(--color-border)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--color-text-muted)',
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <span>Generated Report Preview</span>
        </div>
        <iframe
          key={previewKey}
          ref={iframeRef}
          src={previewUrl}
          style={{
            width: '100%',
            height: 'calc(100vh - 320px)',
            minHeight: 600,
            border: 'none',
            display: 'block',
          }}
          title="Report Preview"
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
        />
      </div>
    </div>
  )
}
