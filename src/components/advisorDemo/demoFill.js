/** Demo-only copy/data fillers so advisor screens never render blank fields. */

export function clientDocs(c) {
  const existing = (c.documents || []).filter((d) => d?.name)
  if (existing.length) {
    return existing.map((d, i) => ({
      name: d.name,
      status: d.status || (i % 2 === 0 ? '共有済み' : '下書き'),
      date: d.date || c.lastReview || '2026-09-09',
    }))
  }
  return [
    { name: `${c.name}_定期レビュー_202609.pdf`, status: '共有済み', date: c.lastReview || '2026-09-09' },
    { name: `${c.name}_リスク分析メモ.pdf`, status: '下書き', date: '2026-09-18' },
    { name: '投資方針確認書.pdf', status: '共有済み', date: '2026-08-12' },
  ]
}

export function clientProfileExtra(c) {
  const x = c.profileExtra || {}
  const fill = (v, fallback) => (v && v !== '—' ? v : fallback)
  const age = Number(c.age) || 46
  return {
    marital: fill(x.marital, '既婚'),
    family: fill(x.family, '配偶者・子供2人'),
    nationality: fill(x.nationality, '日本'),
    occupation: fill(x.occupation, '会社員'),
    workplace: fill(x.workplace, '上場企業'),
    role: fill(x.role, 'マネージャー'),
    income: fill(x.income, '¥920万'),
    updatedAt: fill(x.updatedAt, '2026-09-20'),
    retireAge: 65,
    yearsToRetire: Math.max(1, 65 - age),
  }
}

export function meetingRecordCopy(c, m = {}) {
  const type = m.type || m.title || '定期レビュー'
  const raw = String(m.notes || '').trim()
  const summary = raw && raw !== '完了' && raw !== '記録なし'
    ? raw
    : `${c.name} 様の${type}を実施。保有集中と目標配分の乖離を確認し、次回までのリバランス方針を整理。`
  return {
    summary,
    decisions: m.decisions || '集中銘柄の段階削減を継続検討。海外分散枠は次回資料で試算。NISA 枠の活用方針は現状維持。',
    followUp: m.followUp || c.followUps?.[0]?.label || '次回面談資料とリバランス案を送付',
  }
}

export function defaultPrepMemo(c) {
  return `${c.name} 様：前回（${c.lastReview || '2026-09-09'}）以降の配分ドリフトは ${c.drift ?? 0}pt。上位保有の集中と海外分散余地を確認し、予測表現を避けて関連性ベースで説明。`
}

export function defaultLiveMemo(c) {
  return `${c.name} 様と定期レビュー。\n・現状の集中リスクと目標配分の差分を共有\n・海外分散・債券枠は次回までに試算して提案\n・次回フォローは資料送付後に日程調整`
}

export function defaultAgenda(c, meeting) {
  if (meeting?.agenda?.length) return meeting.agenda
  if (c?.meetings?.[0]?.agenda?.length) return c.meetings[0].agenda
  return ['パフォーマンス確認', '集中リスクの確認', '海外分散の検討', '次回方針']
}

export function defaultCaptureItems() {
  return ['集中度の確認', '海外分散の検討', '次回フォロー日']
}

export function nextMeetingLabel(c) {
  if (c.nextMeeting && c.nextMeeting !== '未設定') return c.nextMeeting
  if (c.reviewDays != null) return `${c.reviewDays}日後 · 定期レビュー`
  return '10/2 14:00 · 定期レビュー'
}

export function lastContactLabel(c) {
  return c.lastReview || '2026-09-09'
}

export function depositLabel(c) {
  const buy = (c.transactions || []).find((t) => t.side === '購入' && t.amount)
  if (buy?.amount) return `+¥${Number(buy.amount).toLocaleString()}`
  return '+¥500,000'
}

export function fundVol(f) {
  if (f.category === '債券') return Math.max(3.2, +(4 + Math.abs(Number(f.ret1y) || 0) * 0.35).toFixed(1))
  if (f.category === 'REIT') return 12.4
  if (f.category === 'コモディティ') return 16.8
  return +(Math.max(8, Math.abs(Number(f.ret1y) || 0) * 0.72)).toFixed(1)
}

export function fundCorrelationLabel(funds) {
  if (!funds || funds.length < 2) return '—'
  const cats = new Set(funds.map((f) => f.category))
  if (cats.size === 1) return '高 · 0.81'
  if (cats.has('債券') && [...cats].some((cat) => /株|全世界|先進|新興|テクノ/.test(cat))) return '低 · 0.28'
  return '中 · 0.46'
}

export function riskHistory(score) {
  const end = Number(score) || 80
  return [end - 18, end - 14, end - 9, end - 4, end - 6, end - 2, end].map((v) => Math.max(8, Math.min(98, v)))
}
