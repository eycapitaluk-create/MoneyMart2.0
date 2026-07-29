import { useEffect } from 'react'

/**
 * Set document.title for the current page. Restores the previous title on unmount.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const previous = document.title
    const next = String(title || '').trim()
    if (next) document.title = next.includes('MoneyMart') ? next : `${next} | MoneyMart`
    return () => {
      document.title = previous
    }
  }, [title])
}

export default useDocumentTitle
