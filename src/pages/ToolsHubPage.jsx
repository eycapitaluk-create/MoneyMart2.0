import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchFundUniverseSnapshot } from "../lib/fundUniverse";
import {
  AI_THEME_SYMBOL_SET,
  HIGH_DIVIDEND_SYMBOL_SET,
  AI_THEME_ISIN_SET,
  HIGH_DIVIDEND_ISIN_SET,
} from "../data/etfThemeFlags";
import { looksLikeHighDividendFromText } from "../lib/fundSubcategoryHeuristics";
import {
  getDividendCadenceMeta,
  getDividendYieldPct,
  getFirstDividendMonth,
  dividendCashToJpyApprox,
  formatDividendCash,
} from "../lib/dividendCalendar";
import { getDividendCalendarDetailRecord } from "../lib/dividendCalendarDetailLookup";
import { DIVIDEND_STOCK_UNIVERSE } from "../data/dividendStockUniverse";
import { MM_SIMULATION_PAST_PERFORMANCE_JA } from "../lib/moneymartSimulationDisclaimer";

// ═══════════════════════════════════════════════════════════════
//  SHARED UTILS
// ═══════════════════════════════════════════════════════════════
function fmtJPY(n) {
  if (Math.abs(n) >= 100000000) return `${(n/100000000).toFixed(2)}億円`;
  if (Math.abs(n) >= 10000)     return `${(n/10000).toFixed(1)}万円`;
  return `${Math.round(n).toLocaleString()}円`;
}

const UI_FONT = '"Inter","Noto Sans JP","Hiragino Sans","Yu Gothic UI","Yu Gothic","Helvetica Neue","Arial",sans-serif';
const NUMERIC_FONT = UI_FONT;

const normalizeClassifierText = (value = "") => String(value || "").normalize("NFKC").toUpperCase();
const isAiThemeFund = (fund = {}) => {
  const symbol = String(fund?.symbol || fund?.id || "").trim().toUpperCase();
  const isin = String(fund?.isin || "").trim().toUpperCase();
  const name = normalizeClassifierText(fund?.fundName || fund?.name || "");
  if (AI_THEME_SYMBOL_SET.has(symbol) || AI_THEME_ISIN_SET.has(isin)) return true;
  return /AI|BIGDATA|ROBOT|CLOUD|FINTECH|半導体|テック|TECH|INNOVATION|DEFENSE|EV|BATTERY|DIGITAL/.test(name);
};
const isHighDividendFund = (fund = {}) => {
  const symbol = String(fund?.symbol || fund?.id || "").trim().toUpperCase();
  const isin = String(fund?.isin || "").trim().toUpperCase();
  const rawName = fund?.fundName || fund?.name || "";
  const dbSub = fund?.subcategory || "";
  if (HIGH_DIVIDEND_SYMBOL_SET.has(symbol) || HIGH_DIVIDEND_ISIN_SET.has(isin)) return true;
  return looksLikeHighDividendFromText(rawName, dbSub);
};

function formatSliderTick(value, unit) {
  if (unit === "円") {
    if (Math.abs(value) >= 10000) return `${(value / 10000).toLocaleString()}万`;
    return Number(value).toLocaleString();
  }
  return `${Number(value).toLocaleString()}`;
}

function useResponsiveLayout() {
  const [width, setWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    width,
    isMobile: width < 768,
    isTablet: width < 1024,
  };
}

/** ツール画面のライト/ダーク共通トークン（インライン style 用） */
function toolsColors(isDark) {
  if (!isDark) {
    return {
      cardBg: '#ffffff',
      cardBorder: '#e5e7eb',
      cardBgMuted: '#f9fafb',
      textTitle: '#1f2937',
      textLabel: '#475569',
      textMuted: '#64748b',
      textSoft: '#94a3b8',
      inputBg: '#ffffff',
      inputBgSoft: '#f9fafb',
      inputBorder: '#e5e7eb',
      rowBg: '#f9fafb',
      rowBgStrong: '#f1f5f9',
      barTrack: '#e5e7eb',
      innerWell: 'rgba(0,0,0,0.03)',
      pillInactiveBg: '#f9fafb',
      pillInactiveBorder: '#e5e7eb',
      pillInactiveText: '#64748b',
      /** カードの奥行き（ライト） */
      cardShadow: '0 8px 28px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.04)',
      cardShadowSm: '0 4px 16px rgba(15, 23, 42, 0.05)',
    };
  }
  return {
    cardBg: '#1e293b',
    cardBorder: '#334155',
    cardBgMuted: '#0f172a',
    textTitle: '#f1f5f9',
    textLabel: '#cbd5e1',
    textMuted: '#94a3b8',
    textSoft: '#64748b',
    inputBg: '#0f172a',
    inputBgSoft: '#020617',
    inputBorder: '#475569',
    rowBg: '#0f172a',
    rowBgStrong: '#1e293b',
    barTrack: '#334155',
    innerWell: 'rgba(255,255,255,0.06)',
    pillInactiveBg: '#0f172a',
    pillInactiveBorder: '#475569',
    pillInactiveText: '#94a3b8',
    /** カードの奥行き（ダーク） */
    cardShadow: '0 12px 40px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(148, 163, 184, 0.06)',
    cardShadowSm: '0 6px 24px rgba(0, 0, 0, 0.35)',
  };
}

function Slider({ label, value, min, max, step, unit, onChange, color, note, quick, isDark = false }) {
  const tc = toolsColors(isDark);
  const trackMuted = isDark ? '#334155' : '#e5e7eb';
  const pct = ((value - min) / Math.max(1, (max - min))) * 100;
  const isDecimalStep = String(step).includes('.');
  const stepDecimals = isDecimalStep
    ? Math.max(0, (String(step).split('.')[1] || '').length)
    : 0;
  const clampAndSnap = (rawValue) => {
    const n = Number(rawValue);
    if (!Number.isFinite(n)) return min;
    const clamped = Math.min(max, Math.max(min, n));
    if (!(step > 0)) return clamped;
    const snapped = min + (Math.round((clamped - min) / step) * step);
    return isDecimalStep ? Number(snapped.toFixed(stepDecimals)) : Math.round(snapped);
  };
  const sanitizeDraft = (raw = '') => {
    const normalized = String(raw)
      .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
      .replace(/[．。]/g, '.')
      .replace(/,/g, '')
      .replace(isDecimalStep ? /[^\d.]/g : /[^\d]/g, '');
    if (!isDecimalStep) return normalized;
    const dotIdx = normalized.indexOf('.');
    if (dotIdx === -1) return normalized;
    return `${normalized.slice(0, dotIdx + 1)}${normalized.slice(dotIdx + 1).replace(/\./g, '')}`;
  };

  const [draftValue, setDraftValue] = useState(String(value));
  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const commitDraft = () => {
    const raw = sanitizeDraft(draftValue);
    if (!raw) {
      const fallback = clampAndSnap(min);
      onChange(fallback);
      setDraftValue(String(fallback));
      return;
    }
    const next = clampAndSnap(raw);
    onChange(next);
    setDraftValue(String(next));
  };

  const displayValue = isDecimalStep
    ? Number(value).toLocaleString(undefined, { maximumFractionDigits: stepDecimals })
    : Number(value).toLocaleString();
  const tickRaw = [min, min + ((max - min) / 2), max].map(clampAndSnap);
  const ticks = [...new Set(tickRaw.map((v) => String(v)))].map((v) => Number(v));

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8, gap:10 }}>
        <span style={{ fontSize:13, fontWeight:800, color:tc.textLabel, fontFamily:UI_FONT }}>{label}</span>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {note && <span style={{ fontSize:12, color:"#ea580c", fontWeight:800, fontFamily:UI_FONT }}>{note}</span>}
          <span style={{ fontFamily:NUMERIC_FONT, fontSize:18, fontWeight:900, color }}>{displayValue}{unit}</span>
        </div>
      </div>

      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(clampAndSnap(e.target.value))}
        style={{ background:`linear-gradient(90deg,${color} ${pct}%,${trackMuted} ${pct}%)` }}
      />

      <div style={{ marginTop:6, display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:tc.textSoft, fontFamily:NUMERIC_FONT }}>
        {ticks.map((t) => (
          <span key={`${label}-tick-${t}`}>{formatSliderTick(t, unit)}{unit === "%" ? "" : unit}</span>
        ))}
      </div>

      <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color:tc.textMuted, minWidth:42 }}>直接入力</span>
        <input
          type="text"
          inputMode={isDecimalStep ? "decimal" : "numeric"}
          value={draftValue}
          onChange={(e) => setDraftValue(sanitizeDraft(e.target.value))}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            commitDraft();
            e.currentTarget.blur();
          }}
          style={{
            width: 120,
            background: tc.inputBgSoft,
            border: `1.5px solid ${tc.inputBorder}`,
            borderRadius: 10,
            padding: "6px 10px",
            fontFamily: NUMERIC_FONT,
            fontSize: 13,
            fontWeight: 800,
            color: tc.textTitle,
            outline: "none",
            textAlign: "right",
          }}
        />
        <span style={{ fontSize:12, fontWeight:700, color:tc.textMuted }}>{unit}</span>
      </div>

      {quick && (
        <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
          {quick.map(v => (
            <button key={v} onClick={() => onChange(v)} style={{
              flex:1, minWidth:72, padding:"7px 0", borderRadius:10, fontSize:12, fontWeight:800, fontFamily:UI_FONT, cursor:"pointer",
              background: value===v ? color : tc.pillInactiveBg,
              border:`1px solid ${value===v ? color : tc.pillInactiveBorder}`,
              color: value===v ? "#fff" : tc.pillInactiveText,
            }}>{v >= 10000 ? `${v/10000}万` : v}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOOL 1: 新NISA シミュレーター
// ═══════════════════════════════════════════════════════════════
function calcNISA({ tsumitateMonthly, seichouMonthly, rate, years }) {
  const monthlyRate = rate / 100 / 12;
  const months = years * 12;
  let t = 0, s = 0;
  const yearlyData = [];
  for (let m = 1; m <= months; m++) {
    t = (t + tsumitateMonthly) * (1 + monthlyRate);
    s = (s + seichouMonthly)   * (1 + monthlyRate);
    if (m % 12 === 0) {
      const invested = (tsumitateMonthly + seichouMonthly) * m / 10000;
      const total    = (t + s) / 10000;
      yearlyData.push({ year: m/12, invested, total, gain: total - invested });
    }
  }
  const final = yearlyData[yearlyData.length - 1] || { total:0, gain:0, invested:0 };
  return { yearlyData, final };
}

function NISASimulator({ isDark = false }) {
  const { isMobile } = useResponsiveLayout();
  const tc = toolsColors(isDark);
  const [tm, setTm] = useState(100000);
  const [sm, setSm] = useState(200000);
  const [rate, setRate] = useState(5);
  const [years, setYears] = useState(5);
  const result = useMemo(() => calcNISA({ tsumitateMonthly:tm, seichouMonthly:sm, rate, years }), [tm,sm,rate,years]);
  const { final, yearlyData } = result;
  const taxSaved = final.gain * 0.20315 * 10000;
  const maxTotal = Math.max(...yearlyData.map(d=>d.total), 1);

  return (
    <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1.3fr", gap:20 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ background:isDark ? tc.cardBg : "#eff6ff", border:isDark ? `1.5px solid ${tc.cardBorder}` : "1.5px solid #bfdbfe", borderRadius:16, padding:16, boxShadow:isDark ? tc.cardShadowSm : "0 6px 24px rgba(37, 99, 235, 0.08)" }}>
          <div style={{ fontSize:12, fontWeight:800, color:isDark ? "#93c5fd" : "#2563eb", marginBottom:10 }}>📘 つみたて投資枠</div>
          <Slider isDark={isDark} label="月額積立" value={tm} min={0} max={100000} step={1000} unit="円" onChange={setTm} color="#3b82f6" note={`年 ${(tm*12/10000).toFixed(1)}万円`} quick={[10000,30000,50000,100000]}/>
        </div>
        <div style={{ background:isDark ? tc.cardBg : "#faf5ff", border:isDark ? `1.5px solid ${tc.cardBorder}` : "1.5px solid #e9d5ff", borderRadius:16, padding:16, boxShadow:isDark ? tc.cardShadowSm : "0 6px 24px rgba(124, 58, 237, 0.08)" }}>
          <div style={{ fontSize:12, fontWeight:800, color:isDark ? "#c4b5fd" : "#7c3aed", marginBottom:10 }}>📗 成長投資枠</div>
          <Slider isDark={isDark} label="月額投資" value={sm} min={0} max={200000} step={1000} unit="円" onChange={setSm} color="#8b5cf6" note={`年 ${(sm*12/10000).toFixed(1)}万円`} quick={[0,50000,100000,200000]}/>
        </div>
        <Slider isDark={isDark} label="想定年利回り" value={rate} min={1} max={15} step={0.5} unit="%" onChange={setRate} color="#f97316" quick={[3,5,7,10]}/>
        <Slider isDark={isDark} label="投資期間" value={years} min={1} max={40} step={1} unit="年" onChange={setYears} color="#16a34a" quick={[5,10,20,30]}/>
        <div style={{ background:isDark ? "rgba(251, 146, 60, 0.12)" : "#fff7ed", border:isDark ? "1.5px solid rgba(251, 191, 36, 0.35)" : "1.5px solid #fed7aa", borderRadius:14, padding:"10px 12px" }}>
          <div style={{ fontSize:11, fontWeight:900, color:isDark ? "#fdba74" : "#9a3412", marginBottom:4 }}>新NISA 上限メモ</div>
          <div style={{ fontSize:11, color:isDark ? "#fed7aa" : "#7c2d12", lineHeight:1.7 }}>
            年間上限: 合計360万円（つみたて120万円 + 成長240万円）<br />
            生涯上限: 合計1800万円（うち成長枠は最大1200万円）
          </div>
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ background:"linear-gradient(135deg,#111827,#1f2937)", borderRadius:20, padding:22 }}>
          <div style={{ fontSize:12, color:"#cbd5e1", marginBottom:4 }}>{years}年後の想定資産</div>
          <div style={{ fontFamily:NUMERIC_FONT, fontSize:38, fontWeight:800, color:"#4ade80", lineHeight:1 }}>{fmtJPY(final.total*10000)}</div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr 1fr", gap:8, marginTop:14 }}>
            {[
              { label:"元本合計", val:fmtJPY(final.invested*10000), color:"#9ca3af" },
              { label:"運用益",   val:fmtJPY(final.gain*10000),     color:"#60a5fa" },
              { label:"節税効果", val:fmtJPY(taxSaved),              color:"#fbbf24" },
            ].map(item => (
              <div key={item.label} style={{ background:"rgba(255,255,255,0.06)", borderRadius:10, padding:"10px" }}>
                <div style={{ fontFamily:NUMERIC_FONT, fontSize:13, fontWeight:800, color:item.color }}>{item.val}</div>
                <div style={{ fontSize:11, color:"#cbd5e1", marginTop:4 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16, boxShadow:tc.cardShadowSm }}>
          <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:12 }}>資産成長推移</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:80 }}>
            {yearlyData.filter((_,i,a)=>i===0||i===a.length-1||(i+1)%Math.ceil(a.length/10)===0).map((d,i)=>(
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <div style={{ width:"100%", borderRadius:"3px 3px 0 0", background:"linear-gradient(180deg,#4ade80,#16a34a)", height:Math.max(4,(d.total/maxTotal)*70), transition:"height 0.5s" }}/>
                <div style={{ fontSize:10, color:tc.textSoft }}>{d.year}年</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16, boxShadow:tc.cardShadowSm }}>
          <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:10 }}>年別スナップショット</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {yearlyData.filter(d=>d.year===1||d.year%5===0||d.year===years).map((d,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background: d.year===years ? (isDark ? "rgba(22,163,74,0.14)" : "#f0fdf4") : tc.rowBg, borderRadius:10, padding:"8px 12px", border:`1px solid ${d.year===years ? (isDark ? "rgba(34,197,94,0.35)" : "#bbf7d0") : tc.barTrack}` }}>
                <span style={{ fontFamily:NUMERIC_FONT, fontSize:12, fontWeight:700, color:tc.textMuted, minWidth:36 }}>{d.year}年</span>
                <div style={{ flex:1, height:5, background:tc.barTrack, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(d.total/maxTotal)*100}%`, background:"linear-gradient(90deg,#4ade80aa,#4ade80)", borderRadius:3 }}/>
                </div>
                <span style={{ fontFamily:NUMERIC_FONT, fontSize:12, fontWeight:800, color:d.year===years?"#4ade80":tc.textTitle, minWidth:70, textAlign:"right" }}>{fmtJPY(d.total*10000)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOOL 2: 積立 vs 一括投資
// ═══════════════════════════════════════════════════════════════
function LumpVsDCA({ isDark = false }) {
  const { isMobile, isTablet } = useResponsiveLayout();
  const tc = toolsColors(isDark);
  const [principal, setPrincipal] = useState(3000000);
  const [monthly,   setMonthly]   = useState(100000);
  const [rate,      setRate]      = useState(5);
  const [years,     setYears]     = useState(20);

  const lump = useMemo(() => {
    const total = principal * Math.pow(1 + rate/100, years);
    return { total, gain:total-principal };
  }, [principal, rate, years]);

  const dca = useMemo(() => {
    const mr = rate/100/12, months = years*12;
    let bal = 0;
    for (let m = 1; m <= months; m++) bal = (bal + monthly) * (1 + mr);
    const invested = monthly * months;
    return { total:bal, gain:bal-invested, invested };
  }, [monthly, rate, years]);

  const winner = lump.total >= dca.total ? "lump" : "dca";
  const diff   = Math.abs(lump.total - dca.total);

  const scenarios = [3,5,7,10].map(r => {
    const lt = principal * Math.pow(1+r/100, years);
    let bal = 0;
    for (let m=1;m<=years*12;m++) bal=(bal+monthly)*(1+r/100/12);
    return { rate:r, lump:lt, dca:bal };
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:20, padding:20, boxShadow:tc.cardShadow }}>
        <p style={{ fontSize:12, fontWeight:500, color:tc.textMuted, lineHeight:1.65, marginBottom:14, padding:"10px 12px", borderRadius:12, background:tc.rowBg, border:`1px solid ${tc.barTrack}` }}>
          スライダーと「直接入力」は同じ刻みに丸めます。<span style={{ fontWeight:700, color:tc.textTitle }}>一括元本は5万円</span>、<span style={{ fontWeight:700, color:tc.textTitle }}>月額積立は1万円</span>単位です（細かい金額は概算の比較向き）。
        </p>
        <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap:16 }}>
          <Slider isDark={isDark} label="一括投資元本" value={principal} min={100000} max={20000000} step={50000} unit="円" onChange={setPrincipal} color="#3b82f6" quick={[1000000,3000000,5000000,10000000]}/>
          <Slider isDark={isDark} label="月額積立(DCA)" value={monthly} min={10000} max={300000} step={10000} unit="円" onChange={setMonthly} color="#f97316" quick={[10000,30000,50000,100000]}/>
          <Slider isDark={isDark} label="年利回り" value={rate} min={1} max={15} step={0.5} unit="%" onChange={setRate} color="#16a34a" quick={[3,5,7,10]}/>
          <Slider isDark={isDark} label="投資期間" value={years} min={1} max={40} step={1} unit="年" onChange={setYears} color="#8b5cf6" quick={[5,10,20,30]}/>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:14 }}>
        {[
          { label:"🔵 一括投資 (Lump Sum)", total:lump.total, gain:lump.gain, invested:principal, color:"#3b82f6", bg:"#eff6ff", bgDark: "rgba(59, 130, 246, 0.12)", border:"#bfdbfe", borderDark: "rgba(59, 130, 246, 0.35)", isW:winner==="lump" },
          { label:"🟠 積立投資 (DCA)",      total:dca.total,  gain:dca.gain,  invested:dca.invested, color:"#f97316", bg:"#fff7ed", bgDark: "rgba(249, 115, 22, 0.12)", border:"#fed7aa", borderDark: "rgba(251, 146, 60, 0.35)", isW:winner==="dca" },
        ].map(s => (
          <div key={s.label} style={{ background:s.isW ? (isDark ? s.bgDark : s.bg) : tc.cardBg, border:`2px solid ${s.isW ? s.color : tc.cardBorder}`, borderRadius:20, padding:20, position:"relative", boxShadow:s.isW?`0 6px 20px ${s.color}18`:"none" }}>
            {s.isW && <div style={{ position:"absolute", top:14, right:14, background:s.color, color:"#fff", fontSize:10, fontWeight:800, padding:"2px 9px", borderRadius:20 }}>🏆 勝利</div>}
            <div style={{ fontSize:12, fontWeight:900, color:s.color, marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:NUMERIC_FONT, fontSize:32, fontWeight:800, color:s.isW?s.color:tc.textTitle, lineHeight:1 }}>{fmtJPY(s.total)}</div>
            <div style={{ fontSize:12, color:tc.textMuted, marginTop:4, marginBottom:12 }}>{years}年後の想定</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                { label:"元本合計",  val:fmtJPY(s.invested) },
                { label:"運用益",    val:`+${fmtJPY(s.gain)}`, color:s.color },
                { label:"収益率",    val:`+${(s.gain/Math.max(s.invested,1)*100).toFixed(1)}%`, color:s.color },
                { label:"年平均益",  val:fmtJPY(s.gain/years) },
              ].map(item=>(
                <div key={item.label} style={{ background:tc.innerWell, borderRadius:10, padding:"8px 10px" }}>
                  <div style={{ fontFamily:NUMERIC_FONT, fontSize:12, fontWeight:800, color:item.color||tc.textTitle }}>{item.val}</div>
                  <div style={{ fontSize:11, color:tc.textMuted, marginTop:3 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:"linear-gradient(135deg,#111827,#1f2937)", borderRadius:16, padding:"16px 22px", display:"flex", flexDirection:isMobile ? "column" : "row", alignItems:isMobile ? "stretch" : "center", justifyContent:"space-between", gap:14 }}>
        <div>
          <div style={{ fontSize:12, color:"#cbd5e1", marginBottom:3 }}>現在の条件では</div>
          <div style={{ fontSize:15, fontWeight:800, color:"#fff" }}>
            {winner==="lump"?"🔵 一括投資":"🟠 積立投資"} が <span style={{ color:"#fbbf24", fontFamily:NUMERIC_FONT }}>{fmtJPY(diff)}</span> 有利です
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {scenarios.map(s=>(
            <div key={s.rate} style={{ background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"10px 14px", textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#cbd5e1", marginBottom:3 }}>{s.rate}% 利回り</div>
              <div style={{ fontSize:12, fontWeight:700, color:s.lump>=s.dca?"#60a5fa":"#fb923c" }}>{s.lump>=s.dca?"一括":"積立"} 優勢</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOOL 3: 税金計算機
// ═══════════════════════════════════════════════════════════════
function TaxCalc({ isDark = false }) {
  const { isMobile } = useResponsiveLayout();
  const tc = toolsColors(isDark);
  const [buyPriceInput,  setBuyPriceInput]  = useState('500000');
  const [sellPriceInput, setSellPriceInput] = useState('700000');
  const [qtyInput,       setQtyInput]       = useState('100');
  const [dividendInput,  setDividendInput]  = useState('0');
  const [lossInput,      setLossInput]      = useState('0');
  const [account,        setAccount]        = useState("normal");

  const sanitizeDecimalText = (raw = '') => {
    const normalized = String(raw)
      .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
      .replace(/[．。]/g, '.')
      .replace(/,/g, '')
      .replace(/[^\d.]/g, '');
    const dotIdx = normalized.indexOf('.');
    if (dotIdx === -1) return normalized;
    return `${normalized.slice(0, dotIdx + 1)}${normalized.slice(dotIdx + 1).replace(/\./g, '')}`;
  };
  const sanitizeIntegerText = (raw = '') => String(raw)
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
    .replace(/,/g, '')
    .replace(/[^\d]/g, '');
  const parseNonNegative = (raw = '') => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  };

  const buyPrice = parseNonNegative(buyPriceInput);
  const sellPrice = parseNonNegative(sellPriceInput);
  const qty = Math.floor(parseNonNegative(qtyInput));
  const dividend = parseNonNegative(dividendInput);
  const loss = parseNonNegative(lossInput);

  const { rawIncome, netIncome, taxTotal, afterTax, nisaSaving, gainPct } = useMemo(() => {
    const totalGain  = (sellPrice - buyPrice) * qty;
    const rawIncome  = totalGain + dividend;
    const netIncome  = Math.max(0, rawIncome - loss);
    const rate       = account === "nisa" ? 0 : 0.20315;
    const taxTotal   = netIncome * rate;
    const afterTax   = rawIncome - taxTotal;
    const nisaSaving = netIncome * 0.20315;
    const gainPct    = buyPrice > 0 ? ((sellPrice-buyPrice)/buyPrice*100) : 0;
    return { rawIncome, netIncome, taxTotal, afterTax, nisaSaving, gainPct };
  }, [buyPrice, sellPrice, qty, dividend, loss, account]);

  const isNisa = account === "nisa";

  const inputBase = {
    width: '100%',
    background: tc.inputBg,
    border: `1.5px solid ${tc.inputBorder}`,
    borderRadius: 10,
    padding: '8px 12px',
    fontFamily: NUMERIC_FONT,
    fontWeight: 700,
    outline: 'none',
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:20 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16, boxShadow:tc.cardShadowSm }}>
          <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:10 }}>口座タイプ</div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:8 }}>
            {[
              { id:"normal",  label:"課税口座",  rate:"20.315%" },
              { id:"nisa",    label:"NISA",      rate:"0%" },
            ].map(a=>(
              <div key={a.id} onClick={()=>setAccount(a.id)} style={{ flex:1, padding:"10px 6px", borderRadius:12, textAlign:"center", cursor:"pointer", background:account===a.id?"#111827":tc.cardBgMuted, border:`1.5px solid ${account===a.id?"#fbbf24":tc.inputBorder}`, transition:"all 0.15s" }}>
                <div style={{ fontSize:12, fontWeight:800, color:account===a.id?"#fff":tc.textTitle }}>{a.label}</div>
                <div style={{ fontSize:11, color:a.id==="nisa"?"#4ade80":"#f87171", fontFamily:NUMERIC_FONT, fontWeight:700 }}>{a.rate}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16, boxShadow:tc.cardShadowSm }}>
          <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:12 }}>売却情報</div>
          {[
            { id:'buy', label:'取得価格（1株）', value:buyPriceInput, onChange:setBuyPriceInput, color:'#6b7280', inputMode:'decimal', sanitize:sanitizeDecimalText },
            { id:'sell', label:`売却価格（1株）${gainPct!==0?` (${gainPct>0?'+':''}${gainPct.toFixed(1)}%)`:''}`, value:sellPriceInput, onChange:setSellPriceInput, color:sellPrice>buyPrice?'#16a34a':'#dc2626', inputMode:'decimal', sanitize:sanitizeDecimalText },
            { id:'qty', label:'保有数量（株）', value:qtyInput, onChange:setQtyInput, color:'#3b82f6', inputMode:'numeric', sanitize:sanitizeIntegerText },
          ].map(f=>(
            <div key={f.id} style={{ marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:700, color:tc.textLabel, marginBottom:5 }}>{f.label}</div>
              <input
                type="text"
                inputMode={f.inputMode}
                value={f.value}
                onChange={e=>f.onChange(f.sanitize(e.target.value))}
                style={{ ...inputBase, fontSize:14, color:f.color }}
                onFocus={e=>{ e.target.style.borderColor='#fbbf24'; }}
                onBlur={e=>{ e.target.style.borderColor=tc.inputBorder; }}
                placeholder="0"
              />
            </div>
          ))}
        </div>

        <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16, display:'grid', gridTemplateColumns:isMobile ? '1fr' : '1fr 1fr', gap:12, boxShadow:tc.cardShadowSm }}>
          {[
            { id:'dividend', label:'配当金（年間）', value:dividendInput, onChange:setDividendInput, color:'#f59e0b', inputMode:'decimal', sanitize:sanitizeDecimalText },
            { id:'loss', label:'損益通算（損失）', value:lossInput, onChange:setLossInput, color:'#dc2626', inputMode:'decimal', sanitize:sanitizeDecimalText },
          ].map(f=>(
            <div key={f.id}>
              <div style={{ fontSize:12, fontWeight:700, color:tc.textLabel, marginBottom:5 }}>{f.label}</div>
              <input
                type="text"
                inputMode={f.inputMode}
                value={f.value}
                onChange={e=>f.onChange(f.sanitize(e.target.value))}
                style={{ ...inputBase, fontSize:13, color:f.color }}
                onFocus={e=>{ e.target.style.borderColor='#fbbf24'; }}
                onBlur={e=>{ e.target.style.borderColor=tc.inputBorder; }}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ background:isNisa?"linear-gradient(135deg,#16a34a,#15803d)":"linear-gradient(135deg,#111827,#1f2937)", borderRadius:20, padding:24, boxShadow:isDark?"0 20px 50px rgba(0,0,0,0.55)":"0 16px 44px rgba(15,23,42,0.14)" }}>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.74)", marginBottom:6 }}>{isNisa?"NISA 非課税・全額受取":"税引後の手取り額"}</div>
          <div style={{ fontFamily:NUMERIC_FONT, fontSize:40, fontWeight:800, color:"#ffffff", lineHeight:1 }}>{fmtJPY(afterTax)}</div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:8, marginTop:14 }}>
            {[
              { label:"総収益",    val:fmtJPY(rawIncome),                                      color:isNisa?"#ffffff":"#9ca3af" },
              { label:"税金",      val:isNisa?"なし":`-${fmtJPY(taxTotal)}`,                   color:isNisa?"#dcfce7":"#f87171" },
              { label:"損益控除",  val:loss>0?`-${fmtJPY(loss)}`:"なし",                       color:isNisa?"#bfdbfe":"#60a5fa" },
              { label:"実効税率",  val:isNisa?"0%":`${(taxTotal/Math.max(rawIncome,1)*100).toFixed(1)}%`, color:"#fbbf24" },
            ].map(item=>(
              <div key={item.label} style={{ background:isNisa?"rgba(255,255,255,0.10)":"rgba(255,255,255,0.06)", borderRadius:10, padding:"10px 12px", border:isNisa?"1px solid rgba(255,255,255,0.18)":"none" }}>
                <div style={{ fontFamily:NUMERIC_FONT, fontSize:13, fontWeight:800, color:item.color }}>{item.val}</div>
                <div style={{ fontSize:11, color:isNisa?"#f0fdf4":"#cbd5e1", marginTop:4 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {!isNisa && rawIncome > 0 && (
          <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16, boxShadow:tc.cardShadowSm }}>
            <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:12 }}>税金内訳（20.315%）</div>
            {[
              { label:"所得税 15%",        val:netIncome*0.15,    color:"#f87171" },
              { label:"住民税 5%",          val:netIncome*0.05,    color:"#fb923c" },
              { label:"復興特別税 0.315%",  val:netIncome*0.00315, color:"#fbbf24" },
            ].map(item=>(
              <div key={item.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 10px", background:tc.rowBg, borderRadius:8, marginBottom:6 }}>
                <span style={{ fontSize:12, color:tc.textLabel }}>{item.label}</span>
                <span style={{ fontFamily:NUMERIC_FONT, fontSize:12, fontWeight:800, color:item.color }}>-{fmtJPY(item.val)}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 10px", background:isDark?"rgba(220,38,38,0.15)":"#fef2f2", border:`1px solid ${isDark?"rgba(248,113,113,0.35)":"#fecaca"}`, borderRadius:8 }}>
              <span style={{ fontSize:12, fontWeight:800, color:"#dc2626" }}>合計</span>
              <span style={{ fontFamily:NUMERIC_FONT, fontSize:13, fontWeight:800, color:"#dc2626" }}>-{fmtJPY(taxTotal)}</span>
            </div>
          </div>
        )}

        {!isNisa && rawIncome > 0 && (
          <div style={{ background:isDark?"rgba(22,163,74,0.14)":"#f0fdf4", border:`1.5px solid ${isDark?"rgba(34,197,94,0.4)":"#86efac"}`, borderRadius:16, padding:16, boxShadow:tc.cardShadowSm }}>
            <div style={{ fontSize:12, fontWeight:900, color:"#4ade80", marginBottom:8 }}>💡 NISAなら追加で</div>
            <div style={{ fontFamily:NUMERIC_FONT, fontSize:26, fontWeight:800, color:"#4ade80" }}>+{fmtJPY(nisaSaving)}</div>
            <div style={{ fontSize:12, color:tc.textLabel, marginTop:4 }}>受け取れていました</div>
            <button onClick={()=>setAccount("nisa")} style={{ marginTop:10, width:"100%", padding:"8px", background:"#16a34a", border:"none", borderRadius:10, color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
              NISAで再計算 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOOL 4: 為替積立計算機
// ═══════════════════════════════════════════════════════════════
const CURRENCIES = [
  { code:"USD", name:"米ドル",     flag:"🇺🇸", symbol:"$",  color:"#16a34a" },
  { code:"EUR", name:"ユーロ",     flag:"🇪🇺", symbol:"€",  color:"#2563eb" },
  { code:"GBP", name:"ポンド",     flag:"🇬🇧", symbol:"£",  color:"#7c3aed" },
  { code:"KRW", name:"韓国ウォン", flag:"🇰🇷", symbol:"₩",  color:"#dc2626" },
  { code:"AUD", name:"豪ドル",     flag:"🇦🇺", symbol:"A$", color:"#d97706" },
];

/** Frankfurter v1 — use api.frankfurter.dev directly (.app only 301-redirects). */
const FRANKFURTER_JPY_LATEST =
  "https://api.frankfurter.dev/v1/latest?from=JPY&to=USD,EUR,GBP,KRW,AUD";

function fmtAmountJp(n, intlOpts) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  return Number(n).toLocaleString("ja-JP", intlOpts)
}

function CurrencyCalc({ isDark = false }) {
  const { isMobile, isTablet } = useResponsiveLayout();
  const tc = toolsColors(isDark);
  const [rates,    setRates]    = useState(null);
  const [fxFailed, setFxFailed] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [monthly,  setMonthly]  = useState(30000);
  const [period,   setPeriod]   = useState(12);

  useEffect(() => {
    let cancelled = false;
    setFxFailed(false);
    (async () => {
      try {
        const r = await fetch(FRANKFURTER_JPY_LATEST);
        const d = await r.json().catch(() => null);
        const next = d?.rates && typeof d.rates === "object" ? d.rates : null;
        const ok =
          r.ok &&
          next &&
          CURRENCIES.some((c) => Number(next[c.code]) > 0);
        if (cancelled) return;
        if (ok) {
          setRates(next);
          setFxFailed(false);
        } else {
          setRates(null);
          setFxFailed(true);
        }
      } catch {
        if (!cancelled) {
          setRates(null);
          setFxFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cur      = CURRENCIES.find(c=>c.code===currency) || CURRENCIES[0];
  const baseRate = rates?.[currency];
  const totalJPY = monthly * period;
  const totalFx  = baseRate ? totalJPY * baseRate : null;
  const jpyPer1  = baseRate ? 1/baseRate : null;

  const scenarios = [
    { label:"円高 -5%", delta:-5, color:"#dc2626" },
    { label:"現在",      delta: 0, color:"#374151" },
    { label:"円安 +5%", delta:+5, color:"#16a34a" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr 1fr" : isTablet ? "1fr 1fr 1fr" : `repeat(${CURRENCIES.length},1fr)`, gap:8 }}>
        {CURRENCIES.map(c=>(
          <div key={c.code} onClick={()=>setCurrency(c.code)} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"10px 8px", borderRadius:14, cursor:"pointer", background:currency===c.code?"#111827":tc.cardBg, border:`1.5px solid ${currency===c.code?"#fbbf24":tc.cardBorder}`, transition:"all 0.15s" }}>
            <span>{c.flag}</span>
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:currency===c.code?"#fff":tc.textTitle }}>{c.code}</div>
              {rates?.[c.code] && (
                <div style={{ fontFamily:NUMERIC_FONT, fontSize:10, color:currency===c.code?"#cbd5e1":c.color, fontWeight:700 }}>
                  ¥{fmtAmountJp(1 / rates[c.code], { maximumFractionDigits: 1 })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr", gap:16 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16, boxShadow:tc.cardShadowSm }}>
            {!rates && !fxFailed && (
              <div style={{ fontSize:12, color:tc.textMuted, marginBottom:10 }}>リアルタイム為替レート読込中...</div>
            )}
            {fxFailed && (
              <div style={{ fontSize:12, color:"#f87171", fontWeight:700, marginBottom:10 }}>
                為替レートを取得できませんでした。通信状況を確認してページを再読み込みしてください。
              </div>
            )}
            {rates && baseRate && (
              <div style={{ fontSize:12, color:"#4ade80", fontWeight:700, marginBottom:10 }}>
                ✓ 最新レート適用中 · {cur.symbol}1 = ¥{fmtAmountJp(jpyPer1, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
            <Slider isDark={isDark} label="月額積立（JPY）" value={monthly} min={5000} max={200000} step={5000} unit="円" onChange={setMonthly} color={cur.color} quick={[10000,30000,50000,100000]}/>
            <Slider isDark={isDark} label="積立期間" value={period} min={1} max={60} step={1} unit="ヶ月" onChange={setPeriod} color="#8b5cf6" quick={[6,12,24,36]}/>
          </div>

          {baseRate && (
            <div style={{ background:tc.cardBgMuted, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16, boxShadow:tc.cardShadowSm }}>
              {[
                { label:"総投資額（JPY）",         val:`¥${fmtAmountJp(totalJPY)}` },
                { label:`現在レート最終（${currency}）`, val:`${cur.symbol}${fmtAmountJp(Math.round(totalFx ?? 0))}` },
                {
                  label:"月額両替",
                  val: `${cur.symbol}${fmtAmountJp(monthly * baseRate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                },
              ].map(item=>(
                <div key={item.label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${tc.barTrack}` }}>
                  <span style={{ fontSize:12, color:tc.textLabel }}>{item.label}</span>
                  <span style={{ fontFamily:NUMERIC_FONT, fontSize:13, fontWeight:800, color:tc.textTitle }}>{item.val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {scenarios.map(sc=>{
            const adjRate = baseRate ? baseRate * (1 + sc.delta/100) : null;
            const adjTotal = adjRate ? totalJPY * adjRate : null;
            return (
              <div key={sc.label} style={{ background: sc.delta===0?"linear-gradient(135deg,#111827,#1f2937)":tc.cardBg, border:`1.5px solid ${sc.delta===0?"#334155":sc.delta>0?(isDark?"rgba(34,197,94,0.4)":"#bbf7d0"):(isDark?"rgba(248,113,113,0.35)":"#fecaca")}`, borderRadius:16, padding:16, boxShadow:sc.delta===0?(isDark?"0 14px 40px rgba(0,0,0,0.5)":"0 12px 32px rgba(15,23,42,0.12)"):tc.cardShadowSm }}>
                <div style={{ fontSize:12, fontWeight:800, color:sc.delta===0?"#cbd5e1":sc.color, marginBottom:6 }}>{sc.label}</div>
                {adjTotal ? (
                  <>
                    <div style={{ fontFamily:NUMERIC_FONT, fontSize:26, fontWeight:800, color:sc.delta===0?"#fff":sc.color }}>
                      {cur.symbol}
                      {fmtAmountJp(Math.round(adjTotal))}
                    </div>
                    <div style={{ fontSize:11, color:sc.delta===0?"#cbd5e1":tc.textMuted, marginTop:4 }}>
                      ¥1 = {cur.symbol}
                      {fmtAmountJp(adjRate, { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                    </div>
                  </>
                ) : <div style={{ fontSize:12, color:tc.textMuted }}>為替レート読込中...</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOOL 5: 配当カレンダー（詳細マスター優先 + Universe フォールバック）
// ═══════════════════════════════════════════════════════════════
const DEMO_COLORS = ["#2a9d8f","#f4a261","#ff9f1c","#457b9d","#e63946","#e9c46a","#6b7280","#8b5cf6","#06b6d4","#84cc16"];
const toDivStockId = (symbol) => (symbol || "").endsWith(".T") ? symbol.slice(0, -2) : symbol;

/** ツール画面のみ: USD 銘柄の円換算に使う固定レート（ライブ為替ではない） */
const TOOLS_DIVIDEND_DEMO_USD_JPY = 150;
/** 初回表示用のサンプル銘柄（DIVIDEND_STOCK_UNIVERSE のマスター値を利用） */
const TOOLS_DIVIDEND_DEFAULT_DEMO_IDS = ["MDT", "MCD", "AON", "MA", "8306"];

// 銘柄一覧: 詳細マスター（generated json）を優先し、未登録銘柄のみ Universe を参照する。
const DIV_STOCK_PICKER = DIVIDEND_STOCK_UNIVERSE.map((r, i) => {
  const id = toDivStockId(r.symbol);
  const detail = getDividendCalendarDetailRecord(r.symbol);
  const detailDividends = (Array.isArray(detail?.dividends) ? detail.dividends : [])
    .map((d) => ({
      month: Number(d?.month),
      amount: Number(d?.amount),
    }))
    .filter((d) => Number.isInteger(d.month) && d.month >= 1 && d.month <= 12 && Number.isFinite(d.amount) && d.amount > 0);

  const months = Array.isArray(r.dividendMonths) ? r.dividendMonths : [];
  const perShare = Number(r.dividendAmountPerShare);
  const fallbackDividends = months
    .map((month) => ({
      month: Number(month),
      amount: Number.isFinite(perShare) && perShare > 0 ? perShare : 0,
    }))
    .filter((d) => Number.isInteger(d.month) && d.month >= 1 && d.month <= 12 && d.amount > 0);

  const dividends = detailDividends.length > 0 ? detailDividends : fallbackDividends;
  const detailPrice = Number(detail?.price);
  return {
    id,
    name: detail?.name || r.name,
    flag: r.region === "JP" ? "🇯🇵" : "🇺🇸",
    sector: r.sector || detail?.category || "その他",
    color: DEMO_COLORS[i % DEMO_COLORS.length],
    dividends,
    price: Number.isFinite(detailPrice) && detailPrice > 0 ? detailPrice : (r.region === "JP" ? 2000 : 50),
  };
});

const DIV_PICKER_BY_ID = new Map(DIV_STOCK_PICKER.map((s) => [s.id, s]));
const TOOLS_DIVIDEND_DEFAULT_IDS_RESOLVED = TOOLS_DIVIDEND_DEFAULT_DEMO_IDS.filter((id) => DIV_PICKER_BY_ID.has(id));

const MONTHS_JP = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

const TOOLS_DIVIDEND_MAX_SELECTED = 8;

function DividendCalendar({ session = null, isDark = false }) {
  void session;
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();
  const tc = toolsColors(isDark);

  const [localWatchlist, setLocalWatchlist] = useState(() => [...TOOLS_DIVIDEND_DEFAULT_IDS_RESOLVED]);
  const [localQty, setLocalQty] = useState({});
  const [selMonth, setSelMonth] = useState(new Date().getMonth() + 1);
  const [stockQuery, setStockQuery] = useState("");
  const [flashMonth, setFlashMonth] = useState(null);

  const watched = useMemo(() => (
    localWatchlist
      .map((id) => DIV_PICKER_BY_ID.get(id))
      .filter(Boolean)
      .map((s) => ({
        ...s,
        qty: localQty[s.id] ?? 10,
      }))
  ), [localWatchlist, localQty]);

  const getQty = (item) => item.qty ?? 10;
  const setQtyForStock = (id, nextValue) => {
    const sanitized = Math.max(1, Number(nextValue) || 1);
    setLocalQty((prev) => ({ ...prev, [id]: sanitized }));
  };

  const resetDemoSelection = () => {
    setLocalWatchlist([...TOOLS_DIVIDEND_DEFAULT_IDS_RESOLVED]);
    setLocalQty({});
    setSelMonth(new Date().getMonth() + 1);
  };

  const clearAllSelection = () => {
    setLocalWatchlist([]);
    setLocalQty({});
    setSelMonth(new Date().getMonth() + 1);
  };

  const toggleWatchStock = (stock) => {
    const isWatching = watched.some((w) => w.id === stock.id);
    if (isWatching) {
      setLocalWatchlist((prev) => prev.filter((x) => x !== stock.id));
      return;
    }
    setLocalWatchlist((prev) => {
      if (prev.includes(stock.id)) return prev;
      if (prev.length >= TOOLS_DIVIDEND_MAX_SELECTED) return prev;
      return [...prev, stock.id];
    });
    const firstMonth = getFirstDividendMonth(stock.dividends);
    if (firstMonth) {
      setSelMonth(firstMonth);
      setFlashMonth(firstMonth);
      window.setTimeout(() => setFlashMonth(null), 1300);
    }
  };

  const filteredStocks = useMemo(() => {
    const q = stockQuery.trim().toLowerCase();
    if (!q) return DIV_STOCK_PICKER;
    return DIV_STOCK_PICKER.filter((stock) =>
      `${stock.id} ${stock.name} ${stock.sector}`.toLowerCase().includes(q)
    );
  }, [stockQuery]);

  const monthlyEvents = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    watched.forEach((stock) => {
      const q = Number(stock.qty ?? 10);
      stock.dividends.forEach((div) => {
        const jpy = dividendCashToJpyApprox(div.amount, stock, TOOLS_DIVIDEND_DEMO_USD_JPY);
        if (jpy > 0 && div.month >= 1 && div.month <= 12) {
          map[div.month].push({ stock, amount: div.amount, total: jpy * q });
        }
      });
    });
    return map;
  }, [watched]);

  const monthlyTotals = useMemo(() => Object.fromEntries(Object.entries(monthlyEvents).map(([m,evs])=>[m,evs.reduce((s,e)=>s+e.total,0)])), [monthlyEvents]);
  const yearTotal = Object.values(monthlyTotals).reduce((s,v)=>s+v,0);
  const maxM = Math.max(...Object.values(monthlyTotals), 1);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* ── バナー ─────────────────────────── */}
      <div style={{ background:isDark?"rgba(251, 146, 60, 0.12)":"linear-gradient(135deg,#fff7ed,#fef3c7)", border:isDark?"1.5px solid rgba(251, 191, 36, 0.35)":"1.5px solid #fed7aa", borderRadius:14, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>📌</span>
          <div>
            <div style={{ fontSize:12, fontWeight:800, color:isDark?"#fdba74":"#92400e" }}>
              ツール画面はサンプル表示です
            </div>
            <div style={{ fontSize:12, color:isDark?"#fed7aa":"#b45309", marginTop:2 }}>
              配当スケジュール・1株あたり金額はサイト内マスター（参考）です。米国株の円換算は{TOOLS_DIVIDEND_DEMO_USD_JPY}円/ドルの固定レート。ご自身の登録銘柄はマイページの配当タブで管理してください。
            </div>
          </div>
        </div>
        <button type="button" onClick={() => navigate("/mypage?tab=dividend")} style={{ padding:"7px 16px", background:"#f97316", color:"#fff", borderRadius:10, fontSize:12, fontWeight:800, textDecoration:"none", whiteSpace:"nowrap", boxShadow:"0 2px 8px #f9731644", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
          マイページで管理 →
        </button>
      </div>

      <div style={{ display:"flex", alignItems:isMobile ? "flex-start" : "center", justifyContent:"space-between", flexDirection:isMobile ? "column" : "row", gap:isMobile ? 8 : 0, background:"linear-gradient(135deg,#111827,#1f2937)", borderRadius:16, padding:"14px 20px" }}>
        <div>
          <div style={{ fontSize:12, color:"#cbd5e1", marginBottom:2 }}>年間予想配当受取額</div>
          <div style={{ fontFamily:NUMERIC_FONT, fontSize:28, fontWeight:800, color:"#4ade80" }}>
            {`¥${Math.round(yearTotal).toLocaleString()}`}
          </div>
          <div style={{ fontSize:10, color:"#94a3b8", marginTop:4 }}>サンプル合計（税引前・参考）</div>
        </div>
        <div style={{ fontSize:12, color:"#cbd5e1" }}>選択中 {watched.length}銘柄（最大{TOOLS_DIVIDEND_MAX_SELECTED}）</div>
      </div>

      <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"flex", alignItems:isMobile ? "flex-start" : "center", justifyContent:"space-between", flexDirection:isMobile ? "column" : "row", gap:10 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:900, color:tc.textTitle }}>使い方</div>
            <div style={{ fontSize:12, color:tc.textMuted, marginTop:4 }}>1. 下の一覧から銘柄を選ぶ  2. 株数を変えて受取イメージを試す  3. 本番の登録・編集はマイページへ</div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button
              type="button"
              onClick={resetDemoSelection}
              style={{ padding:"7px 12px", borderRadius:10, border:`1px solid ${isDark?"rgba(56,189,248,0.45)":"#bae6fd"}`, background:isDark?"rgba(14,165,233,0.15)":"#f0f9ff", color:isDark?"#7dd3fc":"#0369a1", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}
            >
              サンプルに戻す
            </button>
            <button
              type="button"
              onClick={clearAllSelection}
              style={{ padding:"7px 12px", borderRadius:10, border:`1px solid ${isDark?"rgba(248,113,113,0.45)":"#fecaca"}`, background:isDark?"rgba(220,38,38,0.15)":"#fef2f2", color:"#f87171", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}
            >
              すべて削除
            </button>
          </div>
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:tc.textLabel, marginBottom:8 }}>サンプルで選択中の銘柄</div>
          {watched.length === 0 ? (
            <div style={{ fontSize:12, color:tc.textSoft }}>まだ選択した銘柄がありません。下の一覧から追加してください。</div>
          ) : (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {watched.map((stock) => (
                <div key={`selected-${stock.id}`} style={{ display:"flex", alignItems:"center", gap:8, background:tc.rowBgStrong, border:`1px solid ${tc.cardBorder}`, borderRadius:999, padding:"7px 12px" }}>
                  <span style={{ fontSize:15 }}>{stock.flag}</span>
                  <span style={{ fontSize:12, fontWeight:800, color:tc.textTitle }}>{stock.name}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${getDividendCadenceMeta(stock.dividends).className}`}>{getDividendCadenceMeta(stock.dividends).label}</span>
                  <span style={{ fontSize:11, color:tc.textMuted }}>{stock.dividends.map((div) => `${div.month}月`).join(" / ")}</span>
                  <button
                    type="button"
                    onClick={() => toggleWatchStock(stock)}
                    style={{ border:"none", background:"transparent", color:"#dc2626", fontSize:12, fontWeight:900, cursor:"pointer", padding:0, fontFamily:"inherit" }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "2fr 1fr", gap:16 }}>
        <div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "repeat(3,1fr)" : "repeat(4,1fr)", gap:8, marginBottom:16 }}>
            {MONTHS_JP.map((name,i)=>{
              const m=i+1, total=monthlyTotals[m], isS=selMonth===m, hasD=monthlyEvents[m].length>0;
              return (
                <div key={m} onClick={()=>setSelMonth(m)} style={{ background:isS?(isDark?"rgba(22,163,74,0.2)":"#f0fdf4"):hasD?tc.cardBg:tc.rowBg, border:`1.5px solid ${isS?"#22c55e":hasD?tc.cardBorder:tc.barTrack}`, borderRadius:12, padding:"10px 8px", cursor:"pointer", textAlign:"center", boxShadow:isS?"0 4px 12px #16a34a22":"none", transition:"all 0.15s", animation:flashMonth===m ? "mm-dividend-pulse 1.1s ease" : "none" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:isS?"#4ade80":hasD?tc.textTitle:tc.textSoft, marginBottom:6 }}>{name}</div>
                  <div style={{ height:28, display:"flex", alignItems:"flex-end", justifyContent:"center", marginBottom:4 }}>
                    {hasD ? <div style={{ width:"80%", height:Math.max(4,(total/maxM)*24), background:isS?"#4ade80":(isDark?"rgba(74,222,128,0.25)":"#d1fae5"), borderRadius:"2px 2px 0 0" }}/> : <div style={{ width:"80%", height:2, background:tc.barTrack }}/>}
                  </div>
                  {hasD ? <div style={{ fontFamily:NUMERIC_FONT, fontSize:11, fontWeight:700, color:isS?"#4ade80":tc.textMuted }}>¥{Math.round(total).toLocaleString()}</div>
                        : <div style={{ fontSize:10, color:tc.textSoft }}>なし</div>}
                </div>
              );
            })}
          </div>

          <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:tc.textTitle }}>{MONTHS_JP[selMonth-1]}の配当</div>
                <div style={{ fontSize:11, color:tc.textMuted, marginTop:4 }}>サンプル選択銘柄のうち、{MONTHS_JP[selMonth-1]}に支払予定の項目だけを表示しています。</div>
              </div>
              {monthlyTotals[selMonth]>0 && <div style={{ fontFamily:NUMERIC_FONT, fontSize:14, fontWeight:800, color:"#4ade80" }}>¥{Math.round(monthlyTotals[selMonth]).toLocaleString()}</div>}
            </div>
            {monthlyEvents[selMonth].length === 0 ? (
              <div style={{ textAlign:"center", padding:"20px 0", color:tc.textSoft, fontSize:12 }}>この月は配当がありません 📭</div>
            ) : monthlyEvents[selMonth].map((ev)=>(
              <div key={`${ev.stock?.symbol ?? ''}-${ev.exDate ?? ''}`} style={{ display:"flex", alignItems:"center", gap:10, background:tc.rowBg, borderRadius:10, padding:"10px 12px", marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{ev.stock.flag}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:tc.textTitle }}>{ev.stock.name}</div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${getDividendCadenceMeta(ev.stock.dividends).className}`}>{getDividendCadenceMeta(ev.stock.dividends).label}</span>
                  </div>
                  <div style={{ fontSize:10, color:tc.textMuted, marginTop:2 }}>{ev.stock.sector}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:NUMERIC_FONT, fontSize:13, fontWeight:800, color:"#4ade80" }}>¥{Math.round(ev.total).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:tc.textMuted }}>{formatDividendCash(ev.amount, ev.stock)}/株 × {getQty(ev.stock)}株</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:14 }}>
          <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:4 }}>銘柄追加 / 株数調整</div>
          <div style={{ fontSize:10, color:tc.textMuted, marginBottom:10 }}>ここでの変更はツール内のみ（保存されません）。本番の配当登録はマイページの配当タブへ。</div>
          <input
            type="text"
            value={stockQuery}
            onChange={(e) => setStockQuery(e.target.value)}
            placeholder="銘柄名 / ティッカー / セクター検索"
            style={{ width:"100%", marginBottom:12, background:tc.inputBgSoft, border:`1.5px solid ${tc.inputBorder}`, borderRadius:10, padding:"8px 12px", fontSize:12, fontFamily:"inherit", outline:"none", color:tc.textTitle }}
          />
          <div style={{ maxHeight:420, overflowY:"auto", paddingRight:4 }}>
          {filteredStocks.map(stock=>{
            const isW = watched.some((w) => w.id === stock.id);
            return (
              <div key={stock.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"10px 0", borderBottom:`1px solid ${tc.barTrack}` }}>
                <span style={{ fontSize:16 }}>{stock.flag}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:tc.textTitle }}>{stock.name}</div>
                  <div style={{ fontSize:10, color:tc.textMuted, marginTop:3 }}>{stock.id} · {stock.sector}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginTop:4 }}>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${getDividendCadenceMeta(stock.dividends).className}`}>
                      {(stock.dividends || []).length ? getDividendCadenceMeta(stock.dividends).label : "マスター未登録"}
                    </span>
                    <span style={{ fontSize:10, color:tc.textSoft }}>
                      {(stock.dividends || []).length ? stock.dividends.map((div) => `${div.month}月`).join(" / ") : "配当月なし"}
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:"#4ade80", marginTop:4, fontWeight:700 }}>
                    予想年配当利回り {(stock.dividends || []).length && getDividendYieldPct(stock.price, stock.dividends) != null ? `${getDividendYieldPct(stock.price, stock.dividends).toFixed(2)}%` : "—"}
                  </div>
                </div>
                {isW && (
                  <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"center" }}>
                    <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                      <button type="button" onClick={()=>setQtyForStock(stock.id, getQty(stock)-10)} style={{ background:tc.rowBgStrong, border:"none", borderRadius:5, width:20, height:20, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", color:tc.textTitle }}>-</button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={getQty(stock)}
                        onChange={(e) => setQtyForStock(stock.id, e.target.value)}
                        style={{ width:46, background:tc.inputBg, border:`1px solid ${tc.inputBorder}`, borderRadius:6, fontFamily:NUMERIC_FONT, fontSize:11, fontWeight:800, textAlign:"center", padding:"3px 4px", color:tc.textTitle }}
                      />
                      <button type="button" onClick={()=>setQtyForStock(stock.id, getQty(stock)+10)} style={{ background:tc.rowBgStrong, border:"none", borderRadius:5, width:20, height:20, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", color:tc.textTitle }}>+</button>
                    </div>
                    <div style={{ fontSize:10, color:tc.textMuted }}>株</div>
                  </div>
                )}
                <button type="button" onClick={()=>toggleWatchStock(stock)} style={{ padding:"3px 8px", borderRadius:8, border:`1px solid ${isW?(isDark?"rgba(248,113,113,0.45)":"#fecaca"):(isDark?"rgba(34,197,94,0.4)":"#bbf7d0")}`, background:isW?(isDark?"rgba(220,38,38,0.15)":"#fef2f2"):(isDark?"rgba(22,163,74,0.14)":"#f0fdf4"), color:isW?"#f87171":"#4ade80", fontSize:10, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
                  {isW?"削除":"追加"}
                </button>
              </div>
            );
          })}
          {filteredStocks.length === 0 && (
            <div style={{ padding:"12px 0 4px", textAlign:"center", fontSize:12, color:tc.textSoft }}>
              検索結果がありません。
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOOL 6: ETFスクリーナー
// ═══════════════════════════════════════════════════════════════
function ETFScreener({ isDark = false }) {
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();
  const tc = toolsColors(isDark);
  const [cat, setCat] = useState("すべて");
  const [nisa, setNisa] = useState("すべて");
  const [themeFilter, setThemeFilter] = useState("すべて");
  const [minReturn, setMinReturn] = useState(5);
  const [maxFee, setMaxFee] = useState(0.35);
  const [minAvgVolumeK, setMinAvgVolumeK] = useState(50);
  const [sortBy, setSortBy] = useState("return_desc");
  const [search, setSearch] = useState("");
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const rows = await fetchFundUniverseSnapshot();
        if (!cancelled) setFunds(rows || []);
      } catch (err) {
        if (!cancelled) {
          setFunds([]);
          setError(err?.message || "ETFデータを読み込めませんでした");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ETF_CATS = useMemo(() => {
    const counts = new Map();
    funds.forEach((fund) => counts.set(fund.category || "その他", (counts.get(fund.category || "その他") || 0) + 1));
    return ["すべて", ...[...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a))];
  }, [funds]);

  const NISA_CATS = useMemo(() => {
    const counts = new Map();
    funds.forEach((fund) => counts.set(fund.nisaCategory || "-", (counts.get(fund.nisaCategory || "-") || 0) + 1));
    return ["すべて", ...[...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a))];
  }, [funds]);

  const THEME_FILTERS = useMemo(() => {
    const aiCount = funds.filter((fund) => isAiThemeFund(fund)).length;
    const highDividendCount = funds.filter((fund) => isHighDividendFund(fund)).length;
    return [
      { id: "すべて", label: "すべて", count: funds.length },
      { id: "AIテーマ", label: "AIテーマ", count: aiCount },
      { id: "高配当", label: "高配当", count: highDividendCount },
    ].filter((item) => item.id === "すべて" || item.count > 0);
  }, [funds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minAvgVolume = Number(minAvgVolumeK || 0) * 1000;
    const list = funds.filter((fund) => {
      if (cat !== "すべて" && fund.category !== cat) return false;
      if (nisa !== "すべて" && (fund.nisaCategory || "-") !== nisa) return false;
      if (themeFilter === "AIテーマ" && !isAiThemeFund(fund)) return false;
      if (themeFilter === "高配当" && !isHighDividendFund(fund)) return false;
      const trustFeeValue = Number(fund.trustFee);
      if (!Number.isFinite(trustFeeValue) || trustFeeValue > maxFee) return false;
      const return1YValue = Number(fund.returnRate1Y);
      if (!Number.isFinite(return1YValue) || return1YValue < minReturn) return false;
      const avgVolume = Number(fund.avgVolume);
      if (!Number.isFinite(avgVolume) || avgVolume < minAvgVolume) return false;
      if (q) {
        const haystack = `${fund.fundName || ""} ${fund.symbol || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "return_desc") list.sort((a, b) => Number(b.returnRate1Y ?? -999) - Number(a.returnRate1Y ?? -999));
    else if (sortBy === "trust_fee_asc") list.sort((a, b) => Number(a.trustFee ?? Infinity) - Number(b.trustFee ?? Infinity));
    else if (sortBy === "volume_desc") list.sort((a, b) => Number(b.avgVolume ?? 0) - Number(a.avgVolume ?? 0));
    else if (sortBy === "name_asc") list.sort((a, b) => String(a.fundName || "").localeCompare(String(b.fundName || ""), "ja"));
    return list;
  }, [cat, funds, maxFee, minAvgVolumeK, minReturn, nisa, search, sortBy, themeFilter]);

  return (
    <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : "200px 1fr", gap:16 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:14 }}>
          <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:10 }}>カテゴリー</div>
          <div style={{ display:"flex", flexDirection:isMobile ? "row" : "column", flexWrap:isMobile ? "wrap" : "nowrap", gap:isMobile ? 6 : 0 }}>
          {ETF_CATS.map(c=>(
            <div key={c} onClick={()=>setCat(c)} style={{ padding:"7px 10px", borderRadius:8, cursor:"pointer", background:cat===c?"#111827":tc.rowBg, color:cat===c?"#fff":tc.textTitle, fontSize:11, fontWeight:700, marginBottom:isMobile ? 0 : 3, transition:"all 0.12s", display:"flex", justifyContent:"space-between", gap:8, flex:isMobile ? "0 0 auto" : "initial" }}>
              <span>{c}</span>
              <span style={{ fontSize:10, color:cat===c?"#cbd5e1":tc.textSoft }}>{c==="すべて"?funds.length:funds.filter(e=>e.category===c).length}</span>
            </div>
          ))}
          </div>
        </div>
        <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:16, padding:14 }}>
          <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:12 }}>詳細フィルター</div>
          <Slider isDark={isDark} label="最低1年リターン" value={minReturn} min={0} max={60} step={1} unit="%" onChange={setMinReturn} color="#16a34a"/>
          <Slider isDark={isDark} label="最大信託報酬" value={maxFee} min={0.03} max={0.8} step={0.01} unit="%" onChange={setMaxFee} color="#ef4444"/>
          <Slider isDark={isDark} label="最低平均出来高" value={minAvgVolumeK} min={0} max={2000} step={10} unit="K" onChange={setMinAvgVolumeK} color="#2563eb"/>
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:8 }}>テーマ</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {THEME_FILTERS.map(item => (
                <button key={item.id} type="button" onClick={() => setThemeFilter(item.id)} style={{ padding:"6px 10px", borderRadius:999, border:`1.5px solid ${themeFilter===item.id?"#0ea5e9":tc.inputBorder}`, background:themeFilter===item.id?(isDark?"rgba(14,165,233,0.2)":"#ecfeff"):tc.cardBg, color:themeFilter===item.id?(isDark?"#7dd3fc":"#0c4a6e"):tc.textLabel, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {item.label} ({item.count})
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:12, fontWeight:900, color:tc.textTitle, marginBottom:8 }}>NISA区分</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {NISA_CATS.map(item => (
                <button key={item} type="button" onClick={() => setNisa(item)} style={{ padding:"6px 10px", borderRadius:999, border:`1.5px solid ${nisa===item?"#16a34a":tc.inputBorder}`, background:nisa===item?(isDark?"rgba(22,163,74,0.18)":"#f0fdf4"):tc.cardBg, color:nisa===item?"#4ade80":tc.textLabel, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ background:isDark?"rgba(22,163,74,0.14)":"#f0fdf4", border:`1.5px solid ${isDark?"rgba(34,197,94,0.35)":"#bbf7d0"}`, borderRadius:12, padding:12, textAlign:"center" }}>
          <div style={{ fontFamily:NUMERIC_FONT, fontSize:24, fontWeight:800, color:"#4ade80" }}>{filtered.length}</div>
          <div style={{ fontSize:12, color:tc.textLabel }}>条件一致</div>
        </div>
      </div>

      <div>
        <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ファンド名 / シンボル検索..." style={{ flex:1, minWidth:120, background:tc.inputBgSoft, border:`1.5px solid ${tc.inputBorder}`, borderRadius:10, padding:"7px 12px", fontSize:12, fontFamily:"inherit", outline:"none", color:tc.textTitle }}/>
          {[
            { id:"return_desc", label:"1Y収益率↓" },
            { id:"trust_fee_asc", label:"信託報酬↑" },
            { id:"volume_desc", label:"出来高↓" },
            { id:"name_asc", label:"名前順" },
          ].map(s=>(
            <button key={s.id} onClick={()=>setSortBy(s.id)} style={{ padding:"7px 12px", borderRadius:10, fontSize:11, fontWeight:700, fontFamily:"inherit", cursor:"pointer", background:sortBy===s.id?"#111827":tc.cardBg, color:sortBy===s.id?"#fff":tc.textLabel, border:`1.5px solid ${sortBy===s.id?"#fbbf24":tc.cardBorder}` }}>{s.label}</button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {loading && (
            <div style={{ background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:14, padding:"18px 16px", color:tc.textMuted, fontSize:12, fontWeight:700 }}>
              ETFデータを読み込み中...
            </div>
          )}
          {!loading && error && (
            <div style={{ background:isDark?"rgba(251,146,60,0.12)":"#fff7ed", border:`1.5px solid ${isDark?"rgba(251,191,36,0.4)":"#fed7aa"}`, borderRadius:14, padding:"18px 16px", color:isDark?"#fdba74":"#c2410c", fontSize:12, fontWeight:700 }}>
              {error}
            </div>
          )}
          {!loading && !error && filtered.map((etf)=>(
            <div key={etf.symbol ?? etf.isin ?? etf.id} style={{ display:"flex", flexDirection:isMobile ? "column" : "row", alignItems:isMobile ? "stretch" : "center", gap:14, background:tc.cardBg, border:`1.5px solid ${tc.cardBorder}`, borderRadius:14, padding:"13px 16px", transition:"all 0.15s", cursor:"pointer" }}
              onClick={() => navigate(`/funds/${encodeURIComponent(String(etf.symbol || ""))}`)}
              onMouseEnter={(e) => { e.currentTarget.style.border = `1.5px solid ${isDark ? "#fbbf24" : "#111827"}`; }}
              onMouseLeave={(e) => { e.currentTarget.style.border = `1.5px solid ${tc.cardBorder}`; }}>
              <div style={{ background:tc.rowBgStrong, borderRadius:10, padding:"8px 10px", textAlign:"center", minWidth:isMobile ? "100%" : 52, flexShrink:0 }}>
                <div style={{ fontFamily:NUMERIC_FONT, fontSize:11, fontWeight:800, color:tc.textTitle }}>{String(etf.symbol || "").replace(".T","")}</div>
                <div style={{ fontSize:10, color:tc.textMuted }}>{etf.exchange || "ETF"}</div>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:800, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:isMobile ? "normal" : "nowrap", lineHeight:1.5, color:tc.textTitle }}>{etf.fundName}</div>
                <div style={{ fontSize:11, color:tc.textMuted, marginTop:3 }}>{etf.category} · NISA {etf.nisaCategory || "-"}</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile ? "repeat(3,minmax(0,1fr))" : "repeat(3,1fr)", gap:isMobile ? 8 : 12, flexShrink:0, width:isMobile ? "100%" : "auto" }}>
                {[
                  { label:"信託報酬", val:Number.isFinite(Number(etf.trustFee))?`${Number(etf.trustFee).toFixed(3)}%`:"-", color:Number(etf.trustFee)<=0.15?"#16a34a":Number(etf.trustFee)<=0.35?"#d97706":"#dc2626" },
                  { label:"1Y", val:Number.isFinite(Number(etf.returnRate1Y))?`${Number(etf.returnRate1Y)>0?"+":""}${Number(etf.returnRate1Y).toFixed(1)}%`:"-", color:Number(etf.returnRate1Y)>=0?"#ef4444":"#2563eb" },
                  { label:"平均出来高", val:Number(etf.avgVolume)>0?`${Math.round(Number(etf.avgVolume)/1000).toLocaleString()}K`:"-", color:"#2563eb" },
                ].map(m=>(
                  <div key={m.label} style={{ textAlign:"center" }}>
                    <div style={{ fontFamily:NUMERIC_FONT, fontSize:13, fontWeight:800, color:m.color }}>{m.val}</div>
                    <div style={{ fontSize:11, color:tc.textMuted }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ background:tc.cardBg, border:`1.5px dashed ${tc.inputBorder}`, borderRadius:14, padding:"18px 16px", color:tc.textMuted, fontSize:12, fontWeight:700, textAlign:"center" }}>
              条件に合うETFがありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOOLS メタデータ
// ═══════════════════════════════════════════════════════════════
const TOOLS = [
  { id:"nisa",     label:"新NISAシミュレーター",  icon:"🏦", color:"#16a34a", bg:"#f0fdf4", border:"#86efac", desc:"積立・成長の２枠設定 → 複利収益 + 節税効果を計算",       badge:"人気",  component: NISASimulator },
  { id:"lumpvsdca",label:"積立 vs 一括投資",       icon:"⚖️", color:"#3b82f6", bg:"#eff6ff", border:"#bfdbfe", desc:"1000万円を今入れるか、毎月分散するか？4つの利回りで比較", badge:"NEW",   component: LumpVsDCA },
  { id:"tax",      label:"税金計算機",              icon:"🧾", color:"#f59e0b", bg:"#fffbeb", border:"#fde68a", desc:"売却益・配当の税金計算 + NISA節税シミュレーション",        badge:null,    component: TaxCalc },
  { id:"currency", label:"為替積立計算機",          icon:"💱", color:"#8b5cf6", bg:"#faf5ff", border:"#e9d5ff", desc:"毎月の円をドルに換えるとNヶ月後にいくら？リアルタイム為替", badge:"無料", component: CurrencyCalc },
  { id:"dividend", label:"配当カレンダー",          icon:"📅", color:"#f97316", bg:"#fff7ed", border:"#fed7aa", desc:"マスター参照のサンプルで配当月を試す（保存はマイページ）",          badge:null,    component: DividendCalendar },
];

const TOOL_GUIDES = {
  nisa: {
    title: "新NISAシミュレーターとは？",
    what: "毎月いくら積み立てると、何年後にいくらになるかを計算するツールです。",
    why: "新NISAは運用益に税金がかかりません。通常の口座と比べてどれだけ「得」になるかを数字で確認できます。",
    steps: [
      "つみたて投資枠・成長投資枠の月額を設定",
      "想定利回りと運用年数を入力",
      "将来の資産額と節税効果が即座に表示",
    ],
    example: "月30万円（つみたて10万円 + 成長20万円）・年利5%・5年 → 元本1,800万円",
    tip: "まずは上限ベース（つみたて10万円 + 成長20万円）で5年=元本1,800万円のケースを基準に試してください。",
  },
  lumpvsdca: {
    title: "一括投資 vs 積立投資とは？",
    what: "まとまったお金を今すぐ全額投資する場合と、毎月少しずつ積み立てる場合を比較するシミュレーターです。",
    why: "「退職金が入った」「ボーナスが出た」など、まとまった資金をどう使うか悩む方に向いています。",
    steps: [
      "一括投資額と毎月の積立額を入力",
      "想定利回りと運用年数を設定",
      "4つの利回りシナリオで自動比較",
    ],
    example: "300万円を一括投資 vs 毎月5万円積立（年利5%・5年）",
    tip: "一般的に長期では一括投資が有利ですが、暴落リスクを避けたい場合は積立が安心です。",
  },
  tax: {
    title: "投資税金計算機とは？",
    what: "株や投資信託を売った時・配当をもらった時にかかる税金を計算するツールです。",
    why: "日本の投資利益には20.315%の税金がかかります。NISAを使えばこの税金がゼロになります。どれだけ差が出るか確認できます。",
    steps: [
      "買値・売値（または配当金額）を入力",
      "口座タイプを選択（課税口座 or NISA）",
      "税金額と手取り金額が即座に表示",
    ],
    example: "100万円の利益 → 課税口座で税金20.3万円、NISAなら0円",
    tip: "同じ利益でも口座の種類で手取りが大きく変わります。まずNISA口座を使い切ることを優先しましょう。",
  },
  currency: {
    title: "外貨積立計算機とは？",
    what: "毎月円をドルなどの外貨に換えて積み立てると、何ヶ月後にいくらになるかを計算するツールです。",
    why: "円安が続く時代に、外貨資産を少しずつ持つ外貨積立が注目されています。リアルタイムの為替レートで試算できます。",
    steps: [
      "毎月の積立円額を入力",
      "積立期間を設定",
      "現在の為替レートで外貨残高を自動計算",
    ],
    example: "毎月3万円 × 12ヶ月・1ドル150円 → 約2,400ドル",
    tip: "為替は毎日変動します。毎月一定額を積み立てることで、為替リスクを分散できます（ドルコスト平均法）。",
  },
  dividend: {
    title: "配当カレンダーとは？",
    what: "配当の入金イメージを、サイト内マスター（参考）を使ってブラウザ上で試せるツールです。",
    why: "ログイン中でもこの画面はマイページの登録銘柄とは連動しません。誤解なく「見て試す」体験に寄せています。",
    steps: [
      "初期サンプル銘柄のまま月別の入金イメージを見る",
      "銘柄を入れ替えたり株数を変えて試す",
      "本番の登録・手入力はマイページの配当タブへ",
    ],
    example: "米国株4 + 日本株1 のサンプル → 月別バーと年間合計（円換算は固定レート）を確認",
    tip: "米国株は150円/ドルで概算換算しています。実際の受取額は為替・税・企業の変更で異なります。",
  },
};

const TOOL_EXTRA_DISCLAIMER_BY_ID = {
  nisa: '※ 節税効果はお客様の課税状況・口座の利用状況により異なります。実際の税務については税務署または税理士にご確認ください。',
  lumpvsdca: '※ 本結果は入力値に基づく試算です。実際の運用成果は市場環境・運用タイミングにより大きく異なります。',
  tax: '※ 税額・節税効果はお客様の課税状況・控除内容により異なります。実際の税務については税務署または税理士にご確認ください。',
  currency: '※ 為替レートはリアルタイム参照ですが、将来の為替動向・運用成果を保証するものではありません。円高・円安シナリオはあくまで参考値です。',
  dividend: '※ ツール画面はブラウザ内のサンプル表示です（マイページの登録銘柄とは連動しません）。米国株の円換算は固定レートです。配当予定・金額はサイト内マスターに基づく参考値であり、変更・取消される場合があります。表示金額は税引前です。実際の受取額は課税状況により異なります。',
}

// ═══════════════════════════════════════════════════════════════
//  MAIN HUB (MoneyMart Navbar に統合するためページのみ）
// ═══════════════════════════════════════════════════════════════
export default function ToolsHubPage({ session = null }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile, isTablet } = useResponsiveLayout();
  const [isDark, setIsDark] = useState(() => (
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  ));
  const [showGuideModal, setShowGuideModal] = useState(false);
  const isLoggedIn = Boolean(session?.user?.id);

  const activeTool = useMemo(() => {
    const id = String(searchParams.get("tool") || "").trim();
    if (!id) return null;
    return TOOLS.some((t) => t.id === id) ? id : null;
  }, [searchParams]);

  const tool = TOOLS.find((t) => t.id === activeTool);
  const ToolComponent = tool?.component;
  const activeGuide = TOOL_GUIDES[activeTool] || null;

  const openToolFromList = (id) => {
    setSearchParams({ tool: id }, { replace: false });
  };

  const switchActiveTool = (id) => {
    setSearchParams({ tool: id }, { replace: true });
  };

  const goToToolsHubList = () => {
    setShowGuideModal(false);
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const raw = String(searchParams.get("tool") || "").trim();
    if (raw && !TOOLS.some((t) => t.id === raw)) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const onHubReset = () => {
      setShowGuideModal(false);
      setSearchParams({}, { replace: true });
    };
    window.addEventListener("mm-tools-hub-reset", onHubReset);
    return () => window.removeEventListener("mm-tools-hub-reset", onHubReset);
  }, [setSearchParams]);

  return (
    <>
      <style>{`
        .mm-tools-wrap *, .mm-tools-wrap *::before, .mm-tools-wrap *::after { box-sizing:border-box; }
        .mm-tools-wrap input[type=range]  { -webkit-appearance:none; width:100%; height:8px; border-radius:999px; outline:none; cursor:pointer; }
        .mm-tools-wrap input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:#111827; border:3px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.15); cursor:pointer; transition:transform 0.1s; }
        .mm-tools-wrap input[type=range]::-webkit-slider-thumb:hover { transform:scale(1.2); }
        .mm-tools-wrap input[type=number] { -moz-appearance:textfield; }
        .mm-tools-wrap input[type=number]::-webkit-inner-spin-button { opacity:0; }
        @keyframes mm-fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mm-popIn  { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        @keyframes mm-dividend-pulse {
          0% { transform:scale(1); box-shadow:0 0 0 rgba(34,197,94,0); }
          35% { transform:scale(1.04); box-shadow:0 0 0 6px rgba(34,197,94,0.12); }
          100% { transform:scale(1); box-shadow:0 0 0 rgba(34,197,94,0); }
        }
        .mm-tool-card { cursor:pointer; transition:all 0.2s; }
        .mm-tool-card:hover { transform:translateY(-4px) !important; }
        .mm-tab-btn { cursor:pointer; transition:all 0.15s; }
        .mm-tab-btn:hover { background:#f1f5f9 !important; }
        .mm-tools-shell { max-width: 1200px; margin: 0 auto; }
        .mm-tools-stage-scale { zoom: 1.1; }
        .mm-tools-wrap.mm-tools-dark { background:#020617 !important; color:#e2e8f0 !important; }
        .mm-tools-wrap.mm-tools-dark [style*="background:#fff"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #fff"],
        .mm-tools-wrap.mm-tools-dark [style*="background:#f9fafb"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #f9fafb"],
        .mm-tools-wrap.mm-tools-dark [style*="background:#faf9f6"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #faf9f6"],
        .mm-tools-wrap.mm-tools-dark [style*="background:#fff7ed"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #fff7ed"],
        .mm-tools-wrap.mm-tools-dark [style*="background:#fffbeb"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #fffbeb"],
        .mm-tools-wrap.mm-tools-dark [style*="background:#eff6ff"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #eff6ff"],
        .mm-tools-wrap.mm-tools-dark [style*="background:#faf5ff"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #faf5ff"],
        .mm-tools-wrap.mm-tools-dark [style*="background:#f0fdfa"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #f0fdfa"],
        .mm-tools-wrap.mm-tools-dark [style*="background:#f0fdf4"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #f0fdf4"],
        .mm-tools-wrap.mm-tools-dark [style*="background:#fef2f2"],
        .mm-tools-wrap.mm-tools-dark [style*="background: #fef2f2"] {
          background:#0f172a !important;
        }
        .mm-tools-wrap.mm-tools-dark [style*="color:#111827"],
        .mm-tools-wrap.mm-tools-dark [style*="color: #111827"],
        .mm-tools-wrap.mm-tools-dark [style*="color:#1f2937"],
        .mm-tools-wrap.mm-tools-dark [style*="color: #1f2937"],
        .mm-tools-wrap.mm-tools-dark [style*="color:#374151"],
        .mm-tools-wrap.mm-tools-dark [style*="color: #374151"],
        .mm-tools-wrap.mm-tools-dark [style*="color:#475569"],
        .mm-tools-wrap.mm-tools-dark [style*="color: #475569"],
        .mm-tools-wrap.mm-tools-dark [style*="color:#64748b"],
        .mm-tools-wrap.mm-tools-dark [style*="color: #64748b"] {
          color:#e2e8f0 !important;
        }
        .mm-tools-wrap.mm-tools-dark [style*="#e5e7eb"],
        .mm-tools-wrap.mm-tools-dark [style*="#f1f5f9"],
        .mm-tools-wrap.mm-tools-dark [style*="#fed7aa"],
        .mm-tools-wrap.mm-tools-dark [style*="#fde68a"],
        .mm-tools-wrap.mm-tools-dark [style*="#bfdbfe"],
        .mm-tools-wrap.mm-tools-dark [style*="#e9d5ff"],
        .mm-tools-wrap.mm-tools-dark [style*="#a7f3d0"],
        .mm-tools-wrap.mm-tools-dark [style*="#bbf7d0"],
        .mm-tools-wrap.mm-tools-dark [style*="#fecaca"] {
          border-color:#334155 !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-tab-btn:hover { background:#1e293b !important; }
        .mm-tools-wrap.mm-tools-dark input[type=range]::-webkit-slider-thumb {
          background:#e2e8f0 !important;
          border-color:#0f172a !important;
          box-shadow:0 4px 12px rgba(0,0,0,0.45) !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-tool-landing-tip {
          background:rgba(251, 146, 60, 0.12) !important;
          border-color:rgba(251, 191, 36, 0.35) !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-tool-landing-tip-title { color:#fdba74 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-tool-landing-tip-body { color:#fed7aa !important; }
        .mm-tools-wrap.mm-tools-dark .mm-tool-landing-card {
          background:#0f172a !important;
          box-shadow:0 8px 28px rgba(0,0,0,0.45) !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-tool-landing-card-title { color:#f1f5f9 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-tool-landing-card-desc { color:#94a3b8 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-tool-active-header {
          background:#0f172a !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-tool-active-title { color:#f1f5f9 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-tool-active-sub { color:#94a3b8 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-tool-pill-btn {
          background:#1e293b !important;
          border-color:#334155 !important;
          color:#cbd5e1 !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-tool-help-fab {
          background:#0f172a !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-tool-login-overlay {
          background:rgba(15, 23, 42, 0.88) !important;
          backdrop-filter:blur(4px) !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-tool-login-box {
          background:#0f172a !important;
          border-color:rgba(251, 146, 60, 0.45) !important;
          box-shadow:0 10px 28px rgba(0,0,0,0.5) !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-tool-login-title { color:#fdba74 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-tool-login-body { color:#cbd5e1 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-tool-guide-modal {
          background:#0f172a !important;
          box-shadow:0 28px 80px rgba(0,0,0,0.55) !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-guide-head { color:#f1f5f9 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-guide-close {
          background:#1e293b !important;
          color:#e2e8f0 !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-guide-muted { color:#94a3b8 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-guide-section-label { color:#f87171 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-guide-callout {
          background:#1e293b !important;
          border-color:#334155 !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-guide-callout-text { color:#cbd5e1 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-guide-example {
          background:#1e293b !important;
          border-color:#334155 !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-guide-example-text { color:#cbd5e1 !important; }
        .mm-tools-wrap.mm-tools-dark .mm-guide-tip-box {
          background:rgba(251, 191, 36, 0.1) !important;
          border-color:rgba(251, 191, 36, 0.35) !important;
        }
        .mm-tools-wrap.mm-tools-dark .mm-guide-tip-text { color:#fde68a !important; }
        @media (max-width: 1280px) {
          .mm-tools-stage-scale { zoom: 1; }
        }
        @media (max-width: 960px) {
          .mm-tools-shell { max-width: 100%; }
        }
      `}</style>

      {/* ページ背景はホーム等の Tailwind ページと揃え、全体リデザイン時はここを Layout 一本化する */}
      <div className={`mm-tools-wrap ${isDark ? "mm-tools-dark" : ""}`} style={{ minHeight:"80vh", background:isDark ? "#020617" : "#F8FAFC", fontFamily:UI_FONT, color:isDark ? "#e2e8f0" : "#111827" }}>

        {/* ── ランディング（ツール選択前） ── */}
        {!activeTool && (
          <>
            <div style={{ background:"linear-gradient(135deg,#111827,#1f2937)", padding:"56px 24px 52px" }}>
              <div className="mm-tools-shell">
                <div style={{ fontSize:12, fontWeight:900, color:"#f97316", letterSpacing:"0.12em", marginBottom:12 }}>MONEYMART TOOLS</div>
                <h1 style={{ fontFamily:UI_FONT, fontSize:46, fontWeight:900, color:"#fff", lineHeight:1.18, marginBottom:16 }}>
                  投資計算ツール集<br/>
                  <span style={{ color:"#fbbf24" }}>5種類を無料で</span>
                </h1>
                <p style={{ fontSize:17, color:"#cbd5e1", lineHeight:1.8, maxWidth:780 }}>
                  ツール内容は誰でも閲覧できます。数値を変更して保存・実行するにはログインが必要です。
                </p>
                <div style={{ display:"flex", gap:12, marginTop:24, flexWrap:"wrap" }}>
                  {["無料・会員登録不要", "リアルタイム為替対応", "投資シミュレーション中心"].map(t=>(
                    <div key={t} style={{ fontSize:12, fontWeight:800, color:"#cbd5e1", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:999, padding:"8px 14px" }}>✓ {t}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mm-tools-shell" style={{ padding:"36px 24px 72px" }}>
              <div className="mm-tool-landing-tip" style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:22, padding:"18px 22px", marginBottom:32, display:"flex", alignItems:isMobile ? "flex-start" : "center", flexDirection:isMobile ? "column" : "row", gap:16 }}>
                <span style={{ fontSize:22 }}>💡</span>
                <div>
                  <div className="mm-tool-landing-tip-title" style={{ fontSize:14, fontWeight:900, color:"#9a3412", marginBottom:5 }}>おすすめの使い方</div>
                  <div className="mm-tool-landing-tip-body" style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#c2410c", flexWrap:"wrap" }}>
                    {["⚖️ 積立 vs 一括", "→", "🏦 NISAシミュレーター", "→", "🧾 税金計算機"].map((t,i)=>(
                      <span key={i} style={{ fontWeight:t==="→"?400:700 }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3,1fr)", gap:16 }}>
                {TOOLS.map((t,i)=>(
                  <div key={t.id} className="mm-tool-card mm-tool-landing-card" onClick={()=>openToolFromList(t.id)} style={{
                    background:"#fff", border:`1.5px solid ${t.border}`,
                    borderRadius:26, padding:"30px 28px", position:"relative", overflow:"hidden",
                    boxShadow:isDark ? `0 16px 44px rgba(0,0,0,0.55), 0 0 0 1px ${t.color}22` : `0 12px 36px ${t.color}14, 0 4px 14px rgba(15,23,42,0.05)`,
                    animation:`mm-fadeUp 0.4s ease ${i*0.07}s both`,
                  }}>
                    <div style={{ position:"absolute", top:0, left:0, right:0, height:4, background:`linear-gradient(90deg,${t.color},${t.color}88)` }} aria-hidden />
                    <div style={{ position:"absolute", top:-24, right:-24, width:96, height:96, borderRadius:"50%", background:`${t.color}10` }}/>
                    {t.badge && (
                      <div style={{ position:"absolute", top:18, right:18, background:t.color, color:"#fff", fontSize:10, fontWeight:900, padding:"4px 10px", borderRadius:999 }}>{t.badge}</div>
                    )}
                    <div style={{ fontSize:38, marginBottom:16 }}>{t.icon}</div>
                    <div className="mm-tool-landing-card-title" style={{ fontFamily:UI_FONT, fontSize:21, fontWeight:900, color:"#111827", marginBottom:10, lineHeight:1.4 }}>{t.label}</div>
                    <div className="mm-tool-landing-card-desc" style={{ fontSize:14, color:"#64748b", lineHeight:1.75, marginBottom:18 }}>{t.desc}</div>
                    <div style={{ fontSize:13, fontWeight:900, color:t.color }}>今すぐ使う →</div>
                  </div>
                ))}
              </div>
              <p className="mm-tools-landing-disclaimer" style={{ fontSize:11, color:isDark ? "#94a3b8" : "#64748b", lineHeight:1.65, marginTop:28, maxWidth:720 }}>
                {MM_SIMULATION_PAST_PERFORMANCE_JA}
              </p>
            </div>
          </>
        )}

        {/* ── ツール画面 ── */}
        {activeTool && ToolComponent && (
          <div className="mm-tools-shell mm-tools-stage-scale" style={{ padding:"30px 24px 80px", animation:"mm-popIn 0.3s ease" }}>
            {/* ツールヘッダー */}
            <div className="mm-tool-active-header" style={{ display:"flex", flexDirection:isMobile ? "column" : "row", alignItems:isMobile ? "flex-start" : "center", gap:18, marginBottom:28, background:"#fff", border:`1.5px solid ${tool.border}`, borderRadius:24, padding:"24px 26px", boxShadow:isDark ? `0 18px 48px rgba(0,0,0,0.5), inset 0 4px 0 0 ${tool.color}` : `0 14px 40px ${tool.color}16, 0 4px 16px rgba(15,23,42,0.06), inset 0 4px 0 0 ${tool.color}` }}>
              <div style={{ fontSize:42 }}>{tool.icon}</div>
              <div>
                <div className="mm-tool-active-title" style={{ fontFamily:UI_FONT, fontSize:28, fontWeight:900, color:"#111827", lineHeight:1.3 }}>{tool.label}</div>
                <div className="mm-tool-active-sub" style={{ fontSize:14, color:"#64748b", marginTop:6, lineHeight:1.7 }}>{tool.desc}</div>
              </div>
              {activeGuide && (
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="mm-tool-help-fab"
                  style={{
                    width:54,
                    height:54,
                    minWidth:54,
                    borderRadius:"50%",
                    border:`2px solid ${tool.border}`,
                    background:isDark ? "#0f172a" : "#ffffff",
                    color:tool.color,
                    fontSize:28,
                    fontWeight:900,
                    cursor:"pointer",
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    boxShadow:isDark ? `0 0 0 2px ${tool.color}55, 0 10px 28px rgba(0,0,0,0.45)` : `0 8px 22px ${tool.color}22`,
                  }}
                  aria-label={`${tool.label} の説明を開く`}
                >
                  ?
                </button>
              )}
              <div style={{ marginLeft:isMobile ? 0 : "auto", display:"flex", gap:8, flexWrap:"wrap", width:isMobile ? "100%" : "auto" }}>
                <button
                  type="button"
                  className="mm-tool-pill-btn"
                  onClick={goToToolsHubList}
                  style={{
                    padding:"9px 16px",
                    borderRadius:14,
                    fontSize:12,
                    fontWeight:800,
                    fontFamily:UI_FONT,
                    cursor:"pointer",
                    background:isDark ? "#1e293b" : "#f8fafc",
                    border:`1.5px solid ${isDark ? "#334155" : "#e5e7eb"}`,
                    color:isDark ? "#cbd5e1" : "#475569",
                  }}
                >
                  ← 一覧へ
                </button>
                {TOOLS.filter(t=>t.id!==activeTool).slice(0,3).map(t=>(
                  <button
                    key={t.id}
                    type="button"
                    className="mm-tool-pill-btn"
                    onClick={()=>switchActiveTool(t.id)}
                    style={{
                      padding:"9px 14px",
                      borderRadius:14,
                      fontSize:12,
                      fontWeight:800,
                      fontFamily:UI_FONT,
                      cursor:"pointer",
                      background:isDark ? "#1e293b" : "#f8fafc",
                      border:`1.5px solid ${isDark ? "#334155" : "#e5e7eb"}`,
                      color:isDark ? "#94a3b8" : "#475569",
                      display:"flex",
                      alignItems:"center",
                      gap:6,
                      transition:"all 0.15s",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=t.color;e.currentTarget.style.color=t.color;}}
                    onMouseLeave={e=>{
                      e.currentTarget.style.borderColor = isDark ? "#334155" : "#e5e7eb";
                      e.currentTarget.style.color = isDark ? "#94a3b8" : "#6b7280";
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ position:"relative" }}>
              <ToolComponent session={session} isDark={isDark} />
              {!isLoggedIn && (
                <div className="mm-tool-login-overlay" style={{ position:"absolute", zIndex:30, inset:0, background:isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.78)", backdropFilter:"blur(2.5px)", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
                  <div className="mm-tool-login-box" style={{ maxWidth:440, width:"100%", background:isDark ? "#0f172a" : "#ffffff", border:"1.5px solid #fed7aa", borderRadius:16, padding:"16px 18px", boxShadow:isDark ? "0 10px 28px rgba(0,0,0,0.45)" : "0 10px 24px rgba(15,23,42,0.12)" }}>
                    <p className="mm-tool-login-title" style={{ fontSize:14, fontWeight:900, color:isDark ? "#fdba74" : "#9a3412", marginBottom:6 }}>数値入力・シミュレーション実行はログイン後に利用できます</p>
                    <p className="mm-tool-login-body" style={{ fontSize:12, color:isDark ? "#cbd5e1" : "#7c2d12", lineHeight:1.7, marginBottom:12 }}>ツール内容はこのまま閲覧できます。続ける場合はログインしてください。</p>
                    <button
                      type="button"
                      onClick={() => { navigate('/login', { state: { from: '/tools' } }); window.setTimeout(() => { if (window.location.pathname !== '/login') window.location.assign('/login') }, 120) }}
                      style={{ border:"none", borderRadius:10, background:"#f97316", color:"#fff", fontSize:12, fontWeight:900, padding:"9px 14px", cursor:"pointer", fontFamily:"inherit" }}
                    >
                      ログインして続ける
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="mm-tool-active-disclaimer" style={{ fontSize:11, color:isDark ? "#94a3b8" : "#64748b", lineHeight:1.65, marginTop:22, paddingTop:18, borderTop:`1px solid ${isDark ? "#334155" : "#e5e7eb"}` }}>
              {MM_SIMULATION_PAST_PERFORMANCE_JA}
            </p>
            {activeTool && TOOL_EXTRA_DISCLAIMER_BY_ID[activeTool] ? (
              <p className="mm-tool-active-disclaimer" style={{ fontSize:11, color:isDark ? "#94a3b8" : "#64748b", lineHeight:1.65, marginTop:8 }}>
                {TOOL_EXTRA_DISCLAIMER_BY_ID[activeTool]}
              </p>
            ) : null}
          </div>
        )}

        {activeTool && activeGuide && showGuideModal && tool && (
          <div
            onClick={() => setShowGuideModal(false)}
            style={{
              position:"fixed",
              inset:0,
              zIndex:1200,
              background:"rgba(2,6,23,0.62)",
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              padding:isMobile ? 16 : 24,
            }}
          >
            <div
              className="mm-tool-guide-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                width:"100%",
                maxWidth:820,
                maxHeight:"88vh",
                overflowY:"auto",
                background:"#ffffff",
                borderRadius:36,
                boxShadow:"0 28px 80px rgba(15,23,42,0.28)",
                border:`1.5px solid ${tool.border}`,
              }}
            >
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:isMobile ? "24px 20px 18px" : "30px 34px 20px", borderBottom:`1px solid ${tool.border}` }}>
                <div className="mm-guide-head" style={{ fontSize:isMobile ? 20 : 24, fontWeight:900, color:"#111827", lineHeight:1.35 }}>
                  {activeGuide.title}
                </div>
                <button
                  type="button"
                  className="mm-guide-close"
                  onClick={() => setShowGuideModal(false)}
                  style={{
                    width:56,
                    height:56,
                    minWidth:56,
                    borderRadius:"50%",
                    border:"none",
                    background:"#f3f4f6",
                    color:"#111827",
                    fontSize:26,
                    cursor:"pointer",
                  }}
                  aria-label="説明を閉じる"
                >
                  ×
                </button>
              </div>

              <div style={{ padding:isMobile ? "22px 20px 26px" : "28px 42px 34px", display:"flex", flexDirection:"column", gap:18 }}>
                <div>
                  <div className="mm-guide-section-label" style={{ fontSize:12, fontWeight:900, color:"#dc2626", marginBottom:8 }}>📌 このツールでわかること</div>
                  <div className="mm-guide-muted" style={{ fontSize:isMobile ? 16 : 18, fontWeight:800, color:"#334155", lineHeight:1.9 }}>{activeGuide.what}</div>
                </div>

                <div className="mm-guide-callout" style={{ background:"#f8fafc", border:"1.5px solid #e5e7eb", borderRadius:22, padding:isMobile ? "18px 18px" : "22px 24px" }}>
                  <div style={{ fontSize:12, fontWeight:900, color:"#d97706", marginBottom:10 }}>💡 なぜ使うの？</div>
                  <div className="mm-guide-callout-text" style={{ fontSize:isMobile ? 15 : 17, fontWeight:700, color:"#475569", lineHeight:1.9 }}>{activeGuide.why}</div>
                </div>

                <div>
                  <div style={{ fontSize:12, fontWeight:900, color:tool.color, marginBottom:10 }}>🔢 使い方</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {activeGuide.steps.map((step, idx) => (
                      <div key={step} style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                        <div style={{
                          width:34,
                          height:34,
                          minWidth:34,
                          borderRadius:"50%",
                          background:tool.color,
                          color:"#fff",
                          fontSize:18,
                          fontWeight:900,
                          display:"flex",
                          alignItems:"center",
                          justifyContent:"center",
                          marginTop:1,
                        }}>
                          {idx + 1}
                        </div>
                        <div className="mm-guide-muted" style={{ fontSize:isMobile ? 16 : 17, fontWeight:800, color:"#334155", lineHeight:1.8 }}>{step}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mm-guide-example" style={{ background:tool.bg, border:`1.5px solid ${tool.border}`, borderRadius:22, padding:isMobile ? "18px 18px" : "20px 22px" }}>
                  <div style={{ fontSize:12, fontWeight:900, color:tool.color, marginBottom:8 }}>📊 計算例</div>
                  <div className="mm-guide-example-text" style={{ fontSize:isMobile ? 16 : 17, fontWeight:800, color:"#334155", lineHeight:1.8 }}>{activeGuide.example}</div>
                </div>

                <div className="mm-guide-tip-box" style={{ background:"#fffdf2", border:"1.5px solid #fde68a", borderRadius:22, padding:isMobile ? "18px 18px" : "20px 22px" }}>
                  <div className="mm-guide-tip-text" style={{ fontSize:isMobile ? 15 : 16, fontWeight:800, color:"#92400e", lineHeight:1.9 }}>
                    ⭐ {activeGuide.tip}
                  </div>
                </div>

                <p className="mm-guide-disclaimer" style={{ fontSize:12, fontWeight:700, color:"#64748b", lineHeight:1.65, margin:0, paddingTop:4, borderTop:"1px solid #e5e7eb" }}>
                  {MM_SIMULATION_PAST_PERFORMANCE_JA}
                </p>
                {activeTool && TOOL_EXTRA_DISCLAIMER_BY_ID[activeTool] ? (
                  <p className="mm-guide-disclaimer" style={{ fontSize:12, fontWeight:700, color:"#64748b", lineHeight:1.65, margin:0, marginTop:6 }}>
                    {TOOL_EXTRA_DISCLAIMER_BY_ID[activeTool]}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
