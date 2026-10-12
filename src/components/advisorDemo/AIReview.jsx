import { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  EyeOff,
  MessageSquare,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { C } from './theme'
import { Card, Donut, Pill, CHART } from './ui'

const ACTIONS = [
  {
    id: 1,
    level: 'H',
    icon: '◔',
    title: 'iFreeETF 日経225 集中度86%を50%へ段階的削減',
    tag: '単一銘柄集中 / 緊急リバランス',
    impact: '36ポイント削減',
    impactLead: 'ポートフォリオの集中リスクを',
    impactTail: 'し、目標資産配分への収束を加速',
    reasons: [
      '現在保有額¥284万 > 目標額¥165万(総AUM¥330万×50%×50%目安)',
      '単一銘柄86% > 中庸型リスク閾値20%',
      'セクター集中度92%(日本ETF) > 許容基準40%',
    ],
  },
  {
    id: 2,
    level: 'H',
    icon: '◒',
    title: '国内集中度85%から海外資産35%への多地域展開',
    tag: '地域分散 / ドリフト50pts',
    impact: '35ポイント向上',
    impactLead: '海外資産比率を',
    impactTail: '地域分散を改善',
    reasons: ['国内資産への集中が高水準', '米国・全世界株式による地域分散余地', '目標配分との乖離を段階的に縮小'],
  },
  {
    id: 3,
    level: 'H',
    icon: '↻',
    title: '債券配分0%から目標35%(¥115万)への体系的組入',
    tag: 'アセットクラス欠落 / 固定利付導入',
    impact: '+35ポイント',
    impactLead: '債券配分を',
    impactTail: '段階的に組み入れ',
    reasons: ['現在の債券配分は0%', '中庸型の目標債券比率は35%', '株式下落時の緩衝資産が不足'],
  },
  {
    id: 4,
    level: 'M',
    icon: '◕',
    title: 'ベーカー・ヒューズ14%集中を分散ポジションへ段階換え',
    tag: '単一銘柄集中 / エネルギー集約',
    impact: '約8ポイント軽減',
    impactLead: '単一株集中リスクを',
    impactTail: '分散ポジションに転換',
    reasons: ['エネルギー単一銘柄への集中', '同一リスク要因への依存を低減', '複数地域・セクターへ再配分'],
  },
  {
    id: 5,
    level: 'M',
    icon: '✦',
    title: 'ポートフォリオリバランス進捗管理の四半期チェックイン設定',
    tag: 'ガバナンス / 進捗追跡',
    impact: '90%以上',
    impactLead: 'リバランス計画の実行率を',
    impactTail: '四半期ごとに確認',
    reasons: ['段階的な売却・再配分の進捗を追跡', '目標乖離の再拡大を早期検知', '顧客合意事項を定期的に確認'],
  },
]

function ChangeMetric({ label, value, sub, tint, icon }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: `${tint}26`, background: `${tint}0d` }}>
      <div className="flex items-center gap-1 text-[9px] font-extrabold" style={{ color: C.textMuted }}>
        <span style={{ color: tint }}>{icon}</span>{label}
      </div>
      <div className="mt-0.5 text-[15px] font-extrabold leading-tight tabular-nums" style={{ color: value === '未登録' ? C.textMuted : tint }}>{value}</div>
      <div className="mt-0.5 text-[8px]" style={{ color: C.textMuted }}>{sub}</div>
    </div>
  )
}

function DecisionButton({ icon: Icon, label, color, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-bold"
      style={{ borderColor: color, color: active ? '#fff' : color, background: active ? color : '#fff' }}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  )
}

function ActionCard({ action, expanded, status, onToggle, onDecision, onModify, onNote }) {
  const high = action.level === 'H'
  const color = high ? '#ef4444' : '#f97316'
  return (
    <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#e2e8f0' }}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2.5 p-3 text-left">
        <div className="flex flex-col items-center gap-0.5">
          <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: color }}>{action.level}</span>
          <span className="text-[9px] font-extrabold" style={{ color: C.textMuted }}>{action.id}</span>
        </div>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px]" style={{ background: '#f1f5f9', color: '#64748b' }}>{action.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold leading-snug" style={{ color: C.navy }}>{action.title}</div>
          <div className="mt-1 inline-block rounded bg-slate-50 px-1.5 py-0.5 text-[8px]" style={{ color: C.textMuted }}>{action.tag}</div>
        </div>
        <span className="shrink-0 text-[11px] font-extrabold" style={{ color: C.textSecondary }}>{action.impact}</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>

      {expanded ? (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded-lg border bg-slate-50 p-2.5" style={{ borderColor: '#e2e8f0' }}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-200 text-[12px]" style={{ color: '#64748b' }}>→</span>
            <div>
              <div className="text-[8px] font-extrabold tracking-wide" style={{ color: C.textMuted }}>{action.impactLead}</div>
              <div className="text-[13px] font-extrabold" style={{ color: C.navy }}>{action.impact}</div>
              <div className="text-[9px]" style={{ color: C.textMuted }}>{action.impactTail}</div>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-[9px] font-extrabold tracking-wide" style={{ color: C.textMuted }}>重要な理由</div>
            <ul className="mt-1.5 space-y-1">
              {action.reasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>
                  <span style={{ color: C.textMuted }}>•</span><span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t pt-2.5" style={{ borderColor: '#e2e8f0' }}>
            {status ? <span className="mr-auto text-[10px] font-bold" style={{ color: status === 'accepted' ? C.green : status === 'edited' ? C.accent : C.textMuted }}>保存済み: {status === 'accepted' ? '承認' : status === 'edited' ? '修正' : '見送り'}</span> : null}
            <DecisionButton icon={CheckCircle2} label="承認" color="#10b981" active={status === 'accepted'} onClick={() => onDecision('accepted')} />
            <DecisionButton icon={PencilLine} label="修正" color={C.accent} active={status === 'edited'} onClick={onModify} />
            <DecisionButton icon={EyeOff} label="見送り" color="#64748b" active={status === 'rejected'} onClick={() => onDecision('rejected')} />
            <button type="button" onClick={onNote} className="inline-flex items-center gap-1 px-1.5 py-1 text-[10px] font-semibold" style={{ color: C.accent }}>
              <MessageSquare className="h-3 w-3" /> メモ追加
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function LiveSimulation() {
  return (
    <Card padding={14}>
      <div className="mb-2 flex items-center gap-1.5">
        <span style={{ color: C.accent }}>◔</span>
        <h3 className="text-[13px] font-bold">ライブシミュレーション</h3>
        <Pill className="ml-auto" bg="#dcfce7" color="#10b981">改善</Pill>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="mb-1 text-[9px] font-extrabold text-red-500">現在</div>
          <Donut segments={[{ label: '株式', value: 100, color: C.accent }]} size={86} showLegend={false} centerValue="" />
        </div>
        <div className="text-center">
          <div className="mb-1 text-[9px] font-extrabold text-emerald-500">適用後</div>
          <Donut
            segments={[
              { label: '株式', value: 45, color: C.accent },
              { label: '債券', value: 35, color: CHART.bond },
              { label: '現金', value: 20, color: CHART.cash },
            ]}
            size={86}
            showLegend={false}
            centerValue=""
          />
        </div>
      </div>
      <div className="mt-2 space-y-2 border-t pt-2 text-[11px]" style={{ borderColor: C.borderSub }}>
        {[['リスクスコア', '80', '77/100', '-3'], ['上位 3 銘柄集中', '100', '70%', '-30'], ['配分乖離', '50', '45pt', '-5']].map(([label, cur, next, diff]) => (
          <div key={label} className="flex items-center">
            <span className="flex-1" style={{ color: C.textMuted }}>{label}</span>
            <span className="font-semibold">{cur} → <b style={{ color: C.green }}>{next}</b> <b style={{ color: C.green }}>({diff})</b></span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px]" style={{ color: C.textMuted }}>承認・修正・見送りを切り替えると即時反映されます</p>
    </Card>
  )
}

function ModifyModal({ action, onClose, onSave }) {
  const [value, setValue] = useState(action.impact)
  const [reason, setReason] = useState('顧客の換金ニーズを踏まえ、削減幅を段階的に調整する。')
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[16px] font-extrabold" style={{ color: C.navy }}>確認ポイントを修正</h2>
        <p className="mt-1 text-[11px]" style={{ color: C.textMuted }}>{action.title}</p>
        <label className="mt-4 block text-[10px] font-bold" style={{ color: C.textMuted }}>アドバイザーによる修正案</label>
        <input value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-[14px] font-bold" style={{ borderColor: C.border }} />
        <label className="mt-3 block text-[10px] font-bold" style={{ color: C.textMuted }}>修正の事由</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3 text-[12px]" style={{ borderColor: C.border }} placeholder="例: 顧客の換金ニーズを踏まえ、削減幅を20ptに調整" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-[11px] font-bold" style={{ background: '#f1f5f9' }}>キャンセル</button>
          <button type="button" onClick={() => onSave(value, reason)} className="rounded-lg px-4 py-2 text-[11px] font-extrabold text-white" style={{ background: C.accent }}>保存</button>
        </div>
      </div>
    </div>
  )
}

export default function AIReview({ c, decisions, setDecision, onToast }) {
  const [expanded, setExpanded] = useState(new Set([1]))
  const [rightTab, setRightTab] = useState('notes')
  const [modifyAction, setModifyAction] = useState(null)
  const decided = ACTIONS.filter((a) => decisions[`a${a.id}`])
  const counts = {
    accepted: decided.filter((a) => decisions[`a${a.id}`] === 'accepted').length,
    edited: decided.filter((a) => decisions[`a${a.id}`] === 'edited').length,
    rejected: decided.filter((a) => decisions[`a${a.id}`] === 'rejected').length,
  }

  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <div className="space-y-4">
      <div className="text-center text-[15px] font-extrabold" style={{ color: C.navy }}>AI レビュー</div>

      <Card padding={16}>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[16px]" style={{ color: C.accent }}>◉</span>
          <h3 className="text-[14px] font-extrabold">前回レビューからの変化</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold" style={{ color: C.textMuted }}>Sep 20, 2026</span>
          <button type="button" onClick={() => onToast('デモ: 詳細を表示しました')} className="ml-auto rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ background: '#fef3c7', color: C.accent }}>詳細 →</button>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border p-3.5" style={{ borderColor: '#fde68a', background: 'linear-gradient(135deg,#fffbeb,#fff)' }}>
            <div className="text-[10px] font-bold" style={{ color: C.textMuted }}>ポートフォリオ評価額</div>
            <div className="mt-1 text-[32px] font-extrabold leading-none text-emerald-500">+8.6%</div>
            <div className="mt-2 text-[9px]" style={{ color: C.textMuted }}>元本 ¥304万 → ¥330万</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ChangeMetric icon="🛒" tint="#10b981" label="新規買付" value="BKR" sub="90日" />
            <ChangeMetric icon="▣" tint="#2563eb" label="キャッシュ残高" value="未登録" sub="未設定" />
            <ChangeMetric icon="⬟" tint="#dc2626" label="リスクスコア" value="80 / 100" sub="ドリフト基準" />
            <ChangeMetric icon="◔" tint="#dc2626" label="Top 3 集中度" value="100%" sub="集中高" />
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card padding={16}>
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full text-[18px]" style={{ background: '#ede9fe', color: C.accent }}>✦</div>
            <div>
              <h3 className="text-[16px] font-extrabold">AI 分析</h3>
              <p className="text-[10px]" style={{ color: C.textMuted }}>確認用の整理です。最終判断はアドバイザー様にお任せします。</p>
            </div>
          </div>
          <div className="space-y-3">
            {ACTIONS.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                expanded={expanded.has(action.id)}
                status={decisions[`a${action.id}`]}
                onToggle={() => toggle(action.id)}
                onDecision={(status) => {
                  setDecision(`a${action.id}`, status)
                  onToast(`デモ: ${status === 'accepted' ? '承認' : '見送り'}を保存しました`)
                }}
                onModify={() => setModifyAction(action)}
                onNote={() => onToast(`デモ: アクション #${action.id} にメモを追加`)}
              />
            ))}
          </div>
        </Card>

        <div className="space-y-3">
          <div className="pl-1 text-[9px] font-extrabold tracking-widest" style={{ color: C.textMuted }}>▦ サブビュー</div>
          <LiveSimulation />
          <Card padding={14}>
            <div className="mb-2 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" style={{ color: C.accent }} />
              <h3 className="text-[13px] font-bold">アドバイザー判断</h3>
              <span className="text-[11px]" style={{ color: C.textMuted }}>({decided.length})</span>
            </div>
            <div className="mb-2 flex gap-1.5">
              <Pill bg="#dcfce7" color="#10b981">● {counts.accepted} 承認</Pill>
              <Pill>● {counts.edited} 修正</Pill>
              <Pill bg="#f1f5f9" color="#64748b">● {counts.rejected} 無視</Pill>
            </div>
            {decided.length ? (
              <div className="space-y-1.5">
                {decided.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-[10px]">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-300 text-white">×</span>
                    <span className="flex-1 font-semibold leading-snug">{a.title}</span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px]" style={{ color: C.textMuted }}>
                      {decisions[`a${a.id}`] === 'accepted' ? '承認済み' : decisions[`a${a.id}`] === 'edited' ? '修正済み' : '無視'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[9px] font-extrabold" style={{ color: C.textMuted }}>前回面談 2026-09-09</p>
                {[
                  ['iFreeETF 日経225 集中度の段階削減', '承認済み'],
                  ['海外分散枠の試算を次回提示', '修正済み'],
                ].map(([title, status]) => (
                  <div key={title} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-[10px]">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-white" style={{ background: C.accent }}>✓</span>
                    <span className="flex-1 font-semibold leading-snug">{title}</span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[8px]" style={{ color: C.textMuted }}>{status}</span>
                  </div>
                ))}
                <p className="text-[9px]" style={{ color: C.textMuted }}>今回セッションの新規判断は、左のアクションから記録されます。</p>
              </div>
            )}
          </Card>

          <Card padding={0}>
            <div className="flex border-b" style={{ borderColor: C.borderSub }}>
              {[['notes', 'AI Notes', 3], ['funds', '検討リスト', 10]].map(([id, label, count]) => (
                <button key={id} type="button" onClick={() => setRightTab(id)} className="relative flex-1 py-2.5 text-[12px] font-bold" style={{ color: rightTab === id ? C.navy : C.textMuted }}>
                  {label} <span className="text-[10px]">({count})</span>
                  {rightTab === id ? <i className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: C.accent }} /> : null}
                </button>
              ))}
            </div>
            <div className="p-3">
              {rightTab === 'notes' ? (
                <ul className="space-y-2">
                  {[
                    'リスク許容度は「バランス型」ですが、実配分ドリフトが 50 pt。目標乖離が確認されます。',
                    '集中リスク検出: iFreeETF 日経225(年1回決算型) が 86% を占めており、上限を超過しています。',
                    'Top 3 銘柄が総資産の 100% を占め、分散不足の傾向。',
                  ].map((note) => <li key={note} className="flex gap-2 text-[11px] leading-relaxed" style={{ color: C.textSecondary }}><span style={{ color: C.accent }}>•</span>{note}</li>)}
                </ul>
              ) : (
                <div className="space-y-1.5">
                  {['2559.T 全世界株式', '2558.T S&P500', '1482.T 米国債7-10年', '2510.T 国内債券'].map((f) => (
                    <button key={f} type="button" onClick={() => onToast(`デモ: ${f} の詳細`)} className="flex w-full items-center rounded-lg bg-slate-50 p-2 text-left text-[11px] font-semibold">
                      <span style={{ color: C.accent }}>★</span><span className="ml-2 flex-1">{f}</span><span style={{ color: C.textMuted }}>›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {modifyAction ? (
        <ModifyModal
          action={modifyAction}
          onClose={() => setModifyAction(null)}
          onSave={() => {
            setDecision(`a${modifyAction.id}`, 'edited')
            setModifyAction(null)
            onToast('デモ: 修正案を保存しました')
          }}
        />
      ) : null}
    </div>
  )
}
