import { useState } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { FEAR_GREED, SECTORS_HEATMAP } from './mockCatalog'
import { C } from './theme'
import { Card, FearGreedGauge, SectorHeatmap, Pill } from './ui'

const INDICES = [
  { flag: '🇯🇵', name: '日経平均', value: '45,218.32', chg: '+0.82' },
  { flag: '🇯🇵', name: 'TOPIX', value: '3,182.45', chg: '+0.55' },
  { flag: '🇺🇸', name: 'S&P 500', value: '5,628.30', chg: '+0.41' },
  { flag: '🇺🇸', name: 'NASDAQ', value: '17,842.10', chg: '+0.68' },
  { flag: '🇺🇸', name: 'ダウ平均', value: '42,156.80', chg: '-0.12' },
  { flag: '🇭🇰', name: 'ハンセン', value: '18,420.55', chg: '-0.85' },
  { flag: '🇨🇳', name: '上海総合', value: '3,012.40', chg: '+0.22' },
  { flag: '🇩🇪', name: 'DAX', value: '18,942.10', chg: '+0.35' },
]

const FX = [
  { name: 'USD/JPY', value: '156.85', chg: '+0.18' },
  { name: 'EUR/JPY', value: '171.20', chg: '+0.25' },
  { name: 'GBP/JPY', value: '205.40', chg: '+0.12' },
  { name: 'AUD/JPY', value: '104.62', chg: '-0.21' },
  { name: 'CNH/JPY', value: '22.18', chg: '+0.08' },
]

const COMMODITIES = [
  { name: '金 (USD/oz)', value: '2,412.50', chg: '-0.85' },
  { name: 'WTI原油', value: '68.20', chg: '-6.32' },
  { name: 'Brent原油', value: '71.85', chg: '-5.10' },
]

const VOL = [
  { name: 'VIX (S&P)', value: '14.81', tag: '低い', ok: true },
  { name: 'MOVE (米国債)', value: '80.64', tag: '高い', ok: false },
  { name: 'VXTLT (債券)', value: '12.38', tag: '低い', ok: true },
]

const EVENTS = [
  { date: '9/22 火', flag: '🇺🇸', title: 'Micron (MU) 決算', impact: 'H' },
  { date: '9/22 火', flag: '🇺🇸', title: '米雇用統計', impact: 'H' },
  { date: '10/2 木', flag: '🇺🇸', title: '米雇用統計', impact: 'H' },
  { date: '10/14 火', flag: '🇺🇸', title: '米CPI', impact: 'H' },
  { date: '10/15 水', flag: '🇺🇸', title: '米PPI', impact: 'M' },
  { date: '10/15 水', flag: '🇺🇸', title: 'Google Pixel 2026 秋発表', impact: 'M' },
  { date: '10/22 水', flag: '🇯🇵', title: '日本CPI', impact: 'M' },
  { date: '10/28 火', flag: '🇺🇸', title: 'FOMC 金利決定', impact: 'H' },
  { date: '10/29 水', flag: '🇯🇵', title: '日銀会合', impact: 'H' },
  { date: '10/29 水', flag: '🇪🇺', title: 'ECB会合', impact: 'H' },
]

const NEWS = [
  { tag: '日経', title: 'NY株式：金利高を警戒、ダウは続落' },
  { tag: 'ロイター', title: 'ECBラガルド総裁「2027年に退任へ」' },
  { tag: 'Fisco', title: 'NY原油3営業日続落、需要懸念' },
  { tag: '日経', title: '円相場：156円台半ば、ドル買い優勢' },
  { tag: 'ロイター', title: '日本株：半導体関連が押し上げ' },
]

const HEAT_TABS = ['セクター', '地域', '商品', '日本', '銘柄']

function chgColor(chg) {
  const n = typeof chg === 'string' ? parseFloat(chg) : chg
  return n >= 0 ? C.positive : C.negative
}

function FearGreedTab() {
  return (
    <div className="space-y-3">
      <Card padding={12}>
        <div className="text-[11px] font-bold" style={{ color: C.navy }}>本日のマーケット概観</div>
        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: C.textSecondary }}>
          Fear & Greed <b>{FEAR_GREED.index}</b>（{FEAR_GREED.label}）· VIX 14.81（低ボラ）· USD/JPY 156.85
        </p>
      </Card>

      <Card padding={16}>
        <FearGreedGauge score={FEAR_GREED.index} size={78} />
        <div className="mt-3 text-[10px]" style={{ color: C.textMuted }}>
          市場心理: VIX·プット/コール·モメンタム等から算出 · 6指標·30日推移はタップで詳細
        </div>
      </Card>

      <Card padding={14}>
        <h3 className="mb-3 text-[13px] font-bold">主要指数</h3>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {INDICES.map((x) => (
            <div key={x.name} className="rounded-xl border p-2.5" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-1 text-[10px]" style={{ color: C.textMuted }}>
                <span>{x.flag}</span> {x.name}
              </div>
              <div className="mt-1 text-[14px] font-extrabold tabular-nums" style={{ color: C.navy }}>{x.value}</div>
              <div className="mt-0.5 text-[11px] font-bold tabular-nums" style={{ color: chgColor(x.chg) }}>
                {Number(x.chg) >= 0 ? '+' : ''}{x.chg}%
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">為替</h3>
          {FX.map((x) => (
            <div key={x.name} className="flex items-center justify-between border-b py-2 text-[12px]" style={{ borderColor: C.borderSub }}>
              <span style={{ color: C.textSecondary }}>{x.name}</span>
              <span>
                <b className="tabular-nums" style={{ color: C.navy }}>{x.value}</b>{' '}
                <span className="font-bold tabular-nums" style={{ color: chgColor(x.chg) }}>
                  {Number(x.chg) >= 0 ? '+' : ''}{x.chg}%
                </span>
              </span>
            </div>
          ))}
        </Card>
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">主要商品</h3>
          {COMMODITIES.map((x) => (
            <div key={x.name} className="flex items-center justify-between border-b py-2 text-[12px]" style={{ borderColor: C.borderSub }}>
              <span style={{ color: C.textSecondary }}>{x.name}</span>
              <span>
                <b className="tabular-nums" style={{ color: C.navy }}>{x.value}</b>{' '}
                <span className="font-bold tabular-nums" style={{ color: chgColor(x.chg) }}>
                  {Number(x.chg) >= 0 ? '+' : ''}{x.chg}%
                </span>
              </span>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">% 10年債利回り</h3>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px]" style={{ color: C.textMuted }}>🇺🇸 US 10Y</div>
              <div className="text-[28px] font-extrabold tabular-nums" style={{ color: C.navy }}>5.00%</div>
            </div>
            <span className="text-[14px] font-bold" style={{ color: C.positive }}>+1.03%</span>
          </div>
        </Card>
        <Card padding={14}>
          <h3 className="mb-2 text-[13px] font-bold">ボラティリティ指数</h3>
          {VOL.map((v) => (
            <div key={v.name} className="mb-1.5 flex items-center justify-between text-[12px]">
              <span style={{ color: C.textSecondary }}>{v.name}</span>
              <span className="flex items-center gap-2">
                <b className="tabular-nums">{v.value}</b>
                <Pill bg={v.ok ? '#dcfce7' : '#fee2e2'} color={v.ok ? C.green : C.positive}>{v.tag}</Pill>
              </span>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card padding={14}>
          <h3 className="mb-3 text-[13px] font-bold">今後の主要イベント (2ヶ月)</h3>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {EVENTS.map((e, i) => (
              <div key={`${e.date}-${i}`} className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px]" style={{ borderColor: C.border }}>
                <span className="w-14 shrink-0 font-semibold tabular-nums" style={{ color: C.textMuted }}>{e.date}</span>
                <span>{e.flag}</span>
                <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: C.navy }}>{e.title}</span>
                <span
                  className="grid h-5 w-5 place-items-center rounded text-[9px] font-extrabold text-white"
                  style={{ background: e.impact === 'H' ? C.positive : '#f97316' }}
                >
                  {e.impact}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card padding={14}>
          <h3 className="mb-3 text-[13px] font-bold">主要ニュース</h3>
          <div className="space-y-2">
            {NEWS.map((n) => (
              <div key={n.title} className="flex items-start gap-2 text-[11px]">
                <Pill bg="#fef3c7" color={C.accentDark}>{n.tag}</Pill>
                <span className="min-w-0 flex-1 font-semibold leading-snug" style={{ color: C.navy }}>{n.title}</span>
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function HeatmapTab() {
  const [sub, setSub] = useState('セクター')
  const [region, setRegion] = useState('米国')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {HEAT_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSub(t)}
            className="rounded-full px-3 py-1.5 text-[11px] font-bold"
            style={{
              background: sub === t ? '#fff' : C.surfaceSub,
              color: sub === t ? C.navy : C.textMuted,
              border: `1px solid ${sub === t ? C.border : 'transparent'}`,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {(sub === '銘柄' || sub === '日本') ? (
        <div className="inline-flex rounded-lg p-0.5" style={{ background: C.surfaceSub }}>
          {['米国', '日本'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className="rounded-md px-3 py-1 text-[11px] font-bold"
              style={{ background: region === r ? '#fff' : 'transparent', color: region === r ? C.navy : C.textMuted }}
            >
              {r}
            </button>
          ))}
        </div>
      ) : null}

      <Card padding={14}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-bold">
              マーケットヒートマップ {sub}
              <span className="ml-1 text-[10px] font-semibold" style={{ color: C.textMuted }}>
                ({sub === 'セクター' ? '米国セクター当日' : sub === '地域' ? '主要地域の相対モメンタム' : sub === '商品' ? '商品・為替関連' : sub === '日本' ? '国内セクター' : '主要銘柄バスケット'})
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-16 w-3 flex-col overflow-hidden rounded-sm">
              <div className="flex-1" style={{ background: '#166534' }} />
              <div className="flex-1" style={{ background: '#22c55e' }} />
              <div className="flex-1" style={{ background: '#94a3b8' }} />
              <div className="flex-1" style={{ background: '#ef4444' }} />
              <div className="flex-1" style={{ background: '#991b1b' }} />
            </div>
            <div className="text-[9px] leading-tight" style={{ color: C.textMuted }}>
              上昇<br /><br />下落
            </div>
            <button type="button" className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: C.accent }}>
              <RefreshCw className="h-3 w-3" /> 更新
            </button>
          </div>
        </div>
        <SectorHeatmap sectors={SECTORS_HEATMAP} />
        <p className="mt-3 text-[10px] leading-relaxed" style={{ color: C.textSecondary }}>
          {sub}タブは同一ヒートマップを顧客対話用に切り替えています。上昇・下落の相対感を共有し、個別銘柄の売買指示には使いません。
        </p>
        <div className="mt-1 text-right text-[9px]" style={{ color: C.textMuted }}>
          Source: 外部市場データプロバイダ
        </div>
      </Card>
    </div>
  )
}

export default function MarketPage() {
  const [tab, setTab] = useState(0)
  return (
    <div className="space-y-4 p-5 lg:p-6">
      <h1 className="text-[22px] font-extrabold" style={{ color: C.navy }}>マーケット</h1>
      <div className="flex gap-2">
        {['Fear & Greed', 'セクター ヒートマップ'].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i)}
            className="rounded-full px-4 py-2 text-[12px] font-extrabold"
            style={{
              background: tab === i ? C.accent : '#fff',
              color: tab === i ? '#fff' : C.textSecondary,
              border: `1px solid ${tab === i ? C.accent : C.border}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 0 ? <FearGreedTab /> : <HeatmapTab />}
    </div>
  )
}
