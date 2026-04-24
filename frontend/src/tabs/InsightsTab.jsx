import React, { useState } from 'react'

const MAX_CHARS = 280

function InsightBox({ index, value, onChange, cohortColor }) {
  const remaining = MAX_CHARS - (value || '').length
  const isOver = remaining < 0

  function renderPreview(text) {
    if (!text) return ''
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="form-label">Insight {index + 1}</label>
      <textarea
        className="form-textarea"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Type insight here. Use **bold** for emphasis."
        maxLength={MAX_CHARS + 20}
        style={{
          minHeight: 90,
          borderColor: isOver ? '#c0392b' : undefined,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: isOver ? '#c0392b' : 'var(--color-text-muted)' }}>
          {remaining} characters remaining
        </span>
      </div>
      {/* Preview */}
      {value && (
        <div style={{
          background: '#fff',
          borderLeft: `3px solid ${cohortColor}`,
          borderRadius: 8,
          padding: '10px 13px',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--color-text)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 5 }}>
            Preview
          </div>
          <div dangerouslySetInnerHTML={{ __html: renderPreview(value) }} />
        </div>
      )}
    </div>
  )
}

export default function InsightsTab({ project, updateProject }) {
  const [activePanel, setActivePanel] = useState('a')

  const cohortColors = {
    a: 'var(--color-cohort-a)',
    b: 'var(--color-cohort-b)',
  }

  function updateInsight(cohort, index, value) {
    const updated = [...(project.insights[cohort] || ['', '', '', ''])]
    updated[index] = value
    updateProject({ insights: { ...project.insights, [cohort]: updated } })
  }

  const insights = project.insights || { a: ['', '', '', ''], b: ['', '', '', ''] }

  return (
    <div>
      <div className="card">
        <h2 className="section-title" style={{ marginBottom: 6 }}>Key Insights</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
          Write up to 4 insight bullets per cohort. They appear below the Sankey diagram in the report.
          Use <code style={{ fontSize: 12, background: 'var(--color-accent-light)', padding: '1px 5px', borderRadius: 3 }}>**bold**</code> for emphasis.
        </p>

        {/* Cohort tabs */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--color-accent-light)', borderRadius: 8, padding: 4, width: 'fit-content', marginBottom: 20 }}>
          {['a', 'b'].map(key => (
            <button
              key={key}
              onClick={() => setActivePanel(key)}
              style={{
                border: 'none',
                borderRadius: 5,
                padding: '7px 18px',
                fontSize: 13,
                fontWeight: activePanel === key ? 600 : 500,
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
                background: activePanel === key ? (key === 'a'
                  ? 'linear-gradient(135deg, #4a3f8f, #6c63d5)'
                  : 'linear-gradient(135deg, #6b3fa0, #9b59b6)')
                  : 'transparent',
                color: activePanel === key ? '#fff' : 'var(--color-text-muted)',
                boxShadow: activePanel === key ? (key === 'a'
                  ? '0 2px 8px rgba(108,99,213,0.3)'
                  : '0 2px 8px rgba(107,63,160,0.3)')
                  : 'none',
                transition: 'all 0.15s',
              }}
            >
              {project.cohorts[key].name || (key === 'a' ? 'Converting' : 'Non-Converting')}
            </button>
          ))}
        </div>

        {/* Insight boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[0, 1, 2, 3].map(i => (
            <InsightBox
              key={i}
              index={i}
              value={insights[activePanel]?.[i] || ''}
              onChange={v => updateInsight(activePanel, i, v)}
              cohortColor={cohortColors[activePanel]}
            />
          ))}
        </div>
      </div>

      {/* Full preview */}
      <div className="card">
        <h3 className="section-title">Preview — {project.cohorts[activePanel].name}</h3>
        <div style={{
          background: '#f8f8fd',
          border: '1px solid #e8e6f5',
          borderRadius: 10,
          padding: '18px 22px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}>
          {(insights[activePanel] || []).filter(s => s && s.trim()).map((text, i) => (
            <div key={i} style={{
              background: '#fff',
              borderLeft: `3px solid ${cohortColors[activePanel]}`,
              borderRadius: 8,
              padding: '13px 15px',
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--color-text)',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                {project.cohorts[activePanel].name}
              </div>
              <div dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          ))}
          {!(insights[activePanel] || []).some(s => s && s.trim()) && (
            <div style={{ gridColumn: '1/-1', color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
              No insights written yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
