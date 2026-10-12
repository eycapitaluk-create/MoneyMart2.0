/** Market brief 電光パネル — グローバル / 米国 / 日本 */

export const MARKET_MAJOR_REGION_SLIDES = [
  { id: 'region-global', headline: 'グローバル', regionKey: 'global' },
  { id: 'region-us', headline: '米国', regionKey: 'us' },
  { id: 'region-jp', headline: '日本', regionKey: 'jp' },
]

export const MARKET_MAJOR_REGION_OPTIONS = [
  { value: 'global', label: 'グローバル' },
  { value: 'us', label: '米国' },
  { value: 'jp', label: '日本' },
]

const MARKET_MAJOR_REGION_LABEL = 'グローバル|全世界|速報|米国|アメリカ|日本|国内'
const MARKET_MAJOR_REGION_HEADER_RE = new RegExp(
  `(?:^|\\n)\\s*(?:[◆●■・]\\s*)?(?:【\\s*)?(${MARKET_MAJOR_REGION_LABEL})(?:\\s*】)?\\s*[:：]?\\s*`,
  'g',
)
const MARKET_MAJOR_INLINE_REGION_RE = new RegExp(
  `^[◆●■・]?\\s*(?:【\\s*)?(${MARKET_MAJOR_REGION_LABEL})(?:\\s*】)?\\s*[:：]?\\s*([\\s\\S]*)$`,
)

export const marketRegionKeyToId = (key) => {
  const k = String(key || '').trim().toLowerCase()
  if (k === 'jp' || k === 'japan') return 'region-jp'
  if (k === 'us' || k === 'usa' || k === 'america') return 'region-us'
  if (k === 'global' || k === 'world') return 'region-global'
  return null
}

export const marketRegionIdToLabel = (regionId) => {
  const hit = MARKET_MAJOR_REGION_SLIDES.find((s) => s.id === regionId)
  return hit?.headline || regionId || ''
}

const stripMajorNewsBullet = (value) => String(value || '').replace(/^[◆●■・]\s*/, '').trim()

const regionIdFromLabel = (label) => {
  const s = String(label || '').replace(/[【】\[\]]/g, '').trim()
  if (/^(?:日本|国内)/.test(s)) return 'region-jp'
  if (/^(?:米国|アメリカ)/.test(s)) return 'region-us'
  if (/^(?:グローバル|全世界|速報)/.test(s)) return 'region-global'
  return null
}

const regionIdFromHaystack = (text) => {
  const s = String(text || '')
  if (/(^|[\s【◆●■・])(?:日本|国内)([\s】：:]|$)/.test(s) || /日銀|日経平均|東証/.test(s)) return 'region-jp'
  if (/(^|[\s【◆●■・])(?:米国|アメリカ)([\s】：:]|$)/.test(s) || /FRB|FOMC/.test(s)) return 'region-us'
  if (/(^|[\s【◆●■・])(?:グローバル|全世界|速報)([\s】：:]|$)/.test(s)) return 'region-global'
  return null
}

const bodyToMajorNewsLines = (text) =>
  String(text || '')
    .split(/\n+/)
    .map(stripMajorNewsBullet)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

const formatMajorNewsTickerSegment = (card) => {
  const title = String(card?.title || '').trim()
  const detail = String(card?.detail || '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title && !detail) return ''
  if (!detail) return title
  return `${title} — ${detail}`
}

const splitMajorNewsDescriptionChunks = (description) => {
  const raw = String(description || '').replace(/\r\n/g, '\n').trim()
  if (!raw) return []

  const matches = []
  const headerRe = new RegExp(MARKET_MAJOR_REGION_HEADER_RE.source, 'g')
  let match
  while ((match = headerRe.exec(raw)) !== null) {
    matches.push({ index: match.index, length: match[0].length, label: match[1] })
  }
  if (matches.length > 0) {
    const chunks = []
    if (matches[0].index > 0) {
      const preamble = raw.slice(0, matches[0].index).trim()
      if (preamble) chunks.push({ regionId: null, text: preamble })
    }
    for (let i = 0; i < matches.length; i += 1) {
      const start = matches[i].index + matches[i].length
      const end = i + 1 < matches.length ? matches[i + 1].index : raw.length
      chunks.push({
        regionId: regionIdFromLabel(matches[i].label),
        text: raw.slice(start, end).trim(),
      })
    }
    return chunks
  }

  const inlineParts = raw.split(/(?=◆)/).map((part) => part.trim()).filter(Boolean)
  if (inlineParts.length > 1) {
    return inlineParts.map((part) => {
      const labeled = part.match(MARKET_MAJOR_INLINE_REGION_RE)
      if (labeled) {
        return { regionId: regionIdFromLabel(labeled[1]), text: stripMajorNewsBullet(labeled[2]) }
      }
      return { regionId: null, text: stripMajorNewsBullet(part) }
    })
  }

  return [{ regionId: null, text: raw }]
}

const assignMajorNewsCardToRegionLines = (card) => {
  const title = String(card?.title || '').trim()
  const titleRegion = regionIdFromLabel(title)
  const chunks = splitMajorNewsDescriptionChunks(card?.detail)
  const assigned = []
  const push = (regionId, line) => {
    const text = String(line || '').trim()
    if (!text) return
    assigned.push({ regionId: regionId || titleRegion || 'region-global', line: text })
  }

  if (titleRegion) {
    const lines = bodyToMajorNewsLines(card?.detail)
    if (lines.length > 0) {
      lines.forEach((line) => push(titleRegion, line))
      return assigned
    }
    const segment = formatMajorNewsTickerSegment(card)
    if (segment && !/^(?:グローバル|米国|日本|全世界|速報|国内|アメリカ)$/.test(title)) {
      push(titleRegion, segment)
    }
    return assigned
  }

  const hasLabeledChunks = chunks.some((chunk) => chunk.regionId)
  if (hasLabeledChunks) {
    chunks.forEach((chunk) => {
      const regionId = chunk.regionId || regionIdFromHaystack(title) || 'region-global'
      const lines = bodyToMajorNewsLines(chunk.text)
      const sourceLines = lines.length > 0 ? lines : (chunk.text ? [chunk.text] : [])
      sourceLines.forEach((line) => {
        if (!title) {
          push(regionId, line)
          return
        }
        push(regionId, line.includes(title) ? line : `${title} — ${line}`)
      })
    })
    return assigned
  }

  const inferred = regionIdFromHaystack(`${title}\n${card?.detail || ''}`) || 'region-global'
  const segment = formatMajorNewsTickerSegment(card)
  if (segment) push(inferred, segment)
  return assigned
}

/** DB row → card（market_region 明示時はそのパネル専用） */
export const toMajorNewsCard = (row, idx, fallbackPrefix) => ({
  id: String(row?.id || `${fallbackPrefix}-${idx}`),
  title: String(row?.title || '').trim(),
  detail: String(row?.description || row?.detail || '').trim(),
  marketRegion: String(row?.marketRegion || row?.market_region || '').trim() || null,
})

const cardToDisplayLines = (card) => {
  const title = String(card?.title || '').trim()
  const detailLines = bodyToMajorNewsLines(card?.detail)
  if (detailLines.length === 0) return title ? [title] : []
  if (!title) return detailLines
  return detailLines.map((line) => (line.includes(title) ? line : `${title} — ${line}`))
}

const pushLinesToBucket = (buckets, regionId, lines, kind) => {
  const slot = buckets[regionId] || buckets['region-global']
  for (const line of lines) {
    const text = String(line || '').trim()
    if (text) slot[kind].push(text)
  }
}

/**
 * @param {Array<{ title?: string, detail?: string, marketRegion?: string|null }>} majorCards
 * @param {Array<{ title?: string, detail?: string, marketRegion?: string|null }>} weeklyCards
 */
export const buildMarketMajorRegionSlides = (majorCards, weeklyCards) => {
  const buckets = {
    'region-global': { major: [], weekly: [] },
    'region-us': { major: [], weekly: [] },
    'region-jp': { major: [], weekly: [] },
  }

  const assignCard = (card, kind) => {
    const explicitId = marketRegionKeyToId(card?.marketRegion)
    if (explicitId) {
      pushLinesToBucket(buckets, explicitId, cardToDisplayLines(card), kind)
      return
    }
    assignMajorNewsCardToRegionLines(card).forEach(({ regionId, line }) => {
      pushLinesToBucket(buckets, regionId, [line], kind)
    })
  }

  ;(Array.isArray(majorCards) ? majorCards : []).forEach((card) => assignCard(card, 'major'))
  ;(Array.isArray(weeklyCards) ? weeklyCards : []).forEach((card) => assignCard(card, 'weekly'))

  return MARKET_MAJOR_REGION_SLIDES.map((def) => {
    const slot = buckets[def.id]
    const lines = [...slot.major]
    if (slot.major.length > 0 && slot.weekly.length > 0) {
      lines.push('今週の主要結果サマリー')
    }
    lines.push(...slot.weekly)
    return {
      id: def.id,
      headline: def.headline,
      lines: lines.length > 0 ? lines : ['該当する項目はまだありません'],
    }
  })
}
