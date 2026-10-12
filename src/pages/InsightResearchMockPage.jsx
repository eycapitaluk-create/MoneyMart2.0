import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  INSIGHT_RESEARCH_MOCK_DEFAULT,
  INSIGHT_RESEARCH_MOCK_STORAGE_KEY,
  normalizeInsightResearchMockDraft,
} from '../data/insightResearchMock'

const linePoints = [
  [36, 194],
  [118, 166],
  [200, 132],
  [282, 104],
  [364, 64],
  [446, 42],
  [528, 28],
]

function MiniLineChart() {
  const path = linePoints.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const area = `${path} L 528 218 L 36 218 Z`
  return (
    <svg viewBox="0 0 560 240" className="h-[260px] w-full" role="img" aria-label="AI主要銘柄パフォーマンスのモックチャート">
      {[48, 96, 144, 192].map((y) => (
        <line key={y} x1="28" x2="536" y1={y} y2={y} stroke="#f0ede8" strokeWidth="1" />
      ))}
      <path d="M 36 190 L 118 184 L 200 171 L 282 154 L 364 142 L 446 134 L 528 126" fill="none" stroke="#6b6b6b" strokeDasharray="6 6" strokeWidth="2" />
      <path d="M 36 194 L 118 182 L 200 161 L 282 130 L 364 106 L 446 90 L 528 76" fill="none" stroke="#c9a84c" strokeWidth="3" />
      <path d={area} fill="rgba(200,16,46,0.08)" />
      <path d={path} fill="none" stroke="#c8102e" strokeWidth="4" />
      {linePoints.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#c8102e" stroke="#fff" strokeWidth="2" />
      ))}
      <text x="34" y="232" fill="#6b6b6b" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo">Jan</text>
      <text x="494" y="232" fill="#6b6b6b" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo">May</text>
    </svg>
  )
}

function MiniBarChart() {
  const rows = [
    ['PER', 175, 42],
    ['Sales', 45, 62],
    ['Loss', 68, 8],
    ['Margin', 28, 72],
  ]
  return (
    <div className="space-y-4 py-4">
      {rows.map(([label, dotcom, ai]) => (
        <div key={label} className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
          <div className="font-mono text-[11px] text-stone-500">{label}</div>
          <div className="space-y-1.5">
            <div className="h-3 bg-stone-100">
              <div className="h-full bg-[#c8102e]/75" style={{ width: `${Math.min(Number(dotcom), 180) / 1.8}%` }} />
            </div>
            <div className="h-3 bg-stone-100">
              <div className="h-full bg-[#c9a84c]/80" style={{ width: `${Math.min(Number(ai), 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-5 pt-2 font-mono text-[11px] text-stone-500">
        <span><span className="mr-2 inline-block h-2 w-6 bg-[#c8102e]/75" />Dotcom</span>
        <span><span className="mr-2 inline-block h-2 w-6 bg-[#c9a84c]/80" />AI</span>
      </div>
    </div>
  )
}

function RiskRadar() {
  return (
    <svg viewBox="0 0 360 260" className="h-[260px] w-full" role="img" aria-label="AI相場リスクレーダーのモックチャート">
      <g transform="translate(180 130)">
        {[36, 72, 108].map((r) => (
          <polygon key={r} points={`0,-${r} ${r * 0.866},-${r / 2} ${r * 0.866},${r / 2} 0,${r} -${r * 0.866},${r / 2} -${r * 0.866},-${r / 2}`} fill="none" stroke="#eee8dd" />
        ))}
        <polygon points="0,-95 84,-48 72,42 0,78 -66,38 -78,-45" fill="rgba(200,16,46,0.12)" stroke="#c8102e" strokeWidth="3" />
        <polygon points="0,-50 46,-26 100,58 0,92 -72,42 -34,-20" fill="rgba(107,107,107,0.05)" stroke="#6b6b6b" strokeDasharray="5 5" strokeWidth="2" />
      </g>
      {['Options', 'Valuation', 'Margin', 'Concentration', 'Rates', 'Competition'].map((label, idx) => {
        const coords = [
          [180, 14],
          [306, 72],
          [306, 190],
          [180, 252],
          [54, 190],
          [54, 72],
        ][idx]
        return <text key={label} x={coords[0]} y={coords[1]} textAnchor="middle" fill="#6b6b6b" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, Menlo">{label}</text>
      })}
    </svg>
  )
}

function ChartMock({ index }) {
  if (index === 1) return <MiniBarChart />
  if (index === 2) return <RiskRadar />
  return <MiniLineChart />
}

function loadDraftFromStorage() {
  if (typeof window === 'undefined') return INSIGHT_RESEARCH_MOCK_DEFAULT
  try {
    const raw = window.localStorage.getItem(INSIGHT_RESEARCH_MOCK_STORAGE_KEY)
    if (!raw) return INSIGHT_RESEARCH_MOCK_DEFAULT
    return normalizeInsightResearchMockDraft(JSON.parse(raw))
  } catch {
    return INSIGHT_RESEARCH_MOCK_DEFAULT
  }
}

export function InsightResearchMockPreview({ draft: draftOverride = null, embedded = false }) {
  const [storedDraft, setStoredDraft] = useState(() => loadDraftFromStorage())
  const draft = useMemo(
    () => normalizeInsightResearchMockDraft(draftOverride || storedDraft),
    [draftOverride, storedDraft],
  )
  const metaRows = useMemo(() => [
    ['Date', draft.date],
    ['Category', draft.category],
    ['Read Time', draft.readTime],
    ['Source', draft.source],
  ], [draft])

  useEffect(() => {
    if (draftOverride) return undefined
    const onStorage = (event) => {
      if (event.key !== INSIGHT_RESEARCH_MOCK_STORAGE_KEY) return
      setStoredDraft(loadDraftFromStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [draftOverride])

  return (
    <div className={`mm-research-mock bg-[#f8f6f1] text-[#0f0f0f] ${embedded ? 'min-h-0' : 'min-h-screen'}`}>
      {!embedded ? (
        <Helmet>
          <title>Insight Research Mock | MoneyMart</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
      ) : null}
      <style>{`
        .mm-research-mock {
          font-family: 'Hiragino Sans', 'Yu Gothic', 'YuGothic', 'Meiryo', system-ui, sans-serif;
          font-feature-settings: "palt" 1;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }
        .mm-research-mock .font-serif {
          font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'YuMincho', 'Hiragino Mincho Pro', serif !important;
          font-feature-settings: "palt" 1;
          letter-spacing: -0.035em;
        }
        .mm-research-mock .font-mono {
          font-family: 'SFMono-Regular', 'Menlo', 'Monaco', ui-monospace, monospace !important;
        }
      `}</style>

      <header className="border-b-[3px] border-[#0f0f0f] bg-[#f8f6f1] py-5 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#c8102e]">MoneyMart Research</p>
        <p className="mt-1 font-mono text-xl font-medium tracking-[0.14em]">MARKET INTELLIGENCE REPORT</p>
      </header>

      <main>
        <section className="mx-auto mt-14 max-w-[820px] px-6 sm:px-10">
          <p className="mb-7 inline-block border border-[#c8102e] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-[#c8102e]">
            {draft.issue}
          </p>
          <h1 className="font-serif text-[2rem] font-bold leading-[1.3] tracking-[-0.02em] sm:text-[2.65rem]">
            {draft.titleLead}
            <span className="text-[#c8102e]">{draft.titleAccent}</span>
            <br />
            {draft.titleTail}
          </h1>
          <p className="mt-5 border-l-[3px] border-[#c9a84c] pl-4 text-[15px] font-light leading-8 text-[#6b6b6b] sm:text-base">
            {draft.subtitle}
          </p>
          <dl className="mt-10 grid gap-4 border-y border-[#e8e4dc] py-5 sm:grid-cols-4">
            {metaRows.map(([label, value]) => (
              <div key={label} className="font-mono text-[11px] tracking-wide text-[#6b6b6b]">
                <dt className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#c8102e]">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {draft.coverImageUrl ? (
            <figure className="mt-10 border border-[#e8e4dc] bg-white p-3">
              <img
                src={draft.coverImageUrl}
                alt=""
                className="block h-auto w-full"
                loading={embedded ? 'lazy' : 'eager'}
                decoding="async"
              />
              {draft.coverImageCaption ? (
                <figcaption className="mt-3 font-mono text-[11px] leading-5 text-[#6b6b6b]">
                  {draft.coverImageCaption}
                </figcaption>
              ) : null}
            </figure>
          ) : (
            <div className="mt-10 border border-dashed border-[#c9a84c]/70 bg-white/60 px-6 py-8 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#c9a84c]">Cover image placeholder</p>
              <p className="mt-2 text-sm text-[#6b6b6b]">관리 화면에서 이미지 URL을 넣으면 여기에 기사 대표 이미지가 표시됩니다.</p>
            </div>
          )}
        </section>

        <article className="mx-auto max-w-[820px] px-6 pb-20 pt-12 sm:px-10">
          <section className="mb-14 bg-[#0f0f0f] px-7 py-8 text-[#f8f6f1] sm:px-10">
            <h2 className="mb-5 font-mono text-[10px] uppercase tracking-[0.32em] text-[#c9a84c]">Key Findings — 3つの結論</h2>
            <ul className="space-y-3">
              {draft.findings.map((finding) => (
                <li key={finding} className="relative pl-5 text-sm leading-7 before:absolute before:left-0 before:text-[#c9a84c] before:content-['→']">
                  {finding}
                </li>
              ))}
            </ul>
          </section>

          {draft.showMarketSnapshot ? (
            <section className="mb-16">
              <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.32em] text-[#c8102e]">Market Snapshot</p>
              <div className="grid gap-5 sm:grid-cols-3">
                {draft.stats.map((stat) => (
                  <div key={`${stat.value}-${stat.label}`} className="border border-[#e8e4dc] bg-white px-5 py-6">
                    <p className={`mb-2 font-mono text-3xl font-medium leading-none ${stat.tone === 'red' ? 'text-[#c8102e]' : stat.tone === 'gold' ? 'text-[#c9a84c]' : 'text-[#0f0f0f]'}`}>
                      {stat.value}
                    </p>
                    <p className="whitespace-pre-line text-[11px] leading-5 text-[#6b6b6b]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {draft.sections.map((section, index) => (
            <section key={`${section.label}-${section.title}`} className="mb-16">
              <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.32em] text-[#c8102e]">{section.label}</p>
              <h2 className="mb-5 font-serif text-[1.65rem] font-bold leading-snug">{section.title}</h2>
              <p className="mb-5 text-[15px] leading-8 text-[#2a2a2a]">{section.body}</p>
              {section.quote ? (
                <blockquote className="my-9 border-l-4 border-[#c8102e] bg-white px-7 py-5">
                  <p className="font-serif text-lg italic leading-8">{section.quote}</p>
                </blockquote>
              ) : null}
              {section.imageUrl ? (
                <figure className="my-9 border border-[#e8e4dc] bg-white p-3">
                  <img src={section.imageUrl} alt="" className="block h-auto w-full" loading="lazy" decoding="async" />
                  {section.imageCaption ? (
                    <figcaption className="mt-3 font-mono text-[11px] leading-5 text-[#6b6b6b]">{section.imageCaption}</figcaption>
                  ) : null}
                </figure>
              ) : null}
              <div className="my-10 border border-[#e8e4dc] bg-white p-7">
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#6b6b6b]">{section.chartTitle}</p>
                <h3 className="mb-3 font-serif text-lg font-semibold">{section.chartHeadline}</h3>
                <ChartMock index={index} />
                <p className="mt-3 font-mono text-[11px] text-[#6b6b6b]">* {section.chartNote}</p>
              </div>
            </section>
          ))}

          <section className="my-14 bg-gradient-to-br from-[#0f0f0f] to-[#1a1a1a] px-7 py-10 text-[#f8f6f1] sm:px-12">
            <p className="mb-5 font-mono text-[9px] uppercase tracking-[0.32em] text-[#c9a84c]">MoneyMart Verdict</p>
            <h2 className="mb-5 font-serif text-2xl font-bold leading-normal">{draft.verdictTitle}</h2>
            <p className="text-sm leading-8 text-[#c8c4bc]">{draft.verdictBody}</p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {draft.verdictItems.map((item) => (
                <div key={item.label} className="border-t border-[#333] pt-4">
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.24em] text-[#c9a84c]">{item.label}</p>
                  <p className="text-[13px] leading-7 text-[#c8c4bc]">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <footer className="mt-10 flex flex-col gap-5 border-t border-[#e8e4dc] pt-7 text-[#6b6b6b] sm:flex-row sm:justify-between">
            <p className="font-mono text-[11px] tracking-wide">
              <strong className="mb-1 block text-[13px] text-[#0f0f0f]">MoneyMart Research</strong>
              日本の個人投資家のための、無料金融分析
              <br />
              moneymart.co.jp
            </p>
            <p className="max-w-md text-left text-[11px] leading-6 sm:text-right">
              本レポートは情報提供を目的としており、投資勧誘を意図するものではありません。投資判断はご自身の責任において行ってください。
            </p>
          </footer>
        </article>
      </main>
    </div>
  )
}

export default function InsightResearchMockPage() {
  return <InsightResearchMockPreview />
}
