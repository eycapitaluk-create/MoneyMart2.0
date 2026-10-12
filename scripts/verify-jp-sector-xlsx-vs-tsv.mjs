/**
 * jp stock data classification.xlsx の sector 適用結果が、StockPage.jsx と同じ正規化＋7012オーバーライドを通したときに
 * reports/JP_STOCK_SYMBOL_SECTORS.tsv（DBスナップショット相当）と一致するか検証する。
 *
 *   node scripts/verify-jp-sector-xlsx-vs-tsv.mjs [path.xlsx] [--tsv=reports/JP_STOCK_SYMBOL_SECTORS.tsv]
 *
 * （apply スクリプトと同じ列解釈: A symbol, B sector, C NEW, D industry…）
 */
import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'

/** StockPage.jsx と同一（コピペで同期推奨） */
const STOCK_SECTOR_OVERRIDE_BY_SYMBOL = new Map([
  ['7012.T', '資本財・産業'],
])

function normalizeSectorName(value) {
  const sector = String(value || '').trim()
  if (!sector || /market/i.test(sector)) return '未分類'
  if (sector === '公益') return '電力・ガス'
  const lower = sector.toLowerCase()
  const exactMap = {
    technology: 'テクノロジー',
    tech: 'テクノロジー',
    financial: '金融',
    financials: '金融',
    finance: '金融',
    healthcare: 'ヘルスケア',
    'health care': 'ヘルスケア',
    industrial: '資本財・産業',
    industrials: '資本財・産業',
    consumer: '一般消費財',
    'consumer discretionary': '一般消費財',
    'consumer staples': '生活必需品',
    communication: 'コミュニケーション',
    'communication services': 'コミュニケーション',
    energy: 'エネルギー',
    materials: '素材',
    utilities: '電力・ガス',
    'real estate': '不動産',
    'sector etf': 'セクターETF',
    'index etf': '指数ETF',
    'thematic etf': 'テーマETF',
    'dividend etf': '高配当ETF',
    'fixed income etf': '債券ETF',
    'international equity etf': '海外株式ETF',
    'global equity etf': 'グローバル株式ETF',
    'commodity etf': '原材料ETF',
  }
  if (exactMap[lower]) return exactMap[lower]
  if (lower.includes('tech')) return 'テクノロジー'
  if (lower.includes('financ')) return '金融'
  if (lower.includes('health')) return 'ヘルスケア'
  if (lower.includes('consumer')) return '一般消費財'
  if (lower.includes('industrial')) return '資本財・産業'
  if (lower.includes('energy')) return 'エネルギー'
  if (lower.includes('material')) return '素材'
  if (lower.includes('utilit')) return '電力・ガス'
  if (lower.includes('communicat')) return 'コミュニケーション'
  if (lower.includes('real estate')) return '不動産'
  if (lower.includes('etf')) return 'ETF'
  return sector
}

function displayedSectorFromRawDb(symbol, rawDbSector) {
  const raw = String(rawDbSector ?? '').trim()
  const base = raw ? normalizeSectorName(raw) : '未分類'
  return STOCK_SECTOR_OVERRIDE_BY_SYMBOL.get(symbol) || base
}

function displayedSectorFromExcelRaw(effectiveSector, symbol) {
  return STOCK_SECTOR_OVERRIDE_BY_SYMBOL.get(symbol) || normalizeSectorName(effectiveSector || '')
}

const clean = (v) => {
  if (v == null) return ''
  return String(v).trim()
}

/** @returns { Map<string, { rawSector: string|null, displayed: string }> } */
function parseXlsxSectorBySymbol(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath, { cellDates: true })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    raw: true,
  })
  const headerIdx = rows.findIndex(
    (r) => Array.isArray(r) && clean(r[0]).toLowerCase() === 'symbol',
  )
  if (headerIdx < 0) throw new Error('header row with "symbol" not found')

  const out = new Map()
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!Array.isArray(r)) continue
    const symbol = clean(r[0]).toUpperCase()
    if (!symbol || !symbol.endsWith('.T')) continue
    const sectorCol = clean(r[1])
    const newCol = clean(r[2])
    const effective = newCol || sectorCol || ''
    const rawSector = effective || null
    const displayed = displayedSectorFromExcelRaw(effective, symbol)
    out.set(symbol, { rawSector, displayed })
  }
  return out
}

/** @returns { Map<string, string> } symbol -> DB raw sector string */
function parseTsvSymbolsAndRawSector(tsvPath) {
  const text = fs.readFileSync(tsvPath, 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('TSV empty')
  const sep = /\t/.test(lines[0]) ? '\t' : ','
  const header = lines[0].split(sep).map((c) => c.trim().toLowerCase())
  const symIdx = header.indexOf('symbol')
  const secIdx = header.indexOf('sector')
  if (symIdx < 0 || secIdx < 0)
    throw new Error('TSV missing symbol or sector column')
  const map = new Map()
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep)
    const sym = clean(cols[symIdx]).toUpperCase()
    if (!sym) continue
    map.set(sym, clean(cols[secIdx] ?? ''))
  }
  return map
}

function main() {
  const DEFAULT_XLSX = '/Users/justinnam/Downloads/jp stock data classification.xlsx'

  let xlsxArg = ''
  let tsvPath = path.join(process.cwd(), 'reports/JP_STOCK_SYMBOL_SECTORS.tsv')

  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--tsv=')) tsvPath = a.slice(6)
    else if (!xlsxArg && !a.startsWith('--')) xlsxArg = a
  }
  const xlsxPath = xlsxArg || DEFAULT_XLSX

  console.log(`XLSX: ${xlsxPath}`)
  console.log(`TSV:  ${tsvPath}\n`)

  const excelMap = parseXlsxSectorBySymbol(xlsxPath)
  const rawTsvMap = parseTsvSymbolsAndRawSector(tsvPath)

  /** @type {{ symbol: string, excelDisplayed: string, dbDisplayed: string, excelRaw: string|null, dbRaw: string }[]} */
  const mismatches = []
  const excelOnly = []

  for (const [symbol, { rawSector, displayed: exDisp }] of excelMap) {
    const dbRaw = rawTsvMap.get(symbol)
    if (dbRaw === undefined) {
      excelOnly.push(symbol)
      continue
    }
    const dbDisp = displayedSectorFromRawDb(symbol, dbRaw)
    if (exDisp !== dbDisp) {
      mismatches.push({
        symbol,
        excelRaw: rawSector,
        dbRaw,
        excelDisplayed: exDisp,
        dbDisplayed: dbDisp,
      })
    }
  }

  const tsvNoExcel = [...rawTsvMap.keys()].filter((s) => s.endsWith('.T') && !excelMap.has(s))

  console.log(`엑셀에서 파싱한 .T 행 수: ${excelMap.size}`)
  console.log(`TSV 행 수: ${rawTsvMap.size}`)
  console.log(`엑셀 ∩ TSV 교집합: ${excelMap.size - excelOnly.length}`)
  console.log(`\n➜ 화면 라벨(정규화+7012) 불일치: ${mismatches.length}`)
  if (mismatches.length) {
    mismatches.slice(0, 50).forEach((m) =>
      console.log(
        `${m.symbol}\texcel 표시: ${m.excelDisplayed}\tTSV→표시: ${m.dbDisplayed}\t(raw 엑셀: ${m.excelRaw ?? ''}\tDB raw: ${m.dbRaw})`,
      ),
    )
    if (mismatches.length > 50) console.log(`… 외 ${mismatches.length - 50}건`)
  }

  console.log(`\n➜ 엑셀에만 있고 TSV에 없음: ${excelOnly.length}`)
  if (excelOnly.length) {
    console.log(excelOnly.sort().slice(0, 40).join(', '))
    if (excelOnly.length > 40) console.log(`… 외 ${excelOnly.length - 40}종목`)
  }

  console.log(`\n➜ TSV에만 있음 (엑셀 무행, .T): ${tsvNoExcel.length}`)
  if (tsvNoExcel.length) {
    tsvNoExcel
      .sort()
      .slice(0, 25)
      .forEach((s) =>
        console.log(
          `  ${s}\t표시:${displayedSectorFromRawDb(s, rawTsvMap.get(s))}\tdb raw:${rawTsvMap.get(s) || '(빈칸)'}`,
        ),
      )
    if (tsvNoExcel.length > 25) console.log(`  … 외 ${tsvNoExcel.length - 25}종목`)
  }

  const crossOk = mismatches.length === 0 && excelOnly.length === 0
  if (crossOk) {
    console.log(`\n결론: 엑셀의 각 .T 종목과 TSV(DB)가 **표시 섹터**까지 일치합니다.`)
    if (tsvNoExcel.length) {
      console.log(
        '      (단, 엑셀에 없는 .T 종목이 TSV에는 남아 있음 → 히트맵 등 다른 출처 종목 가능. 검증 범위는 “엑셀에 있는 줄”.)',
      )
    }
  } else {
    console.log(
      '\n결론: 엑셀 규칙(NEW‖sector)→프론트와 동일 처리한 결과와 TSV(DB)가 완전히 맞지 않습니다. apply 스크립트 재실행 후 `npm run`/export-tsv 재생성 필요.',
    )
  }

  process.exit(crossOk ? 0 : 2)
}

main()
