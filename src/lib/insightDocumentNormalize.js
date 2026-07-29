/**
 * Normalize insight document payloads before render.
 * Keeps missing/partial admin documents from crashing InsightArticleView.
 */
export function normalizeInsightDocumentForRender(docRaw = {}) {
  const doc = docRaw && typeof docRaw === 'object' ? docRaw : {}
  const hero = doc.hero && typeof doc.hero === 'object' ? { ...doc.hero } : {}
  const admin = doc.admin && typeof doc.admin === 'object' ? { ...doc.admin } : {}

  if (!Array.isArray(hero.titleLines)) {
    hero.titleLines = []
  }
  if (!Array.isArray(hero.meta)) {
    hero.meta = []
  }

  return {
    ...doc,
    hero,
    admin,
    ticker: Array.isArray(doc.ticker) ? doc.ticker : [],
    sections: Array.isArray(doc.sections) ? doc.sections : [],
    footer: doc.footer && typeof doc.footer === 'object' ? doc.footer : {},
  }
}
