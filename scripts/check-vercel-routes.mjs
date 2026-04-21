import fs from 'fs'
import path from 'path'

const root = process.cwd()
const vercelPath = path.join(root, 'vercel.json')

function fail(message) {
  console.error(`[check-vercel-routes] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(vercelPath)) {
  fail('vercel.json not found')
}

let config
try {
  config = JSON.parse(fs.readFileSync(vercelPath, 'utf8'))
} catch (error) {
  fail(`invalid vercel.json: ${error?.message || String(error)}`)
}

const routes = Array.isArray(config?.routes) ? config.routes : []

const violations = []

for (const route of routes) {
  const src = String(route?.src || '')
  const dest = String(route?.dest || '')

  // Safety rule: ETF compare must render the app UI, not SSR fallback-only HTML.
  if (/^\^\/etf-compare\/\?\$$/.test(src) && dest === '/api/ssr/etf-compare') {
    violations.push({
      src,
      dest,
      reason: 'Do not route /etf-compare directly to SSR fallback endpoint.',
    })
  }
}

if (violations.length > 0) {
  console.error('[check-vercel-routes] blocked route configuration detected:')
  for (const v of violations) {
    console.error(`- src: ${v.src} -> dest: ${v.dest}`)
    console.error(`  reason: ${v.reason}`)
  }
  process.exit(1)
}

console.log('[check-vercel-routes] OK')
