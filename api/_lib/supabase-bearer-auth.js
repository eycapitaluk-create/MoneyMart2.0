import { createClient } from '@supabase/supabase-js'

export function getSupabaseEnv() {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const supabaseAnon = String(
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  ).trim()
  const serviceKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
  ).trim()
  return { supabaseUrl, supabaseAnon, serviceKey }
}

export function sendBillingJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.end(JSON.stringify(payload))
}

export async function readJsonBody(req) {
  const raw = await new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
  if (!raw || !String(raw).trim()) return {}
  return JSON.parse(raw)
}

export async function requireSupabaseUser(req) {
  const { supabaseUrl, supabaseAnon, serviceKey } = getSupabaseEnv()
  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    const err = new Error('Supabase env missing')
    err.status = 500
    throw err
  }

  const auth = String(req.headers.authorization || '')
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  if (!bearer) {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnon)
  const { data: authData, error: authErr } = await supabaseUser.auth.getUser(bearer)
  if (authErr || !authData?.user?.id) {
    const err = new Error('Invalid session')
    err.status = 401
    throw err
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  return { user: authData.user, admin, supabaseUrl, supabaseAnon, serviceKey }
}
