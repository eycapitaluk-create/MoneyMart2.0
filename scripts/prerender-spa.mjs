/**
 * Post-build SPA prerender: starts `vite preview`, captures fully rendered HTML with Playwright,
 * writes dist/<path>/index.html so Vercel "filesystem" serves real HTML before the SPA fallback.
 *
 * Requires: npm run build first, and Chromium: `npx playwright install chromium`
 *
 * Skip: SKIP_PRERENDER=1 npm run build
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dist = join(root, 'dist')

const PORT = Number(process.env.PRERENDER_PORT || 4179)
const BASE = `http://localhost:${PORT}`

/** SEO / thin-tool routes (avoid auth-gated pages). */
const ROUTES = [
  '/',
  '/dividend-calendar',
  '/budget-tracker',
  '/tools',
  '/insights',
  '/market-indicator',
  '/etf-compare',
  '/funds',
  '/funds/compare',
  '/stocks',
  '/news',
  '/faq',
  '/about',
]

function startPreview() {
  const viteCli = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  return spawn(process.execPath, [viteCli, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'inherit',
  })
}

async function waitForServer(maxMs = 120000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) })
      if (r.ok || r.status === 404) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`Preview server did not respond at ${BASE} within ${maxMs}ms`)
}

async function main() {
  if (process.env.SKIP_PRERENDER === '1') {
    console.log('[prerender] SKIP_PRERENDER=1 — skipping.')
    return
  }

  const preview = startPreview()

  try {
    await waitForServer()
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      locale: 'ja-JP',
      userAgent:
        'Mozilla/5.0 (compatible; MoneyMartPrerender/1.0; +https://www.moneymart.co.jp)',
    })

    for (const route of ROUTES) {
      const page = await context.newPage()
      try {
        await page.goto(`${BASE}${route}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        })
        await page.waitForSelector('#root', { timeout: 90000 })
        // Let React + Helmet + data effects settle (avoids empty #root in HTML).
        await page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {})
        await new Promise((r) => setTimeout(r, 800))
        const html = await page.content()
        const rel = route === '/' ? '' : route.replace(/^\//, '')
        const outDir = rel ? join(dist, rel) : dist
        await mkdir(outDir, { recursive: true })
        const outFile = join(outDir, 'index.html')
        await writeFile(outFile, html, 'utf8')
        console.log('[prerender]', route, '→', outFile)
      } catch (err) {
        console.error('[prerender] failed:', route, err?.message || err)
        throw err
      } finally {
        await page.close()
      }
    }

    await browser.close()
  } finally {
    preview.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 500))
    try {
      preview.kill('SIGKILL')
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error('[prerender]', e)
  console.error('\nTip: npx playwright install chromium')
  process.exit(1)
})
