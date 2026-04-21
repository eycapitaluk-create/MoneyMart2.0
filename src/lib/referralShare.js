/** 招待リンク共有用の固定コピー（URLは別途付与） */
export const REFERRAL_SHARE_TITLE = 'MoneyMart'
export const REFERRAL_SHARE_TEXT =
  '金融の比較・資産の見える化はMoneyMartで（無料登録）'

export function getReferralNativeSharePayload(url) {
  return {
    title: REFERRAL_SHARE_TITLE,
    text: REFERRAL_SHARE_TEXT,
    url,
  }
}

/** X（旧Twitter）投稿画面を開く */
export function openReferralShareOnX(url) {
  if (!url || typeof window === 'undefined') return
  const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(REFERRAL_SHARE_TEXT)}&url=${encodeURIComponent(url)}`
  window.open(intentUrl, '_blank', 'noopener,noreferrer')
}

/** LINEでテキスト＋URLを送る（LINEアプリまたはストアへ） */
export function openReferralShareOnLine(url) {
  if (!url || typeof window === 'undefined') return
  const message = `${REFERRAL_SHARE_TEXT}\n${url}`
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`
  window.open(lineUrl, '_blank', 'noopener,noreferrer')
}

/** Facebookの共有ダイアログを開く（URLのみ） */
export function openReferralShareOnFacebook(url) {
  if (!url || typeof window === 'undefined') return
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  window.open(fbUrl, '_blank', 'noopener,noreferrer')
}
