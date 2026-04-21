import { buildEtfCompareSsrHtml } from './lib/etfCompareSsrHtml.js'
import { fetchEtfSnapshotForSsr } from './lib/fetchEtfSnapshotForSsr.js'

function sendHtml(res, status, html) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

export default async function handler(_req, res) {
  try {
    const snapshot = await fetchEtfSnapshotForSsr()
    const html = buildEtfCompareSsrHtml({ canonicalPath: '/funds/compare', snapshot })
    return sendHtml(res, 200, html)
  } catch (e) {
    const fallback = buildEtfCompareSsrHtml({ canonicalPath: '/funds/compare', snapshot: null })
    return sendHtml(res, 200, fallback)
  }
}
