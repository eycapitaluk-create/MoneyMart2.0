/** PAY.JP 追加ブランド本番利用開始（JST）— 審査通過メール 2026-06-17 12:00 */
export const PAYJP_EXTENDED_BRANDS_LIVE_AT_JST = '2026-06-17T12:00:00+09:00'

/** Web Premium（PAY.JP カードフォーム）— Apple Pay は別実装のため Web 未対応 */
export const PAYJP_WEB_CARD_BRANDS_LABEL =
  'Visa / Mastercard / JCB / American Express / Diners Club / Discover'

export const PAYJP_WEB_CARD_BRAND_CHIPS = [
  'Visa',
  'Mastercard',
  'JCB',
  'Amex',
  'Diners',
  'Discover',
]

function resolveExtendedBrandsLiveAt() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PAYJP_EXTENDED_BRANDS_LIVE_AT) {
    return String(import.meta.env.VITE_PAYJP_EXTENDED_BRANDS_LIVE_AT).trim()
  }
  return PAYJP_EXTENDED_BRANDS_LIVE_AT_JST
}

export function arePayjpExtendedBrandsLive(now = new Date(), liveAtIso = resolveExtendedBrandsLiveAt()) {
  const liveAt = new Date(liveAtIso).getTime()
  return Number.isFinite(liveAt) && now.getTime() >= liveAt
}

export const PAYJP_CARD_BRANDS_FAQ = {
  q: 'ウェブで利用できるクレジットカードの種類は？',
  a:
    'ウェブブラウザから Premium をお申し込みの場合、決済代行 PAY.JP のクレジットカードフォームを利用します。'
    + `対応ブランド：${PAYJP_WEB_CARD_BRANDS_LABEL}（2026年6月17日以降、本番環境ですべてご利用いただけます）。`
    + '\n\n'
    + 'Apple Pay は PAY.JP 側で別途実装が必要なため、現時点では Web チェックアウトではお使いいただけません。iOS アプリでは App Store 経由のお支払いをご利用ください。',
}

export const PAYJP_CARD_BRANDS_CHATBOT_CONTEXT = [
  `Web Premium via PAY.JP accepts: ${PAYJP_WEB_CARD_BRANDS_LABEL}.`,
  'All six card brands are live on production since 2026-06-17 12:00 JST (PAY.JP merchant approval).',
  'Apple Pay is NOT implemented on web checkout (separate PAY.JP integration). iOS users can use App Store subscription.',
  'No per-brand code toggle—PAY.JP merchant settings control which brands work; our card form accepts them automatically.',
].join(' ')

/** PAY.JP カード有効性確認（11円オーソリ）— FAQ / チャットボット共通（PAY株式会社公式回答に基づく） */

export const PAYJP_ELEVEN_YEN_FAQ = {
  q: 'カード登録時に11円の利用明細が付きました。返金されますか？',
  a:
    'ウェブで Premium をお申し込みの際、決済代行 PAY.JP ではカード情報登録（トークン発行）時に、カードの有効性確認のため一時的に11円のオーソリ（与信枠の確保）が行われます。これは月額料金の本課金ではなく、有効性確認のみの処理です。\n\n'
    + '通常のクレジットカードでは、オーソリのみで即時に返金処理が行われるため、実際の引き落としは発生しません。PAY.JP 側の管理画面にも、有効性確認のみの履歴は表示されない場合があります。\n\n'
    + 'デビットカードやプリペイドカードなど与信枠のないカードでは、一時的に残高から11円が引かれることがあります。PAY.JP からは返金処理を行いますが、カード残高への反映タイミングはカード発行会社により異なり、通常は数日程度です。\n\n'
    + '数日経っても戻らない場合は、お手数ですがカード発行会社へ返金時期をご確認ください。お試し期間終了後の自動返金とは別の処理です。本番の月額・年額料金はお試し終了後（または申込画面の表示どおり）に別途請求されます。',
}

/** チャットボット system 用（短め） */
export const PAYJP_ELEVEN_YEN_CHATBOT_CONTEXT = [
  'PAY.JP card verification (web Premium signup): when registering a card, PAY.JP may place a temporary ¥11 authorization to verify the card. This is NOT the subscription fee.',
  'For standard credit cards, it is authorization-only and reversed immediately—usually no actual charge. This auth may not appear in the merchant PAY.JP dashboard.',
  'Debit/prepaid cards without a credit line may temporarily debit ¥11; PAY.JP initiates refund but timing to restore balance depends on the card issuer (often a few days).',
  'If debit/prepaid users report no refund after several days, advise them to contact their card issuer about refund timing.',
  'The ¥11 check is separate from the free trial and from recurring Premium billing after trial ends.',
].join(' ')
