/**
 * Community seed personas — display as nicknames only (never legal-style names).
 */
import { randomBytes } from 'node:crypto'

export const COMMUNITY_SEED_PERSONAS = [
  { email: 'mm-seed-01@community.seed', nickname: 'ケンタ@積立', exp: 4200 },
  { email: 'mm-seed-02@community.seed', nickname: 'みき_nisa', exp: 3100 },
  { email: 'mm-seed-03@community.seed', nickname: 'だいすけ半導体', exp: 2800 },
  { email: 'mm-seed-04@community.seed', nickname: 'しょう_高配当', exp: 5200 },
  { email: 'mm-seed-05@community.seed', nickname: 'めぐ積立', exp: 1900 },
  { email: 'mm-seed-06@community.seed', nickname: 'なおきメモ', exp: 1500 },
  { email: 'mm-seed-07@community.seed', nickname: 'りょうETF', exp: 3600 },
  { email: 'mm-seed-08@community.seed', nickname: 'さくら株', exp: 2400 },
  { email: 'mm-seed-09@community.seed', nickname: 'たくみAI', exp: 4800 },
  { email: 'mm-seed-10@community.seed', nickname: 'ゆうま_分割', exp: 2700 },
  { email: 'mm-seed-11@community.seed', nickname: 'はやと先物', exp: 3300 },
  { email: 'mm-seed-12@community.seed', nickname: 'あやコア', exp: 2100 },
]

export const COMMUNITY_SEED_EMAILS = COMMUNITY_SEED_PERSONAS.map((p) => p.email.toLowerCase())

export function getSeedPersonaByEmail(email) {
  const norm = String(email || '').toLowerCase()
  return COMMUNITY_SEED_PERSONAS.find((p) => p.email.toLowerCase() === norm) || null
}

/** Historic formula that was committed in this public repo. Do not reuse. */
export function legacyDeterministicSeedPassword(nickname) {
  return `MmSeed!${String(nickname || '').length}99`
}

export function isLegacyDeterministicSeedPassword(password, nickname) {
  return String(password || '') === legacyDeterministicSeedPassword(nickname)
}

/**
 * Unguessable password for seed bot accounts.
 * The hourly cron uses the service role and never signs in as these users.
 */
export function generateSeedPersonaPassword() {
  return `Mm.${randomBytes(24).toString('base64url')}`
}
