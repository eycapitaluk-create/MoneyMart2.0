/**
 * Strip visible mm-community-seed markers from lounge_posts / lounge_comments.
 *
 *   node scripts/strip-community-seed-markers.mjs
 *   node scripts/strip-community-seed-markers.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'))
loadEnvFile(path.resolve(__dirname, '..', '.env'))

const DRY_RUN = process.argv.includes('--dry-run')
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
).trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const MARKER_RE = /mm-community-seed[\w-]*/i

function extractMarker(text = '') {
  const m = String(text).match(MARKER_RE)
  return m ? m[0].toLowerCase() : null
}

function stripMarkers(text = '') {
  let out = String(text ?? '')
  if (!MARKER_RE.test(out)) return out
  out = out.replace(/<!--\s*mm-community-seed[\w-]*\s*-->/gi, '')
  out = out.replace(/^\s*mm-community-seed[\w-]*\s*$/gim, '')
  out = out.replace(/\s*mm-community-seed[\w-]*\s*/gi, ' ')
  out = out.replace(/[ \t]+\n/g, '\n')
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.replace(/\s+$/, '').trim()
}

async function main() {
  const { data: posts, error } = await admin
    .from('lounge_posts')
    .select('id, title, content')
    .or('content.ilike.%mm-community-seed%,title.ilike.%mm-community-seed%')
  if (error) throw error

  console.log(`Found ${posts?.length || 0} posts with seed markers`)

  let updatedPosts = 0
  for (const post of posts || []) {
    const marker = extractMarker(post.content) || extractMarker(post.title)
    const nextTitle = stripMarkers(post.title || '')
    const nextContent = stripMarkers(post.content || '')
    if (DRY_RUN) {
      console.log(`[dry-run] post ${post.id} marker=${marker}`)
      updatedPosts += 1
      continue
    }
    const { error: updErr } = await admin
      .from('lounge_posts')
      .update({ title: nextTitle, content: nextContent })
      .eq('id', post.id)
    if (updErr) {
      console.error('post update failed', post.id, updErr.message)
      continue
    }
    updatedPosts += 1
  }

  const { data: comments, error: cErr } = await admin
    .from('lounge_comments')
    .select('id, content')
    .ilike('content', '%mm-community-seed%')
  if (cErr) throw cErr

  console.log(`Found ${comments?.length || 0} comments with seed markers`)
  let updatedComments = 0
  for (const row of comments || []) {
    const next = stripMarkers(row.content || '')
    if (DRY_RUN) {
      updatedComments += 1
      continue
    }
    const { error: updErr } = await admin
      .from('lounge_comments')
      .update({ content: next })
      .eq('id', row.id)
    if (updErr) {
      console.error('comment update failed', row.id, updErr.message)
      continue
    }
    updatedComments += 1
  }

  console.log(
    DRY_RUN
      ? `Dry run: would clean ${updatedPosts} posts, ${updatedComments} comments`
      : `Done: cleaned ${updatedPosts} posts, cleaned ${updatedComments} comments`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
