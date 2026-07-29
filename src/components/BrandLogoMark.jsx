/** Compact MoneyMart mark used next to the wordmark in the navbar. */
export default function BrandLogoMark({ className = '' }) {
  return (
    <span
      className={`w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white text-2xl font-black leading-none flex items-center justify-center ${className}`.trim()}
      aria-hidden
    >
      M
    </span>
  )
}
