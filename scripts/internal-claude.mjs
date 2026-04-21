#!/usr/bin/env node
/**
 * 내부 전용 Claude 호출 (로컬 터미널). HTTP로 노출하지 말 것.
 *
 * - 프로덕션 API 키·서비스 롤 키·유저 PII·원문 뉴스 전체 등은 프롬프트에 넣지 않기.
 * - 출력은 항상 사람이 검토한 뒤 반영 (SQL 실행, 배포 결정 등).
 *
 * 사용:
 *   node scripts/internal-claude.mjs "이 마이그레이션 의도 설명해줘: ..."
 *   cat notes.txt | node scripts/internal-claude.mjs --stdin
 *
 * Env: ANTHROPIC_API_KEY (.env.local 권장)
 * Optional: INTERNAL_CLAUDE_MODEL (기본 claude-3-5-haiku-20241022)
 */
import fs from 'node:fs/promises'
import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022'

const loadEnv = async () => {
  for (const f of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(f, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && !process.env[k]) process.env[k] = v
      }
    } catch {
      /* ignore */
    }
  }
}

const readStdin = async () => {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').trim()
}

const SYSTEM = [
  'You are an internal assistant for MoneyMart engineers and operators.',
  'Help with: code review, SQL/migrations reasoning, log triage, runbook wording, cron failure hypotheses.',
  'Do not fabricate live market numbers, user data, or API responses. If unknown, say so.',
  'Prefer concise Japanese or English matching the user message language.',
].join(' ')

const run = async () => {
  await loadEnv()
  const apiKey = String(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '').trim().replace(/^["']|["']$/g, '')
  if (!apiKey) {
    console.error('Set ANTHROPIC_API_KEY in .env.local (internal use only).')
    process.exit(1)
  }

  const argv = process.argv.slice(2)
  const useStdin = argv[0] === '--stdin' || argv[0] === '-'
  const argText = useStdin ? argv.slice(1).join(' ').trim() : argv.join(' ').trim()
  const stdinText = useStdin ? await readStdin() : ''
  const user = (stdinText || argText).trim()
  if (!user) {
    console.error(`Usage:
  node scripts/internal-claude.mjs "your question"
  cat file.txt | node scripts/internal-claude.mjs --stdin`)
    process.exit(1)
  }

  const model = String(process.env.INTERNAL_CLAUDE_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const client = new Anthropic({ apiKey })
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0.2,
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
  })
  const text = (res.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
  process.stdout.write(text)
  if (text && !text.endsWith('\n')) process.stdout.write('\n')
}

run().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
