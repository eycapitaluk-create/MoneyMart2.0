/**
 * Client-side fallback for stock names when stock_symbol_profiles / stock_symbols lack name_jp/name_en
 * Used when DB has no company name to avoid showing only ticker code
 */

/** Override DB display names when DB has wrong/misleading data */
export const DISPLAY_NAME_OVERRIDE = new Map([
  ['DAY', 'デイフォース / Dayforce'], // Ceridian rebranded to Dayforce 2024, ticker CDAY→DAY
])

export const STOCK_NAME_FALLBACK = new Map([
  ['AAPL', 'Apple'], ['MSFT', 'Microsoft'], ['NVDA', 'NVIDIA'], ['AMZN', 'Amazon'], ['META', 'Meta'],
  ['GOOGL', 'Alphabet'], ['GOOG', 'Alphabet'], ['TSLA', 'Tesla'], ['AVGO', 'Broadcom'], ['AMD', 'AMD'],
  ['ORCL', 'Oracle'], ['NFLX', 'Netflix'], ['CRM', 'Salesforce'], ['ADBE', 'Adobe'], ['INTC', 'Intel'],
  ['QCOM', 'Qualcomm'], ['TXN', 'Texas Instruments'], ['MU', 'Micron'], ['CSCO', 'Cisco'], ['IBM', 'IBM'],
  ['JPM', 'JPMorgan Chase'], ['GS', 'Goldman Sachs'], ['MS', 'Morgan Stanley'], ['BAC', 'Bank of America'],
  ['WFC', 'Wells Fargo'], ['C', 'Citigroup'], ['BLK', 'BlackRock'], ['V', 'Visa'], ['MA', 'Mastercard'],
  ['XOM', 'Exxon Mobil'], ['CVX', 'Chevron'], ['COP', 'ConocoPhillips'], ['WMT', 'Walmart'],
  ['COST', 'Costco'], ['HD', 'Home Depot'], ['MCD', "McDonald's"], ['KO', 'Coca-Cola'], ['PEP', 'PepsiCo'],
  ['JNJ', 'Johnson & Johnson'], ['PFE', 'Pfizer'], ['MRK', 'Merck'], ['UNH', 'UnitedHealth'],
  ['ABBV', 'AbbVie'], ['LLY', 'Eli Lilly'], ['TMO', 'Thermo Fisher'], ['ABT', 'Abbott'], ['DHR', 'Danaher'],
  ['CAT', 'Caterpillar'], ['GE', 'General Electric'], ['DE', 'Deere'], ['HON', 'Honeywell'],
  ['LMT', 'Lockheed Martin'], ['RTX', 'RTX'], ['NOC', 'Northrop Grumman'], ['BA', 'Boeing'],
  ['ASML', 'ASML'], ['NVO', 'Novo Nordisk'], ['SAP', 'SAP'], ['SHEL', 'Shell'], ['HSBC', 'HSBC'],
  ['BP', 'BP'], ['RIO', 'Rio Tinto'], ['AZN', 'AstraZeneca'], ['BRK.B', 'Berkshire Hathaway'], ['BRK-B', 'Berkshire Hathaway'],
  ['NOW', 'ServiceNow'], ['LOW', "Lowe's"], ['SO', 'Southern Company'], ['ITW', 'Illinois Tool Works'],
  ['MCK', 'McKesson'], ['USB', 'U.S. Bancorp'], ['MOS', 'Mosaic'], ['WDC', 'Western Digital'],
  ['ULTA', 'Ulta Beauty'], ['CE', 'Celanese'], ['CF', 'CF Industries'], ['FICO', 'Fair Isaac'],
  ['CNC', 'Centene'], ['CPB', 'Campbell Soup'], ['CAG', 'Conagra Brands'],
  ['CI', 'Cigna'], ['SLB', 'Schlumberger'], ['BDX', 'Becton Dickinson'], ['EOG', 'EOG Resources'],
  ['PANW', 'Palo Alto Networks'], ['KLAC', 'KLA'], ['SNPS', 'Synopsys'], ['ZTS', 'Zoetis'],
  ['MO', 'Altria'], ['TJX', 'TJX Companies'], ['BKNG', 'Booking Holdings'], ['ISRG', 'Intuitive Surgical'],
  ['SYK', 'Stryker'], ['AXP', 'American Express'], ['PLD', 'Prologis'], ['ELV', 'Elevance Health'],
  ['VRT', 'Vertiv Holdings'],
  ['ADI', 'Analog Devices'], ['MDLZ', 'Mondelez'], ['REGN', 'Regeneron'], ['MMC', 'Marsh McLennan'],
  ['GILD', 'Gilead'], ['CVS', 'CVS Health'], ['LIN', 'Linde'], ['ACN', 'Accenture'], ['NEE', 'NextEra Energy'],
  ['PM', 'Philip Morris'], ['INTU', 'Intuit'], ['AMGN', 'Amgen'], ['SPGI', 'S&P Global'],
])

export const getStockNameFallback = (symbol) => {
  if (!symbol) return null
  const key = String(symbol).trim().toUpperCase()
  return STOCK_NAME_FALLBACK.get(key) || null
}

export const getDisplayNameOverride = (symbol) => {
  if (!symbol) return null
  const key = String(symbol).trim().toUpperCase()
  return DISPLAY_NAME_OVERRIDE.get(key) || null
}
