/** Campaign UTM allowlist. No supabase, no browser. Safe to import from Node tests. */

export const CAMPAIGN_UTM_VALUE = /^[A-Za-z0-9._~-]{1,64}$/

const UTM_KEYS = [
  ['utm_source', 'utm_source'],
  ['utm_medium', 'utm_medium'],
  ['utm_campaign', 'utm_campaign'],
  ['utm_term', 'utm_term'],
  ['utm_content', 'utm_content'],
]

/** Keep campaign UTM keys only. Drop emails, tokens, ref, and any other query. */
export function allowlistedCampaignUtm(search = '', stored = {}) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''))
  const picked = {}
  for (const [key, storedKey] of UTM_KEYS) {
    const fromUrl = String(params.get(key) || '').trim()
    if (CAMPAIGN_UTM_VALUE.test(fromUrl)) {
      picked[key] = fromUrl
      continue
    }
    const fromStored = String(stored?.[storedKey] || '').trim()
    picked[key] = CAMPAIGN_UTM_VALUE.test(fromStored) ? fromStored : ''
  }
  const keep = new URLSearchParams()
  for (const [key] of UTM_KEYS) {
    if (picked[key]) keep.set(key, picked[key])
  }
  const query = keep.toString()
  return {
    utm_source: picked.utm_source,
    utm_medium: picked.utm_medium,
    utm_campaign: picked.utm_campaign,
    utm_term: picked.utm_term,
    utm_content: picked.utm_content,
    page_query: query ? `?${query}` : '',
  }
}
