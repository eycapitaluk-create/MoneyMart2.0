import fs from 'node:fs/promises'
import path from 'node:path'
import { ETF_SYMBOLS_FROM_XLSX } from '../src/data/etfListFromXlsx.js'

const run = async () => {
  const reportDir = path.resolve('reports')
  await fs.mkdir(reportDir, { recursive: true })

  const targetPath = path.join(reportDir, 'etf_expense_ratio_template.csv')
  const rows = ['symbol,expense_ratio']

  for (const symbol of ETF_SYMBOLS_FROM_XLSX) {
    rows.push(`${symbol},`)
  }

  await fs.writeFile(targetPath, `${rows.join('\n')}\n`, 'utf8')
  console.log(`Wrote: ${targetPath}`)
  console.log(`Rows: ${ETF_SYMBOLS_FROM_XLSX.length}`)
}

run().catch((err) => {
  console.error(err?.message || String(err))
  process.exit(1)
})

