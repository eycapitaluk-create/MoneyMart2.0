/**
 * Remove duplicate community seed posts:
 * 1) Drop 【時埋め】 posts when another post exists in the same JST hour bucket.
 * 2) Drop exact duplicate content (keep earliest by created_at).
 *
 *   node scripts/dedupe-community-seed-posts.mjs
 *   node scripts/dedupe-community-seed-posts.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = val
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env.local'))
loadEnvFile(path.resolve(__dirname, '..', '.env'))

const DRY_RUN = process.argv.includes('--dry-run')
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim()
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const GAP_PREFIX = '【時埋め】'

function jstHourKey(isoOrDate) {
  const t = new Date(isoOrDate).getTime() + 9 * 3600000
  const jst = new Date(t)
  return `${jst.toISOString().slice(0, 10)}:${jst.getUTCHours()}`
}

async function listSeedAuthorIds() {
  const ids = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users || []) {
      if (String(u.email || '').toLowerCase().includes('@community.seed')) ids.push(u.id)
    }
    if (!data.users?.length || data.users.length < 200) break
  }
  return ids
}

async function deletePosts(postIds) {
  if (!postIds.length) return
  if (DRY_RUN) return
  const chunk = 100
  for (let i = 0; i < postIds.length; i += chunk) {
    const slice = postIds.slice(i, i + chunk)
    await admin.from('lounge_comments').delete().in('post_id', slice)
    await admin.from('lounge_post_tags').delete().in('post_id', slice)
    await admin.from('lounge_post_likes').delete().in('post_id', slice)
    await admin.from('lounge_post_bookmarks').delete().in('post_id', slice)
    await admin.from('lounge_posts').delete().in('id', slice)
  }
}

async function main() {
  const authorIds = await listSeedAuthorIds()
  if (!authorIds.length) {
    console.log('No seed authors found.')
    return
  }

  const { data: posts, error } = await admin
    .from('lounge_posts')
    .select('id,title,content,created_at')
    .in('author_id', authorIds)
    .gte('created_at', '2026-07-01T00:00:00+09:00')
    .order('created_at')
  if (error) throw error

  const toDelete = new Set()

  // Rule 1: gap-fill overlaps same hour as a better post
  const byHour = new Map()
  for (const p of posts || []) {
    const k = jstHourKey(p.created_at)
    if (!byHour.has(k)) byHour.set(k, [])
    byHour.get(k).push(p)
  }
  for (const [, arr] of byHour) {
    if (arr.length <= 1) continue
    const gapFills = arr.filter((p) => String(p.title || '').startsWith(GAP_PREFIX))
    const others = arr.filter((p) => !String(p.title || '').startsWith(GAP_PREFIX))
    if (gapFills.length && others.length) {
      for (const p of gapFills) toDelete.add(p.id)
    }
  }

  // Rule 2: exact same content (keep earliest)
  const byContent = new Map()
  for (const p of posts || []) {
    if (toDelete.has(p.id)) continue
    const k = String(p.content || '').trim()
    if (!k) continue
    if (!byContent.has(k)) byContent.set(k, [])
    byContent.get(k).push(p)
  }
  for (const [, arr] of byContent) {
    if (arr.length <= 1) continue
    const sorted = [...arr].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    for (const p of sorted.slice(1)) toDelete.add(p.id)
  }

  const ids = [...toDelete]
  console.log(DRY_RUN ? `[dry-run] Would delete ${ids.length} duplicate posts` : `Deleting ${ids.length} duplicate posts…`)

  if (ids.length <= 20 || DRY_RUN) {
    for (const id of ids) {
      const p = posts.find((x) => x.id === id)
      console.log(`  - ${p?.title?.slice(0, 60) || id}`)
    }
  } else {
    console.log(`  (first 10 of ${ids.length})`)
    for (const id of ids.slice(0, 10)) {
      const p = posts.find((x) => x.id === id)
      console.log(`  - ${p?.title?.slice(0, 60) || id}`)
    }
  }

  await deletePosts(ids)

  // verify
  const { data: after } = await admin
    .from('lounge_posts')
    .select('created_at,title')
    .in('author_id', authorIds)
    .gte('created_at', '2026-07-01T00:00:00+09:00')
  const byHour2 = new Map()
  for (const p of after || []) {
    const k = jstHourKey(p.created_at)
    byHour2.set(k, (byHour2.get(k) || 0) + 1)
  }
  const overlapGap = (after || []).filter((p) => String(p.title || '').startsWith(GAP_PREFIX)).length
  const multi = [...byHour2.values()].filter((c) => c > 1).length
  console.log(`Remaining seed posts: ${after?.length || 0}`)
  console.log(`Remaining 【時埋め】 posts: ${overlapGap}`)
  console.log(`Hour buckets with >1 post: ${multi}`)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
