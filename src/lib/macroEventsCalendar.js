import { supabase } from './supabase'

/** UI と同一の重要度クリップ（1〜5） */
export function normalizeMacroImportance(importance) {
  const n = Number(importance || 0)
  if (!Number.isFinite(n) || n <= 0) return 3
  return Math.max(1, Math.min(5, Math.round(n)))
}

const ALLOWED_COUNTRIES = new Set(['US', 'JP', 'EU', 'UK', 'KR', 'GLOBAL', 'CN', 'IN', 'EM'])

export function normalizeMacroCountry(raw) {
  const c = String(raw || '').trim().toUpperCase()
  if (ALLOWED_COUNTRIES.has(c)) return c
  return 'GLOBAL'
}

/** YYYY-MM-DD をローカル暦の00:00としてパース（一覧フィルタ用） */
export function parseLocalDateFromYmd(ymd) {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10) - 1
  const d = parseInt(m[3], 10)
  const dt = new Date(y, mo, d)
  if (!Number.isFinite(dt.getTime())) return null
  dt.setHours(0, 0, 0, 0)
  return dt
}

function pickFirst(row, keys, fallback = '') {
  for (const k of keys) {
    const v = row?.[k]
    if (v != null && String(v).trim() !== '') return v
  }
  return fallback
}

function pickStartYmd(row) {
  const v = pickFirst(row, [
    'event_date_start',
    'event_start_date',
    'starts_on',
    'start_date',
    'event_date',
    'EventDateStart',
  ])
  return v ? String(v).slice(0, 10) : ''
}

function pickEndYmd(row) {
  const v = pickFirst(row, ['event_date_end', 'event_end_date', 'ends_on', 'end_date', 'EventDateEnd'])
  return v ? String(v).slice(0, 10) : ''
}

function pickDateLabel(row) {
  const ja = pickFirst(row, ['date_label_ja', 'date_label', 'display_date', 'DateLabel'])
  if (ja) return String(ja).trim()
  const start = pickStartYmd(row)
  if (!start) return ''
  const dt = parseLocalDateFromYmd(start)
  if (!dt) return start
  const wd = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()] || ''
  return `${dt.getMonth() + 1}/${dt.getDate()} (${wd})`
}

/**
 * Supabase `macro_events_calendar` の1行を MarketPage のイベントカード形へ。
 * カラム名は運用でブレうるため複数エイリアスを許容する。
 */
export function mapMacroEventsCalendarRow(row, idx = 0) {
  const idRaw = pickFirst(row, ['slug', 'id', 'external_id'], '')
  const id = String(idRaw || `macro-${idx}`).trim()

  const labelEarly = String(pickFirst(row, ['date_label_ja', 'date_label', 'display_date', 'DateLabel'], '') || '').trim()

  const eventTitle = pickFirst(
    row,
    [
      'event_title',
      'event_name',
      'title',
      'name',
      'heading',
      'label',
      'summary',
      'event',
      'Event',
      'body',
      'memo',
    ],
    '',
  ).trim()

  const startYmd = pickStartYmd(row)
  const endYmd = pickEndYmd(row) || startYmd
  const dateLabel = pickDateLabel(row) || startYmd || labelEarly || '—'

  const titleResolved =
    eventTitle ||
    labelEarly ||
    (startYmd ? `イベント（${startYmd}）` : '') ||
    (id && !/^macro-\d+$/.test(id) ? id : '') ||
    `マクロイベント ${idx + 1}`

  const category = String(pickFirst(row, ['category', 'Category'], '') || '').trim()
  const impact = String(pickFirst(row, ['impact_note', 'impact', 'notes', 'description', 'detail'], '') || '').trim()

  const sortOrder = Number(row?.sort_order ?? row?.sortOrder ?? 0) || 0

  return {
    id,
    dateLabel,
    country: normalizeMacroCountry(pickFirst(row, ['country', 'region_code', 'Country'], 'GLOBAL')),
    category: category || undefined,
    event: titleResolved,
    impact,
    importance: normalizeMacroImportance(row?.importance ?? row?.Importance),
    /** `filterUpcomingEconomicEvents` が参照（Supabase連携時の終了日ベースで非表示化） */
    eventDateStart: startYmd || null,
    eventDateEnd: endYmd || null,
    sortOrder,
  }
}

export function mapMacroEventsCalendarRows(rows) {
  const mapped = (Array.isArray(rows) ? rows : [])
    .map((row, idx) => mapMacroEventsCalendarRow(row, idx))
    .filter(Boolean)
  mapped.sort((a, b) => {
    const da = a.eventDateStart || ''
    const db = b.eventDateStart || ''
    if (da !== db) return da.localeCompare(db)
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })
  return mapped.map(({ sortOrder: _s, ...rest }) => rest)
}

/**
 * マクロイベントを取得。公開可否は Supabase の RLS が決める（anon は公開行のみが返る想定）。
 */
export async function fetchPublishedMacroEventsCalendar() {
  const { data, error } = await supabase.from('macro_events_calendar').select('*').limit(500)

  if (error) throw error
  return Array.isArray(data) ? data : []
}
