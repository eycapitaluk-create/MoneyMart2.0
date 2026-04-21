const STORAGE_KEY = 'mm_affiliate_click_logs'

export const trackAffiliateClick = ({ product = {}, source = 'unknown' } = {}) => {
  try {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    logs.unshift({
      at: new Date().toISOString(),
      source,
      product_id: product?.id || null,
      product_name: product?.name || '',
      provider: product?.provider || '',
      ad_provider: product?.ad_provider || '',
      affiliate_url: product?.affiliate_url || product?.apply_url || '',
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 200)))
  } catch {
    // Ignore tracking failures in client-only demo mode.
  }
}

