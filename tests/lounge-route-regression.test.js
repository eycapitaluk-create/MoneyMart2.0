import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')

test('/lounge resolves to the community implementation', async () => {
  const [appSource, loungePageSource, loungeV2Source] = await Promise.all([
    readSource('src/App.jsx'),
    readSource('src/pages/LoungePage.jsx'),
    readSource('src/pages/LoungePageV2.jsx'),
  ])

  assert.match(appSource, /import\('\.\/pages\/LoungePage'\)/)
  assert.match(appSource, /path="\/lounge".*<LoungePage/s)
  assert.match(
    loungePageSource,
    /export\s+\{\s*default\s*\}\s+from\s+['"]\.\/LoungePageV2['"]/,
  )
  assert.doesNotMatch(loungePageSource, /InsightsPage/)
  assert.match(loungeV2Source, /export default function LoungePageV2/)
  assert.match(loungeV2Source, /\bfetchFeed\(/)
})
