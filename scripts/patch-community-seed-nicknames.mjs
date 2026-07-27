/**
 * One-shot: seed personas use nicknames only (not 田中健太-style names).
 * Updates user_profiles, lounge_posts.author_name, lounge_comments.author_name.
 *
 *   node scripts/patch-community-seed-nicknames.mjs
 *   node scripts/patch-community-seed-nicknames.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMMUNITY_SEED_PERSONAS } from '../api/_lib/community-seed-personas.js'

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

async function findUserIdByEmail(emailNorm) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => String(u.email || '').toLowerCase() === emailNorm)
    if (hit) return hit.id
    if (!data.users?.length || data.users.length < 200) return null
    page += 1
  }
}

async function main() {
  const nicknameByUserId = new Map()

  for (const persona of COMMUNITY_SEED_PERSONAS) {
    const email = persona.email.toLowerCase()
    const nickname = String(persona.nickname || '').trim()
    const userId = await findUserIdByEmail(email)
    if (!userId) {
      console.log(`skip (no user): ${email}`)
      continue
    }
    nicknameByUserId.set(userId, nickname)

    if (DRY_RUN) {
      console.log(`[dry-run] profile ${email} -> nickname=${nickname}`)
      continue
    }

    await admin.from('user_profiles').upsert({
      user_id: userId,
      nickname,
      full_name: null,
    }, { onConflict: 'user_id' })

    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { nickname, display_name: nickname },
    })

    console.log(`profile ${email} -> ${nickname}`)
  }

  const userIds = [...nicknameByUserId.keys()]
  if (userIds.length === 0) {
    console.log('No seed users found.')
    return
  }

  for (const [userId, nickname] of nicknameByUserId) {
    if (DRY_RUN) {
      console.log(`[dry-run] posts/comments author_id=${userId} -> ${nickname}`)
      continue
    }
    const { error: postErr } = await admin
      .from('lounge_posts')
      .update({ author_name: nickname })
      .eq('author_id', userId)
    if (postErr) console.error('posts update', userId, postErr.message)
    else console.log(`posts ${userId} -> ${nickname}`)

    const { error: cErr } = await admin
      .from('lounge_comments')
      .update({ author_name: nickname })
      .eq('author_id', userId)
    if (cErr) console.error('comments update', userId, cErr.message)
    else console.log(`comments ${userId} -> ${nickname}`)
  }

  console.log(DRY_RUN ? 'Dry run complete.' : `Patched ${userIds.length} seed users.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
