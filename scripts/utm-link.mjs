#!/usr/bin/env node
/**
 * Mint a canonical tracked MoneyMart link.
 *
 *   node scripts/utm-link.mjs --source twitter --campaign reply_strategy --content pinned
 *   node scripts/utm-link.mjs --source note --path /premium --campaign nisa_guide
 *   node scripts/utm-link.mjs --list
 *
 * Canonical sources keep traffic in its own dashboard channel. An off-registry
 * source still tracks, but lands in "UTM tagged (other)".
 */

import { UTM_SOURCES, buildUtmLink, isCanonicalUtmSource } from '../src/lib/utmLinks.js'

const args = process.argv.slice(2)
const flag = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}

if (args.includes('--list') || args.length === 0) {
  console.log('Canonical sources:\n')
  for (const s of UTM_SOURCES) {
    console.log(`  ${s.source.padEnd(12)} medium=${s.medium.padEnd(8)} ${s.label}`)
  }
  console.log('\nUsage: node scripts/utm-link.mjs --source <source> [--path /] [--campaign name] [--content placement]')
  process.exit(0)
}

const source = flag('source')
const campaign = flag('campaign')

if (!source) {
  console.error('Missing --source. Run with --list to see canonical sources.')
  process.exit(1)
}
if (!campaign) {
  console.error('Missing --campaign. Without it you cannot tell placements apart later.')
  process.exit(1)
}
if (!isCanonicalUtmSource(source)) {
  console.error(`Warning: "${source}" is not canonical — it will bucket as "UTM tagged (other)".`)
}

console.log(buildUtmLink({
  source,
  path: flag('path', '/'),
  campaign,
  content: flag('content'),
  medium: flag('medium'),
}))
