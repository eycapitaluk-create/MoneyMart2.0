/**
 * DB/API에서 UTF-8 바이트를 Latin-1(ISO-8859-1) 문자로 잘못 해석해 저장한 경우의 표시 복구.
 * (예: 「つみたて・成長」→ ã¤ã¿ã¿ã¦ãƒ»æˆé•· 같은 깨짐)
 *
 * Numbers/Excel 経由で「æ　é　·…」のように全角スペース(U+3000)がバイト間に入った場合も、
 * code unit ≤255 だけ順に抜き出して UTF-8 として解釈する。
 */
const hasCjkOrKana = (s) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(s)

export const recoverMojibakeUtf8FromLatin1 = (value) => {
  const s = String(value ?? '')
  if (!s) return s
  // ・や　だけでなく、ひらがな/カタカナ/漢字がある＝正常な日本語とみなす（U+3000 単体では復号しない）
  if (hasCjkOrKana(s)) return s

  const bytes = []
  for (let i = 0; i < s.length; i++) {
    const u = s.charCodeAt(i)
    if (u <= 255) bytes.push(u)
  }
  if (bytes.length < 2) return s

  let highByteCount = 0
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] >= 0x80) highByteCount += 1
  }
  if (highByteCount < 2) return s

  try {
    const arr = new Uint8Array(bytes)
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(arr)
    if (decoded.includes('\uFFFD')) return s
    if (!hasCjkOrKana(decoded)) return s
    return decoded
  } catch {
    return s
  }
}

/** stock_symbols.nisa_category など API 経由の文字列用（未設定は '-'） */
export const normalizeNisaCategoryField = (raw) => {
  const s = String(raw ?? '').trim()
  if (!s || s === '-') return '-'
  return recoverMojibakeUtf8FromLatin1(s) || s
}
