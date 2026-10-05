import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  EyeOff,
  FileText,
  Fuel,
  JapaneseYen,
  ListOrdered,
  Mail,
  MoreHorizontal,
  PencilLine,
  Share2,
  Sparkles,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { formatYen, riskLabel } from './mockFeatured'
import { clientDocs, clientProfileExtra, depositLabel, lastContactLabel, nextMeetingLabel } from './demoFill'
import { C } from './theme'
import RiskReview from './RiskReview'
import MeetingsTab from './MeetingsTab'
import AIReview from './AIReview'
import {
  Card,
  DisclaimerBanner,
  Donut,
  HitlBar,
  Pill,
  PriorityRing,
  AreaChart,
  PeriodReturnStats,
  PortfolioValueChart,
  BenchmarkCompareChart,
  buildDemoValueSeries,
  ConcentrationDonut,
  TargetAllocBars,
  RadarChart,
  CHART,
} from './ui'

const TABS = [
  { id: 'summary', label: 'サマリー' },
  { id: 'portfolio', label: 'ポートフォリオ' },
  { id: 'transactions', label: '取引履歴' },
  { id: 'review', label: 'レビュー' },
  { id: 'meetings', label: 'ミーティング' },
  { id: 'profile', label: 'プロフィール' },
]

function ClientHeader({ c, onToast }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>{c.name} 様</h1>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onToast('デモ: 監査ログを表示しました')} className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-[11px] font-bold" style={{ borderColor: C.border }}>
            <ListOrdered className="h-3.5 w-3.5" /> 監査ログ
          </button>
          <button type="button" onClick={() => onToast('デモ: 変更を保存しました')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-extrabold text-white" style={{ background: C.accent }}>
            <PencilLine className="h-3.5 w-3.5" /> プロフィール編集
          </button>
          <button type="button" className="rounded-xl border bg-white p-2" style={{ borderColor: C.border }} aria-label="more">
            <MoreHorizontal className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      <Card padding={16}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl text-[14px] font-bold" style={{ background: C.accentLight, color: C.accentDark }}>
            {(c.name || 'Na').slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[16px] font-extrabold" style={{ color: C.navy }}>{c.name}</span>
              <Pill bg="#fee2e2" color={C.positive}>{c.status || '契約中'}</Pill>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['ポートフォリオ評価額', formatYen(c.aum)],
                ['年初来リターン', `${c.returnPct >= 0 ? '+' : ''}${c.returnPct}%`],
                ['リスク許容度', riskLabel[c.profile] || 'バランス型'],
                ['担当アドバイザー', c.advisorName || 'Justin'],
                ['次回ミーティング', nextMeetingLabel(c)],
                ['最終連絡日', lastContactLabel(c)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ color: C.textMuted }}>{k}</div>
                  <div className="mt-0.5 font-bold tabular-nums" style={{ color: k.includes('リターン') ? C.positive : C.navy }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ['詳細プロフィール', UserRound],
                ['ドキュメント', FileText],
                ['PDF 共有', Share2],
                ['メール', Mail],
              ].map(([label, Icon]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onToast('デモ: 変更を保存しました')}
                  className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-[11px] font-semibold"
                  style={{ borderColor: label.includes('PDF') ? C.accent : C.border, color: label.includes('PDF') ? C.accent : C.textSecondary }}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

function SummaryTab({ c, decisions, setDecision, onToast, setTab, setReviewSub }) {
  const cost = c.cost || Math.round(c.aum / (1 + (c.returnPct || 0) / 100))
  const spark = useMemo(
    () => buildDemoValueSeries({ start: cost, end: c.aum, n: 36 }),
    [c.aum, cost],
  )
  const pri = c.priority?.total ?? 55
  const bucketLabel = pri < 40 ? '健全' : pri < 60 ? '注視' : pri < 80 ? '警戒' : '危険'
  return (
    <div className="space-y-3">
      {c.recommendations?.length ? (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px]" style={{ background: C.accentLight, color: C.accentDark }}>
          <Sparkles className="h-3.5 w-3.5" />
          検討リストのファンド · {(c.recommendations || []).length}件
          <span className="ml-2 truncate opacity-80">
            {(c.watchlist || ['APA', '200A.T', '213A.T']).slice(0, 3).join(' · ')}
          </span>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card padding={14} style={{ borderColor: `${CHART.watch}4d` }}>
          <div className="flex items-center gap-3">
            <PriorityRing score={pri} size={72} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-bold">優先度スコア</h3>
                <Pill bg={CHART.watch} color="#fff">{bucketLabel}</Pill>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(c.priority?.parts || []).map(([label, pts]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold"
                    style={{ background: `${CHART.watch}0f`, border: `1px solid ${CHART.watch}33`, color: C.navy }}
                  >
                    {label}
                    <b style={{ color: CHART.watch }}>+{pts} pt</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card padding={14}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" style={{ color: C.accent }} />
              <h3 className="text-[13px] font-bold">AI サマリー</h3>
            </div>
            <button type="button" className="text-[10px] font-bold" style={{ color: C.accent }} onClick={() => { setTab('review'); setReviewSub('ai') }}>
              詳しく見る →
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>
            {(c.aiSummary || '').slice(0, 320)}
          </pre>
          <HitlBar
            status={decisions.summary || 'pending'}
            onAccept={() => { setDecision('summary', 'accepted'); onToast('デモ: 変更を保存しました') }}
            onEdit={() => { setDecision('summary', 'edited'); onToast('デモ: 変更を保存しました') }}
            onReject={() => { setDecision('summary', 'rejected'); onToast('デモ: 変更を保存しました') }}
          />
        </Card>
      </div>

      <Card padding={14}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-bold">保有資産との関連</h3>
          <button type="button" className="text-[10px] font-bold" style={{ color: C.accent }}>全て見る →</button>
        </div>
        <DisclaimerBanner className="mb-3" />
        <div className="space-y-2">
          {(c.relatedNews || []).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onToast('デモ: ニュース詳細シート（関連性表示）')}
              className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left hover:bg-[#fbf8ef]"
              style={{ borderColor: C.border }}
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: C.surfaceSub }}>
                {n.icon === 'fuel' ? <Fuel className="h-4 w-4" style={{ color: C.accent }} /> : n.icon === 'yen' ? <JapaneseYen className="h-4 w-4" style={{ color: C.accent }} /> : <TrendingUp className="h-4 w-4" style={{ color: C.accent }} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold" style={{ color: C.navy }}>{n.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Pill bg="#dbeafe" color={C.negative}>関連度 {n.level}</Pill>
                  {(n.factors || []).map((f) => <Pill key={f}>{f}</Pill>)}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </button>
          ))}
        </div>
      </Card>

      <Card padding={14}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-bold">アクション一覧</h3>
          <button type="button" className="text-[10px] font-bold" style={{ color: C.accent }} onClick={() => { setTab('review'); setReviewSub('ai') }}>すべて表示 →</button>
        </div>
        <div className="text-[11px] font-semibold" style={{ color: C.textMuted }}>AI 提案（受入待ち）</div>
        <ul className="mt-2 space-y-1.5 text-[12px]" style={{ color: C.textSecondary }}>
          {(c.recommendations || []).map((r) => (
            <li key={r.title} className="flex gap-2">
              <span style={{ color: C.positive }}>+</span>
              <span>{r.title}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
        <Card padding={14}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold">ポートフォリオ評価額・パフォーマンス</h3>
            <button type="button" className="text-[10px] font-bold" style={{ color: C.accent }} onClick={() => setTab('portfolio')}>ポートフォリオを見る →</button>
          </div>
          <div className="text-[24px] font-extrabold tabular-nums" style={{ color: C.navy }}>{formatYen(c.aum)}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Pill bg="#fee2e2" color={C.positive}>+{Number(c.returnPct || 0).toFixed(1)}%</Pill>
            <span className="text-[9px]" style={{ color: C.textMuted }}>運用開始来</span>
          </div>
          <div className="mt-1 text-[10px]" style={{ color: C.textMuted }}>元本: {formatYen(cost)}</div>
          <div className="mt-3"><AreaChart values={spark} height={70} /></div>
          <div className="my-2 h-px opacity-40" style={{ background: C.border }} />
          <PeriodReturnStats mtd={5.6} ytd={4.3} y1={9.6} />
        </Card>
        <div className="space-y-3">
          <Card padding={14}>
            <h3 className="mb-2 text-[13px] font-bold">次回ミーティング</h3>
            <div className="text-[22px] font-extrabold" style={{ color: C.accent }}>{c.reviewDays != null ? `${c.reviewDays}日後` : '—'}</div>
            <p className="mt-1 text-[11px]" style={{ color: C.textSecondary }}>9月25日 (金) 04:00 · 定期レビュー</p>
          </Card>
          <Card padding={14}>
            <h3 className="mb-2 text-[13px] font-bold">最近のドキュメント</h3>
            <div className="space-y-2">
              {clientDocs(c).map((d) => (
                <button key={d.name} type="button" className="flex w-full items-start justify-between gap-2 rounded-lg bg-[#faf8f2] px-2.5 py-2 text-left">
                  <div>
                    <div className="text-[11px] font-bold leading-snug" style={{ color: C.navy }}>{d.name}</div>
                    <div className="mt-0.5 text-[9px]" style={{ color: C.textMuted }}>{d.date.replace(/-/g, '/')}</div>
                  </div>
                  <Pill bg={d.status === '共有済み' ? '#dcfce7' : '#fef3c7'} color={d.status === '共有済み' ? C.green : C.accentDark}>{d.status}</Pill>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PortfolioTab({ c }) {
  const cost = c.cost || Math.round(c.aum / (1 + (c.returnPct || 0) / 100))
  const unreal = c.aum - cost
  const cashYen = 504035
  const cashPct = Math.round((cashYen / (c.aum + cashYen)) * 100)
  const stockPct = 7
  const fundPct = 79
  const [period, setPeriod] = useState('all')
  const retPct = Number(c.returnPct || 8.7)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['含み損益', `+${formatYen(unreal)}`, C.positive],
          ['実現損益', '+¥3,274', C.positive],
          ['予想配当', '¥33,551/年', C.navy],
          ['入金', depositLabel(c), C.navy],
        ].map(([k, v, color]) => (
          <Card key={k} padding={12}>
            <div className="text-[10px]" style={{ color: C.textMuted }}>{k}</div>
            <div className="mt-1 text-[15px] font-extrabold tabular-nums" style={{ color }}>{v}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">ポートフォリオ評価額</h3>
          <PortfolioValueChart
            start={3_029_126}
            end={c.aum}
            period={period}
            onPeriod={setPeriod}
            height={130}
            dateLabels={['8/20', '3/9', '9/18']}
          />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3 text-[11px]" style={{ borderColor: C.borderSub }}>
            {[
              ['元本', formatYen(cost), C.navy],
              ['現在価値', formatYen(c.aum), C.navy],
              ['未実現損益', `+${formatYen(unreal)}`, C.positive],
              ['実現損益', '+¥3,274', C.positive],
              ['年間配当', '¥33,551/年', C.navy],
              ['保有件数', `${(c.holdings || []).filter((h) => h.value > 0).length}銘柄`, C.navy],
              ['トータルリターン', `+${retPct.toFixed(2)}%`, C.positive],
              ['現金比率', `${cashPct}%`, C.navy],
            ].map(([k, v, color]) => (
              <div key={k} className="flex justify-between gap-2">
                <span style={{ color: C.textMuted }}>{k}</span>
                <b className="tabular-nums" style={{ color }}>{v}</b>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: C.borderSub }}>
            <div className="text-[10px] font-bold" style={{ color: C.textMuted }}>上位保有</div>
            {(c.holdings || []).filter((h) => h.value > 0).map((h) => (
              <div key={h.symbol} className="flex justify-between text-[11px]">
                <span className="truncate font-semibold" style={{ color: C.navy }}>{h.name}</span>
                <span className="font-bold tabular-nums" style={{ color: C.accent }}>{h.pct}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={14}>
          <h3 className="mb-1 text-[13px] font-bold">ベンチマーク比較</h3>
          <BenchmarkCompareChart portfolioPct={retPct} nikkeiPct={43.3} spPct={15.2} worldPct={23.6} />
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">資産クラス配分</h3>
          <Donut
            segments={[
              { label: '株式', value: stockPct, color: CHART.equity },
              { label: '投信/ETF', value: fundPct, color: CHART.bond },
              { label: '現金', value: cashPct, color: CHART.cash },
            ]}
            size={110}
            centerValue={`${fundPct}%`}
            centerLabel="投信/ETF"
          />
          <p className="mt-2 text-[9px]" style={{ color: C.textMuted }}>保有から自動計算</p>
        </Card>

        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">キャッシュポジション</h3>
          <div className="text-[22px] font-extrabold tabular-nums" style={{ color: C.navy }}>{formatYen(cashYen)}</div>
          <div className="mt-1 text-[11px]" style={{ color: C.textMuted }}>全資産の {cashPct}%</div>
          <div className="relative mt-4 h-2 rounded-full bg-slate-100">
            <div className="absolute inset-y-0 left-0 rounded-full bg-slate-400" style={{ width: `${cashPct}%` }} />
          </div>
          <div className="mt-1 text-[9px] font-bold" style={{ color: C.positive }}>▼ 適正水準</div>
        </Card>

        <Card padding={14}>
          <h3 className="mb-3 text-[13px] font-bold">地域別分布</h3>
          {[
            ['🇯🇵', '日本', 92, C.accent],
            ['🇺🇸', '米国', 8, '#d6c49a'],
          ].map(([flag, name, pct, color]) => (
            <div key={name} className="mb-2.5">
              <div className="mb-1 flex justify-between text-[11px]">
                <span>{flag} {name}</span>
                <b className="tabular-nums">{pct}%</b>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          ))}
        </Card>

        <Card padding={14}>
          <h3 className="mb-3 text-[13px] font-bold">セクター分布</h3>
          {[
            ['投信/ETF', 92, CHART.bond],
            ['エネルギー', 8, '#ef4444'],
          ].map(([name, pct, color]) => (
            <div key={name} className="mb-2 flex items-center gap-2 text-[11px]">
              <i className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="flex-1">{name}</span>
              <b className="tabular-nums">{pct}%</b>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">パフォーマンス上位</h3>
          {[
            ['ベーカー・ヒューズ', 'BKR', 80.78],
            ['iFreeETF 日経225', '1320.T', 2.16],
          ].map(([name, sym, pct]) => (
            <div key={sym} className="flex items-center gap-2 border-b py-2 text-[11px]" style={{ borderColor: C.borderSub }}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{name}</div>
                <div style={{ color: C.textMuted }}>{sym}</div>
              </div>
              <span className="font-extrabold tabular-nums" style={{ color: C.positive }}>+{pct.toFixed(2)}%</span>
              <span style={{ color: C.accent }}>★</span>
            </div>
          ))}
        </Card>
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">パフォーマンス下位</h3>
          {[
            ['J-REIT Index Fund', '1345.T', -10.19],
            ['iFreeETF TOPIX', '1306.T', -2.40],
            ['現金・待機資金', 'CASH', 0.12],
          ].map(([name, sym, pct]) => (
            <div key={sym} className="flex items-center gap-2 border-b py-2 text-[11px]" style={{ borderColor: C.borderSub }}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{name}</div>
                <div style={{ color: C.textMuted }}>{sym}</div>
              </div>
              <span className="font-extrabold tabular-nums" style={{ color: pct >= 0 ? C.positive : C.negative }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
              <span style={{ color: C.textMuted }}>☆</span>
            </div>
          ))}
        </Card>
      </div>

      <Card padding={14}>
        <h3 className="mb-3 text-[13px] font-bold">顧客インサイト — 商談トピック</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['予想年間配当', '¥33,551', '月平均 ¥2,795', '#ede9fe'],
            ['配当利回り', '1.10%', '対コスト', '#ffe4e6'],
            ['NISA活用', '0%', '未利用', '#fef3c7'],
            ['分散スコア', '58 / 100', '改善余地あり', '#e0f2fe'],
            ['退職まで', '19年', '長期ホライズン', '#ffedd5'],
            ['目標達成', '0%', '進捗なし', '#f1f5f9'],
          ].map(([title, value, sub, bg]) => (
            <div key={title} className="rounded-xl p-3" style={{ background: bg }}>
              <div className="text-[10px] font-semibold" style={{ color: C.textMuted }}>{title}</div>
              <div className="mt-1 text-[16px] font-extrabold tabular-nums" style={{ color: C.navy }}>{value}</div>
              <div className="mt-0.5 text-[9px]" style={{ color: C.textMuted }}>{sub}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function buildClientTransactions(c) {
  if (c.transactions?.length) return c.transactions
  const holdings = (c.holdings || []).filter((h) => h.value > 0)
  if (!holdings.length) return []
  const seed = String(c.id || c.name || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return Array.from({ length: 12 }, (_, i) => {
    const h = holdings[i % holdings.length]
    const side = i % 6 === 4 ? '配当' : i % 5 === 3 ? '売却' : '購入'
    const qty = side === '配当' ? Math.max(5, 10 + (seed + i * 7) % 45) : Math.max(1, 5 + (seed + i * 11) % 36)
    const amount = side === '配当'
      ? Math.max(800, Math.round(h.value * (0.0004 + (i % 3) * 0.00015)))
      : Math.max(10000, Math.round(h.value * (0.025 + (i % 4) * 0.012)))
    const day = Math.max(1, 19 - i * 3)
    const month = day > 0 ? 9 : 8
    const normalizedDay = day > 0 ? day : 28 + day
    return {
      date: `2026-${String(month).padStart(2, '0')}-${String(normalizedDay).padStart(2, '0')}`,
      symbol: h.symbol,
      name: h.name,
      side,
      qty,
      price: null,
      amount,
      pnl: null,
    }
  })
}

function TransactionsTab({ c }) {
  const [period, setPeriod] = useState('3ヶ月')
  const [side, setSide] = useState('すべて')
  const generated = useMemo(() => buildClientTransactions(c), [c])
  const rows = side === 'すべて' ? generated : generated.filter((r) => r.side === side)
  const buys = generated.filter((r) => r.side === '購入').reduce((sum, r) => sum + r.amount, 0)
  const sells = generated.filter((r) => r.side === '売却').reduce((sum, r) => sum + r.amount, 0)
  const dividends = generated.filter((r) => r.side === '配当').reduce((sum, r) => sum + r.amount, 0)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['取引件数', `${generated.length}件`, C.navy],
          ['購入合計', formatYen(buys), C.positive],
          ['売却合計', formatYen(sells), C.negative],
          ['受取配当', formatYen(dividends), C.accent],
          ['純入金額', formatYen(buys - sells), C.navy],
        ].map(([label, value, color]) => (
          <Card key={label} padding={12}>
            <div className="text-[9px] font-semibold" style={{ color: C.textMuted }}>{label}</div>
            <div className="mt-1 text-[15px] font-extrabold tabular-nums" style={{ color }}>{value}</div>
          </Card>
        ))}
      </div>
      <Card padding={14}>
        <div className="mb-3 flex flex-wrap gap-2">
          {['過去30日', '1ヶ月', '3ヶ月', '6ヶ月', '1年'].map((x) => (
            <button key={x} type="button" onClick={() => setPeriod(x)} className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: period === x ? C.accent : '#fff', color: period === x ? '#fff' : C.textSecondary, border: `1px solid ${C.border}` }}>{x}</button>
          ))}
          <span className="mx-1 h-7 w-px" style={{ background: C.border }} />
          {['すべて', '購入', '売却', '配当'].map((x) => (
            <button key={x} type="button" onClick={() => setSide(x)} className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: side === x ? C.accent : '#fff', color: side === x ? '#fff' : C.textSecondary, border: `1px solid ${C.border}` }}>{x}</button>
          ))}
          <span className="ml-auto self-center text-[10px] font-bold" style={{ color: C.textMuted }}>{rows.length} 件表示</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead style={{ color: C.textMuted }}>
              <tr className="border-b bg-slate-50" style={{ borderColor: C.borderSub }}>
                {['日付', '銘柄', '種別', '数量', '単価', '金額', '損益'].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.date}-${r.symbol}-${i}`} className="border-b hover:bg-[#fbf8ef]" style={{ borderColor: C.borderSub }}>
                  <td className="whitespace-nowrap px-2 py-2.5">{r.date}</td>
                  <td className="max-w-52 px-2 py-2.5"><b className="block truncate">{r.name}</b><div className="text-[10px]" style={{ color: C.textMuted }}>{r.symbol}</div></td>
                  <td className="px-2 py-2.5"><Pill bg={r.side === '売却' ? '#dbeafe' : r.side === '配当' ? '#fef3c7' : '#fee2e2'} color={r.side === '売却' ? C.negative : r.side === '配当' ? C.accentDark : C.positive}>{r.side}</Pill></td>
                  <td className="px-2 py-2.5 tabular-nums">{r.qty}</td>
                  <td className="px-2 py-2.5 tabular-nums">{r.price == null ? '—' : `¥${Number(r.price).toLocaleString()}`}</td>
                  <td className="px-2 py-2.5 tabular-nums font-semibold">¥{Number(r.amount).toLocaleString()}</td>
                  <td className="px-2 py-2.5 tabular-nums font-bold" style={{ color: r.pnl == null ? C.textMuted : r.pnl >= 0 ? C.positive : C.negative }}>{r.pnl == null ? '—' : `${r.pnl >= 0 ? '+' : '−'}¥${Math.abs(r.pnl).toLocaleString()}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function ReviewTab({ c, sub, setSub, decisions, setDecision, onToast }) {
  const defaultAgenda = [
    { title: '運用実績と目標進捗の確認', detail: `年初来リターン ${c.returnPct >= 0 ? '+' : ''}${c.returnPct}% · 評価額 ${formatYen(c.aum)}`, status: '必須' },
    { title: '目標配分との差異を確認', detail: `現在の配分ドリフト ${c.drift || 0}pt · リスク許容度 ${riskLabel[c.profile] || 'バランス型'}`, status: (c.drift || 0) >= 20 ? '要対応' : '確認' },
    { title: '集中リスクと分散方針', detail: `最大保有比率 ${c.concentration?.maxHolding || 0}% · 最大セクター ${c.concentration?.maxSector || 0}%`, status: c.concentration?.severity === 'high' ? '高' : '確認' },
    { title: '次回アクションと期限設定', detail: (c.followUps || [])[0]?.label || '次回面談候補日と必要資料を確認', status: '未完了' },
  ]
  const recommendations = (c.recommendations || []).length >= 3
    ? c.recommendations
    : [
        ...(c.recommendations || []),
        { title: 'ポートフォリオ配分を目標比率へ調整', status: 'draft', impact: `ドリフト ${c.drift || 0}pt の改善` },
        { title: '非課税枠・積立設定の利用状況を確認', status: 'watch', impact: '長期運用計画を更新' },
        { title: '地域・資産クラスの分散候補を比較', status: 'draft', impact: '集中リスクを低減' },
      ].slice(0, 4)
  return (
    <div className="space-y-3">
      <div className="flex gap-2 rounded-xl border bg-white p-1" style={{ borderColor: C.border }}>
        {[['review', 'レビュー'], ['risk', 'リスクレビュー'], ['ai', 'AI分析']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className="flex-1 rounded-lg py-2 text-[12px] font-bold"
            style={{ background: sub === id ? C.accent : 'transparent', color: sub === id ? '#fff' : C.textSecondary }}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'risk' ? <RiskReview c={c} /> : null}

      {sub === 'ai' ? (
        <AIReview c={c} decisions={decisions} setDecision={setDecision} onToast={onToast} />
      ) : null}

      {sub === 'review' ? (
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <Card padding={14}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold">レビュー議題</h3>
                  <p className="mt-0.5 text-[10px]" style={{ color: C.textMuted }}>次回相談で確認する項目 · {defaultAgenda.length}件</p>
                </div>
                <Pill bg={C.accentLight} color={C.accentDark}>{defaultAgenda.length} 議題</Pill>
              </div>
              <div className="space-y-2">
                {defaultAgenda.map((item, i) => (
                  <div key={item.title} className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: C.borderSub, background: i === 0 ? '#fffcf3' : '#fff' }}>
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: C.accent }}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold" style={{ color: C.navy }}>{item.title}</div>
                      <div className="mt-0.5 truncate text-[9px]" style={{ color: C.textMuted }}>{item.detail}</div>
                    </div>
                    <Pill bg={item.status === '高' || item.status === '要対応' ? '#fee2e2' : '#f1f5f9'} color={item.status === '高' || item.status === '要対応' ? C.positive : C.textSecondary}>{item.status}</Pill>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input defaultValue="NISA枠の利用状況を確認" className="flex-1 rounded-xl border px-3 py-2 text-[11px]" style={{ borderColor: C.border }} />
                <button type="button" onClick={() => onToast('デモ: 議題を追加しました')} className="rounded-xl px-4 py-2 text-[11px] font-bold text-white" style={{ background: C.accent }}>追加</button>
              </div>
            </Card>

            <Card padding={14}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-bold">検討リスト・ウォッチリスト</h3>
                <Pill>{recommendations.length}件</Pill>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {recommendations.map((r, i) => (
                  <button key={`${r.title}-${i}`} type="button" onClick={() => onToast(`デモ: 「${r.title}」を開きました`)} className="rounded-xl border p-3 text-left hover:bg-[#fbf8ef]" style={{ borderColor: C.border }}>
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="text-[12px]" style={{ color: C.accent }}>{i < 2 ? '★' : '☆'}</span>
                      <Pill bg={i === 0 ? '#fef3c7' : '#f1f5f9'} color={i === 0 ? C.accentDark : C.textSecondary}>{r.status || 'draft'}</Pill>
                    </div>
                    <div className="text-[11px] font-bold leading-snug" style={{ color: C.navy }}>{r.title}</div>
                    <div className="mt-1 text-[9px]" style={{ color: C.textMuted }}>{r.impact || '次回レビューで確認'}</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <Card padding={14}>
              <h3 className="mb-3 text-[13px] font-bold">レビュー概要</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['優先度', `${c.priority?.total || 0} pt`, (c.priority?.total || 0) >= 75 ? C.positive : C.accent],
                  ['配分ドリフト', `${c.drift || 0} pt`, (c.drift || 0) >= 20 ? C.positive : C.navy],
                  ['最終レビュー', `${c.monthsSinceReview || 0}ヶ月前`, C.navy],
                  ['次回まで', c.reviewDays != null ? `${c.reviewDays}日` : '未設定', C.accent],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[9px]" style={{ color: C.textMuted }}>{label}</div>
                    <div className="mt-1 text-[16px] font-extrabold tabular-nums" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card padding={14}>
              <h3 className="mb-2 text-[13px] font-bold">フォローアップ</h3>
              {(c.followUps || [{ label: '次回面談資料を準備', due: '次回レビュー前', status: '未完了' }]).map((f, i) => (
                <div key={`${f.label}-${i}`} className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: f.status === '完了' ? C.green : C.accent }} />
                  <div className="min-w-0 flex-1"><div className="truncate text-[10px] font-bold">{f.label}</div><div className="text-[8px]" style={{ color: C.textMuted }}>期限 {f.due || '未設定'}</div></div>
                  <Pill>{f.status || '未完了'}</Pill>
                </div>
              ))}
              <button type="button" onClick={() => onToast('デモ: フォローアップを追加しました')} className="mt-1 w-full rounded-lg border border-dashed py-2 text-[10px] font-bold" style={{ borderColor: C.border, color: C.accent }}>+ アクション追加</button>
            </Card>
            <Card padding={14}>
              <h3 className="mb-2 text-[13px] font-bold">注視中の保有銘柄</h3>
              {(c.holdings || []).filter((h) => h.value > 0).slice(0, 4).map((h) => (
                <div key={h.symbol} className="flex items-center gap-2 border-b py-2 text-[10px]" style={{ borderColor: C.borderSub }}>
                  <span className="w-14 font-extrabold" style={{ color: C.accent }}>{h.symbol}</span>
                  <span className="min-w-0 flex-1 truncate">{h.name}</span>
                  <b>{h.pct || Math.round(h.value / c.aum * 100)}%</b>
                </div>
              ))}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ProfileTab({ c, onToast }) {
  const x = clientProfileExtra(c)
  const initial = (c.name || '顧客').replace(/\s+/g, '').slice(0, 2)
  return (
    <div className="space-y-3">
      <Card padding={16}>
        <div className="flex items-start gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-xl text-[16px] font-bold" style={{ background: C.accentLight, color: C.accentDark }}>{initial}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-extrabold">{c.name}</span>
              <Pill>主要顧客</Pill>
            </div>
            <div className="mt-2 grid gap-1 text-[11px]" style={{ color: C.textSecondary }}>
              <div>顧客 ID: {c.clientCode || c.id}</div>
              <div>電話: {c.phone}</div>
              <div>メール: {c.email}</div>
              <div>生年月日: {c.dob || '1980-01-01'}{c.age ? ` (${c.age}歳)` : ' (46歳)'}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['リスク許容度', riskLabel[c.profile] || 'バランス型'],
            ['投資目的', c.objective || '配当収入'],
            ['目標退職年齢', `${x.retireAge}歳`],
            ['次回レビュー', c.nextReview || nextMeetingLabel(c)],
            ['リスクスコア', `${c.riskScore || 57} / 100`],
            ['投資期間', c.horizon || '3年以上'],
            ['退職までの年数', `${x.yearsToRetire}年`],
            ['プロフィール更新', x.updatedAt],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border p-2.5" style={{ borderColor: C.border }}>
              <div className="text-[9px]" style={{ color: C.textMuted }}>{k}</div>
              <div className="mt-0.5 text-[12px] font-bold" style={{ color: C.navy }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card padding={14}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-bold">1. 個人情報</h3>
          <button type="button" onClick={() => onToast('デモ: 変更を保存しました')} className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: C.accent }}>
            <PencilLine className="h-3.5 w-3.5" /> 編集
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['婚姻状況', x.marital],
            ['家族構成', x.family],
            ['国籍', x.nationality],
            ['職業', x.occupation],
            ['勤務先', x.workplace],
            ['役職', x.role],
            ['年収', x.income],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b py-2 text-[12px]" style={{ borderColor: C.borderSub }}>
              <span style={{ color: C.textMuted }}>{k}</span>
              <b style={{ color: C.navy }}>{v}</b>
            </div>
          ))}
        </div>
      </Card>
      <Card padding={14}>
        <h3 className="mb-2 text-[13px] font-bold">2. 面談メモ</h3>
        <p className="text-[12px] leading-relaxed" style={{ color: C.textSecondary }}>
          {c.aiSummary || `${c.name} 様は${riskLabel[c.profile] || 'バランス型'}。次回は集中リスクと海外分散の関連性を共有し、リバランス案はアドバイザー判断で提示。`}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {clientDocs(c).map((d) => (
            <div key={d.name} className="rounded-xl bg-[#faf8f2] p-2.5">
              <div className="text-[10px] font-bold" style={{ color: C.navy }}>{d.name}</div>
              <div className="mt-1 text-[9px]" style={{ color: C.textMuted }}>{d.status} · {d.date.replace(/-/g, '/')}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default function ClientWorkspace({ client, onToast }) {
  const [tab, setTab] = useState('summary')
  const [reviewSub, setReviewSub] = useState('review')
  const [decisions, setDecisions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`mm_ai_review_actions_${client.id}`) || '{}')
    } catch {
      return {}
    }
  })

  const setDecision = (key, status) => {
    setDecisions((prev) => {
      const next = { ...prev, [key]: status }
      localStorage.setItem(`mm_ai_review_actions_${client.id}`, JSON.stringify(next))
      return next
    })
  }

  if (!client) {
    return (
      <div className="grid place-items-center p-16 text-[13px]" style={{ color: C.textMuted }}>
        左の「顧客一覧」から顧客を選択してください
      </div>
    )
  }

  return (
    <div className="space-y-4 p-5 lg:p-6">
      <ClientHeader c={client} onToast={onToast} />
      <div className="flex flex-wrap gap-1 rounded-xl border bg-white p-1" style={{ borderColor: C.border }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="rounded-lg px-3 py-2 text-[12px] font-bold transition-colors"
            style={{ background: tab === t.id ? C.accent : 'transparent', color: tab === t.id ? '#fff' : C.navy }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'summary' ? <SummaryTab c={client} decisions={decisions} setDecision={setDecision} onToast={onToast} setTab={setTab} setReviewSub={setReviewSub} /> : null}
      {tab === 'portfolio' ? <PortfolioTab c={client} /> : null}
      {tab === 'transactions' ? <TransactionsTab c={client} /> : null}
      {tab === 'review' ? <ReviewTab c={client} sub={reviewSub} setSub={setReviewSub} decisions={decisions} setDecision={setDecision} onToast={onToast} /> : null}
      {tab === 'meetings' ? <MeetingsTab c={client} onToast={onToast} /> : null}
      {tab === 'profile' ? <ProfileTab c={client} onToast={onToast} /> : null}
    </div>
  )
}
