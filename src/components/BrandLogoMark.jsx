/** Squircle MoneyMart アイコン — `public/moneymart-logo.png` */
export const SITE_LOGO_MARK_SRC = '/moneymart-logo.png'

export default function BrandLogoMark({
  className = 'w-8 h-8 rounded-xl shrink-0 object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/15',
}) {
  return (
    <img
      src={SITE_LOGO_MARK_SRC}
      alt=""
      width={32}
      height={32}
      className={className}
      decoding="async"
    />
  )
}
