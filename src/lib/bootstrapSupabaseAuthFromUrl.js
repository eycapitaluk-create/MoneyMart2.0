import { supabase } from './supabase'

/**
 * OAuth / メール確認 URL (?code= / #access_token) — React マウント前に Supabase が URL を処理できるよう getSession。
 */
export async function bootstrapSupabaseAuthFromUrl() {
  if (typeof window === 'undefined') return

  const search = window.location.search || ''
  const hash = window.location.hash || ''
  if (!search.includes('code=') && !hash.includes('access_token')) return

  try {
    await supabase.auth.getSession()
  } catch {
    /* best-effort */
  }
}
