/** MM relevant contents / 一覧カード用：ラベル・URL・既知ツール名 → リンク解決 */

const TOOL_ROUTE_ENTRIES = [
  ['ETF比較ツール', '/etf-compare'],
  ['ETF 比較', '/etf-compare'],
  ['ETF比較', '/etf-compare'],
  ['ファンド比較', '/funds/compare'],
  ['配当カレンダー', '/dividend-calendar'],
  ['市場インジケーター', '/market-indicator'],
  ['ポートフォリオ最適化', '/tools'],
  ['ファンド', '/funds'],
  ['分散', '/funds'],
]

const PATH_LABEL_ENTRIES = [
  ['/tools', 'ポートフォリオ最適化'],
  ['/etf-compare', 'ETF比較'],
  ['/market', '市場動向'],
  ['/stocks', '株式'],
  ['/funds', 'ファンド'],
  ['/funds/compare', 'ファンド比較'],
  ['/dividend-calendar', '配当カレンダー'],
  ['/market-indicator', '市場インジケーター'],
]

function normalizeToolKey(s) {
  return String(s || '')
    .trim()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
}

const TOOL_ROUTE_MAP = new Map(TOOL_ROUTE_ENTRIES.map(([k, v]) => [normalizeToolKey(k), v]))
const PATH_LABEL_MAP = new Map(PATH_LABEL_ENTRIES)

function normalizePathname(pathname) {
  const path = String(pathname || '').trim()
  if (!path) return '/'
  const clean = path.split(/[?#]/)[0] || '/'
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1)
  return clean
}

function isMoneyMartHost(hostname) {
  const host = String(hostname || '').toLowerCase()
  return host === 'moneymart.co.jp' || host.endsWith('.moneymart.co.jp')
}

function resolveLabelFromPath(pathname) {
  const normalized = normalizePathname(pathname)
  return PATH_LABEL_MAP.get(normalized) || normalized
}

export function toExternalLinkLabel(urlText) {
  try {
    const u = new URL(String(urlText || '').trim())
    const host = u.hostname.replace(/^www\./, '')
    const path = (u.pathname || '/').replace(/\/$/, '')
    if (!path || path === '/') return host
    const trimmedPath = path.length > 18 ? `${path.slice(0, 18)}…` : path
    return `${host}${trimmedPath}`
  } catch {
    return String(urlText || '').trim()
  }
}

/**
 * @returns {{ kind: 'internal', to: string, label: string } | { kind: 'external', href: string, label: string } | null}
 */
export function getInsightToolLinkMeta(name) {
  const raw = String(name || '').trim()
  if (!raw) return null

  const customLabelMatch = raw.match(/^(.+?)\s*\|\s*(https?:\/\/\S+|\/\S+)$/i)
  if (customLabelMatch) {
    const customLabel = String(customLabelMatch[1] || '').trim()
    const target = String(customLabelMatch[2] || '').trim()
    if (customLabel && target) {
      if (/^https?:\/\//i.test(target)) {
        return { kind: 'external', href: target, label: customLabel }
      }
      if (target.startsWith('/') && !target.startsWith('//')) {
        const pathOnly = normalizePathname(target)
        return { kind: 'internal', to: pathOnly, label: customLabel }
      }
    }
  }

  const mapped = TOOL_ROUTE_MAP.get(normalizeToolKey(raw))
  if (mapped) {
    return { kind: 'internal', to: mapped, label: resolveLabelFromPath(mapped) }
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw)
      if (isMoneyMartHost(parsed.hostname)) {
        const pathOnly = normalizePathname(parsed.pathname || '/')
        return { kind: 'internal', to: pathOnly, label: resolveLabelFromPath(pathOnly) }
      }
    } catch {
      // ignore parsing error and fallback to external label
    }
    return { kind: 'external', href: raw, label: toExternalLinkLabel(raw) }
  }

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    const pathOnly = normalizePathname(raw.split(/\s+/)[0])
    return { kind: 'internal', to: pathOnly, label: resolveLabelFromPath(pathOnly) }
  }

  return { kind: 'internal', to: '/tools', label: raw }
}
