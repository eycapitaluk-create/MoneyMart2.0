import { useState, useEffect, useMemo } from 'react'
import { ExternalLink, Flame, Search, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'

const SENTIMENT_CONFIG = {
  '強気': { label: '強気', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: TrendingUp },
  '弱気': { label: '弱気', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: TrendingDown },
  '中立': { label: '中立', color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', icon: Minus },
}

const MARKET_TABS = [
  { id: 'all', label: 'すべて', flag: '' },
  { id: 'us',  label: '米国',   flag: '🇺🇸' },
  { id: 'jp',  label: '日本',   flag: '🇯🇵' },
  { id: 'eu',  label: '欧州',   flag: '🇪🇺' },
]

const SECTOR_LIST = ['すべて', '半導体', 'テック', '金融', '自動車', 'ヘルスケア', '通信', 'エネルギー']

const SentimentBadge = ({ sentiment }) => {
  const cfg = SENTIMENT_CONFIG[sentiment] || SENTIMENT_CONFIG['中立']
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <Icon size={10} />{cfg.label}
    </span>
  )
}

const NewsCard = ({ item }) => {
  const isSummarized = item.summary &&
    !item.reason?.includes('短縮表示') &&
    item.summary.length < 250 &&
    !/^http/.test(item.summary)

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
      item.is_hot ? 'border-orange-300 dark:border-orange-700' : 'border-slate-200 dark:border-slate-700'
    }`}>
      {item.is_hot && <div className="h-1 bg-gradient-to-r from-orange-400 to-red-400" />}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm">{item.flag || '🌐'}</span>
            <span className="font-black text-sm text-slate-900 dark:text-white">{item.ticker}</span>
            <span className="text-xs text-slate-400">{item.company_name}</span>
            {item.is_hot && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 text-[10px] font-black border border-orange-200 dark:border-orange-700">
                <Flame size={10} />HOT
              </span>
            )}
            <SentimentBadge sentiment={item.sentiment} />
          </div>
          <span className="text-[10px] text-slate-400 shrink-0">{item.time_text}</span>
        </div>

        {/* Source & Sector */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-slate-400">{item.source}</span>
          {item.sector && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {item.sector}
            </span>
          )}
        </div>

        {/* Headline */}
        <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-3 line-clamp-2">{item.headline}</p>

        {/* AI Summary */}
        <div className={`rounded-xl border p-3 mb-3 ${
          isSummarized
            ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30'
            : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'
        }`}>
          <p className="text-[10px] font-black text-slate-400 mb-1">AI要約</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
            {isSummarized ? item.summary : (item.reason || '要約を生成中です...')}
          </p>
        </div>

        {/* Impact & Reason */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {item.impact && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2">
              <p className="text-[10px] font-black text-slate-400 mb-0.5">投資インパクト</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">{item.impact}</p>
            </div>
          )}
          {item.reason && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2">
              <p className="text-[10px] font-black text-slate-400 mb-0.5">判断根拠</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">{item.reason}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <a href={`/stocks?symbol=${item.ticker}`}
            className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition">
            株式詳細へ
          </a>
          {item.source_url && (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-500 transition">
              原文を見る <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewsPage() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeMarket, setActiveMarket] = useState('all')
  const [activeSector, setActiveSector] = useState('すべて')
  const [activeSentiment, setActiveSentiment] = useState('すべて')
  const [searchQuery, setSearchQuery] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchNews = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ai_news_summaries')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(200)
      if (!error && data) {
        setNews(data)
        setLastUpdated(new Date())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchNews() }, [])

  const stats = useMemo(() => ({
    total: news.length,
    bullish: news.filter((n) => n.sentiment === '強気').length,
    bearish: news.filter((n) => n.sentiment === '弱気').length,
    neutral: news.filter((n) => n.sentiment === '中立').length,
  }), [news])

  const hotNews = useMemo(() => news.filter((n) => n.is_hot), [news])

  const filtered = useMemo(() => news.filter((item) => {
    if (activeMarket !== 'all' && item.market !== activeMarket) return false
    if (activeSector !== 'すべて' && item.sector !== activeSector) return false
    if (activeSentiment !== 'すべて' && item.sentiment !== activeSentiment) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        item.ticker?.toLowerCase().includes(q) ||
        item.company_name?.toLowerCase().includes(q) ||
        item.headline?.toLowerCase().includes(q)
      )
    }
    return true
  }), [news, activeMarket, activeSector, activeSentiment, searchQuery])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] pb-20 font-sans">
      <div className="max-w-[1200px] mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">AIニュース</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">銘柄ニュースをAIが要約・センチメント分析</p>
            {lastUpdated && (
              <p className="text-[11px] text-slate-400 mt-0.5">最終更新: {lastUpdated.toLocaleString('ja-JP')}</p>
            )}
          </div>
          <button onClick={() => fetchNews(true)} disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-600 dark:text-slate-300 hover:border-orange-400 hover:text-orange-500 transition disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />更新
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: '総記事数', value: stats.total, color: 'text-slate-900 dark:text-white' },
            { label: '強気', value: stats.bullish, color: 'text-red-500' },
            { label: '弱気', value: stats.bearish, color: 'text-blue-500' },
            { label: '中立', value: stats.neutral, color: 'text-slate-500' },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 text-center shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{loading ? '--' : s.value}</p>
            </div>
          ))}
        </div>

        {/* HOT Ticker */}
        {hotNews.length > 0 && (
          <div className="bg-slate-900 dark:bg-black text-white rounded-2xl border border-slate-700 overflow-hidden mb-5">
            <div className="py-3 overflow-hidden whitespace-nowrap">
              <div className="inline-flex animate-ticker-market items-center gap-10 pl-4 min-w-max">
                {[...hotNews, ...hotNews].map((item, i) => (
                  <span key={`${item.id}-${i}`} className="flex items-center gap-2 text-xs shrink-0">
                    <span className="text-orange-400 font-black">{item.flag} {item.ticker}</span>
                    <span className="text-slate-200">{item.headline?.slice(0, 50)}{item.headline?.length > 50 ? '...' : ''}</span>
                    <SentimentBadge sentiment={item.sentiment} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Sidebar Filters */}
          <div className="lg:col-span-3 space-y-3">
            <div className="relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="銘柄・キーワード検索"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-sm font-medium focus:border-orange-400 outline-none transition" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">マーケット</p>
              {MARKET_TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveMarket(tab.id)}
                  className={`w-full flex justify-between items-center px-3 py-2 rounded-xl text-sm font-bold transition mb-0.5 ${
                    activeMarket === tab.id ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                  <span>{tab.flag} {tab.label}</span>
                  <span className={`text-[11px] ${activeMarket === tab.id ? 'opacity-70' : 'text-slate-400'}`}>
                    {tab.id === 'all' ? news.length : news.filter((n) => n.market === tab.id).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">センチメント</p>
              {['すべて', '強気', '中立', '弱気'].map((s) => {
                const cfg = SENTIMENT_CONFIG[s]
                return (
                  <button key={s} onClick={() => setActiveSentiment(s)}
                    className={`w-full flex justify-between items-center px-3 py-2 rounded-xl text-sm font-bold transition mb-0.5 ${
                      activeSentiment === s ? 'bg-orange-500 text-white' : `text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 ${cfg?.color || ''}`
                    }`}>
                    <span>{s}</span>
                    <span className={`text-[11px] ${activeSentiment === s ? 'opacity-70' : 'text-slate-400'}`}>
                      {s === 'すべて' ? news.length : news.filter((n) => n.sentiment === s).length}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">セクター</p>
              {SECTOR_LIST.map((s) => (
                <button key={s} onClick={() => setActiveSector(s)}
                  className={`w-full flex justify-between items-center px-3 py-2 rounded-xl text-sm font-bold transition mb-0.5 ${
                    activeSector === s ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}>
                  <span>{s}</span>
                  <span className={`text-[11px] ${activeSector === s ? 'opacity-70' : 'text-slate-400'}`}>
                    {s === 'すべて' ? news.length : news.filter((n) => n.sector === s).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* News Grid */}
          <div className="lg:col-span-9">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{filtered.length}件 表示中</p>
              {(activeMarket !== 'all' || activeSector !== 'すべて' || activeSentiment !== 'すべて' || searchQuery) && (
                <button onClick={() => { setActiveMarket('all'); setActiveSector('すべて'); setActiveSentiment('すべて'); setSearchQuery('') }}
                  className="text-xs font-bold text-orange-500 hover:underline">フィルターをリセット</button>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded mb-3 w-1/3" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                    <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl mt-3" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-slate-500 font-bold">該当するニュースがありません</p>
                <button onClick={() => { setActiveMarket('all'); setActiveSector('すべて'); setActiveSentiment('すべて'); setSearchQuery('') }}
                  className="mt-3 text-sm font-bold text-orange-500 hover:underline">フィルターをリセット</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((item) => <NewsCard key={item.id} item={item} />)}
              </div>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-8 leading-relaxed">{LEGAL_NOTICE_TEMPLATES.investment}</p>
      </div>
    </div>
  )
}
