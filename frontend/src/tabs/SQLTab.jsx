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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
first_client_touch AS (
  SELECT
    e.user_pseudo_id,
    e.target_path,
    ROW_NUMBER() OVER (PARTITION BY e.user_pseudo_id ORDER BY e.event_timestamp) AS rn
  FROM all_events e
  WHERE e.target_domain IN ({{CLIENT_DOMAINS}})
)
SELECT
  f.target_path,
  uc.cohort,
  COUNT(DISTINCT f.user_pseudo_id) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT f.user_pseudo_id) /
    SUM(COUNT(DISTINCT f.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM first_client_touch f
JOIN user_cohorts uc ON f.user_pseudo_id = uc.user_pseudo_id
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
first_client_touch AS (
  SELECT
    e.user_pseudo_id,
    CASE
      {{PAGE_TYPE_CASE}}
      ELSE 'Other'
    END AS page_type,
    ROW_NUMBER() OVER (PARTITION BY e.user_pseudo_id ORDER BY e.event_timestamp) AS rn
  FROM all_events e
  WHERE e.target_domain IN ({{CLIENT_DOMAINS}})
)
SELECT
  f.page_type,
  uc.cohort,
  COUNT(DISTINCT f.user_pseudo_id) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT f.user_pseudo_id) /
    SUM(COUNT(DISTINCT f.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM first_client_touch f
JOIN user_cohorts uc ON f.user_pseudo_id = uc.user_pseudo_id
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
last_client_touch AS (
  SELECT
    e.user_pseudo_id,
    e.target_path,
    ROW_NUMBER() OVER (PARTITION BY e.user_pseudo_id ORDER BY e.event_timestamp DESC) AS rn
  FROM all_events e
  WHERE e.target_domain IN ({{CLIENT_DOMAINS}})
)
SELECT
  l.target_path,
  uc.cohort,
  COUNT(DISTINCT l.user_pseudo_id) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT l.user_pseudo_id) /
    SUM(COUNT(DISTINCT l.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM last_client_touch l
JOIN user_cohorts uc ON l.user_pseudo_id = uc.user_pseudo_id
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
last_client_touch AS (
  SELECT
    e.user_pseudo_id,
    CASE
      {{PAGE_TYPE_CASE}}
      ELSE 'Other'
    END AS page_type,
    ROW_NUMBER() OVER (PARTITION BY e.user_pseudo_id ORDER BY e.event_timestamp DESC) AS rn
  FROM all_events e
  WHERE e.target_domain IN ({{CLIENT_DOMAINS}})
)
SELECT
  l.page_type,
  uc.cohort,
  COUNT(DISTINCT l.user_pseudo_id) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT l.user_pseudo_id) /
    SUM(COUNT(DISTINCT l.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM last_client_touch l
JOIN user_cohorts uc ON l.user_pseudo_id = uc.user_pseudo_id
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
client_events_typed AS (
  SELECT
    e.user_pseudo_id,
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
    user_pseudo_id,
    event_timestamp,
    page_type,
    LAG(page_type) OVER (PARTITION BY user_pseudo_id ORDER BY event_timestamp) AS prev_page_type
  FROM client_events_typed
),
transitions AS (
  SELECT
    user_pseudo_id,
    prev_page_type AS from_page,
    page_type AS to_page
  FROM deduped
  WHERE prev_page_type IS NOT NULL AND prev_page_type != page_type
)
SELECT
  uc.cohort,
  t.from_page,
  t.to_page,
  COUNT(DISTINCT t.user_pseudo_id) AS unique_users,
  COUNT(*) AS total_transitions,
  ROUND(100.0 * COUNT(DISTINCT t.user_pseudo_id) /
    SUM(COUNT(DISTINCT t.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM transitions t
JOIN user_cohorts uc ON t.user_pseudo_id = uc.user_pseudo_id
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC
LIMIT 150`,
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
first_client_ts AS (
  SELECT
    user_pseudo_id,
    MIN(event_timestamp) AS first_client_time
  FROM all_events
  WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY user_pseudo_id
),
pre_entry AS (
  SELECT
    ae.user_pseudo_id,
    ae.target_domain,
    ROW_NUMBER() OVER (PARTITION BY ae.user_pseudo_id ORDER BY ae.event_timestamp DESC) AS rn
  FROM all_events ae
  JOIN first_client_ts fct ON ae.user_pseudo_id = fct.user_pseudo_id
  WHERE ae.event_timestamp < fct.first_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  p.target_domain,
  uc.cohort,
  COUNT(DISTINCT p.user_pseudo_id) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT p.user_pseudo_id) /
    SUM(COUNT(DISTINCT p.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM pre_entry p
JOIN user_cohorts uc ON p.user_pseudo_id = uc.user_pseudo_id
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
first_client_ts AS (
  SELECT user_pseudo_id, MIN(event_timestamp) AS first_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY user_pseudo_id
),
pre_entry AS (
  SELECT
    ae.user_pseudo_id,
    CASE
      ${UNIVERSAL_DOMAIN_CASE}
      {{CLIENT_SPECIFIC_CATEGORIES}}
      WHEN target_domain IN ({{COMPETITOR_DOMAINS}}) THEN 'Competitors'
      ELSE 'Other'
    END AS domain_category,
    ROW_NUMBER() OVER (PARTITION BY ae.user_pseudo_id ORDER BY ae.event_timestamp DESC) AS rn
  FROM all_events ae
  JOIN first_client_ts fct ON ae.user_pseudo_id = fct.user_pseudo_id
  WHERE ae.event_timestamp < fct.first_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  p.domain_category,
  uc.cohort,
  COUNT(DISTINCT p.user_pseudo_id) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT p.user_pseudo_id) /
    SUM(COUNT(DISTINCT p.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM pre_entry p
JOIN user_cohorts uc ON p.user_pseudo_id = uc.user_pseudo_id
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
last_client_ts AS (
  SELECT user_pseudo_id, MAX(event_timestamp) AS last_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY user_pseudo_id
),
post_exit AS (
  SELECT
    ae.user_pseudo_id,
    ae.target_domain,
    ROW_NUMBER() OVER (PARTITION BY ae.user_pseudo_id ORDER BY ae.event_timestamp) AS rn
  FROM all_events ae
  JOIN last_client_ts lct ON ae.user_pseudo_id = lct.user_pseudo_id
  WHERE ae.event_timestamp > lct.last_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  p.target_domain,
  uc.cohort,
  COUNT(DISTINCT p.user_pseudo_id) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT p.user_pseudo_id) /
    SUM(COUNT(DISTINCT p.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM post_exit p
JOIN user_cohorts uc ON p.user_pseudo_id = uc.user_pseudo_id
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
last_client_ts AS (
  SELECT user_pseudo_id, MAX(event_timestamp) AS last_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY user_pseudo_id
),
post_exit AS (
  SELECT
    ae.user_pseudo_id,
    CASE
      ${UNIVERSAL_DOMAIN_CASE}
      {{CLIENT_SPECIFIC_CATEGORIES}}
      WHEN target_domain IN ({{COMPETITOR_DOMAINS}}) THEN 'Competitors'
      ELSE 'Other'
    END AS domain_category,
    ROW_NUMBER() OVER (PARTITION BY ae.user_pseudo_id ORDER BY ae.event_timestamp) AS rn
  FROM all_events ae
  JOIN last_client_ts lct ON ae.user_pseudo_id = lct.user_pseudo_id
  WHERE ae.event_timestamp > lct.last_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  p.domain_category,
  uc.cohort,
  COUNT(DISTINCT p.user_pseudo_id) AS unique_users,
  ROUND(100.0 * COUNT(DISTINCT p.user_pseudo_id) /
    SUM(COUNT(DISTINCT p.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM post_exit p
JOIN user_cohorts uc ON p.user_pseudo_id = uc.user_pseudo_id
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
client_window AS (
  SELECT
    user_pseudo_id,
    MIN(event_timestamp) AS first_client_time,
    MAX(event_timestamp) AS last_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY user_pseudo_id
),
mid_journey AS (
  SELECT ae.user_pseudo_id, ae.target_domain
  FROM all_events ae
  JOIN client_window cw ON ae.user_pseudo_id = cw.user_pseudo_id
  WHERE ae.event_timestamp > cw.first_client_time
    AND ae.event_timestamp < cw.last_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  m.target_domain,
  uc.cohort,
  COUNT(DISTINCT m.user_pseudo_id) AS unique_users,
  COUNT(*) AS total_visits,
  ROUND(100.0 * COUNT(DISTINCT m.user_pseudo_id) /
    SUM(COUNT(DISTINCT m.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM mid_journey m
JOIN user_cohorts uc ON m.user_pseudo_id = uc.user_pseudo_id
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
    user_pseudo_id,
    event_timestamp,
    target_domain,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
client_window AS (
  SELECT user_pseudo_id,
    MIN(event_timestamp) AS first_client_time,
    MAX(event_timestamp) AS last_client_time
  FROM all_events WHERE target_domain IN ({{CLIENT_DOMAINS}})
  GROUP BY user_pseudo_id
),
mid_journey AS (
  SELECT
    ae.user_pseudo_id,
    CASE
      ${UNIVERSAL_DOMAIN_CASE}
      {{CLIENT_SPECIFIC_CATEGORIES}}
      WHEN target_domain IN ({{COMPETITOR_DOMAINS}}) THEN 'Competitors'
      ELSE 'Other'
    END AS domain_category
  FROM all_events ae
  JOIN client_window cw ON ae.user_pseudo_id = cw.user_pseudo_id
  WHERE ae.event_timestamp > cw.first_client_time
    AND ae.event_timestamp < cw.last_client_time
    AND ae.target_domain NOT IN ({{CLIENT_DOMAINS}})
)
SELECT
  m.domain_category,
  uc.cohort,
  COUNT(DISTINCT m.user_pseudo_id) AS unique_users,
  COUNT(*) AS total_visits,
  ROUND(100.0 * COUNT(DISTINCT m.user_pseudo_id) /
    SUM(COUNT(DISTINCT m.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM mid_journey m
JOIN user_cohorts uc ON m.user_pseudo_id = uc.user_pseudo_id
GROUP BY 1, 2
ORDER BY 2, 3 DESC`,
      },
      {
        id: 'Q7',
        label: 'Q7 — Full Cross-Domain Transitions',
        saveAs: 'transitions_full.csv',
        validationOnly: false,
        note: 'The master query. Upload this file in the Upload Data tab. This drives the Sankey diagram.',
        sql: `-- Q7: Full Cross-Domain Transitions — all step-to-step transitions in the full journey
-- Classifies every event as client page-type or external category
-- Deduplicates consecutive visits to the same node
WITH
all_events AS (
  SELECT
    user_pseudo_id,
    event_timestamp,
    target_domain,
    target_path,
    CASE WHEN {{CONVERSION_CONDITIONS}} THEN 1 ELSE 0 END AS is_conversion
  FROM \`{{DATASET}}\`
  WHERE event_date BETWEEN '{{DATE_FROM}}' AND '{{DATE_TO}}'
),
user_cohorts AS (
  SELECT
    user_pseudo_id,
    CASE WHEN MAX(is_conversion) = 1 THEN 'Converting' ELSE 'Non-Converting' END AS cohort
  FROM all_events
  GROUP BY user_pseudo_id
),
events_classified AS (
  SELECT
    user_pseudo_id,
    event_timestamp,
    CASE
      WHEN target_domain IN ({{CLIENT_DOMAINS}}) THEN
        CASE
          {{PAGE_TYPE_CASE}}
          ELSE 'Client: Other'
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
    user_pseudo_id,
    event_timestamp,
    node_label,
    LAG(node_label) OVER (PARTITION BY user_pseudo_id ORDER BY event_timestamp) AS prev_node
  FROM events_classified
),
transitions AS (
  SELECT
    user_pseudo_id,
    prev_node AS from_node,
    node_label AS to_node
  FROM deduped
  WHERE prev_node IS NOT NULL AND prev_node != node_label
)
SELECT
  uc.cohort,
  t.from_node,
  t.to_node,
  COUNT(DISTINCT t.user_pseudo_id) AS unique_users,
  COUNT(*) AS total_transitions,
  ROUND(100.0 * COUNT(DISTINCT t.user_pseudo_id) /
    SUM(COUNT(DISTINCT t.user_pseudo_id)) OVER (PARTITION BY uc.cohort), 1) AS pct_of_cohort
FROM transitions t
JOIN user_cohorts uc ON t.user_pseudo_id = uc.user_pseudo_id
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC
LIMIT 200`,
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
