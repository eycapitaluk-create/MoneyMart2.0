/**
 * Edge middleware が api/ssr/* に渡す `__mm_path` のガードレール。
 * 絶対URL・scheme・プロトコル相対 "//" で別オリジンに解決される値やパストラバーサル後の不正パスを棄却する。
 */
import path from 'node:path'

/** このオリジン以外に解決されたら不正（protocol-relative・http(s) を弾いた後でも保険） */
const SSR_PATH_BASE_URL = new URL('https://mm-internal-ssr-path.invalid/')

/** ミドルウェアが付与する想定パスだけ許可する */
export const MM_PATH_PREFIXES_INSIGHTS = ['/insights']
export const MM_PATH_PREFIXES_STOCKS = ['/stocks']
export const MM_PATH_PREFIXES_FUNDS_DETAIL = ['/funds']
export const MM_PATH_PREFIXES_TOOLS = ['/tools']
export const MM_PATH_PREFIXES_CHECK = ['/check']
export const MM_PATH_PREFIXES_STATIC_PUBLIC = ['/about', '/faq', '/careers', '/legal', '/premium', '/products']
export const MM_PATH_PREFIXES_PUBLIC = MM_PATH_PREFIXES_STATIC_PUBLIC

const MAX_MM_PATH_LEN = 2048

const ABS_OR_PROTO_REL_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/
/** クローラ転送で想定しないスキーム（javascript:, data:, blob: …）もまとめて拒否する */
function looksLikeAbsoluteOrSpecialScheme(s) {
  return ABS_OR_PROTO_REL_SCHEME_RE.test(String(s || '').trim())
}

/**
 * @param {unknown} pathname - URL.pathname（先頭 "/" 付き）
 * @param {string[]} allowedPrefixes - 例 ['/insights']; pathname === prefix または prefix + '/' で始まるなら許可
 */
export function pathnameMatchesMmAllowlist(pathname, allowedPrefixes) {
  const pRaw = String(pathname || '').trim()
  if (!pRaw.startsWith('/') || pRaw.includes('\0')) return false
  let pNorm = path.posix.normalize(pRaw)
  if (!pNorm.startsWith('/')) pNorm = `/${pNorm}`
  /** "/insights/../stocks" 等が正規化で /stocks に落ちても許可判定で弾ける */
  for (const pre of allowedPrefixes) {
    if (!pre.startsWith('/')) continue
    if (pNorm === pre || pNorm.startsWith(`${pre}/`)) return true
  }
  return false
}

/**
 * @returns {{ ok: true, pathname: string, queryParams: URLSearchParams }
 *           | { ok: false, reason?: string }}
 */
export function parseMmPathForSsr(mmRaw, allowedPrefixes) {
  if (mmRaw == null) return { ok: false, reason: 'empty' }

  let s = String(mmRaw).trim()
  if (s.length === 0) return { ok: false, reason: 'empty' }
  if (s.length > MAX_MM_PATH_LEN) return { ok: false, reason: 'too_long' }
  /** 不可視／制御文字 */
  if (/[\u0000-\u001f\u007f]/.test(s) || /\\/.test(s)) return { ok: false, reason: 'control_or_backslash' }
  /** ユーザーがクエリとは別で渡した絶対URL・dangerous scheme */
  if (looksLikeAbsoluteOrSpecialScheme(s)) return { ok: false, reason: 'scheme_absolute' }
  /** 別ホストへの protocol-relative は解決しない */
  if (s.startsWith('//')) return { ok: false, reason: 'protocol_relative' }

  let u
  try {
    u = new URL(s, SSR_PATH_BASE_URL)
  } catch {
    return { ok: false, reason: 'parse_failed' }
  }

  if (u.origin !== SSR_PATH_BASE_URL.origin) {
    return { ok: false, reason: 'foreign_origin' }
  }

  const pathnameRaw = String(u.pathname || '/')
  if (!pathnameMatchesMmAllowlist(pathnameRaw, allowedPrefixes)) {
    return { ok: false, reason: 'prefix_mismatch' }
  }

  let pathnameClean = path.posix.normalize(pathnameRaw)
  if (!pathnameClean.startsWith('/')) pathnameClean = `/${pathnameClean}`
  pathnameClean = pathnameClean.replace(/\/+$/, '')
  if (pathnameClean.length === 0) pathnameClean = allowedPrefixes[0] || '/'

  return {
    ok: true,
    pathname: pathnameClean,
    queryParams: new URLSearchParams(u.searchParams),
  }
}
