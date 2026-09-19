const pct1 = (num, den) => {
  if (!den || !Number.isFinite(Number(num))) return null
  return Math.round((Number(num) / den) * 1000) / 10
}

const herfindahl = (values) => {
  const total = values.reduce((s, v) => s + v, 0)
  if (!total) return 0
  const shares = values.map((v) => (v / total) * 100)
  return Math.round(shares.reduce((acc, s) => acc + s * s, 0) * 10) / 10
}

export function buildSiteAdvancedAnalysis(analytics = {}) {
  const sessions = Number(analytics.uniqueSessionsPageView || 0)
  const pageViews = Number(analytics.pageViews || 0)
  const searches = Number(analytics.searches || 0)
  const clicks = Number(analytics.productClicks || 0)
  const landing = Number(analytics.landingViews || 0)

  const act = analytics.activity || {}
  const dau = Array.isArray(act.dauDaily) ? act.dauDaily : []
  const avgDau = dau.length
    ? dau.reduce((s, r) => s + Number(r.activeSessions || 0), 0) / dau.length
    : 0
  const wau = Number(act.rolling?.wauSessions || 0)
  const mau = Number(act.rolling?.mauSessionsWindow || sessions || 0)
  const loggedIn = Number(act.cohortSessions?.loggedInSessions || 0)
  const anonymous = Number(act.cohortSessions?.anonymousSessions || 0)
  const returning = Number(act.cohortSessions?.returningUserSessions || 0)
  const newUsers = Number(act.cohortSessions?.newUserSessions || 0)

  const pages = Array.isArray(analytics.topPages) ? analytics.topPages : []
  const pageViewsListed = pages.reduce((s, r) => s + Number(r.views || 0), 0)
  const top3Views = pages.slice(0, 3).reduce((s, r) => s + Number(r.views || 0), 0)

  const funnel = Array.isArray(analytics.funnel) ? analytics.funnel : []
  const funnelDropoffs = funnel.map((row, idx) => {
    const prev = idx === 0 ? Number(row.sessions || 0) : Number(funnel[idx - 1].sessions || 0)
    const cur = Number(row.sessions || 0)
    return {
      step: row.step,
      sessions: cur,
      dropoffPct: idx === 0 ? 0 : pct1(Math.max(0, prev - cur), prev),
      keepPct: pct1(cur, prev),
    }
  })
  const worstDrop = [...funnelDropoffs].slice(1).sort((a, b) => (b.dropoffPct || 0) - (a.dropoffPct || 0))[0] || null

  const stickinessDauMau = mau > 0 ? Math.round((avgDau / mau) * 1000) / 10 : null
  const stickinessWauMau = mau > 0 ? pct1(wau, mau) : null

  let constraint = 'volume'
  let constraintNote = 'Not enough session volume to isolate a product constraint.'
  if (sessions >= 40 && (pct1(clicks, sessions) ?? 0) < 8) {
    constraint = 'engagement'
    constraintNote = 'Sessions are not converting into product clicks.'
  } else if (sessions >= 40 && (pct1(searches, sessions) ?? 0) < 5 && clicks > 0) {
    constraint = 'discovery'
    constraintNote = 'Users click products but search intensity is low — browse-led, not query-led.'
  } else if (stickinessDauMau != null && stickinessDauMau < 8 && mau >= 50) {
    constraint = 'retention'
    constraintNote = 'DAU/MAU is thin — users visit once and do not return in-window.'
  } else if (worstDrop && (worstDrop.dropoffPct || 0) >= 70) {
    constraint = 'funnel'
    constraintNote = `Largest funnel loss is after “${worstDrop.step}”.`
  } else if (sessions >= 40) {
    constraint = 'scale'
    constraintNote = 'Engagement ratios look usable; next lever is more qualified traffic.'
  }

  return {
    rates: {
      pagesPerSession: sessions > 0 ? Math.round((pageViews / sessions) * 100) / 100 : null,
      searchPerSessionPct: pct1(searches, sessions),
      clickPerSessionPct: pct1(clicks, sessions),
      landingPerSessionPct: pct1(landing, sessions),
    },
    stickiness: {
      avgDau,
      wau,
      mau,
      dauMauPct: stickinessDauMau,
      wauMauPct: stickinessWauMau,
      loggedInSharePct: pct1(loggedIn, loggedIn + anonymous),
      returningSharePct: pct1(returning, newUsers + returning),
    },
    concentration: {
      pageHhi: herfindahl(pages.map((r) => Number(r.views || 0))),
      top3PageSharePct: pct1(top3Views, pageViewsListed),
    },
    funnelDropoffs,
    worstDrop,
    constraint,
    constraintNote,
  }
}
