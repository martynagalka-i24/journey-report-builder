import React, { useState } from 'react'

const UNIVERSAL_DOMAIN_CASE = `-- Search engines
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
WHEN target_domain IN ('reddit.com', 'quora.com') THEN 'Forums'`

const QUERIES = [
  {
    group: 'Client Website Queries',
    items: [
      {
        id: 'Q1a',
        label: 'Q1a — Entry Paths (Raw)',
        saveAs: 'entry_paths_raw.csv',
        validationOnly: true,
        note: 'Run this first. Review raw paths before running Q1b.',
        sql: `-- Q1a: Entry Paths (Raw) — first client-domain page per user, by cohort
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
first_client_touch AS (
  SELECT
    e.uid,
    e.target_path,
    ROW_NUMBER() OVER (PARTITION BY e.uid ORDER BY e.event_timestamp) AS rn
  FROM all_events e
  WHERE e.target_domain IN ({{CLIENT_DOMAINS}})
)
SELECT
  f.target_path,
  uc.cohort,
  COUNT(DISTINCT f.uid) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT f.uid) /
    SUM(COUNT(DISTINCT f.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM first_client_touch f
JOIN user_cohorts uc ON f.uid = uc.uid
WHERE f.rn = 1
GROUP BY 1, 2
ORDER BY 2, 3 DESC
LIMIT 100`,
      },
      {
        id: 'Q1b',
        label: 'Q1b — Entry Paths (Categorised)',
        saveAs: 'entry_paths_categorised.csv',
        validationOnly: false,
        note: 'Upload this file in the Upload Data tab.',
        sql: `-- Q1b: Entry Paths (Categorised) — page-type classification of entry pages
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
first_client_touch AS (
  SELECT
    e.uid,
    CASE
      {{PAGE_TYPE_CASE}}
      ELSE 'Other'
    END AS page_type,
    ROW_NUMBER() OVER (PARTITION BY e.uid ORDER BY e.event_timestamp) AS rn
  FROM all_events e
  WHERE e.target_domain IN ({{CLIENT_DOMAINS}})
)
SELECT
  f.page_type,
  uc.cohort,
  COUNT(DISTINCT f.uid) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT f.uid) /
    SUM(COUNT(DISTINCT f.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM first_client_touch f
JOIN user_cohorts uc ON f.uid = uc.uid
WHERE f.rn = 1
GROUP BY 1, 2
ORDER BY 2, 3 DESC`,
      },
      {
        id: 'Q2a',
        label: 'Q2a — Exit Paths (Raw)',
        saveAs: 'exit_paths_raw.csv',
        validationOnly: true,
        note: 'Run this first. Review raw exit paths before running Q2b.',
        sql: `-- Q2a: Exit Paths (Raw) — last client-domain page per user, by cohort
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
last_client_touch AS (
  SELECT
    e.uid,
    e.target_path,
    ROW_NUMBER() OVER (PARTITION BY e.uid ORDER BY e.event_timestamp DESC) AS rn
  FROM all_events e
  WHERE e.target_domain IN ({{CLIENT_DOMAINS}})
)
SELECT
  l.target_path,
  uc.cohort,
  COUNT(DISTINCT l.uid) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT l.uid) /
    SUM(COUNT(DISTINCT l.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM last_client_touch l
JOIN user_cohorts uc ON l.uid = uc.uid
WHERE l.rn = 1
GROUP BY 1, 2
ORDER BY 2, 3 DESC
LIMIT 100`,
      },
      {
        id: 'Q2b',
        label: 'Q2b — Exit Paths (Categorised)',
        saveAs: 'exit_paths_categorised.csv',
        validationOnly: false,
        note: 'Upload this file in the Upload Data tab.',
        sql: `-- Q2b: Exit Paths (Categorised) — page-type classification of exit pages
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
last_client_touch AS (
  SELECT
    e.uid,
    CASE
      {{PAGE_TYPE_CASE}}
      ELSE 'Other'
    END AS page_type,
    ROW_NUMBER() OVER (PARTITION BY e.uid ORDER BY e.event_timestamp DESC) AS rn
  FROM all_events e
  WHERE e.target_domain IN ({{CLIENT_DOMAINS}})
)
SELECT
  l.page_type,
  uc.cohort,
  COUNT(DISTINCT l.uid) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT l.uid) /
    SUM(COUNT(DISTINCT l.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM last_client_touch l
JOIN user_cohorts uc ON l.uid = uc.uid
WHERE l.rn = 1
GROUP BY 1, 2
ORDER BY 2, 3 DESC`,
      },
      {
        id: 'Q3',
        label: 'Q3 — Internal Transitions',
        saveAs: 'internal_transitions.csv',
        validationOnly: false,
        note: 'Upload this file in the Upload Data tab.',
        sql: `-- Q3: Internal Transitions — step-to-step page-type transitions within the client domain
-- Deduplicates consecutive visits to the same page type
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
client_events_typed AS (
  SELECT
    e.uid,
    e.event_timestamp,
    CASE
      {{PAGE_TYPE_CASE}}
      ELSE 'Other'
    END AS page_type
  FROM all_events e
  WHERE e.target_domain IN ({{CLIENT_DOMAINS}})
),
deduped AS (
  SELECT
    uid,
    event_timestamp,
    page_type,
    LAG(page_type) OVER (PARTITION BY uid ORDER BY event_timestamp) AS prev_page_type
  FROM client_events_typed
),
transitions AS (
  SELECT
    uid,
    prev_page_type AS from_page,
    page_type AS to_page
  FROM deduped
  WHERE prev_page_type IS NOT NULL AND prev_page_type != page_type
)
SELECT
  uc.cohort,
  t.from_page,
  t.to_page,
  COUNT(DISTINCT t.uid) AS unique_users,
  COUNT(*) AS total_transitions,
  ROUND(100.0 * COUNT(DISTINCT t.uid) /
    SUM(COUNT(DISTINCT t.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM transitions t
JOIN user_cohorts uc ON t.uid = uc.uid
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC
QUALIFY ROW_NUMBER() OVER (PARTITION BY uc.cohort ORDER BY COUNT(DISTINCT t.uid) DESC) <= 75`,
      },
    ],
  },
  {
    group: 'External Domain Queries',
    items: [
      {
        id: 'Q4a',
        label: 'Q4a — Pre-Entry Domains (Raw)',
        saveAs: 'pre_entry_domains_raw.csv',
        validationOnly: true,
        note: 'Run this first. Review raw domains with Claude to define your client-specific categories before running Q4b.',
        sql: `-- Q4a: Pre-Entry Domains (Raw) — domain visited immediately before first client-domain touch
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
first_client_ts AS (
  SELECT
    uid,
    MIN(event_timestamp) AS first_client_time
  FROM all_events
  WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY uid
),
pre_entry AS (
  SELECT
    ae.uid,
    ae.target_domain,
    ROW_NUMBER() OVER (PARTITION BY ae.uid ORDER BY ae.event_timestamp DESC) AS rn
  FROM all_events ae
  JOIN first_client_ts fct ON ae.uid = fct.uid
  WHERE ae.event_timestamp < fct.first_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  p.target_domain,
  uc.cohort,
  COUNT(DISTINCT p.uid) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT p.uid) /
    SUM(COUNT(DISTINCT p.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM pre_entry p
JOIN user_cohorts uc ON p.uid = uc.uid
WHERE p.rn = 1
GROUP BY 1, 2
ORDER BY 2, 3 DESC
LIMIT 100`,
      },
      {
        id: 'Q4b',
        label: 'Q4b — Pre-Entry Domains (Categorised)',
        saveAs: 'pre_entry_categorised.csv',
        validationOnly: false,
        note: 'Upload this file in the Upload Data tab.',
        sql: `-- Q4b: Pre-Entry Domains (Categorised) — domain categories before first client touch
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
first_client_ts AS (
  SELECT uid, MIN(event_timestamp) AS first_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY uid
),
pre_entry AS (
  SELECT
    ae.uid,
    CASE
      ${UNIVERSAL_DOMAIN_CASE}
      {{CLIENT_SPECIFIC_CATEGORIES}}
      WHEN target_domain IN ({{COMPETITOR_DOMAINS}}) THEN 'Competitors'
      ELSE 'Other'
    END AS domain_category,
    ROW_NUMBER() OVER (PARTITION BY ae.uid ORDER BY ae.event_timestamp DESC) AS rn
  FROM all_events ae
  JOIN first_client_ts fct ON ae.uid = fct.uid
  WHERE ae.event_timestamp < fct.first_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  p.domain_category,
  uc.cohort,
  COUNT(DISTINCT p.uid) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT p.uid) /
    SUM(COUNT(DISTINCT p.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM pre_entry p
JOIN user_cohorts uc ON p.uid = uc.uid
WHERE p.rn = 1
GROUP BY 1, 2
ORDER BY 2, 3 DESC`,
      },
      {
        id: 'Q5a',
        label: 'Q5a — Post-Exit Domains (Raw)',
        saveAs: 'post_exit_domains_raw.csv',
        validationOnly: true,
        note: 'Run this first. Review raw domains with Claude to define your client-specific categories before running Q5b.',
        sql: `-- Q5a: Post-Exit Domains (Raw) — domain visited immediately after last client-domain touch
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
last_client_ts AS (
  SELECT uid, MAX(event_timestamp) AS last_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY uid
),
post_exit AS (
  SELECT
    ae.uid,
    ae.target_domain,
    ROW_NUMBER() OVER (PARTITION BY ae.uid ORDER BY ae.event_timestamp) AS rn
  FROM all_events ae
  JOIN last_client_ts lct ON ae.uid = lct.uid
  WHERE ae.event_timestamp > lct.last_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  p.target_domain,
  uc.cohort,
  COUNT(DISTINCT p.uid) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT p.uid) /
    SUM(COUNT(DISTINCT p.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM post_exit p
JOIN user_cohorts uc ON p.uid = uc.uid
WHERE p.rn = 1
GROUP BY 1, 2
ORDER BY 2, 3 DESC
LIMIT 100`,
      },
      {
        id: 'Q5b',
        label: 'Q5b — Post-Exit Domains (Categorised)',
        saveAs: 'post_exit_categorised.csv',
        validationOnly: false,
        note: 'Upload this file in the Upload Data tab.',
        sql: `-- Q5b: Post-Exit Domains (Categorised) — domain categories after last client touch
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
last_client_ts AS (
  SELECT uid, MAX(event_timestamp) AS last_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY uid
),
post_exit AS (
  SELECT
    ae.uid,
    CASE
      ${UNIVERSAL_DOMAIN_CASE}
      {{CLIENT_SPECIFIC_CATEGORIES}}
      WHEN target_domain IN ({{COMPETITOR_DOMAINS}}) THEN 'Competitors'
      ELSE 'Other'
    END AS domain_category,
    ROW_NUMBER() OVER (PARTITION BY ae.uid ORDER BY ae.event_timestamp) AS rn
  FROM all_events ae
  JOIN last_client_ts lct ON ae.uid = lct.uid
  WHERE ae.event_timestamp > lct.last_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  p.domain_category,
  uc.cohort,
  COUNT(DISTINCT p.uid) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT p.uid) /
    SUM(COUNT(DISTINCT p.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM post_exit p
JOIN user_cohorts uc ON p.uid = uc.uid
WHERE p.rn = 1
GROUP BY 1, 2
ORDER BY 2, 3 DESC`,
      },
      {
        id: 'Q6a',
        label: 'Q6a — Mid-Journey Domains (Raw)',
        saveAs: 'mid_journey_domains_raw.csv',
        validationOnly: true,
        note: 'Run this first. Review raw domains with Claude to define your client-specific categories before running Q6b.',
        sql: `-- Q6a: Mid-Journey Domains (Raw) — external domains between first and last client touch
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
client_window AS (
  SELECT
    uid,
    MIN(event_timestamp) AS first_client_time,
    MAX(event_timestamp) AS last_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY uid
),
mid_journey AS (
  SELECT ae.uid, ae.target_domain
  FROM all_events ae
  JOIN client_window cw ON ae.uid = cw.uid
  WHERE ae.event_timestamp > cw.first_client_time
    AND ae.event_timestamp < cw.last_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  m.target_domain,
  uc.cohort,
  COUNT(DISTINCT m.uid) AS unique_users,
  COUNT(*) AS total_visits,
  ROUND(100.0 * COUNT(DISTINCT m.uid) /
    SUM(COUNT(DISTINCT m.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM mid_journey m
JOIN user_cohorts uc ON m.uid = uc.uid
GROUP BY 1, 2
ORDER BY 2, 3 DESC
LIMIT 100`,
      },
      {
        id: 'Q6b',
        label: 'Q6b — Mid-Journey Domains (Categorised)',
        saveAs: 'mid_journey_categorised.csv',
        validationOnly: false,
        note: 'Upload this file in the Upload Data tab.',
        sql: `-- Q6b: Mid-Journey Domains (Categorised) — external domain categories between client touches
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
client_window AS (
  SELECT uid,
    MIN(event_timestamp) AS first_client_time,
    MAX(event_timestamp) AS last_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY uid
),
mid_journey AS (
  SELECT
    ae.uid,
    CASE
      ${UNIVERSAL_DOMAIN_CASE}
      {{CLIENT_SPECIFIC_CATEGORIES}}
      WHEN target_domain IN ({{COMPETITOR_DOMAINS}}) THEN 'Competitors'
      ELSE 'Other'
    END AS domain_category
  FROM all_events ae
  JOIN client_window cw ON ae.uid = cw.uid
  WHERE ae.event_timestamp > cw.first_client_time
    AND ae.event_timestamp < cw.last_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  m.domain_category,
  uc.cohort,
  COUNT(DISTINCT m.uid) AS unique_users,
  COUNT(*) AS total_visits,
  ROUND(100.0 * COUNT(DISTINCT m.uid) /
    SUM(COUNT(DISTINCT m.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM mid_journey m
JOIN user_cohorts uc ON m.uid = uc.uid
GROUP BY 1, 2
ORDER BY 2, 3 DESC`,
      },
      {
        id: 'Q7',
        label: 'Q7 — Full Cross-Domain Transitions',
        saveAs: 'transitions_full.csv',
        validationOnly: false,
        note: 'The master query. Upload this file in the Upload Data tab. This drives the Sankey diagram. Pure external → external transitions (no client touchpoint) are excluded.',
        sql: `-- Q7: Full Cross-Domain Transitions — all step-to-step transitions in the full journey
-- Classifies every event as client page-type or external category
-- Deduplicates consecutive visits to the same node
-- Excludes pure external → external transitions (at least one end must be a client page)
WITH
all_events AS (
  SELECT
    uid,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    uid,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY uid
),
events_classified AS (
  SELECT
    uid,
    event_timestamp,
    CASE WHEN target_domain IN ({{CLIENT_DOMAINS}}) THEN TRUE ELSE FALSE END AS is_client,
    CASE
      WHEN target_domain IN ({{CLIENT_DOMAINS}}) THEN
        CASE
          {{PAGE_TYPE_CASE}}
          ELSE '[ME] Other'
        END
      ELSE
        CASE
          ${UNIVERSAL_DOMAIN_CASE}
          {{CLIENT_SPECIFIC_CATEGORIES}}
          WHEN target_domain IN ({{COMPETITOR_DOMAINS}}) THEN 'Competitors'
          ELSE 'Other'
        END
    END AS node_label
  FROM all_events
),
deduped AS (
  SELECT
    uid,
    event_timestamp,
    node_label,
    is_client,
    LAG(node_label) OVER (PARTITION BY uid ORDER BY event_timestamp) AS prev_node,
    LAG(is_client) OVER (PARTITION BY uid ORDER BY event_timestamp) AS prev_is_client
  FROM events_classified
),
transitions AS (
  SELECT
    uid,
    prev_node AS from_node,
    node_label AS to_node
  FROM deduped
  WHERE prev_node IS NOT NULL
    AND prev_node != node_label
    AND (is_client OR prev_is_client)  -- at least one end must be a client page
)
SELECT
  uc.cohort,
  t.from_node,
  t.to_node,
  COUNT(DISTINCT t.uid) AS unique_users,
  COUNT(*) AS total_transitions,
  ROUND(100.0 * COUNT(DISTINCT t.uid) /
    SUM(COUNT(DISTINCT t.uid)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM transitions t
JOIN user_cohorts uc ON t.uid = uc.uid
GROUP BY 1, 2, 3
QUALIFY ROW_NUMBER() OVER (PARTITION BY uc.cohort ORDER BY COUNT(DISTINCT t.uid) DESC) <= 100
ORDER BY 1, unique_users DESC`,
      },
    ],
  },
]

function SQLTemplate({ query }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(query.sql).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      {/* Query header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-accent-light)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{query.label}</span>
          <span className={`badge ${query.validationOnly ? 'badge-pending' : 'badge-success'}`}>
            {query.validationOnly ? 'Validation only' : 'Upload required'}
          </span>
        </div>
        <button className="btn btn-secondary" onClick={copy} style={{ padding: '5px 12px', fontSize: 12 }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* SQL code */}
      <pre style={{
        margin: 0,
        padding: '14px 16px',
        fontSize: 11.5,
        lineHeight: 1.65,
        color: '#2d2d6e',
        background: '#fafafc',
        overflowX: 'auto',
        maxHeight: 320,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}>
        {query.sql}
      </pre>

      {/* Note */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontSize: 12,
        color: 'var(--color-text-muted)',
      }}>
        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Save as: {query.saveAs}</span>
        <span>·</span>
        <span>{query.note}</span>
      </div>
    </div>
  )
}

export default function SQLTab() {
  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title" style={{ marginBottom: 8 }}>SQL Query Templates</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
          Copy each template, replace the <code style={{ background: 'var(--color-accent-light)', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>{'{{PLACEHOLDERS}}'}</code> with your values, and run in BigQuery.
        </p>
        <div style={{
          background: 'var(--color-accent-light)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>Required placeholders</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 24px' }}>
            {[
              ['{{DATASET}}', 'Full BigQuery dataset path'],
              ['{{DATE_FROM}}', 'Start date (YYYY-MM-DD)'],
              ['{{DATE_TO}}', 'End date (YYYY-MM-DD)'],
              ['{{CLIENT_DOMAINS}}', "Quoted domains, e.g. 'hyundai.com', 'hyundai.de'"],
              ['{{CONVERSION_CONDITIONS}}', 'SQL WHERE conditions for converting users'],
              ['{{PAGE_TYPE_CASE}}', 'CASE WHEN block for page-type classification'],
              ['{{COMPETITOR_DOMAINS}}', "Quoted competitor domains"],
              ['{{CLIENT_SPECIFIC_CATEGORIES}}', 'Additional CASE WHEN rows for domain taxonomy'],
            ].map(([ph, desc]) => (
              <div key={ph} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '2px 0' }}>
                <code style={{ fontSize: 11, color: 'var(--color-cohort-a-mid)', fontWeight: 600, flexShrink: 0 }}>{ph}</code>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Concepts & Glossary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title" style={{ marginBottom: 12 }}>Key Concepts</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 28px', marginBottom: 16 }}>

          {/* Journey terms */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Journey Terms</div>
            {[
              ['Conversion', 'A user action signalling commercial intent (e.g. reaching checkout, booking, sign-up). Defined by {{CONVERSION_CONDITIONS}}.'],
              ['Cohort', 'A group of users with a shared trait. The app always uses two: Converting and Non-Converting.'],
              ['Entry (first touch)', 'The first page a user visits on the client site in the observation window.'],
              ['Exit (last touch)', 'The last client page a user visits before the window ends or they leave permanently.'],
              ['Reach / pct_of_cohort', 'Share of users in a cohort who made a given transition. Controls the Min. Reach slider in the report.'],
              ['Internal transition', 'Navigation between pages within the client domain — not crossing to external sites.'],
            ].map(([term, def]) => (
              <div key={term} style={{ marginBottom: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{term}</span>
                <span style={{ color: 'var(--color-text-muted)' }}> — {def}</span>
              </div>
            ))}
          </div>

          {/* Sankey layers */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Sankey Layers</div>
            {[
              ['Pre-Client (Layer 0)', 'External domains visited before the user\'s first client site visit.'],
              ['Discovery (Layer 1)', 'Client pages that are primarily entry points — where users first land.'],
              ['Evaluation (Layer 2)', 'Client pages visited mid-journey; pages that appear in both entry and exit data.'],
              ['Conversion (Layer 3)', 'Client pages tagged as ⭐ Conversion in the configurator. Auto-placed in this column.'],
              ['Post-Client (Layer 4)', 'External domains visited after the user\'s last client site visit.'],
              ['Mid-journey external', 'External domains visited between first and last client touch (used in Q6, displayed in Layer 0).'],
            ].map(([term, def]) => (
              <div key={term} style={{ marginBottom: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{term}</span>
                <span style={{ color: 'var(--color-text-muted)' }}> — {def}</span>
              </div>
            ))}
          </div>

          {/* Ribbon types */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Ribbon Types</div>
            {[
              ['FOBO — red', 'Fear Of Better Options. A user leaves a Key Page or Conversion page to visit an external site.'],
              ['Return — green', 'A user comes back to a Key Page or Conversion page after visiting an external site.'],
              ['Other flow — purple', 'Any transition not involving a Key Page or Conversion page.'],
            ].map(([term, def]) => (
              <div key={term} style={{ marginBottom: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{term}</span>
                <span style={{ color: 'var(--color-text-muted)' }}> — {def}</span>
              </div>
            ))}

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', margin: '12px 0 8px' }}>Node Types</div>
            {[
              ['Client node', 'A page on the client\'s own website. Drives layer assignment and ribbon colour logic.'],
              ['Key Page 🔑', 'An important client page that triggers FOBO/Return ribbon colouring when left or returned to.'],
              ['Conversion ⭐', 'A client page representing a conversion action. Auto-placed in the Conversion layer.'],
              ['Competitor ⚠', 'An external domain that is a direct competitor. Highlighted in red.'],
            ].map(([term, def]) => (
              <div key={term} style={{ marginBottom: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{term}</span>
                <span style={{ color: 'var(--color-text-muted)' }}> — {def}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Categorisation notes */}
        <div style={{
          background: '#fffbf0',
          border: '1px solid #f0e6c0',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 12,
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#7a5c00' }}>⚠ Categorisation reminders</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-muted)' }}>
            <li><strong>Always end your <code>{'{{PAGE_TYPE_CASE}}'}</code> block with <code>ELSE '[ME] Other'</code></strong> — this keeps the client catch-all label consistent across Q1b, Q2b, Q3 and Q7. The app template's <code>ELSE 'Other'</code> becomes unreachable.</li>
            <li><strong>Search</strong> covers the major global engines (Google, Bing, DuckDuckGo, etc.). Add regional variants relevant to your market in <code>{'{{CLIENT_SPECIFIC_CATEGORIES}}'}</code> — e.g. Yandex for Russia, Naver for Korea, Baidu for China.</li>
            <li><strong>Other (external)</strong> is a catch-all for uncategorised domains. Run Q4a and Q5a first, review the raw domain list, and promote any significant domains into named categories before running Q4b/Q5b.</li>
            <li><strong>External → external transitions</strong> are excluded from Q7 by design — only transitions where at least one end is a client page are included in the Sankey.</li>
          </ul>
        </div>
      </div>

      {QUERIES.map(group => (
        <div key={group.group}>
          <h3 style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: '24px 0 12px',
            paddingBottom: 8,
            borderBottom: '2px solid var(--color-border)',
          }}>
            {group.group}
          </h3>
          {group.items.map(q => <SQLTemplate key={q.id} query={q} />)}
        </div>
      ))}
    </div>
  )
}
