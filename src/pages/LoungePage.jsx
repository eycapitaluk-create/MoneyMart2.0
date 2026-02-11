import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Bell, MessageCircle, ThumbsUp,
  TrendingUp, TrendingDown, MoreHorizontal, Share2,
  Flame, Hash, User, CheckCircle2,
  BarChart2, ArrowUpRight, Award
} from 'lucide-react'

const LoungeStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');
    body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
    .hide-scrollbar::-webkit-scrollbar { display: none; }
  `}</style>
)

const TRENDING_TAGS = [
  { id: 1, tag: 'NVDA', name: 'NVIDIA', count: 1240, trend: 'up' },
  { id: 2, tag: '7203', name: 'トヨタ自動車', count: 856, trend: 'up' },
  { id: 3, tag: 'eMAXIS', name: 'オルカン', count: 620, trend: 'neutral' },
  { id: 4, tag: 'BTC', name: 'Bitcoin', count: 580, trend: 'down' },
]

const POSTS = [
  {
    id: 1,
    user: { name: 'Kenji_Invest', level: 'Pro', badge: true, avatar: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    time: '10分前',
    tag: { code: 'NVDA', name: 'NVIDIA', type: 'US' },
    sentiment: 'bullish',
    title: 'NVIDIAの決算、予想を遥かに超えてきましたね',
    content: 'データセンター売上が前年比+400%。これはまだ初動かもしれません。押し目買い推奨です。',
    stats: { likes: 142, comments: 24, views: '1.2k' },
    chart: true,
  },
  {
    id: 2,
    user: { name: 'Momo_Savings', level: 'Beginner', badge: false, avatar: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' },
    time: '25分前',
    tag: { code: 'eMAXIS', name: 'Slim 全世界株式', type: 'Fund' },
    sentiment: 'neutral',
    title: '新NISAの積立枠、満額使い切るべき？',
    content: '現在月5万円積み立てていますが、ボーナス月で増額するか迷っています。皆さんの設定を教えてください。',
    stats: { likes: 56, comments: 89, views: '890' },
    chart: false,
  },
  {
    id: 3,
    user: { name: 'Tanaka_FX', level: 'Expert', badge: true, avatar: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
    time: '1時間前',
    tag: { code: 'USD/JPY', name: '米ドル/円', type: 'FX' },
    sentiment: 'bearish',
    title: '日銀の介入警戒感、152円台は重い展開か',
    content: 'チャート的にもダブルトップ形成中。一度調整が入ると見てショートポジション積み増し中。',
    stats: { likes: 89, comments: 12, views: '2.5k' },
    chart: true,
  },
]

export default function LoungePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('popular')

  return (
    <div className="min-h-screen pb-20 bg-[#F8FAFC] dark:bg-slate-950">
      <LoungeStyles />

      {/* 1. Header */}
      <nav className="sticky top-16 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-14 px-4 lg:px-8 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">ラウンジ</h1>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 items-center gap-2 w-64">
            <Search size={16} className="text-slate-400" />
            <input type="text" placeholder="キーワード、銘柄検索" className="bg-transparent text-sm font-bold outline-none w-full text-slate-700 dark:text-slate-200 placeholder-slate-400" />
          </div>
          <button className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <Bell size={20} />
          </button>
          <button onClick={() => navigate('/login')} className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
            MK
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 2. Left Sidebar */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <div className="w-20 h-20 mx-auto bg-slate-900 dark:bg-slate-700 text-white rounded-full flex items-center justify-center text-2xl font-black mb-3">MK</div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Minsoo Kim</h3>
            <p className="text-xs text-slate-400 font-bold mb-4">Level 3. Investor</p>
            <div className="flex justify-center gap-4 text-center border-t border-slate-100 dark:border-slate-800 pt-4">
              <div>
                <p className="font-black text-lg text-slate-900 dark:text-white">12</p>
                <p className="text-xs text-slate-400">Posts</p>
              </div>
              <div>
                <p className="font-black text-lg text-slate-900 dark:text-white">1.4k</p>
                <p className="text-xs text-slate-400">Followers</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {[
              { icon: Flame, label: '人気トピック', id: 'popular' },
              { icon: MessageCircle, label: '最新の投稿', id: 'new' },
              { icon: User, label: 'フォロー中', id: 'following' },
              { icon: Hash, label: '保存済み', id: 'saved' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-4 font-bold text-sm transition ${activeTab === item.id ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-l-4 border-orange-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <item.icon size={18} /> {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Main Feed */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0">MK</div>
            <div className="flex-1">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm text-slate-400 font-medium cursor-text hover:bg-slate-100 dark:hover:bg-slate-700 transition mb-3">
                投資に関する考えをシェアしよう...
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <button className="p-2 text-slate-400 hover:text-blue-500 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <BarChart2 size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-green-500 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <TrendingUp size={18} />
                  </button>
                </div>
                <button className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white font-bold text-sm rounded-lg hover:bg-black dark:hover:bg-slate-600 transition">
                  投稿する
                </button>
              </div>
            </div>
          </div>

          <div className="flex lg:hidden overflow-x-auto gap-2 pb-2 scrollbar-hide">
            {['人気', '最新', 'フォロー', '米国株', '日本株', '仮想通貨'].map((tab, i) => (
              <button key={i} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${i === 0 ? 'bg-slate-900 dark:bg-slate-700 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {tab}
              </button>
            ))}
          </div>

          {POSTS.map((post) => (
            <div key={post.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition group cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${post.user.avatar}`}>
                    {post.user.name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{post.user.name}</span>
                      {post.user.badge && <CheckCircle2 size={14} className="text-blue-500 fill-blue-50 dark:fill-blue-900/30" />}
                    </div>
                    <p className="text-xs text-slate-400 font-medium">{post.time} • {post.user.level}</p>
                  </div>
                </div>
                <button className="text-slate-300 hover:text-slate-600 dark:hover:text-slate-400">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-300 transition">
                  <span className="text-slate-400">$</span> {post.tag.code}
                </span>
                {post.sentiment === 'bullish' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/50">
                    <TrendingUp size={12} /> 買い (Bullish)
                  </span>
                )}
                {post.sentiment === 'bearish' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50">
                    <TrendingDown size={12} /> 売り (Bearish)
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-500 transition">
                {post.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {post.content}
              </p>

              {post.chart && (
                <div className="h-40 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 mb-4 flex items-center justify-center">
                  <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <BarChart2 size={16} /> Chart Visualization Area
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                <div className="flex gap-6">
                  <button className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 text-xs font-bold transition">
                    <ThumbsUp size={16} /> {post.stats.likes}
                  </button>
                  <button className="flex items-center gap-1.5 text-slate-400 hover:text-blue-500 text-xs font-bold transition">
                    <MessageCircle size={16} /> {post.stats.comments}
                  </button>
                  <button className="flex items-center gap-1.5 text-slate-400 hover:text-green-500 text-xs font-bold transition">
                    <Share2 size={16} /> Share
                  </button>
                </div>
                <span className="text-xs font-bold text-slate-300 dark:text-slate-500">{post.stats.views} Views</span>
              </div>
            </div>
          ))}
        </div>

        {/* 4. Right Sidebar */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Flame size={18} className="text-orange-500" /> 話題の銘柄
            </h3>
            <div className="space-y-4">
              {TRENDING_TAGS.map((item, i) => (
                <div key={item.id} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-300 dark:text-slate-600 w-4">{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-orange-500">{item.tag}</p>
                      <p className="text-[10px] text-slate-400">{item.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs font-bold text-slate-600 dark:text-slate-400">{item.count} posts</span>
                    {item.trend === 'up' && <span className="text-[10px] text-red-500 font-bold flex items-center justify-end gap-0.5"><TrendingUp size={10} /> 急増</span>}
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              ランキングをもっと見る
            </button>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-1">Pro Insight</h3>
              <p className="text-xs text-slate-400 mb-4">機関投資家の動きを分析した<br />特別レポートを公開中。</p>
              <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-bold transition flex items-center gap-1">
                レポートを読む <ArrowUpRight size={12} />
              </button>
            </div>
            <Award size={80} className="absolute -right-4 -bottom-4 text-white/10 rotate-12" />
          </div>
        </div>
      </main>
    </div>
  )
}
