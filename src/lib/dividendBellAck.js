const STORAGE_KEY = 'mm_dividend_bell_ack_v1'

function currentYm() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * @returns {{ userId: string, ym: string } | null}
 */
export function loadDividendBellAck() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    const userId = String(o?.userId || '').trim()
    const ym = String(o?.ym || '').trim()
    if (!userId || !/^\d{4}-\d{2}$/.test(ym)) return null
    return { userId, ym }
  } catch {
    return null
  }
}

/**
 * 今月の配当ベル通知を「確認済み」として隠す（翌月で自動リセット）。
 */
export function acknowledgeDividendBellForCurrentMonth(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: uid, ym: currentYm() }))
    window.dispatchEvent(new CustomEvent('mm-dividend-bell-ack'))
  } catch {
    // ignore
  }
}

export function isDividendBellAckedForUserMonth(userId, year, month) {
  const uid = String(userId || '').trim()
  if (!uid) return false
  const ym = `${Number(year)}-${String(Number(month)).padStart(2, '0')}`
  const ack = loadDividendBellAck()
  return Boolean(ack && ack.userId === uid && ack.ym === ym)
}
