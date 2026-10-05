/**
 * iOS PriceSeriesCleaner.swift 와 같은 일별 종가 정제.
 * 최신 종가는 지우거나 바꾸지 않는다. 분할 보정은 그 이전 행만 스케일한다.
 */

const SPLIT_FACTORS = [2, 3, 4, 5, 10, 20, 25, 50, 100, 200]
const SPIKE_UP = 1.8
const SPIKE_DOWN = 0.55
const NEIGHBOUR_AGREE = 0.2
const SPLIT_TOLERANCE = 0.06
const PERSIST_POINTS = 3
const PERSIST_LO = 0.8
const PERSIST_HI = 1.25
const MAX_RUN = 5
const LEVEL_SHIFT_MIN = 3
const MAX_ROUNDS = 50

const agree = (a, b) => Math.abs(b / a - 1) <= NEIGHBOUR_AGREE
const inBand = (r) => r >= PERSIST_LO && r <= PERSIST_HI

const isWeekend = (ymd) => {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return false
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  return day === 0 || day === 6
}

const localMedian = (closes, i) => {
  const lo = Math.max(0, i - 5)
  const hi = Math.min(closes.length - 1, i + 5)
  const w = closes.slice(lo, hi + 1).slice().sort((a, b) => a - b)
  return w[Math.floor(w.length / 2)]
}

/**
 * @param {{ date: string, close: number }[]} raw 오름차순이 아니어도 됨
 */
export function cleanPriceSeries(raw) {
  const seen = new Set()
  const base = (Array.isArray(raw) ? raw : [])
    .filter((p) => Number.isFinite(p?.close) && p.close > 0 && p?.date)
    .map((p) => ({ date: String(p.date).slice(0, 10), close: Number(p.close) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((p) => {
      if (seen.has(p.date)) return false
      seen.add(p.date)
      return true
    })
  const dates = base.map((p) => p.date)
  const closes = base.map((p) => p.close)
  const src = base.map((_, i) => i)
  const scale = base.map(() => 1)
  const corrections = []
  if (base.length < 3) {
    return { points: base, sourceIndex: src, scale, corrections }
  }

  const remove = (idx) => {
    for (const i of [...idx].sort((a, b) => b - a)) {
      dates.splice(i, 1)
      closes.splice(i, 1)
      src.splice(i, 1)
      scale.splice(i, 1)
    }
  }

  const unresolvedSeen = new Set()
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    let dropped = false
    for (const weekendOnly of [true, false]) {
      const cands = []
      const n = closes.length
      if (n < 3) break
      for (let i = 1; i < n - 1; i += 1) {
        if (weekendOnly && !isWeekend(dates[i])) continue
        const a = closes[i - 1]
        const x = closes[i]
        const b = closes[i + 1]
        if (!agree(a, b)) continue
        const up = x / a > SPIKE_UP && x / b > SPIKE_UP
        const down = x / a < SPIKE_DOWN && x / b < SPIKE_DOWN
        if (up || down) cands.push(i)
      }
      if (cands.length === 0) continue
      const ranked = cands.slice().sort((l, r) => {
        const lw = isWeekend(dates[l])
        const rw = isWeekend(dates[r])
        if (lw !== rw) return lw ? -1 : 1
        const ld = Math.abs(Math.log(closes[l] / localMedian(closes, l)))
        const rd = Math.abs(Math.log(closes[r] / localMedian(closes, r)))
        return rd - ld
      })
      const picked = new Set()
      for (const i of ranked) {
        if (picked.has(i - 1) || picked.has(i + 1)) continue
        picked.add(i)
      }
      for (const i of [...picked].sort((a, b) => a - b)) {
        corrections.push({
          kind: 'outlier',
          date: dates[i],
          endDate: null,
          factor: closes[i] / closes[i - 1],
          fromClose: closes[i - 1],
          toClose: closes[i],
          rows: 1,
        })
      }
      remove([...picked])
      dropped = true
      break
    }
    if (dropped) continue

    let runDropped = false
    for (let len = 2; len <= MAX_RUN && !runDropped; len += 1) {
      const n = closes.length
      if (n < len + 2) break
      for (let i = 1; i + len - 1 <= n - 2; i += 1) {
        const j = i + len - 1
        const a = closes[i - 1]
        const b = closes[j + 1]
        if (!agree(a, b)) continue
        const block = closes.slice(i, j + 1)
        const up = block.every((v) => v / a > SPIKE_UP && v / b > SPIKE_UP)
        const down = block.every((v) => v / a < SPIKE_DOWN && v / b < SPIKE_DOWN)
        if (!up && !down) continue
        let left = 0
        for (let k = i - 1; k >= 0 && agree(a, closes[k]) && left < len; k -= 1) left += 1
        let right = 0
        for (let k = j + 1; k < n && agree(b, closes[k]) && right < len; k += 1) right += 1
        if (left >= Math.min(len, i) && right >= Math.min(len, n - 1 - j)) {
          corrections.push({
            kind: 'outlierRun',
            date: dates[i],
            endDate: dates[j],
            factor: closes[i] / a,
            fromClose: a,
            toClose: closes[i],
            rows: len,
          })
          remove(Array.from({ length: len }, (_, k) => i + k))
          runDropped = true
          break
        }
      }
    }
    if (runDropped) continue

    let splitDone = false
    const n = closes.length
    for (let i = n - 1; i >= 1; i -= 1) {
      const r = closes[i] / closes[i - 1]
      const f = r < 1 ? 1 / r : r
      if (f < SPIKE_UP) continue
      const snapped = SPLIT_FACTORS.find((s) => Math.abs(f / s - 1) <= SPLIT_TOLERANCE) ?? null
      const tail = n - i
      const window = Math.min(PERSIST_POINTS, tail)
      let persists = (tail >= PERSIST_POINTS || (tail >= 2 && snapped != null))
      for (let k = i; k < i + window; k += 1) {
        if (!inBand(closes[k] / closes[i])) persists = false
      }
      const priorStable = i < 2 || inBand(closes[i - 2] / closes[i - 1])
      if (persists && priorStable && (snapped != null || f >= LEVEL_SHIFT_MIN)) {
        const mult = snapped != null ? (r < 1 ? 1 / snapped : snapped) : r
        const kind = snapped == null ? 'levelShift' : (r < 1 ? 'split' : 'reverseSplit')
        corrections.push({
          kind,
          date: dates[i],
          endDate: null,
          factor: mult,
          fromClose: closes[i - 1],
          toClose: closes[i],
          rows: i,
        })
        for (let k = 0; k < i; k += 1) {
          closes[k] *= mult
          scale[k] *= mult
        }
        splitDone = true
      } else if (!unresolvedSeen.has(dates[i])) {
        unresolvedSeen.add(dates[i])
        corrections.push({
          kind: 'unresolved',
          date: dates[i],
          endDate: null,
          factor: r,
          fromClose: closes[i - 1],
          toClose: closes[i],
          rows: 0,
        })
      }
    }
    if (!splitDone) break
  }

  const finalDates = new Set(dates)
  const resolved = corrections.filter((c) => {
    if (c.kind !== 'unresolved') return true
    const idx = dates.indexOf(c.date)
    if (!finalDates.has(c.date) || idx < 1) return false
    const r = closes[idx] / closes[idx - 1]
    return r > SPIKE_UP || r < (1 / SPIKE_UP)
  })

  return {
    points: dates.map((date, i) => ({ date, close: closes[i] })),
    sourceIndex: src,
    scale,
    corrections: resolved,
  }
}

export function maxDailyMove(points) {
  if (!points || points.length < 2) return 0
  let max = 0
  for (let i = 1; i < points.length; i += 1) {
    max = Math.max(max, Math.abs(points[i].close / points[i - 1].close - 1))
  }
  return max
}

export { isWeekend as isWeekendTradeDate, SPIKE_UP, SPIKE_DOWN }
