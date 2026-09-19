import { appendUtm } from './utmLinks'

/** 招待リンク共有用の固定コピー（URLは別途付与） */
export const REFERRAL_SHARE_TITLE = 'MoneyMart'
export const REFERRAL_SHARE_TEXT =
  '金融の比較・資産の見える化はMoneyMartで（無料登録）'

const REFERRAL_CAMPAIGN = 'referral_invite'

/**
 * Tag an invite link with the network it is being shared to. `?ref=` stays on
 * the URL, so referral credit is unaffected — this only makes the channel
 * visible, which it is not when every network hands back the same bare link.
 */
function taggedInviteUrl(url, source, medium = 'social') {
  if (!url) return url
  return appendUtm(url, { source, medium, campaign: REFERRAL_CAMPAIGN })
}

export function getReferralNativeSharePayload(url) {
  return {
    title: REFERRAL_SHARE_TITLE,
    text: REFERRAL_SHARE_TEXT,
    url: url ? appendUtm(url, { medium: 'native_share', campaign: REFERRAL_CAMPAIGN }) : url,
  }
}

/** コピーされた招待リンク（共有先は不明） */
export function getReferralCopyUrl(url) {
  if (!url) return url
  return appendUtm(url, { medium: 'copy_link', campaign: REFERRAL_CAMPAIGN })
}

/** X（旧Twitter）投稿画面を開く */
export function openReferralShareOnX(url) {
  if (!url || typeof window === 'undefined') return
  const shareUrl = taggedInviteUrl(url, 'twitter')
  const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(REFERRAL_SHARE_TEXT)}&url=${encodeURIComponent(shareUrl)}`
  window.open(intentUrl, '_blank', 'noopener,noreferrer')
}

/** LINEでテキスト＋URLを送る（LINEアプリまたはストアへ） */
export function openReferralShareOnLine(url) {
  if (!url || typeof window === 'undefined') return
  const message = `${REFERRAL_SHARE_TEXT}\n${taggedInviteUrl(url, 'line')}`
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`
  window.open(lineUrl, '_blank', 'noopener,noreferrer')
}

/** Facebookの共有ダイアログを開く（URLのみ） */
export function openReferralShareOnFacebook(url) {
  if (!url || typeof window === 'undefined') return
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(taggedInviteUrl(url, 'facebook'))}`
  window.open(fbUrl, '_blank', 'noopener,noreferrer')
}
