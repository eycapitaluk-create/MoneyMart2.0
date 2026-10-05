import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileText,
  PencilLine,
  Plus,
  Search,
  Share2,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { defaultAgenda, defaultCaptureItems, defaultLiveMemo, defaultPrepMemo, meetingRecordCopy } from './demoFill'
import { C } from './theme'
import { Card, Pill } from './ui'

const FILTERS = [
  { id: 'all', label: 'すべて' },
  { id: 'completed', label: '完了' },
  { id: 'cancelled', label: 'キャンセル' },
  { id: 'noshow', label: '無断欠席' },
]

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function parseMeetingDate(m) {
  const raw = m.date || m.dateKey || '2026-09-25'
  const [y, mo, d] = raw.split('-').map(Number)
  return new Date(y, (mo || 1) - 1, d || 1, 12)
}

function DateBadgeLarge({ date }) {
  return (
    <div
      className="w-[66px] shrink-0 overflow-hidden rounded-lg border text-center"
      style={{ borderColor: '#e7e5e4', background: C.surfaceSub }}
    >
      <div className="py-1 text-[10px] font-extrabold text-white" style={{ background: C.accent }}>
        {MONTHS[date.getMonth()]}
      </div>
      <div className="py-0.5 text-[26px] font-extrabold leading-none" style={{ color: C.navy }}>{date.getDate()}</div>
      <div className="pb-1 text-[9px] font-extrabold" style={{ color: C.textMuted }}>{WEEKDAYS[date.getDay()]}</div>
    </div>
  )
}

function DateBadgeSmall({ date }) {
  return (
    <div className="w-10 shrink-0 rounded-md py-1.5 text-center" style={{ background: C.surfaceSub }}>
      <div className="text-[8px] font-extrabold" style={{ color: C.textMuted }}>{MONTHS[date.getMonth()]}</div>
      <div className="text-[15px] font-extrabold leading-none" style={{ color: C.navy }}>{date.getDate()}</div>
    </div>
  )
}

function statusStyle(status) {
  if (status === '完了' || status === 'completed') return { bg: '#fee2e2', color: C.positive, label: '完了' }
  if (status === 'キャンセル' || status === 'cancelled') return { bg: '#dbeafe', color: C.negative, label: 'キャンセル' }
  if (status === '無断欠席' || status === 'no_show') return { bg: '#f1f5f9', color: C.textMuted, label: '無断欠席' }
  return { bg: '#dbeafe', color: '#1d4ed8', label: '予定' }
}

function workflowLabel(m) {
  const stage = m.workflowStage || (m.prepPct > 0 ? 'preparation' : 'scheduled')
  if (stage === 'meeting') return '面談を続ける'
  if (stage === 'preparation') return '準備を続ける'
  if (stage === 'documentation' || stage === 'post_update') return '記録を完了'
  if (stage === 'approved') return '記録を見る'
  return '準備を開始'
}

function NewMeetingModal({ client, onClose, onSave }) {
  const [type, setType] = useState('定期レビュー')
  const [date, setDate] = useState('2026-09-27')
  const [hour, setHour] = useState(20)
  const [minute, setMinute] = useState(15)
  const [duration, setDuration] = useState(60)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: C.borderSub }}>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] font-bold" style={{ background: '#f1f5f9', color: C.textMuted }}>キャンセル</button>
          <div className="text-[15px] font-extrabold" style={{ color: C.navy }}>新規予定</div>
          <button
            type="button"
            onClick={() => onSave({
              id: `M-NEW-${Date.now()}`,
              date,
              time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
              type,
              status: '予定',
              duration,
              prepPct: 0,
              title: type,
            })}
            className="rounded-lg px-3 py-1.5 text-[12px] font-extrabold text-white"
            style={{ background: C.accent }}
          >
            保存
          </button>
        </div>
        <div className="space-y-0 divide-y px-1" style={{ borderColor: C.borderSub }}>
          <div className="flex items-center justify-between px-4 py-3 text-[13px]">
            <span style={{ color: C.textMuted }}>顧客</span>
            <span className="font-semibold" style={{ color: C.navy }}>{client.name}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-[13px]">
            <span style={{ color: C.textMuted }}>氏名</span>
            <span className="font-semibold" style={{ color: C.navy }}>{client.name}</span>
          </div>
          <div className="px-4 py-3">
            <div className="mb-2 text-[11px] font-extrabold" style={{ color: C.textMuted }}>ミーティング詳細</div>
            <div className="mb-3 flex items-center justify-between text-[13px]">
              <span style={{ color: C.textMuted }}>タイプ</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border px-2 py-1 text-[12px] font-semibold" style={{ borderColor: C.border }}>
                {['定期レビュー', '初回ヒアリング', 'フォローアップ', '面談準備'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="mb-3 flex items-center justify-between text-[13px]">
              <span style={{ color: C.textMuted }}>日付</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-full border px-3 py-1 text-[12px] font-semibold" style={{ borderColor: C.border }} />
            </div>
            <div className="mb-3">
              <div className="mb-1 text-[12px]" style={{ color: C.textMuted }}>時刻</div>
              <div className="flex items-center gap-3">
                <div className="flex flex-1 justify-center gap-4 rounded-xl py-2" style={{ background: '#f8fafc' }}>
                  <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className="bg-transparent text-[18px] font-bold">
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}
                  </select>
                  <span className="text-[18px] font-bold">:</span>
                  <select value={minute} onChange={(e) => setMinute(Number(e.target.value))} className="bg-transparent text-[18px] font-bold">
                    {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                  </select>
                </div>
                <button type="button" className="rounded-lg px-3 py-2 text-[12px] font-extrabold text-white" style={{ background: '#007AFF' }}>適用</button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[12px]" style={{ color: C.textMuted }}>所要時間</div>
              <div className="mb-2 flex items-center justify-center gap-3 rounded-full py-2" style={{ background: '#f1f5f9' }}>
                <button type="button" onClick={() => setDuration((d) => Math.max(15, d - 15))} className="h-8 w-8 rounded-full bg-white text-[16px] font-bold">−</button>
                <span className="min-w-[4rem] text-center text-[15px] font-extrabold">{duration} 分</span>
                <button type="button" onClick={() => setDuration((d) => Math.min(180, d + 15))} className="h-8 w-8 rounded-full bg-white text-[16px] font-bold">+</button>
              </div>
              <div className="flex justify-center gap-2">
                {[15, 30, 45, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold"
                    style={{ background: duration === d ? '#007AFF' : '#f1f5f9', color: duration === d ? '#fff' : C.navy }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkflowStepBar({ step }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl items-start">
      {[[1, '事前準備'], [2, '面談中'], [3, '記録・完了']].map(([n, label], i) => (
        <div key={n} className="flex flex-1 items-start">
          {i > 0 ? <div className="mt-4 h-px flex-1" style={{ background: step >= n ? C.accent : '#d6d3d1' }} /> : null}
          <div className="flex min-w-16 flex-col items-center gap-1">
            <span
              className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-extrabold"
              style={{ background: step === n ? C.accent : step > n ? C.accentLight : '#e7e5e4', color: step >= n ? (step === n ? '#fff' : C.accent) : C.textMuted }}
            >
              {step > n ? <Check className="h-4 w-4" /> : n}
            </span>
            <span className="text-[9px] font-extrabold" style={{ color: step === n ? C.navy : C.textMuted }}>{label}</span>
          </div>
          {i < 2 ? <div className="mt-4 h-px flex-1" style={{ background: step > n ? C.accent : '#d6d3d1' }} /> : null}
        </div>
      ))}
    </div>
  )
}

function PrepStep({ agenda, setAgenda, prepMemo, setPrepMemo, checklist, setChecklist }) {
  const suggestions = [
    'リバランス計画の相談（ドリフト 50pt）',
    'リスク許容度を再確認（保有比率と目標の確認）',
    '教育資金・老後資金のマイルストーン',
    '税制優遇（NISA・iDeCo）の活用状況',
  ]
  const proposals = [
    'A－Stock リストの「⭐」から追加（種別: 検討）',
    '1321.T－ファンド比較の「⭐」から追加（種別: 検討）',
    '1308.T－ファンド比較の「⭐」から追加（種別: 検討）',
    '1306.T－ファンド比較の「⭐」から追加（種別: 検討）',
  ]
  return (
    <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-3">
        <Card padding={14}>
          <div className="mb-3 flex items-start justify-between">
            <h3 className="text-[13px] font-bold">ミーティング概要</h3>
            <div className="grid grid-cols-3 gap-5 text-center">
              <div><div className="text-[9px]" style={{ color: C.textMuted }}>ポートフォリオ評価額</div><b className="text-[16px]">¥330万</b></div>
              <div><div className="text-[9px]" style={{ color: C.textMuted }}>累計リターン</div><b className="text-[16px]" style={{ color: C.positive }}>+12.9%</b></div>
              <div><div className="text-[9px]" style={{ color: C.textMuted }}>リスク許容度</div><b className="text-[14px]" style={{ color: C.accent }}>積極型</b></div>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-[11px]">
            <b>前回ミーティング以降の変化</b>
            <div className="mt-1.5 space-y-1" style={{ color: C.textSecondary }}>
              <div>↻ 前回ミーティングからの配分ドリフト 25pt</div>
              <div>⚠ リスク許容度・バランス型から乖離</div>
              <div>△ iFreeETF 日経225 比重 86% — 単一銘柄比率過大</div>
            </div>
          </div>
        </Card>
        <Card padding={14}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold">ミーティングアジェンダ</h3>
            <Pill>{agenda.length} 項目</Pill>
          </div>
          <div className="space-y-1.5">
            {agenda.map((item, i) => (
              <div key={`${item}-${i}`} className="flex items-center gap-2 rounded-lg bg-[#faf8f2] px-3 py-2 text-[11px]">
                <span className="flex-1">{item}</span>
                <button type="button" onClick={() => setAgenda((a) => a.filter((_, x) => x !== i))} style={{ color: C.textMuted }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => setAgenda((a) => [...a, '新しいアジェンダ項目'])} className="w-full rounded-lg border border-dashed py-2 text-[11px] font-bold" style={{ borderColor: C.border, color: C.accent }}>+ アジェンダ項目を追加</button>
          </div>
        </Card>
        <Card padding={14}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold">アドバイザー専用メモ</h3><Pill>アドバイザーのみ閲覧</Pill></div>
          <textarea value={prepMemo} onChange={(e) => setPrepMemo(e.target.value)} rows={7} className="w-full rounded-lg border p-3 text-[11px]" style={{ borderColor: C.border, background: '#fffef8' }} />
          <button type="button" className="mt-2 w-full rounded-lg py-2 text-[11px] font-extrabold text-white" style={{ background: C.accent }}>メモを保存</button>
          <p className="mt-2 text-[8px]" style={{ color: C.textMuted }}>このノートの表示場所: Step 2 Meeting「Private Preparation Memo」・PDF（Advisor専用）</p>
        </Card>
      </div>
      <div className="space-y-3">
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">AI 提案ディスカッション</h3>
          <div className="space-y-1.5">
            {suggestions.map((s) => <button key={s} type="button" onClick={() => setAgenda((a) => a.includes(s) ? a : [...a, s])} className="flex w-full items-center gap-2 rounded-lg bg-[#faf8f2] px-3 py-2 text-left text-[10px]"><span className="flex-1">✦ {s}</span><Pill>+ アジェンダ</Pill></button>)}
          </div>
        </Card>
        <Card padding={14}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold">運用チーム提案</h3><Pill>4 件</Pill></div>
          <div className="space-y-1.5">{proposals.map((p) => <div key={p} className="rounded-lg bg-slate-50 px-3 py-2 text-[10px]">★ {p}</div>)}</div>
          <button type="button" className="mt-2 w-full rounded-lg border border-dashed py-2 text-[10px]" style={{ borderColor: C.border, color: C.textMuted }}>+ 提案を入力（例: 単年債 ETF を15%）</button>
        </Card>
        <Card padding={14}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold">準備状況</h3><Pill>{Object.values(checklist).filter(Boolean).length} / 4 完了</Pill></div>
          <div className="space-y-2">
            {['アジェンダ準備完了', '保有商品の確認', '事前資料メモの記入', '顧客ドキュメント確認'].map((label, i) => (
              <label key={label} className="flex items-center gap-2 text-[11px]">
                <input type="checkbox" checked={Boolean(checklist[i])} onChange={(e) => setChecklist((v) => ({ ...v, [i]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function MeetingStep({ agenda, prepMemo, memo, setMemo, items, setItems }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="space-y-3">
        <Card padding={14}>
          <div className="mb-2 flex justify-between"><h3 className="text-[13px] font-bold">ミーティングアジェンダ</h3><Pill>0 / {agenda.length} 完了</Pill></div>
          {agenda.length ? agenda.map((a) => <div key={a} className="border-b py-2 text-[11px]" style={{ borderColor: C.borderSub }}>{a}</div>) : <p className="text-[11px]" style={{ color: C.textSecondary }}>パフォーマンス確認 / 集中リスク / 次回方針</p>}
        </Card>
        <Card padding={14}>
          <div className="mb-2 flex justify-between"><h3 className="text-[13px] font-bold">プライベート事前準備メモ</h3><Pill>参照のみ</Pill></div>
          <p className="min-h-14 text-[11px]" style={{ color: C.textSecondary }}>{prepMemo || '前回レビュー以降のドリフトと集中リスクを確認。予測表現は避け、関連性ベースで説明。'}</p>
        </Card>
      </div>
      <div className="space-y-3">
        <Card padding={14}>
          <div className="mb-2 flex justify-between"><h3 className="text-[13px] font-bold">ライブメモ</h3><Pill>{memo.length} 文字</Pill></div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={12} className="w-full rounded-lg border p-3 text-[11px]" style={{ borderColor: C.border, background: '#fffef8' }} placeholder="面談中の発言と合意事項をリアルタイムで記録" />
          <p className="mt-1 text-[8px]" style={{ color: C.textMuted }}>面談中の発言と合意事項をリアルタイムで記録</p>
        </Card>
        <Card padding={14}>
          <div className="mb-2 flex justify-between"><h3 className="text-[13px] font-bold">ミーティング中に記録した項目</h3><Pill>{items.length} 項目</Pill></div>
          {items.map((x) => <div key={x} className="mb-1 rounded bg-slate-50 p-2 text-[10px]">{x}</div>)}
          <button type="button" onClick={() => setItems((v) => [...v, `Capture Item ${v.length + 1}`])} className="w-full rounded-lg bg-[#faf8f2] py-3 text-[11px] font-extrabold" style={{ color: C.accent }}>＋ Capture Item</button>
        </Card>
      </div>
    </div>
  )
}

function DocumentationStep({ meeting, memo, draft, setDraft, reviewChecks, setReviewChecks }) {
  const d = parseMeetingDate(meeting)
  return (
    <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-3">
        <Card padding={14}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold">ミーティング記録書</h3><Pill>{draft ? '確認待ち' : '編集中'}</Pill></div>
          <p className="mb-2 text-[9px]" style={{ color: C.textMuted }}>確認として保存し、ミーティング記録書・2026年9月27日</p>
          <textarea value={`【ミーティング要約】\n${memo || '定期レビューを実施。保有集中と目標配分の乖離を確認。'}\n\n【主要な決定事項】\n1. 集中銘柄の段階削減を継続検討\n2. 海外分散枠は次回資料で試算\n3. NISA 枠の活用方針は現状維持\n\n【フォローアップ】\nリバランス案の資料送付と次回日程の仮押さえ。`} readOnly rows={13} className="w-full rounded-lg border p-3 text-[11px]" style={{ borderColor: C.border, background: '#fffef8' }} />
        </Card>
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">1　決定事項 <span className="text-[9px]" style={{ color: C.positive }}>※記録に反映</span></h3>
          <input defaultValue="NISA 年間投資枠は現状維持。集中銘柄は段階削減を継続検討。" className="mb-2 w-full rounded-lg border px-3 py-2 text-[10px]" style={{ borderColor: C.border }} />
          <h3 className="mb-2 mt-3 text-[13px] font-bold">2　フォローアップアクション</h3>
          <input defaultValue="リバランス案資料を送付し、次回日程を仮押さえ。" className="w-full rounded-lg border px-3 py-2 text-[10px]" style={{ borderColor: C.border }} />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]"><Pill>アドバイザー</Pill><Pill>顧客</Pill><span className="rounded-full bg-slate-100 px-3 py-1">Dec 27, 2026</span><span className="rounded-full bg-slate-100 px-3 py-1">8:30pm</span></div>
          <button type="button" className="mt-3 rounded-lg px-3 py-2 text-[10px] font-bold text-white" style={{ background: C.accent }}>▣ 予定を作成</button>
        </Card>
      </div>
      <div className="space-y-3">
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">書類の内容</h3>
          {['AI サマリー', '関連した経緯', '決定事項', 'フォローアップアクション', 'ライブノート', '顧客プロファイル変更'].map((x, i) => <div key={x} className="mb-1 flex items-center justify-between text-[10px]"><span>{x}</span><span className="flex gap-1">{i < 4 ? <><i className="h-5 w-4 rounded-full" style={{ background: C.accent }} /><i className="h-5 w-4 rounded-full bg-slate-200" /></> : <i className="h-5 w-4 rounded-full bg-slate-200" />}</span></div>)}
        </Card>
        <Card padding={14}>
          <div className="mb-2 flex justify-between"><h3 className="text-[13px] font-bold">レビュー チェックリスト</h3><Pill>{Object.values(reviewChecks).filter(Boolean).length === 3 ? '確認済み' : '未確認'}</Pill></div>
          {['AI 要約を確認しました', '決定事項とアクションを確認しました', '顧客向け内容を確認しました'].map((x, i) => <label key={x} className="mb-2 flex items-center gap-2 text-[10px]"><input type="checkbox" checked={Boolean(reviewChecks[i])} onChange={(e) => setReviewChecks((v) => ({ ...v, [i]: e.target.checked }))} />{x}</label>)}
        </Card>
        <Card padding={14}>
          <div className="mb-2 flex justify-between"><h3 className="text-[13px] font-bold">顧客資料には含めない項目</h3><Pill>非公開</Pill></div>
          <ul className="space-y-1 text-[10px]" style={{ color: C.textSecondary }}><li>・アドバイザー専用メモ</li><li>・監査タイムライン（内部トラッキング用の元データ）</li><li>・ライブノート（現在は除外中 — 確認の内定で切替可能）</li></ul>
        </Card>
        <Card padding={14}>
          <div className="text-[10px] font-bold">次回ミーティング</div>
          <div className="mt-2 flex gap-2 text-[10px]"><Pill>アドバイザー</Pill><Pill>顧客</Pill><span className="rounded-full bg-slate-100 px-2 py-1">{MONTHS[d.getMonth()]} {d.getDate()}, 2026</span></div>
        </Card>
      </div>
      {!draft ? <button type="button" onClick={() => setDraft(true)} className="lg:col-span-2 rounded-xl py-3 text-[12px] font-extrabold text-white" style={{ background: C.accent }}>ドラフトを生成</button> : null}
    </div>
  )
}

function WorkflowOverlay({ client, meeting, onClose, onToast, onComplete }) {
  const [step, setStep] = useState(1)
  const [agenda, setAgenda] = useState(() => defaultAgenda(client, meeting))
  const [prepMemo, setPrepMemo] = useState(() => defaultPrepMemo(client))
  const [memo, setMemo] = useState(() => defaultLiveMemo(client))
  const [items, setItems] = useState(() => defaultCaptureItems())
  const [checklist, setChecklist] = useState({ 0: true, 1: true })
  const [reviewChecks, setReviewChecks] = useState({ 0: true })
  const [draft, setDraft] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const [complete, setComplete] = useState(false)

  const title = step === 1 ? '事前準備' : step === 2 ? '面談中' : '記録・完了'
  const finish = () => {
    setComplete(false)
    onToast('ミーティングを承認しました')
    onComplete?.()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto" style={{ background: '#faf9f6' }}>
      <div className="mx-auto max-w-6xl px-4 py-5 lg:px-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white" aria-label="戻る">‹</button>
            <div><h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>{title}</h1><p className="text-[11px]" style={{ color: C.textMuted }}>{client.name} · {meeting.type || meeting.title}</p></div>
          </div>
          <Pill>ドラフト自動保存中</Pill>
        </div>
        <WorkflowStepBar step={step} />
        <div className="mt-5">
          {step === 1 ? <PrepStep agenda={agenda} setAgenda={setAgenda} prepMemo={prepMemo} setPrepMemo={setPrepMemo} checklist={checklist} setChecklist={setChecklist} /> : null}
          {step === 2 ? <MeetingStep agenda={agenda} prepMemo={prepMemo} memo={memo} setMemo={setMemo} items={items} setItems={setItems} /> : null}
          {step === 3 ? <DocumentationStep meeting={meeting} memo={memo} draft={draft} setDraft={setDraft} reviewChecks={reviewChecks} setReviewChecks={setReviewChecks} /> : null}
        </div>
        <div className="mt-5 flex justify-between">
          <button type="button" onClick={step === 1 ? onClose : () => setStep(step - 1)} className="rounded-full bg-white px-4 py-2.5 text-[11px] font-bold" style={{ border: `1px solid ${C.border}` }}>‹ 戻る</button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep(step + 1)} className="rounded-full px-5 py-2.5 text-[12px] font-extrabold text-white" style={{ background: C.accent }}>{step === 1 ? '面談開始' : '面談終了'} ›</button>
          ) : (
            <button type="button" disabled={!draft} onClick={() => setConfirm(true)} className="rounded-full px-5 py-2.5 text-[12px] font-extrabold text-white disabled:opacity-40" style={{ background: C.accent }}>✓ 承認して完了</button>
          )}
        </div>
      </div>
      {confirm ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-[15px] font-extrabold">このミーティングを承認しますか?</h2>
            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>以下が実行されます:<br />・最終 PDF を生成し client_documents に保存<br />・ステータスを「完了」に変更<br />・Next Review 日付を Client Profile に同期<br /><br />この操作は取り消せません。</p>
            <div className="mt-4 flex gap-2"><button type="button" onClick={() => setConfirm(false)} className="flex-1 rounded-xl bg-slate-100 py-2 text-[11px] font-bold">キャンセル</button><button type="button" onClick={() => { setConfirm(false); setComplete(true) }} className="flex-1 rounded-xl py-2 text-[11px] font-extrabold text-white" style={{ background: C.accent }}>承認して完了</button></div>
          </div>
        </div>
      ) : null}
      {complete ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-[15px] font-extrabold">承認完了</h2><p className="mt-2 text-[11px]" style={{ color: C.textSecondary }}>ミーティングは正常に承認され、最終 PDF が保存されました。Meeting Records に移動しました。</p><button type="button" onClick={finish} className="mt-4 w-full rounded-xl bg-slate-100 py-2 text-[11px] font-bold">閉じる</button></div>
        </div>
      ) : null}
    </div>
  )
}

export default function MeetingsTab({ c, onToast }) {
  const [meetings, setMeetings] = useState(() => [...(c.meetings || [])])
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(() => {
    const list = c.meetings || []
    return list.find((m) => m.status === '予定')?.id || list[0]?.id
  })
  const [showNew, setShowNew] = useState(false)
  const [workflow, setWorkflow] = useState(null)

  const next = meetings.find((m) => m.status === '予定') || meetings[0]
  const nextDate = next ? parseMeetingDate(next) : null

  const filtered = useMemo(() => {
    let list = meetings
    if (filter === 'completed') list = list.filter((m) => m.status === '完了')
    else if (filter === 'cancelled') list = list.filter((m) => m.status === 'キャンセル')
    else if (filter === 'noshow') list = list.filter((m) => m.status === '無断欠席')
    const qq = q.trim().toLowerCase()
    if (qq) list = list.filter((m) => [m.type, m.title, c.name].some((x) => String(x || '').toLowerCase().includes(qq)))
    const upcoming = list.filter((m) => m.status === '予定')
    const past = list.filter((m) => m.status !== '予定')
    return [...upcoming, ...past]
  }, [meetings, filter, q, c.name])

  const selected = meetings.find((m) => m.id === selectedId) || filtered[0]
  const selectedDate = selected ? parseMeetingDate(selected) : null
  const recent = meetings.filter((m) => m.status === '完了').slice(0, 3)

  return (
    <div className="space-y-3">
      {/* Next meeting hero */}
      <Card padding={14}>
        <div className="mb-3 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" style={{ color: C.accent }} />
          <h3 className="text-[13px] font-bold">次回ミーティング</h3>
        </div>
        {next && nextDate ? (
          <div className="flex flex-wrap items-start gap-3.5">
            <DateBadgeLarge date={nextDate} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[16px] font-extrabold" style={{ color: C.navy }}>{next.type || next.title || '定期レビュー'}</span>
                <Pill bg={`${C.accent}1f`} color={C.accent}>{next.type || '定期レビュー'}</Pill>
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] font-semibold" style={{ color: C.textMuted }}>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{next.time || '4:00 AM'} ({next.duration || 60}分)</span>
                <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{c.name} / {c.advisorName || 'Justin'}</span>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[9px] font-extrabold">
                  <span style={{ color: C.textMuted }}>準備進捗</span>
                  <span style={{ color: (next.prepPct || 0) >= 70 ? C.positive : C.accentDark }}>{next.prepPct || 0}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full" style={{ width: `${next.prepPct || 0}%`, background: (next.prepPct || 0) >= 70 ? C.positive : C.accent }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setWorkflow(next)}
                  className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-extrabold text-white"
                  style={{ background: C.accent }}
                >
                  {workflowLabel(next)} <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onToast('デモ: 日程変更シート')} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[11px] font-bold" style={{ borderColor: C.border, background: C.surfaceSub }}>
                  <PencilLine className="h-3.5 w-3.5" /> 日程変更
                </button>
                <button type="button" onClick={() => onToast('デモ: 予定をキャンセルしました')} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[11px] font-bold" style={{ borderColor: '#fecaca', color: C.positive, background: '#fef2f2' }}>
                  <X className="h-3.5 w-3.5" /> キャンセル
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[#faf8f2] p-4">
            <p className="text-[12px] font-bold" style={{ color: C.navy }}>提案: 次回レビュー 10/2 14:00</p>
            <p className="mt-1 text-[11px]" style={{ color: C.textSecondary }}>集中リスクと海外分散のフォロー。オンライン 45分。</p>
            <button type="button" onClick={() => setShowNew(true)} className="mt-3 rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white" style={{ background: C.accent }}>+ この内容で予定を追加</button>
          </div>
        )}
      </Card>

      <div className="grid gap-3 xl:grid-cols-[1fr_1.1fr_0.75fr]">
        {/* Records list */}
        <Card padding={14}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-bold">ミーティング記録</h3>
            <div className="ml-auto flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className="rounded-full px-2 py-0.5 text-[9px] font-extrabold"
                  style={{
                    background: filter === f.id ? C.accent : 'transparent',
                    color: filter === f.id ? '#fff' : C.textMuted,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="履歴を検索"
              className="w-full rounded-md py-1.5 pl-8 pr-2 text-[11px]"
              style={{ background: C.surfaceSub }}
            />
          </div>
          <div className="space-y-1">
            {filtered.map((m) => {
              const d = parseMeetingDate(m)
              const s = statusStyle(m.status)
              const sel = selected?.id === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left"
                  style={{
                    background: sel ? `${C.accent}14` : undefined,
                    boxShadow: sel ? `inset 3px 0 0 ${C.accent}` : undefined,
                  }}
                >
                  <DateBadgeSmall date={d} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-extrabold" style={{ color: C.navy }}>{m.type || m.title}</div>
                    <div className="text-[9px]" style={{ color: C.textMuted }}>{c.name}</div>
                  </div>
                  <Pill bg={s.bg} color={s.color}>{s.label}</Pill>
                </button>
              )
            })}
            {!filtered.length ? (
              <div className="rounded-lg bg-[#faf8f2] p-3 text-[11px]" style={{ color: C.textSecondary }}>
                この条件の履歴はありません。直近は 2026/09/09 定期レビュー（完了）です。
              </div>
            ) : null}
          </div>
        </Card>

        {/* Detail panel */}
        <Card padding={14}>
          {selected && selectedDate ? (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-[13px] font-bold">{selected.type || selected.title || 'ミーティング詳細'}</h3>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => onToast('デモ: PDF を開きました')} className="text-[9px] font-extrabold" style={{ color: C.accent }}>PDF を開く</button>
                  <button type="button" onClick={() => onToast('デモ: 修正版を作成しました')} className="rounded-full px-2 py-1 text-[9px] font-extrabold text-white" style={{ background: C.accent }}>修正版を作成</button>
                </div>
              </div>
              <div className="mb-3 text-[10px]" style={{ color: C.textMuted }}>
                {selected.date?.replace(/-/g, '/') || ''} {selected.time || ''}
              </div>
              {(() => {
                const copy = meetingRecordCopy(c, selected)
                return [
                  ['ミーティング要約', copy.summary],
                  ['主要な決定事項', copy.decisions],
                  ['フォローアップ', copy.followUp],
                ]
              })().map(([k, v]) => (
                <div key={k} className="mb-3">
                  <div className="text-[10px] font-extrabold" style={{ color: C.textMuted }}>{k}</div>
                  <div className="mt-1 text-[12px] leading-relaxed" style={{ color: C.navy }}>{v}</div>
                </div>
              ))}
              <div className="mt-4 border-t pt-3 text-[10px]" style={{ borderColor: C.borderSub, color: C.textMuted }}>
                <div>作成日: 2026/9/18 04:01</div>
                <div className="mt-0.5">更新日: 2026/9/20 20:03</div>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-[#faf8f2] p-4 text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>
              左のリストから記録を選ぶと、要約・決定事項・フォローアップが表示されます。直近は {c.lastReview || '2026-09-09'} の定期レビューです。
            </div>
          )}
        </Card>

        {/* Quick actions + recent */}
        <div className="space-y-3">
          <Card padding={14}>
            <div className="mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" style={{ color: C.accent }} />
              <h3 className="text-[13px] font-bold">クイックアクション</h3>
            </div>
            <div className="space-y-1.5">
              {[
                ['ミーティング予約', CalendarDays, () => setShowNew(true)],
                ['フォローアップ追加', FileText, () => onToast('デモ: フォローアップを追加')],
                ['ログを出力', Share2, () => onToast('デモ: ログを出力しました')],
              ].map(([label, Icon, fn]) => (
                <button
                  key={label}
                  type="button"
                  onClick={fn}
                  className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold hover:bg-[#fbf8ef]"
                  style={{ borderColor: C.border }}
                >
                  <Icon className="h-4 w-4" style={{ color: C.accent }} />
                  <span className="flex-1">{label}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
              ))}
            </div>
          </Card>
          <Card padding={14}>
            <h3 className="mb-2 text-[13px] font-bold">最近のミーティング履歴</h3>
            <div className="space-y-2">
              {(recent.length ? recent : [{ type: '定期レビュー', date: '2026-09-02' }]).map((m, i) => (
                <div key={m.id || i} className="flex items-center gap-2 text-[11px]">
                  <i className="h-2 w-2 rounded-full" style={{ background: C.positive }} />
                  <span>{m.type || '定期レビュー'} {(m.date || '').replace(/-/g, '/')}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {showNew ? (
        <NewMeetingModal
          client={c}
          onClose={() => setShowNew(false)}
          onSave={(m) => {
            setMeetings((prev) => [m, ...prev])
            setSelectedId(m.id)
            setShowNew(false)
            onToast('デモ: 予定を保存しました')
          }}
        />
      ) : null}
      {workflow ? (
        <WorkflowOverlay
          client={c}
          meeting={workflow}
          onClose={() => setWorkflow(null)}
          onToast={onToast}
          onComplete={() => {
            setMeetings((prev) => prev.map((m) => (
              m.id === workflow.id
                ? { ...m, status: '完了', notes: 'ミーティング記録を承認しました', prepPct: 100 }
                : m
            )))
            setSelectedId(workflow.id)
            setWorkflow(null)
          }}
        />
      ) : null}
    </div>
  )
}
