const toIsoDate = (value) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const getWeekRange = (now = new Date()) => {
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(now)
  start.setDate(now.getDate() + diffToMonday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start,
    end,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  }
}

const normalizeCountryCode = (value = '') => {
  const v = String(value || '').toLowerCase()
  if (v.includes('united states') || v === 'us') return 'US'
  if (v.includes('japan') || v === 'jp') return 'JP'
  return ''
}

const fetchJson = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`upstream ${response.status}`)
  return response.json()
}

const normalizeEventRow = (row, idx) => ({
  id: String(row?.CalendarId || `event-${idx}`),
  date: row?.Date || '',
  country: normalizeCountryCode(row?.Country || ''),
  event: String(row?.Event || '').trim(),
  importance: Number(row?.Importance || 0),
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const { startDate, endDate } = getWeekRange(new Date())
    const countryUrl = `https://api.tradingeconomics.com/calendar/country/united%20states,japan/${startDate}/${endDate}?c=guest:guest&f=json`
    const fallbackUrl = 'https://api.tradingeconomics.com/calendar?c=guest:guest&f=json'

    let payload = []
    try {
      payload = await fetchJson(countryUrl)
    } catch {
      payload = await fetchJson(fallbackUrl)
    }

    const startTs = new Date(`${startDate}T00:00:00.000Z`).getTime()
    const endTs = new Date(`${endDate}T23:59:59.999Z`).getTime()
    const events = (Array.isArray(payload) ? payload : [])
      .map(normalizeEventRow)
      .filter((row) => row.country === 'US' || row.country === 'JP')
      .filter((row) => {
        const ts = new Date(row.date).getTime()
        if (!Number.isFinite(ts)) return false
        return ts >= startTs && ts <= endTs
      })
      .filter((row) => row.event)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 12)

    return res.status(200).json({
      ok: true,
      startDate,
      endDate,
      events,
    })
  } catch (error) {
    console.error('Economic calendar proxy failed:', error?.message || error)
    return res.status(502).json({
      ok: false,
      error: 'Calendar provider unavailable',
      events: [],
    })
  }
}
