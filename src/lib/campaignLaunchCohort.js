/** Same-period session cohort for /campaign/sns-2026. No free text, emails, or post URLs. */

import { CAMPAIGN_CP2026_SNS_SEP_ID } from '../constants/campaignCp2026SnsSep.js'

export const CAMPAIGN_LAUNCH_PATH = '/campaign/sns-2026'
export const CAMPAIGN_LAUNCH_ID = CAMPAIGN_CP2026_SNS_SEP_ID

const STAGE_EVENTS = {
  campaign_view: 'view',
  campaign_cta: 'cta',
  campaign_survey_submit: 'survey',
  campaign_sns_submit: 'sns',
  campaign_apply: 'apply',
}

export const CAMPAIGN_COHORT_STAGES = [
  { id: 'view', label: 'View' },
  { id: 'cta', label: 'Login / signup CTA' },
  { id: 'survey', label: 'Survey saved' },
  { id: 'sns', label: 'Post URL saved' },
  { id: 'apply', label: 'Application saved' },
]

function stageOf(row) {
  const name = String(row?.event_name || '')
  if (STAGE_EVENTS[name]) return STAGE_EVENTS[name]
  if (name === 'page_view' && String(row?.page_path || '') === CAMPAIGN_LAUNCH_PATH) return 'view'
  return ''
}

function channelOf(row) {
  const source = String(row?.source || '').trim() || '(no utm_source)'
  const medium = String(row?.medium || '').trim() || '(no utm_medium)'
  return { source, medium, key: `${source} / ${medium}` }
}

function eventTime(row, index) {
  const parsed = Date.parse(row?.created_at || '')
  return Number.isFinite(parsed) ? parsed : index
}

/**
 * Sessions that viewed the campaign in this row set, then later stages in the same session.
 * Channel is the first view in that session, not a later event.
 * Repeat success events in one session count once. Denominator is that view cohort.
 */
export function buildCampaignLaunchCohort(rows = []) {
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => eventTime(a.row, a.index) - eventTime(b.row, b.index) || a.index - b.index)
  const sessions = new Map()
  for (const { row } of ordered) {
    const stage = stageOf(row)
    if (!stage) continue
    const sessionId = String(row?.session_id || '').trim()
    if (!sessionId) continue
    const current = sessions.get(sessionId) || {
      source: '(no utm_source)',
      medium: '(no utm_medium)',
      key: '(no utm_source) / (no utm_medium)',
      stages: new Set(),
      viewLocked: false,
    }
    if (stage === 'view' && !current.viewLocked) {
      const channel = channelOf(row)
      current.source = channel.source
      current.medium = channel.medium
      current.key = channel.key
      current.viewLocked = true
    }
    current.stages.add(stage)
    sessions.set(sessionId, current)
  }

  const viewed = [...sessions.values()].filter((session) => session.stages.has('view'))
  const tally = (list) => {
    const counts = { view: list.length, cta: 0, survey: 0, sns: 0, apply: 0 }
    list.forEach((session) => {
      CAMPAIGN_COHORT_STAGES.forEach((stage) => {
        if (stage.id === 'view') return
        if (session.stages.has(stage.id)) counts[stage.id] += 1
      })
    })
    return counts
  }

  const byChannel = new Map()
  viewed.forEach((session) => {
    const list = byChannel.get(session.key) || []
    list.push(session)
    byChannel.set(session.key, list)
  })

  const channels = [...byChannel.entries()]
    .map(([key, list]) => ({ key, ...tally(list) }))
    .sort((a, b) => b.view - a.view)

  return {
    viewSessions: viewed.length,
    channels,
    totals: tally(viewed),
  }
}
