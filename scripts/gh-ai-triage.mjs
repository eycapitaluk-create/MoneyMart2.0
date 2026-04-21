#!/usr/bin/env node
/**
 * GitHub Actions: 실패/경고 컨텍스트를 짧게 정리해 GITHUB_STEP_SUMMARY에 기록.
 *
 * 사용:
 *   node scripts/gh-ai-triage.mjs ci [lint.log] [build.log]
 *   node scripts/gh-ai-triage.mjs cron [dir]   # dir 안에 *.code / *.body (curl 결과)
 *
 * Env: ANTHROPIC_API_KEY (없으면 원문만 요약 섹션에 붙임)
 * Optional: INTERNAL_CLAUDE_MODEL (기본 claude-3-5-haiku-20241022)
 */
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022'
const MAX_CHUNK = 24000

const appendSummary = async (markdown) => {
  const p = process.env.GITHUB_STEP_SUMMARY
  if (!p) {
    process.stdout.write(`\n---\n${markdown}\n`)
    return
  }
  await fs.appendFile(p, `\n${markdown}\n`)
}

const readTrim = async (filePath) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const t = raw.trim()
    if (t.length <= MAX_CHUNK) return t
    return `${t.slice(0, MAX_CHUNK)}\n\n… [truncated ${t.length - MAX_CHUNK} chars]`
  } catch {
    return ''
  }
}

const triageWithClaude = async (mode, blob) => {
  const key = String(process.env.ANTHROPIC_API_KEY || '').trim().replace(/^["']|["']$/g, '')
  if (!key) return null

  const system =
    mode === 'cron'
      ? 'You are helping MoneyMart operators triage production cron HTTP responses. Be concise: status codes, ok:false reasons, next checks. No fabrication—only use the pasted text. Japanese or English matching the input.'
      : 'You are helping MoneyMart developers fix CI (eslint/vite build). Be concise: likely root cause, file hints, next commands. No fabrication. Japanese or English matching the input.'

  const model = String(process.env.INTERNAL_CLAUDE_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const client = new Anthropic({ apiKey: key })
  const res = await client.messages.create({
    model,
    max_tokens: 2048,
    temperature: 0.15,
    system: system,
    messages: [
      {
        role: 'user',
        content: `Context (${mode}):\n\n${blob}`,
      },
    ],
  })
  return (res.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

const runCi = async (args) => {
  const lintLog = args[0] || 'lint.log'
  const buildLog = args[1] || 'build.log'
  const parts = []
  if (existsSync(lintLog)) {
    parts.push(`### ${lintLog}\n\`\`\`\n${await readTrim(lintLog)}\n\`\`\``)
  } else {
    parts.push(`### ${lintLog}\n_(missing)_`)
  }
  if (existsSync(buildLog)) {
    parts.push(`### ${buildLog}\n\`\`\`\n${await readTrim(buildLog)}\n\`\`\``)
  } else {
    parts.push(`### ${buildLog}\n_(missing)_`)
  }
  const blob = parts.join('\n\n')
  let md = `## CI triage\n\n`
  const ai = await triageWithClaude('ci', blob)
  if (ai) md += `### AI メモ（参考・必ずログ本体を確認）\n\n${ai}\n\n`
  md += `### Raw excerpts\n\n${blob}`
  await appendSummary(md)
}

const runCron = async (args) => {
  const dir = path.resolve(args[0] || 'cron-health')
  const names = ['market-news', 'ai-news']
  const chunks = []
  let overallOk = true

  for (const name of names) {
    const codePath = path.join(dir, `${name}.code`)
    const bodyPath = path.join(dir, `${name}.body`)
    const codeRaw = existsSync(codePath) ? await readTrim(codePath) : ''
    const codeFirst = codeRaw.split(/\n/)[0].trim() || 'missing'

    let bodyDisplay = ''
    let bodyFull = ''
    if (existsSync(bodyPath)) {
      bodyFull = await fs.readFile(bodyPath, 'utf8').catch(() => '')
      bodyDisplay = bodyFull.length <= MAX_CHUNK ? bodyFull.trim() : `${bodyFull.slice(0, MAX_CHUNK).trim()}\n\n… [truncated]`
    }

    if (codeFirst !== '200') overallOk = false
    else {
      try {
        const j = JSON.parse(bodyFull)
        if (j && Object.prototype.hasOwnProperty.call(j, 'ok') && j.ok === false) overallOk = false
      } catch {
        overallOk = false
      }
    }

    chunks.push(`## ${name}\nHTTP: ${codeFirst}\n\n\`\`\`\n${bodyDisplay || '(empty)'}\n\`\`\``)
  }

  const blob = chunks.join('\n\n')

  let md = `## Cron health\n\n`
  if (overallOk) {
    md += `market-news / ai-news: HTTP 200 かつ JSON の \`ok\` が false ではありません。\n\n`
  } else {
    md += `_失敗または異常な応答があります。下記と元ログを確認してください。_\n\n`
  }

  const ai = await triageWithClaude('cron', blob)
  if (ai) md += `### AI メモ（参考・必ずレスポンス本文を確認）\n\n${ai}\n\n`
  md += blob
  await appendSummary(md)

  if (!overallOk) process.exitCode = 1
}

const main = async () => {
  const mode = (process.argv[2] || '').toLowerCase()
  const rest = process.argv.slice(3)
  if (mode === 'ci') await runCi(rest)
  else if (mode === 'cron') await runCron(rest)
  else {
    console.error('Usage: node scripts/gh-ai-triage.mjs ci [lint.log] [build.log]')
    console.error('       node scripts/gh-ai-triage.mjs cron [dir]')
    process.exit(1)
  }
}

main().catch(async (e) => {
  await appendSummary(`## Triage script error\n\n\`${e?.message || e}\``)
  console.error(e)
  process.exit(1)
})
