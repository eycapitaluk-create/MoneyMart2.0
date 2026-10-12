const US_CLOSE_MINUTES = 16 * 60
const JP_CLOSE_MINUTES = 15 * 60 + 30

const zonedClock = (now, timeZone) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const bag = {}
  for (const part of fmt.formatToParts(now)) bag[part.type] = part.value
  let hour = Number(bag.hour)
  if (hour === 24) hour = 0
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    minutes: hour * 60 + Number(bag.minute),
  }
}

const previousWeekdayIso = (year, month, day) => {
  const dt = new Date(Date.UTC(year, month - 1, day))
  do {
    dt.setUTCDate(dt.getUTCDate() - 1)
  } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6)
  return dt.toISOString().slice(0, 10)
}

export const toDateOnly = (value) => {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Last weekday session whose local cash close is already in the past. */
export function lastCompletedSessionDate(now = new Date(), { timeZone, closeMinutes }) {
  const clock = zonedClock(now, timeZone)
  const weekday = new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay()
  const weekend = weekday === 0 || weekday === 6
  if (!weekend && clock.minutes >= closeMinutes) {
    return new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).toISOString().slice(0, 10)
  }
  return previousWeekdayIso(clock.year, clock.month, clock.day)
}

export function getLastUSTradingDate(now = new Date()) {
  return lastCompletedSessionDate(now, {
    timeZone: 'America/New_York',
    closeMinutes: US_CLOSE_MINUTES,
  })
}

export function getLastJPTradingDate(now = new Date()) {
  return lastCompletedSessionDate(now, {
    timeZone: 'Asia/Tokyo',
    closeMinutes: JP_CLOSE_MINUTES,
  })
}

/** Keep only bars whose session date is the date we asked for. */
export function rowsForRequestedSession(rows, requestedDate) {
  return (Array.isArray(rows) ? rows : []).filter((row) => toDateOnly(row?.date) === requestedDate)
}
