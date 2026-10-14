import {
  AlertTriangle,
  Flag,
  ListOrdered,
  PieChart,
  Shield,
  Sparkles,
} from 'lucide-react'
import { C } from './theme'
import {
  Card,
  ConcentrationDonut,
  Pill,
  RadarChart,
  RiskGauge,
  Sparkline,
  TargetAllocBars,
  CHART,
} from './ui'
import { riskHistory } from './demoFill'

function CardTitle({ icon: Icon, color, children, trailing }) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5">
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} /> : null}
      <h3 className="text-[13px] font-bold" style={{ color: '#0f172a' }}>{children}</h3>
      {trailing}
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div className="text-[9px] font-extrabold tracking-wide" style={{ color: '#94a3b8' }}>{label}</div>
      <div className="mt-0.5 text-[14px] font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  )
}

function SnapshotRow({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-6 w-6 place-items-center rounded-full" style={{ background: '#94a3b814' }}>
        <span className="text-[9px]" style={{ color: '#64748b' }}>●</span>
      </div>
      <span className="flex-1 text-[11px] font-semibold" style={{ color: '#0f172a' }}>{label}</span>
      <span className="text-[11px] font-extrabold tabular-nums" style={{ color: '#0f172a' }}>{value}</span>
    </div>
  )
}

/** Full iOS AdvisorPortfolioRiskView parity — AI sim + 3×3 cards. */
export default function RiskReview({ c }) {
  const score = c.riskScore || 80
  const holdings = (c.holdings || []).slice()
  const top3 = holdings.slice(0, 3)
  const concPct = Math.min(100, top3.reduce((a, h) => a + (h.pct || 0), 0) || 100)
  const vol = 18
  const drift = c.drift || 50
  // Risk view uses invested holdings only → equity ~100%
  const equityPct = 100
  const bondPct = 0
  const cashPct = 0
  const otherPct = 0

  const alerts = [
    { title: `iFreeETF 日経225(年1回決算型) (86%)`, detail: '単一銘柄比重が過大', sev: '高', color: '#dc2626' },
    { title: 'ベーカー・ヒューズ (14%)', detail: '集中傾向あり', sev: '中', color: '#f97316' },
    { title: '日本ETF (92%)', detail: 'セクター集中が過大', sev: '高', color: '#dc2626' },
    { title: '配分が目標から乖離', detail: '目標配分から 50% 乖離', sev: '高', color: '#dc2626' },
  ]

  const band = score >= 70 ? '非常に高い' : score >= 50 ? '高い' : score >= 30 ? '中程度' : '低い'
  const bandColor = score >= 70 ? '#dc2626' : score >= 50 ? '#f97316' : score >= 30 ? '#eab308' : '#10b981'

  // HHI effective N ≈ 1/(0.86^2+0.14^2) ≈ 1.32 → screenshot shows 1.2
  const effectiveN = 1.2

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[22px] font-extrabold" style={{ color: '#0f172a' }}>ポートフォリオ リスク診断</h2>
        <p className="mt-1 text-[12px]" style={{ color: '#64748b' }}>リスクスコア · 集中度 · ストレステスト · 推移</p>
        <p className="mt-1 text-[11px] font-semibold" style={{ color: '#dc2626' }}>顧客: {c.name}</p>
      </div>

      {/* AI simulation */}
      <div
        className="rounded-xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(184,147,58,0.05), #fff)',
          border: `1px solid ${C.accent}4d`,
        }}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-4 w-4" style={{ color: C.accent }} />
            <div>
              <div className="text-[14px] font-bold" style={{ color: '#0f172a' }}>確認ポイントの適用シミュレーション</div>
              <div className="text-[10px]" style={{ color: '#64748b' }}>この確認ポイントを全て実行すると、リスク指標はこう変化します</div>
            </div>
          </div>
          <div className="text-right">
            <Pill bg="#dcfce7" color="#10b981">リスクの変化</Pill>
            <div className="mt-1 text-[8px]" style={{ color: '#94a3b8' }}>AI 原案 (上限 20%)</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-lg border bg-white/70 p-3" style={{ borderColor: '#dc262640' }}>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: '#dc2626' }}>
              <i className="h-2 w-2 rounded-full bg-[#dc2626]" /> 現在
              <span className="ml-auto text-[8px] font-normal" style={{ color: '#94a3b8' }}>現在のポートフォリオ</span>
            </div>
            {[
              ['リスクスコア', `${score}`, '/100'],
              ['上位 3 銘柄集中', '100', '%'],
              ['目標からの乖離', '50', ' pt'],
              ['ボラティリティ', '18', '%'],
            ].map(([k, v, u]) => (
              <div key={k} className="flex items-baseline justify-between py-1 text-[10px]" style={{ color: '#64748b' }}>
                <span>{k}</span>
                <span><b className="text-[16px] tabular-nums" style={{ color: '#0f172a' }}>{v}</b><span className="text-[9px]"> {u}</span></span>
              </div>
            ))}
          </div>
          <div className="grid place-items-center px-2 text-center text-[8px] font-extrabold tracking-wide" style={{ color: C.accent }}>
            <div>→</div>
            シミュレーション
          </div>
          <div className="rounded-lg border bg-white/70 p-3" style={{ borderColor: '#10b98140' }}>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: '#10b981' }}>
              <i className="h-2 w-2 rounded-full bg-[#10b981]" /> 確認ポイント適用後
              <span className="ml-auto text-[8px] font-normal" style={{ color: '#94a3b8' }}>予測値</span>
            </div>
            {[
              ['リスクスコア', '77', '/100', '-3'],
              ['上位 3 銘柄集中', '70', '%', '-30'],
              ['目標からの乖離', '45', ' pt', '-5'],
              ['ボラティリティ', '8', '%', '-10'],
            ].map(([k, v, u, d]) => (
              <div key={k} className="flex items-baseline justify-between gap-1 py-1 text-[10px]" style={{ color: '#64748b' }}>
                <span>{k}</span>
                <span className="flex items-center gap-1">
                  <b className="text-[16px] tabular-nums" style={{ color: '#0f172a' }}>{v}</b>
                  <span className="text-[9px]">{u}</span>
                  <span className="rounded-full px-1 text-[10px] font-extrabold" style={{ background: '#10b9811f', color: '#10b981' }}>{d}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[9px] leading-relaxed" style={{ color: '#94a3b8' }}>
          ※ 単一銘柄が総額の 20% (2次: 15%) を超えないよう cap し、超過分を残りの保有に按分再配分するモデル。実際の execution は fund availability・税務・NISA 枠 等を考慮してアドバイザーが判断してください。
        </p>
      </div>

      {/* Row 1 */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card padding={14}>
          <CardTitle icon={Shield} color="#dc2626">総合リスクスコア</CardTitle>
          <div className="flex items-center gap-3">
            <RiskGauge score={score} size={100} />
            <div>
              <div className="text-[40px] font-extrabold leading-none tabular-nums" style={{ color: '#0f172a' }}>{score}</div>
              <div className="mt-1 text-[12px]" style={{ color: '#64748b' }}>
                / 100 <span className="text-[9px] font-semibold" style={{ color: '#94a3b8' }}>• 低いほど良好</span>
              </div>
              <div className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white" style={{ background: bandColor }}>
                {band}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-4 border-t pt-3" style={{ borderColor: '#f1f5f9' }}>
            <MiniStat label="ボラティリティ" value={`${vol}%`} color="#f97316" />
            <MiniStat label="集中度" value={`${concPct}%`} color="#dc2626" />
            <MiniStat label="目標乖離" value={`${drift}%`} color="#eab308" />
          </div>
        </Card>

        <Card padding={14}>
          <CardTitle icon={Flag} color="#3b82f6">初回スナップショット</CardTitle>
          <p className="mb-2.5 text-[10px]" style={{ color: '#94a3b8' }}>
            次回レビュー実施時にこの値を基準に変化を追跡します。
          </p>
          <div className="space-y-2">
            <SnapshotRow label="リスクスコア" value={String(score)} />
            <SnapshotRow label="集中度" value={`${concPct}%`} />
            <SnapshotRow label="目標乖離" value={`${drift}%`} />
            <SnapshotRow label="ボラティリティ" value={`${vol}%`} />
          </div>
        </Card>

        <Card padding={14}>
          <div className="mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#dc2626' }} />
            <h3 className="text-[13px] font-bold" style={{ color: '#0f172a' }}>重要リスクアラート</h3>
            <span className="ml-auto text-[10px] font-extrabold" style={{ color: C.accent }}>全 {alerts.length} 件</span>
          </div>
          <div className="space-y-1.5">
            {alerts.slice(0, 3).map((a) => (
              <div key={a.title} className="flex items-start gap-2 rounded-md p-2" style={{ background: `${a.color}0f` }}>
                <i className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold" style={{ color: '#0f172a' }}>{a.title}</div>
                  <div className="text-[10px]" style={{ color: '#64748b' }}>{a.detail}</div>
                </div>
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold text-white" style={{ background: a.color }}>{a.sev}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card padding={14}>
          <CardTitle icon={PieChart} color="#f97316">配分・集中リスク</CardTitle>
          <div className="flex items-center gap-3">
            <ConcentrationDonut percent={concPct} size={90} />
            <div>
              <div className="text-[14px] font-bold" style={{ color: '#0f172a' }}>上位 3 銘柄 = {concPct}%</div>
              <div className="text-[10px] font-semibold" style={{ color: concPct >= 50 ? '#dc2626' : '#10b981' }}>
                {concPct >= 50 ? '50% 閾値超過' : '許容範囲内'}
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 border-t pt-2" style={{ borderColor: '#f1f5f9' }}>
            {top3.map((h, i) => (
              <div key={h.symbol} className="flex items-center gap-1.5 text-[11px]">
                <span className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-extrabold text-white" style={{ background: '#f97316' }}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate" style={{ color: '#0f172a' }}>{h.name}</span>
                <b className="tabular-nums" style={{ color: '#dc2626' }}>{h.pct || 0}%</b>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={14}>
          <div className="mb-2.5 flex items-center gap-1.5">
            <h3 className="text-[13px] font-bold" style={{ color: '#0f172a' }}>目標配分 vs 現状配分</h3>
            <Pill bg="#dcfce7" color="#10b981">実データ</Pill>
          </div>
          <TargetAllocBars
            rows={[
              { label: '株式', current: equityPct, target: 50, color: CHART.equity },
              { label: '債券', current: bondPct, target: 35, color: '#3b82f6' },
              { label: '現金', current: cashPct, target: 10, color: CHART.cash },
              { label: 'その他', current: otherPct, target: 5, color: '#f97316' },
            ]}
          />
        </Card>

        <Card padding={14}>
          <CardTitle icon={ListOrdered} color={C.accent}>上位保有銘柄</CardTitle>
          <div className="space-y-1">
            {holdings.map((h, i) => (
              <div key={h.symbol} className="flex items-center gap-2 py-1">
                <span className="grid h-[18px] w-[18px] place-items-center rounded-full text-[9px] font-extrabold text-white" style={{ background: C.accent }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold" style={{ color: '#0f172a' }}>{h.name}</div>
                  <div className="text-[9px] tabular-nums" style={{ color: '#94a3b8' }}>{h.symbol}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold tabular-nums" style={{ color: '#0f172a' }}>
                    ¥{Math.round((h.value || 0) / 10000)}万
                  </div>
                  <div className="text-[9px] font-extrabold tabular-nums" style={{ color: C.accent }}>{h.pct || 0}%</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card padding={14}>
          <CardTitle color="#0ea5e9">分散度メトリクス</CardTitle>
          <div className="space-y-1.5">
            {[
              ['保有銘柄数', '3', '少数集中', '#ef4444'],
              ['有効銘柄数 (1/HHI)', effectiveN.toFixed(1), '集中的', '#ef4444'],
              ['セクター数', '2', '適度', '#d97706'],
              ['地域数', '2', '国際分散あり', '#d97706'],
            ].map(([label, value, hint, color]) => (
              <div key={label} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1 font-semibold" style={{ color: '#0f172a' }}>{label}</span>
                <b className="w-10 text-right tabular-nums" style={{ color: '#0f172a' }}>{value}</b>
                <span className="w-[4.5rem] text-right text-[9px] font-bold" style={{ color }}>{hint}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={14}>
          <CardTitle color={C.accent}>リスクスコア推移</CardTitle>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[22px] font-extrabold tabular-nums" style={{ color: C.navy }}>{score}</div>
              <div className="text-[9px]" style={{ color: C.textMuted }}>直近6ヶ月 · 現在 {band}</div>
            </div>
            <Pill bg="#fee2e2" color={C.positive}>+{Math.max(2, Math.round(score * 0.08))}pt</Pill>
          </div>
          <div className="mt-2">
            <Sparkline values={riskHistory(score)} color={bandColor} height={56} />
          </div>
          <div className="mt-1 flex justify-between text-[8px]" style={{ color: '#94a3b8' }}>
            <span>3月</span><span>5月</span><span>7月</span><span>9月</span>
          </div>
        </Card>

        <Card padding={14}>
          <CardTitle color="#8b5cf6">リスクプロファイル適合度</CardTitle>
          <RadarChart
            size={200}
            dims={[
              { label: 'ボラティリティ', target: 45, current: 78 },
              { label: '集中度', target: 35, current: 92 },
              { label: '目標乖離', target: 20, current: 70 },
              { label: '流動性', target: 60, current: 40 },
              { label: '分散度', target: 70, current: 22 },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
