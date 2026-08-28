import { ingestFxRates } from '../api/_lib/fx-rates.js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required')
}

const result = await ingestFxRates({ supabaseUrl, serviceRoleKey })
console.log(JSON.stringify(result, null, 2))
