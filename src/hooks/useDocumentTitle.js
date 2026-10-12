import { useEffect } from 'react'

/** index.html の <title> と揃える（ホーム・フォールバック用） */
export const SITE_DOCUMENT_TITLE_HOME =
  'MoneyMart｜ポートフォリオの見える化・新NISA・投信とETFの重複確認'

/**
 * マウント時に document.title を設定し、アンマウント時に直前のタイトルへ戻す。
 * title がルート内で変わる場合は、親で title 文字列を渡し直す（同一ページ内の表示切替用）。
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const t = String(title ?? '').trim()
    if (!t) return undefined
    const prev = document.title
    document.title = t
    return () => {
      document.title = prev
    }
  }, [title])
}

/**
 * ルート離脱時だけ「このページに入る直前」の document.title に戻す（動的タイトル更新と併用）。
 */
export function useRestoreDocumentTitleOnUnmount() {
  useEffect(() => {
    const before = document.title
    return () => {
      document.title = before
    }
  }, [])
}
