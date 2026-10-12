import reference from './exchangeSessionReference.json' with { type: 'json' }

const CLOSE_BUFFER_MS = 15 * 60 * 1000
const XNYS_INDEX_EXTRA_MS = 60 * 60 * 1000

const byCalendar = new Map(
  Object.entries(reference.calendars || {}).map(([name, calendar]) => {
    const sessions = [...(calendar.sessions || [])].sort((a, b) => a.date.localeCompare(b.date))
    return [name, { coveredThrough: calendar.covered_through || null, sessions }]
  }),
)

export function seoulDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function kstPreviousDate(now = new Date()) {
  const [year, month, day] = seoulDate(now).split('-').map(Number)
  const cutoff = new Date(Date.UTC(year, month - 1, day))
  cutoff.setUTCDate(cutoff.getUTCDate() - 1)
  return cutoff.toISOString().slice(0, 10)
}

export function sessionOnOrBefore(calendarName, cutoffDate, now = new Date(), { extraBufferMs = 0 } = {}) {
  const calendar = byCalendar.get(calendarName)
  if (!calendar) return { date: null, reason: 'calendar_missing' }
  if (!cutoffDate || cutoffDate > calendar.coveredThrough) return { date: null, reason: 'calendar_expired' }
  let chosen = null
  for (const session of calendar.sessions) {
    if (session.date > cutoffDate) break
    const readyAt = Date.parse(session.close_utc) + CLOSE_BUFFER_MS + extraBufferMs
    if (Number.isFinite(readyAt) && readyAt <= now.getTime()) chosen = session
  }
  if (!chosen) return { date: null, reason: 'session_not_ready' }
  return { date: chosen.date, closeUtc: chosen.close_utc, reason: 'ok' }
}

/** The session immediately before sessionDate. Not the nearest older Yahoo bar. */
export function previousSessionDate(calendarName, sessionDate) {
  if (!sessionDate) return null
  if (calendarName === 'FX_UTC') {
    const day = new Date(`${sessionDate}T00:00:00Z`)
    day.setUTCDate(day.getUTCDate() - 1)
    while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1)
    return day.toISOString().slice(0, 10)
  }
  const calendar = byCalendar.get(calendarName)
  if (!calendar) return null
  let previous = null
  for (const session of calendar.sessions) {
    if (session.date >= sessionDate) break
    previous = session.date
  }
  return previous
}

function previousWeekday(date) {
  const day = new Date(`${date}T00:00:00Z`)
  do {
    day.setUTCDate(day.getUTCDate() - 1)
  } while (day.getUTCDay() === 0 || day.getUTCDay() === 6)
  return day.toISOString().slice(0, 10)
}

function weekdayOnOrBefore(date) {
  const day = new Date(`${date}T00:00:00Z`)
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

export function fxReadyAt(sessionDate) {
  return Date.parse(`${sessionDate}T00:00:00Z`) + 24 * 60 * 60 * 1000 + CLOSE_BUFFER_MS
}

/** Yahoo FX has no official close. Use the last weekday on or before the KST cutoff, after the next UTC date plus 15 minutes. */
export function fxSessionOnOrBefore(cutoffDate, now = new Date()) {
  let date = weekdayOnOrBefore(cutoffDate)
  for (let step = 0; step < 8; step += 1) {
    if (now.getTime() >= fxReadyAt(date)) return { date, reason: 'ok' }
    date = previousWeekday(date)
  }
  return { date: null, reason: 'fx_not_ready' }
}

export function expectedPriceDate(calendarName, now = new Date(), { indexBuffer = false } = {}) {
  const cutoff = kstPreviousDate(now)
  if (calendarName === 'FX_UTC') return fxSessionOnOrBefore(cutoff, now)
  const extraBufferMs = calendarName === 'XNYS' && indexBuffer ? XNYS_INDEX_EXTRA_MS : 0
  return sessionOnOrBefore(calendarName, cutoff, now, { extraBufferMs })
}
