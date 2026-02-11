/**
 * サイドバー広告 - 2カラムレイアウト用
 */
import AdBanner from './AdBanner'

export default function AdSidebar({ className = '' }) {
  return (
    <aside className={className}>
      <AdBanner variant="compact" className="sticky top-24" />
    </aside>
  )
}
