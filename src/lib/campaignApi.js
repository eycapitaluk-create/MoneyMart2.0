import { supabase } from './supabase'
import { CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS } from '../constants/campaignCp2026SnsSep.js'

const API_PATH = '/api/campaign/cp2026-sns-sep'

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data?.session?.access_token
  if (!token) {
    const err = new Error('ログインが必要です')
    err.status = 401
    throw err
  }
  return token
}

async function campaignFetch(method, body) {
  const token = await getAccessToken()
  let res
  try {
    res = await fetch(API_PATH, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    })
  } catch {
    const err = new Error('キャンペーンAPIに接続できません（ネットワークまたはサーバー設定）')
    err.status = 0
    throw err
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok === false) {
    const err = new Error(json.error || `Request failed (${res.status})`)
    err.status = res.status
    err.code = json.code
    throw err
  }
  return json
}

export async function fetchCampaignCp2026SnsSepStatus() {
  return campaignFetch('GET')
}

export async function submitCampaignCp2026SnsSepSurvey(answers) {
  return campaignFetch('POST', { action: 'survey', answers })
}

export async function submitCampaignCp2026SnsSepSns({ sns_url, sns_platform }) {
  return campaignFetch('POST', { action: 'sns', sns_url, sns_platform })
}

export async function applyCampaignCp2026SnsSep() {
  return campaignFetch('POST', { action: 'apply' })
}

export { CAMPAIGN_CP2026_SNS_SEP_SURVEY_QUESTIONS }
