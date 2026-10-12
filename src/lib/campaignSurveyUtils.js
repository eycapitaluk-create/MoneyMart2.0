/** Shared survey helpers for campaign cp2026_sns_sep */

export function surveyQuestionVisible(q, answers = {}) {
  if (!q?.showIf) return true
  const v = answers[q.showIf.field]
  if (Array.isArray(q.showIf.values)) return q.showIf.values.includes(v)
  return true
}

export function defaultCampaignSurveyState(questions = []) {
  const o = {}
  for (const q of questions) {
    if (q.type === 'section') continue
    o[q.id] = q.type === 'multiselect' ? [] : ''
    if (q.otherFieldId) o[q.otherFieldId] = ''
  }
  return o
}

export function toggleMultiselectValue(current, value) {
  const cur = Array.isArray(current) ? current : []
  return cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
}
