import { ArrowUpRight, Calendar, Clock, FileText, Newspaper, Shield, ShieldAlert, Users } from 'lucide-react'
import { formatYen } from './mockFeatured'
import { mockArticles } from './mockCatalog'
import { C } from './theme'
import { Card, DisclaimerBanner, Donut, HealthDonut, Pill, CHART, healthBucketsFromClients } from './ui'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'おはようございます'
  if (h < 18) return 'こんにちは'
  return 'こんばんは'
}

export default function AdvisorDashboard({ data, onOpenClient, onToast }) {
  const clients = data.clients || []
  const totalAum = clients.reduce((s, c) => s + (c.aum || 0), 0)
  const reviewSoon = clients.filter((c) => c.reviewDays != null && c.reviewDays <= 30 && c.reviewDays >= 0)
  const highPri = clients.filter((c) => (c.priority?.total || 0) >= 75)
  const reviewedYear = Math.round((clients.filter((c) => (c.monthsSinceReview || 0) <= 12).length / Math.max(1, clients.length)) * 100)
  const monthReview = clients.filter((c) => c.reviewDays != null && c.reviewDays <= 30).slice(0, 8)
  const priorityClients = [...clients].sort((a, b) => (b.priority?.total || 0) - (a.priority?.total || 0))
  const upcomingMeetings = [...(data.meetings || [])]
    .sort((a, b) => `${a.date || a.dateKey || ''}${a.time || ''}`.localeCompare(`${b.date || b.dateKey || ''}${b.time || ''}`))
    .slice(0, 3)
  const salesAlerts = priorityClients.slice(0, 4).map((c, i) => ({
    client: c,
    label: i === 0 ? '至急' : i < 3 ? '要確認' : 'フォロー',
    color: i === 0 ? '#dc2626' : i < 3 ? '#d97706' : '#2563eb',
    title: c.reviewDays != null && c.reviewDays <= 30 ? 'レビュー期限が近づいています' : 'ポートフォリオの確認ポイント',
    detail: c.reviewDays != null
      ? c.reviewDays < 0 ? `期限超過 ${Math.abs(c.reviewDays)}日` : `次回レビューまで ${c.reviewDays}日`
      : `優先度スコア ${c.priority?.total || 0}`,
  }))
  const newsItems = (mockArticles || []).slice(0, 4)

  const allocAgg = clients.reduce(
    (acc, c) => {
      const a = c.allocation || {}
      const w = c.aum || 0
      acc.eq += ((a.equity || 0) / 100) * w
      acc.bd += ((a.bond || 0) / 100) * w
      acc.ca += ((a.cash || 0) / 100) * w
      acc.ot += ((a.other || 0) / 100) * w
      acc.t += w
      return acc
    },
    { eq: 0, bd: 0, ca: 0, ot: 0, t: 0 },
  )
  const pct = (v) => (allocAgg.t ? Math.round((v / allocAgg.t) * 100) : 0)
  const health = healthBucketsFromClients(clients)
  const allocParts = [
    { label: '株式', value: pct(allocAgg.eq), color: CHART.equity },
    { label: '債券', value: pct(allocAgg.bd), color: CHART.bond },
    { label: '現金', value: pct(allocAgg.ca), color: CHART.cash },
    { label: 'その他', value: Math.max(0, 100 - pct(allocAgg.eq) - pct(allocAgg.bd) - pct(allocAgg.ca)), color: CHART.other },
  ]
  const allocTotal = allocParts.reduce((s, p) => s + p.value, 0)

  const kpis = [
    { label: '総顧客数', value: String(clients.length), sub: `${clients.length}名`, Icon: Users },
    { label: '総資産額', value: formatYen(totalAum), sub: '登録済', Icon: FileText },
    { label: '年次レビュー完了', value: `${reviewedYear}%`, sub: '過去12ヶ月', Icon: Shield },
    { label: 'レビュー期日', value: String(reviewSoon.length), sub: '30日以内', Icon: Calendar },
    { label: '高優先度顧客', value: String(highPri.length), sub: '要フォロー', Icon: Clock },
  ]

  return (
    <div className="space-y-4 p-5 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>
            {greeting()}、{data.advisor?.name || 'Justin'} さん
          </h1>
          <p className="mt-1 text-[12px]" style={{ color: C.textMuted }}>
            本日 {data.meetings?.filter((m) => String(m.date || '').includes('09-25') || String(m.date || '').includes('2026-09-25')).length || 1}件のミーティング・
            {reviewSoon.length || 1}件のレビュー予定
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToast('デモ: 顧客追加を受け付けました（佐藤 健太 / 定期レビュー）')}
          className="rounded-xl px-4 py-2.5 text-[12px] font-extrabold text-white"
          style={{ background: C.accent }}
        >
          + 顧客追加
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} padding={12}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold" style={{ color: C.textMuted }}>{k.label}</span>
              <k.Icon className="h-4 w-4" style={{ color: C.accent }} />
            </div>
            <div className="text-[22px] font-extrabold tabular-nums" style={{ color: C.navy }}>{k.value}</div>
            <div className="mt-0.5 text-[10px]" style={{ color: C.textMuted }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card padding={14}>
          <div className="mb-2.5 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" style={{ color: C.positive }} />
            <h2 className="text-[13px] font-bold">本日の営業・相談アラート</h2>
            <Pill bg="#fee2e2" color={C.positive}>{salesAlerts.length}件</Pill>
          </div>
          <div className="divide-y" style={{ borderColor: C.borderSub }}>
            {salesAlerts.map((alert) => (
              <button key={alert.client.id} type="button" onClick={() => onOpenClient(alert.client)} className="flex w-full items-center gap-2.5 py-2 text-left hover:bg-[#fbf8ef]">
                <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: alert.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <b className="truncate text-[11px]" style={{ color: C.navy }}>{alert.client.name}</b>
                    <span className="rounded-full px-1.5 py-0.5 text-[8px] font-extrabold" style={{ background: `${alert.color}18`, color: alert.color }}>{alert.label}</span>
                  </div>
                  <div className="truncate text-[10px]" style={{ color: C.textSecondary }}>{alert.title}</div>
                </div>
                <div className="shrink-0 text-right text-[9px]" style={{ color: C.textMuted }}>{alert.detail}</div>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0" style={{ color: C.accent }} />
              </button>
            ))}
          </div>
        </Card>

        <Card padding={14}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" style={{ color: C.accent }} />
              <h2 className="text-[13px] font-bold">今日、顧客に関連する市場ニュース</h2>
            </div>
            <Pill>{newsItems.length} ファクター</Pill>
          </div>
          <DisclaimerBanner className="mb-2" />
          <div className="divide-y" style={{ borderColor: C.borderSub }}>
            {newsItems.map((article, i) => (
              <button key={article.id} type="button" onClick={() => onToast(`デモ: 「${article.title}」を開きました`)} className="flex w-full items-center gap-2 py-2 text-left hover:bg-[#fbf8ef]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[9px] font-extrabold" style={{ background: i === 0 ? '#fee2e2' : C.accentLight, color: i === 0 ? C.positive : C.accentDark }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-bold" style={{ color: C.navy }}>{article.title}</div>
                  <div className="mt-0.5 flex gap-1 text-[8px]" style={{ color: C.textMuted }}>
                    <span>{article.category || article.kind || 'Market'}</span>
                    {(article.tags || []).slice(0, 2).map((tag) => <span key={tag}>· {tag}</span>)}
                  </div>
                </div>
                <span className="text-[9px] font-bold" style={{ color: C.accent }}>{clients[(i + 1) % Math.max(1, clients.length)]?.name || '顧客'} 関連</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <Card padding={0}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: C.borderSub }}>
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-bold">今月レビュー対象顧客</h2>
              <Pill bg={C.accentLight} color={C.accentDark}>{monthReview.length}名</Pill>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead style={{ color: C.textMuted }}>
                <tr className="border-b" style={{ borderColor: C.borderSub }}>
                  <th className="px-4 py-2 font-medium">顧客</th>
                  <th className="px-2 py-2 font-medium">投資目的</th>
                  <th className="px-2 py-2 font-medium">ヘルス</th>
                  <th className="px-4 py-2 font-medium">次回</th>
                </tr>
              </thead>
              <tbody>
                {monthReview.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-[11px]" style={{ color: C.textSecondary }}>今月の必須レビューは消化済みです。優先対応 5名は上のカードから開けます。</td></tr>
                ) : monthReview.map((c) => {
                  const healthLabel = (c.priority?.total || 0) >= 50 ? '注視' : '余裕'
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer border-b hover:bg-[#fbf8ef]"
                      style={{ borderColor: C.borderSub }}
                      onClick={() => onOpenClient(c)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold" style={{ color: C.navy }}>{c.name}</div>
                        <div className="text-[10px]" style={{ color: C.textMuted }}>{c.email}</div>
                      </td>
                      <td className="px-2 py-3">{c.objective || '資産成長'}</td>
                      <td className="px-2 py-3">
                        <Pill bg={healthLabel === '注視' ? '#fef3c7' : '#dcfce7'} color={healthLabel === '注視' ? C.accentDark : C.green}>
                          {healthLabel}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: C.accent }}>
                        {c.nextReview || (c.reviewDays != null ? `${c.reviewDays}日後` : '—')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding={14}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-bold">全体資産配分</h2>
            <span className="text-[9px] font-bold" style={{ color: C.accent }}>{formatYen(totalAum)}</span>
          </div>
          <Donut
            segments={allocParts}
            size={88}
            centerValue={`${allocTotal || 100}%`}
            centerLabel="配分"
          />
          <div className="mt-3 space-y-1.5 border-t pt-2.5" style={{ borderColor: C.borderSub }}>
            {allocParts.map((part) => (
              <div key={part.label} className="flex items-center gap-1.5 text-[9px]">
                <i className="h-2 w-2 rounded-full" style={{ background: part.color }} />
                <span className="flex-1" style={{ color: C.textSecondary }}>{part.label}</span>
                <b className="tabular-nums" style={{ color: C.navy }}>{part.value}%</b>
                <span className="w-14 text-right tabular-nums" style={{ color: C.textMuted }}>{formatYen(totalAum * part.value / 100)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={14}>
          <h2 className="mb-3 text-[13px] font-bold">ポートフォリオヘルス</h2>
          <HealthDonut
            healthy={health.healthy}
            watch={health.watch}
            caution={health.caution}
            danger={health.danger}
            size={110}
          />
          <div className="mt-2 grid grid-cols-2 gap-1.5 border-t pt-2.5" style={{ borderColor: C.borderSub }}>
            {[
              ['良好', health.healthy, CHART.healthy],
              ['注視', health.watch, CHART.watch],
              ['注意', health.caution, CHART.caution],
              ['要対応', health.danger, CHART.danger],
            ].map(([label, value, color]) => (
              <div
                key={label}
                className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-[9px]"
                style={{ background: `${color}0f`, borderColor: `${color}24` }}
              >
                <i className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                <span className="flex-1" style={{ color: C.textSecondary }}>{label}</span>
                <b style={{ color: C.navy }}>{value}名</b>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr]">
        <Card padding={14}>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[13px] font-bold">直近のミーティング</h2>
            <Pill>{upcomingMeetings.length}件</Pill>
          </div>
          <div className="space-y-1.5">
            {upcomingMeetings.map((meeting, i) => {
              const linked = clients.find((c) => c.id === meeting.clientId)
              return (
                <button key={meeting.id || i} type="button" onClick={() => linked && onOpenClient(linked)} className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-left">
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-[10px] font-extrabold" style={{ color: C.accent }}>{String(meeting.date || meeting.dateKey || '').slice(5).replace('-', '/')}</div>
                    <div className="text-[9px]" style={{ color: C.textMuted }}>{meeting.time || '10:00'}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-bold">{meeting.clientName || linked?.name || '顧客ミーティング'}</div>
                    <div className="truncate text-[9px]" style={{ color: C.textMuted }}>{meeting.type || meeting.title || '定期レビュー'}</div>
                  </div>
                  <Pill>{meeting.mode || 'Online'}</Pill>
                </button>
              )
            })}
          </div>
        </Card>

        <Card padding={14}>
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" style={{ color: C.positive }} />
            <h2 className="text-[13px] font-bold">顧客アラート</h2>
            <span className="text-[10px]" style={{ color: C.textMuted }}>レビュー・配分ドリフト・集中リスク</span>
            <Pill bg="#fee2e2" color={C.positive}>{priorityClients.slice(0, 4).length}件</Pill>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {priorityClients.slice(0, 4).map((c, i) => (
              <button key={c.id} type="button" onClick={() => onOpenClient(c)} className="rounded-xl border p-3 text-left hover:bg-[#fbf8ef]" style={{ borderColor: i === 0 ? '#fecaca' : C.border }}>
                <div className="mb-1 flex items-center gap-1">
                  <Pill bg={i === 0 ? '#fee2e2' : '#fef3c7'} color={i === 0 ? C.positive : C.accentDark}>
                    {(c.priority?.total || 0) >= 75 ? '高優先度' : (c.priority?.total || 0) >= 50 ? '要確認' : 'フォロー'}
                  </Pill>
                  <span className="ml-auto text-[10px] font-extrabold tabular-nums" style={{ color: i === 0 ? C.positive : C.accent }}>{c.priority?.total || 0} pt</span>
                </div>
                <div className="text-[12px] font-bold" style={{ color: C.navy }}>{c.name}</div>
                <p className="mt-1 truncate text-[10px]" style={{ color: C.textSecondary }}>次回 {c.nextReview || '未定'} · {c.objective || '資産成長'}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
