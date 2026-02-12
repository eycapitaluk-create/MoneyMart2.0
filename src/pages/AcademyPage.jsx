import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Play, BookOpen, GraduationCap,
  ChevronRight, CheckCircle2, Award, Youtube, Loader2
} from 'lucide-react'
import AdBanner from '../components/AdBanner'
import { LEGAL_NOTICE_TEMPLATES } from '../constants/legalNoticeTemplates'
import { fetchPublishedAcademyCourses } from '../lib/academyApi'

const FEATURED_VIDEO = {
  id: 'f1',
  title: '【徹底解説】新NISA、初心者はこれを買え！失敗しない銘柄選び',
  tutor: 'MoneyMart 公式チャンネル',
  views: '12.5万回視聴',
  duration: '15:24',
  tags: ['新NISA', '初心者向け', '投資信託'],
  thumbnail: 'bg-gradient-to-r from-blue-600 to-indigo-700',
  youtubeUrl: 'https://www.youtube.com/watch?v=mmAcademy001',
}

const VIDEO_CATEGORIES = [
  {
    id: 'beginner',
    title: '🐣 投資1年生のための基礎講座',
    videos: [
      { id: 1, title: '株と債券の違いとは？', time: '08:30', level: '初級', img: 'bg-emerald-500', youtubeUrl: 'https://www.youtube.com/watch?v=mmAcademy101' },
      { id: 2, title: '複利効果で資産を倍にする方法', time: '12:45', level: '初級', img: 'bg-teal-500', youtubeUrl: 'https://www.youtube.com/watch?v=mmAcademy102' },
      { id: 3, title: 'iDeCoの節税メリット', time: '10:15', level: '初級', img: 'bg-cyan-500', youtubeUrl: 'https://www.youtube.com/watch?v=mmAcademy103' },
    ],
  },
  {
    id: 'analysis',
    title: '📊 チャート分析・テクニカル',
    videos: [
      { id: 4, title: '移動平均線のゴールデンクロス', time: '18:20', level: '中級', img: 'bg-orange-500', youtubeUrl: 'https://www.youtube.com/watch?v=mmAcademy201' },
      { id: 5, title: 'MACDを使った売買タイミング', time: '14:10', level: '中級', img: 'bg-amber-500', youtubeUrl: 'https://www.youtube.com/watch?v=mmAcademy202' },
      { id: 6, title: 'ボリンジャーバンド完全攻略', time: '22:00', level: '上級', img: 'bg-red-500', youtubeUrl: 'https://www.youtube.com/watch?v=mmAcademy203' },
    ],
  },
]

const TERM_OF_DAY = {
  word: 'PER (株価収益率)',
  reading: 'ピーイーアール / Price Earnings Ratio',
  desc: '株価が1株当たり純利益の何倍まで買われているかを見る指標。一般的に15倍以下だと割安とされる。',
  example: '「A社のPERは10倍なので、同業他社より割安だ」',
}

const CATEGORY_META = {
  beginner: { title: '🐣 投資1年生のための基礎講座' },
  analysis: { title: '📊 チャート分析・テクニカル' },
  general: { title: '📘 投資リテラシー講座' },
}

const formatDuration = (seconds = 0) => {
  const safe = Math.max(0, Number(seconds || 0))
  const mm = Math.floor(safe / 60)
  const ss = safe % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

const formatViewsJa = (views = 0) => {
  const n = Number(views || 0)
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万回視聴`
  return `${n.toLocaleString()}回視聴`
}

const openYoutube = (url) => {
  const safeUrl = String(url || '').trim()
  if (!safeUrl) return
  window.open(safeUrl, '_blank', 'noopener,noreferrer')
}

export default function AcademyPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [featuredVideo, setFeaturedVideo] = useState(FEATURED_VIDEO)
  const [videoCategories, setVideoCategories] = useState(VIDEO_CATEGORIES)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogSource, setCatalogSource] = useState('fallback')

  useEffect(() => {
    let alive = true
    const loadAcademyCatalog = async () => {
      setCatalogLoading(true)
      try {
        const courses = await fetchPublishedAcademyCourses()
        if (!alive) return

        if (!Array.isArray(courses) || courses.length === 0) {
          setFeaturedVideo(FEATURED_VIDEO)
          setVideoCategories(VIDEO_CATEGORIES)
          setCatalogSource('fallback')
          return
        }

        const featured = courses.find((c) => c.isFeatured) || courses[0]
        const grouped = new Map()
        for (const row of courses) {
          const key = row.categoryKey || 'general'
          if (!grouped.has(key)) grouped.set(key, [])
          grouped.get(key).push({
            id: row.id,
            title: row.title,
            time: formatDuration(row.durationSeconds || 0),
            level: row.level || '初級',
            img: row.thumbnailStyle || 'bg-slate-500',
            youtubeUrl: row.youtubeUrl || '',
          })
        }

        const categories = Array.from(grouped.entries()).map(([id, videos]) => ({
          id,
          title: CATEGORY_META[id]?.title || CATEGORY_META.general.title,
          videos,
        }))

        setFeaturedVideo({
          id: featured.id,
          title: featured.title,
          tutor: featured.tutorName || 'MoneyMart Academy',
          views: formatViewsJa(featured.viewCount || 0),
          duration: formatDuration(featured.durationSeconds || 0),
          tags: (featured.tags || []).slice(0, 4),
          thumbnail: featured.thumbnailStyle || 'bg-gradient-to-r from-blue-600 to-indigo-700',
          youtubeUrl: featured.youtubeUrl || '',
        })
        setVideoCategories(categories)
        setCatalogSource('live')
      } catch {
        if (!alive) return
        setFeaturedVideo(FEATURED_VIDEO)
        setVideoCategories(VIDEO_CATEGORIES)
        setCatalogSource('fallback')
      } finally {
        if (alive) setCatalogLoading(false)
      }
    }

    loadAcademyCatalog()
    return () => {
      alive = false
    }
  }, [])

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return videoCategories
      .filter((category) => activeTab === 'all' || category.id === activeTab)
      .map((category) => ({
        ...category,
        videos: category.videos.filter((video) => {
          if (!query) return true
          const target = `${video.title} ${video.level}`.toLowerCase()
          return target.includes(query)
        }),
      }))
      .filter((category) => category.videos.length > 0)
  }, [activeTab, searchQuery, videoCategories])

  const tabOptions = useMemo(() => ([
    { id: 'all', label: 'すべて' },
    ...videoCategories.map((c) => ({ id: c.id, label: c.id === 'beginner' ? '基礎講座' : c.id === 'analysis' ? '分析講座' : '一般講座' })),
  ]), [videoCategories])

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 pb-20 font-sans">
      {/* 1. Header & Hero Section */}
      <div className="bg-slate-900 pt-6 pb-20 px-4 rounded-b-[3rem] relative overflow-hidden shadow-2xl">
        <nav className="flex justify-between items-center mb-8 max-w-7xl mx-auto">
          <h1 className="text-lg font-bold text-white">アカデミー</h1>
          <button
            onClick={() => navigate('/mypage')}
            className="bg-white/10 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-white/20 transition"
          >
            マイページ
          </button>
        </nav>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
            お金の知識が、<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400">
              未来の資産
            </span>
            になる。
          </h2>
          <p className="text-slate-400 font-medium mb-8">
            動画で学ぶ、クイズで試す。最短で投資家デビュー。
          </p>

          <div className="relative max-w-lg mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="何を学びたいですか？ (例: NISA, チャート分析...)"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 shadow-xl text-slate-900 dark:text-white font-bold outline-none focus:ring-4 focus:ring-orange-500/30 transition placeholder-slate-400"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          </div>
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
              catalogSource === 'live'
                ? 'text-emerald-300 bg-emerald-500/20 border border-emerald-400/30'
                : 'text-amber-300 bg-amber-500/20 border border-amber-400/30'
            }`}>
              <GraduationCap size={12} />
              Data: {catalogSource === 'live' ? 'LIVE' : 'FALLBACK'}
            </span>
          </div>
        </div>

        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-50" />
      </div>

      {/* 2. Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 -mt-10 relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* [Left Column] Video Content */}
        <div className="lg:col-span-8 space-y-10">
          <div className="flex flex-wrap gap-2 px-1">
            {tabOptions.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-orange-500 dark:border-orange-500'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {catalogLoading ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" /> 講座データを読み込み中...
            </div>
          ) : null}

          <div
            className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-800 group cursor-pointer hover:shadow-2xl transition"
            onClick={() => openYoutube(featuredVideo.youtubeUrl)}
          >
            <div className={`aspect-video rounded-2xl ${featuredVideo.thumbnail} relative flex items-center justify-center mb-4 overflow-hidden`}>
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition duration-300">
                <Play className="text-white fill-white ml-1" size={32} />
              </div>
              <span className="absolute bottom-4 right-4 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">
                {featuredVideo.duration}
              </span>
              <span className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded tracking-wider flex items-center gap-1">
                <Youtube size={12} /> 公式
              </span>
            </div>
            <div className="px-2">
              <div className="flex gap-2 mb-2">
                {featuredVideo.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-orange-500 transition">
                {featuredVideo.title}
              </h3>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>{featuredVideo.tutor}</span>
                <span>{featuredVideo.views}</span>
              </div>
            </div>
          </div>

          {filteredCategories.map((category) => (
            <div key={category.id}>
              <div className="flex justify-between items-end mb-4 px-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{category.title}</h3>
                <button className="text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1">
                  すべて見る <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {category.videos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => openYoutube(video.youtubeUrl)}
                    className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition cursor-pointer group"
                  >
                    <div className={`aspect-video rounded-xl ${video.img} relative mb-3 flex items-center justify-center`}>
                      <Play className="text-white/80 fill-white opacity-0 group-hover:opacity-100 transition transform scale-75 group-hover:scale-100" size={32} />
                      <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {video.time}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 leading-snug mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-orange-500">
                      {video.title}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${video.level === '初級' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : video.level === '中級' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}
                    >
                      {video.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
              該当する講座が見つかりませんでした。
            </div>
          ) : null}
        </div>

        {/* [Right Column] Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <AdBanner variant="vertical" className="lg:sticky lg:top-24" />

          <div className="bg-gradient-to-br from-indigo-900 to-slate-800 text-white p-6 rounded-[2rem] shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4 text-indigo-300 font-bold text-xs uppercase tracking-widest">
                <BookOpen size={16} /> 今日の用語
              </div>
              <h3 className="text-2xl font-black mb-1">{TERM_OF_DAY.word}</h3>
              <p className="text-xs text-slate-400 mb-4 font-mono">{TERM_OF_DAY.reading}</p>
              <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm mb-4">
                <p className="text-sm font-medium leading-relaxed opacity-90">{TERM_OF_DAY.desc}</p>
              </div>
              <div className="flex items-start gap-2 text-xs text-indigo-200 italic">
                <span className="font-black">Ex.</span>
                &quot;{TERM_OF_DAY.example}&quot;
              </div>
            </div>
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl" />
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white">学習レベル</h3>
              <span className="text-xs font-black text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full">
                Lv.3 初級
              </span>
            </div>
            <div className="flex justify-center mb-6">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="#f1f5f9" strokeWidth="12" fill="none" className="dark:stroke-slate-700" />
                  <circle cx="64" cy="64" r="56" stroke="#f97316" strokeWidth="12" fill="none" strokeDasharray="351" strokeDashoffset="100" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">
                    72<span className="text-sm">%</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">次のレベルまで</span>
                </div>
              </div>
            </div>
            <button className="w-full py-3 bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-slate-600 transition">
              <CheckCircle2 size={16} /> 今日のクイズに挑戦
            </button>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-[2rem] border border-orange-100 dark:border-orange-900/50 text-center">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Award size={24} />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-2">プレミアム会員限定</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              プロ投資家による<br />
              特別講義動画が見放題になります。
            </p>
            <button
              onClick={() => navigate('/prime')}
              className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 underline"
            >
              詳細を見る
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          {LEGAL_NOTICE_TEMPLATES.investment}
        </p>
      </div>
    </div>
  )
}
