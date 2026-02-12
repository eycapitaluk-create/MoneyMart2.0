import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Bell, MessageCircle, ThumbsUp, Bookmark,
  TrendingUp, TrendingDown, Share2, Flame, Hash,
  Send, UserPlus, UserMinus, AlertTriangle, Loader2, User
} from 'lucide-react'
import {
  createComment,
  createPost,
  fetchComments,
  getCurrentLoungeUser,
  fetchFeed,
  fetchNotifications,
  fetchTrendingTags,
  markNotificationRead,
  submitReport,
  toggleBookmark,
  toggleFollow,
  toggleLike,
} from '../lib/loungeApi'

const LoungeStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');
    body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
    .hide-scrollbar::-webkit-scrollbar { display: none; }
  `}</style>
)

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}時間前`
  return `${Math.floor(hour / 24)}日前`
}

export default function LoungePage({ bootUser = undefined, authReady = false }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('popular')
  const [search, setSearch] = useState('')
  const [posts, setPosts] = useState([])
  const [trendingTags, setTrendingTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState(undefined)
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [expandedComments, setExpandedComments] = useState({})
  const [commentInputs, setCommentInputs] = useState({})
  const [commentsByPost, setCommentsByPost] = useState({})
  const [composer, setComposer] = useState({
    title: '',
    content: '',
    ticker: '',
    assetType: 'general',
    sentiment: 'neutral',
    tags: '',
  })
  const [busyPostId, setBusyPostId] = useState('')
  const [posting, setPosting] = useState(false)
  useEffect(() => {
    if (!authReady) return
    setUser(bootUser ?? null)
  }, [authReady, bootUser?.id, bootUser?.displayName])


  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  )

  const loadFeed = async (tab = activeTab, keyword = search, resolvedUser = user) => {
    setIsLoading(true)
    setError('')
    try {
      const currentUser = resolvedUser !== undefined ? resolvedUser : await getCurrentLoungeUser()
      const tags = await fetchTrendingTags()
      setUser(currentUser)
      const feed = await fetchFeed({ tab, search: keyword, userId: currentUser?.id || null })
      setPosts(feed)
      setTrendingTags(tags)
      if (currentUser?.id) {
        const notif = await fetchNotifications(currentUser.id)
        setNotifications(notif)
      } else {
        setNotifications([])
      }
    } catch (err) {
      setError(err?.message || 'ラウンジデータの読み込みに失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!authReady) return
    loadFeed(activeTab, search, user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id, authReady])

  const requireAuth = () => {
    if (user === undefined) return false
    if (user?.id) return true
    alert('ログイン後に利用できます。')
    navigate('/login')
    return false
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    loadFeed(activeTab, search)
  }

  const handlePostSubmit = async () => {
    if (!requireAuth()) return
    if (!composer.title.trim() || !composer.content.trim()) {
      alert('タイトルと本文を入力してください。')
      return
    }
    setPosting(true)
    try {
      await createPost({
        userId: user.id,
        title: composer.title.trim(),
        content: composer.content.trim(),
        ticker: composer.ticker.trim(),
        assetType: composer.assetType,
        sentiment: composer.sentiment,
        tags: composer.tags.split(',').map((v) => v.trim()).filter(Boolean),
      })
      setComposer({
        title: '',
        content: '',
        ticker: '',
        assetType: 'general',
        sentiment: 'neutral',
        tags: '',
      })
      await loadFeed(activeTab, search)
    } catch (err) {
      alert(err?.message || '投稿に失敗しました。')
    } finally {
      setPosting(false)
    }
  }

  const handleToggleLike = async (postId) => {
    if (!requireAuth()) return
    setBusyPostId(postId)
    const prev = posts
    setPosts((old) => old.map((p) => {
      if (p.id !== postId) return p
      const nextLiked = !p.isLiked
      return {
        ...p,
        isLiked: nextLiked,
        like_count: Math.max(0, p.like_count + (nextLiked ? 1 : -1)),
      }
    }))
    try {
      await toggleLike({ postId, userId: user.id })
      await loadFeed(activeTab, search)
    } catch {
      setPosts(prev)
      alert('いいね処理に失敗しました。')
    } finally {
      setBusyPostId('')
    }
  }

  const handleToggleBookmark = async (postId) => {
    if (!requireAuth()) return
    setBusyPostId(postId)
    const prev = posts
    setPosts((old) => old.map((p) => {
      if (p.id !== postId) return p
      const nextSaved = !p.isBookmarked
      return {
        ...p,
        isBookmarked: nextSaved,
        bookmark_count: Math.max(0, p.bookmark_count + (nextSaved ? 1 : -1)),
      }
    }))
    try {
      await toggleBookmark({ postId, userId: user.id })
      await loadFeed(activeTab, search)
    } catch {
      setPosts(prev)
      alert('保存処理に失敗しました。')
    } finally {
      setBusyPostId('')
    }
  }

  const handleToggleFollow = async (authorId) => {
    if (!requireAuth()) return
    if (!authorId || authorId === user.id) return
    try {
      await toggleFollow({ targetUserId: authorId, userId: user.id })
      await loadFeed(activeTab, search)
    } catch {
      alert('フォロー操作に失敗しました。')
    }
  }

  const handleToggleComments = async (postId) => {
    const next = !expandedComments[postId]
    setExpandedComments((old) => ({ ...old, [postId]: next }))
    if (next && !commentsByPost[postId]) {
      try {
        const data = await fetchComments(postId)
        setCommentsByPost((old) => ({ ...old, [postId]: data }))
      } catch {
        alert('コメント読み込みに失敗しました。')
      }
    }
  }

  const handleCommentSubmit = async (postId) => {
    if (!requireAuth()) return
    const content = (commentInputs[postId] || '').trim()
    if (!content) return
    try {
      await createComment({ postId, userId: user.id, content })
      setCommentInputs((old) => ({ ...old, [postId]: '' }))
      const data = await fetchComments(postId)
      setCommentsByPost((old) => ({ ...old, [postId]: data }))
      setPosts((old) => old.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p))
    } catch {
      alert('コメント投稿に失敗しました。')
    }
  }

  const handleReport = async (postId) => {
    if (!requireAuth()) return
    const reason = window.prompt('報告理由を入力してください (例: スパム, 誹謗中傷)')
    if (!reason || !reason.trim()) return
    try {
      await submitReport({
        reporterId: user.id,
        targetType: 'post',
        targetPostId: postId,
        reason: reason.trim(),
      })
      alert('報告を受け付けました。')
    } catch {
      alert('報告送信に失敗しました。')
    }
  }

  const handleShare = async (postId) => {
    const url = `${window.location.origin}/lounge?post=${postId}`
    try {
      await navigator.clipboard.writeText(url)
      alert('投稿リンクをコピーしました。')
    } catch {
      alert(url)
    }
  }

  const handleReadNotification = async (id) => {
    try {
      await markNotificationRead(id)
      setNotifications((old) => old.map((n) => n.id === id ? { ...n, is_read: true } : n))
    } catch {
      alert('通知更新に失敗しました。')
    }
  }

  return (
    <div className="min-h-screen pb-20 bg-[#F8FAFC] dark:bg-slate-950">
      <LoungeStyles />

      <nav className="sticky top-16 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 h-14 px-4 lg:px-8 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">ラウンジ</h1>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="hidden md:flex bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 items-center gap-2 w-72">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="キーワード、銘柄検索"
              className="bg-transparent text-sm font-bold outline-none w-full text-slate-700 dark:text-slate-200 placeholder-slate-400"
            />
          </form>
          <button onClick={() => setNotifOpen((v) => !v)} className="relative p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <Bell size={20} />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => (user?.id ? navigate('/mypage') : navigate('/login'))}
            className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs"
          >
            {(user === undefined ? '...' : (user?.displayName || 'MM')).slice(0, 2).toUpperCase()}
          </button>
        </div>
      </nav>
      {notifOpen ? (
        <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500">通知はありません。</p>
            ) : notifications.slice(0, 8).map((n) => (
              <button
                key={n.id}
                onClick={() => handleReadNotification(n.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${
                  n.is_read
                    ? 'border-slate-200 dark:border-slate-700 text-slate-500'
                    : 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                }`}
              >
                {n.type === 'like' ? 'いいねが付きました' : n.type === 'comment' ? 'コメントが届きました' : '新しいフォロワーがいます'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <div className="w-20 h-20 mx-auto bg-slate-900 dark:bg-slate-700 text-white rounded-full flex items-center justify-center text-2xl font-black mb-3">
              {(user === undefined ? '...' : (user?.displayName || 'MM')).slice(0, 2).toUpperCase()}
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              {user === undefined ? '読み込み中...' : (user?.displayName || 'ゲスト')}
            </h3>
            <p className="text-xs text-slate-400 font-bold mb-4">
              {user === undefined ? 'アカウント確認中' : (user?.id ? 'ログイン中のメンバー' : 'ログインして投稿に参加')}
            </p>
            <div className="flex justify-center gap-4 text-center border-t border-slate-100 dark:border-slate-800 pt-4">
              <div>
                <p className="font-black text-lg text-slate-900 dark:text-white">{posts.length}</p>
                <p className="text-xs text-slate-400">Posts</p>
              </div>
              <div>
                <p className="font-black text-lg text-slate-900 dark:text-white">{unreadCount}</p>
                <p className="text-xs text-slate-400">Unread</p>
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

        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {(user === undefined ? '...' : (user?.displayName || 'MM')).slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="grid gap-2 mb-3">
                <input
                  value={composer.title}
                  onChange={(e) => setComposer((old) => ({ ...old, title: e.target.value }))}
                  placeholder="タイトル"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
                />
                <textarea
                  value={composer.content}
                  onChange={(e) => setComposer((old) => ({ ...old, content: e.target.value }))}
                  rows={3}
                  placeholder="投資に関する考えをシェアしよう..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={composer.ticker}
                    onChange={(e) => setComposer((old) => ({ ...old, ticker: e.target.value }))}
                    placeholder="Ticker (例: NVDA)"
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  <input
                    value={composer.tags}
                    onChange={(e) => setComposer((old) => ({ ...old, tags: e.target.value }))}
                    placeholder="Tags comma separated"
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <select
                    value={composer.assetType}
                    onChange={(e) => setComposer((old) => ({ ...old, assetType: e.target.value }))}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="general">General</option>
                    <option value="stock">Stock</option>
                    <option value="fund">Fund</option>
                    <option value="fx">FX</option>
                    <option value="crypto">Crypto</option>
                  </select>
                  <select
                    value={composer.sentiment}
                    onChange={(e) => setComposer((old) => ({ ...old, sentiment: e.target.value }))}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="bullish">Bullish</option>
                    <option value="neutral">Neutral</option>
                    <option value="bearish">Bearish</option>
                  </select>
                </div>
                <button
                  onClick={handlePostSubmit}
                  disabled={posting}
                  className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white font-bold text-sm rounded-lg hover:bg-black dark:hover:bg-slate-600 transition disabled:opacity-60"
                >
                  {posting ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex lg:hidden overflow-x-auto gap-2 pb-2 scrollbar-hide">
            {[
              { id: 'popular', label: '人気' },
              { id: 'new', label: '最新' },
              { id: 'following', label: 'フォロー' },
              { id: 'saved', label: '保存' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-slate-900 dark:bg-slate-700 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center gap-2 text-slate-500">
              <Loader2 size={18} className="animate-spin" /> 読み込み中...
            </div>
          ) : null}
          {error ? (
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          {!isLoading && posts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center text-slate-500">
              投稿がありません。最初の投稿を作成してみてください。
            </div>
          ) : null}
          {posts.map((post) => (
            <div key={post.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    {(post.author_name || 'M').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{post.author_name || 'メンバー'}</span>
                    <p className="text-xs text-slate-400 font-medium">{timeAgo(post.created_at)}</p>
                  </div>
                </div>
                {post.author_id && post.author_id !== user?.id ? (
                  <button
                    onClick={() => handleToggleFollow(post.author_id)}
                    className="text-xs inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    {post.isFollowingAuthor ? <UserMinus size={13} /> : <UserPlus size={13} />}
                    {post.isFollowingAuthor ? 'フォロー中' : 'フォロー'}
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {post.ticker ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400">$</span> {post.ticker}
                  </span>
                ) : null}
                {(post.tags || []).map((tag) => (
                  <span key={tag} className="text-[11px] px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300">
                    #{tag}
                  </span>
                ))}
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

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">
                {post.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {post.content}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                <div className="flex gap-6">
                  <button
                    disabled={busyPostId === post.id}
                    onClick={() => handleToggleLike(post.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold transition ${post.isLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
                  >
                    <ThumbsUp size={16} /> {post.like_count || 0}
                  </button>
                  <button
                    onClick={() => handleToggleComments(post.id)}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-blue-500 text-xs font-bold transition"
                  >
                    <MessageCircle size={16} /> {post.comment_count || 0}
                  </button>
                  <button
                    onClick={() => handleShare(post.id)}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-green-500 text-xs font-bold transition"
                  >
                    <Share2 size={16} /> Share
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleBookmark(post.id)}
                    className={`text-xs font-bold inline-flex items-center gap-1 ${
                      post.isBookmarked ? 'text-orange-500' : 'text-slate-400 hover:text-orange-500'
                    }`}
                  >
                    <Bookmark size={15} /> {post.bookmark_count || 0}
                  </button>
                  <button onClick={() => handleReport(post.id)} className="text-slate-300 hover:text-rose-500">
                    <AlertTriangle size={15} />
                  </button>
                  <span className="text-xs font-bold text-slate-300 dark:text-slate-500">{post.view_count || 0} Views</span>
                </div>
              </div>

              {expandedComments[post.id] ? (
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="space-y-2 mb-3 max-h-56 overflow-y-auto">
                    {(commentsByPost[post.id] || []).map((c) => (
                      <div key={c.id} className="bg-slate-50 dark:bg-slate-800/70 rounded-lg px-3 py-2">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{c.author_name || 'メンバー'}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{c.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={commentInputs[post.id] || ''}
                      onChange={(e) => setCommentInputs((old) => ({ ...old, [post.id]: e.target.value }))}
                      placeholder="コメントを書く..."
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <button
                      onClick={() => handleCommentSubmit(post.id)}
                      className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Send size={13} /> 送信
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Flame size={18} className="text-orange-500" /> 話題の銘柄
            </h3>
            <div className="space-y-4">
              {trendingTags.map((item, i) => (
                <button
                  key={item.tag}
                  onClick={() => {
                    setSearch(item.tag)
                    loadFeed(activeTab, item.tag)
                  }}
                  className="w-full text-left flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-300 dark:text-slate-600 w-4">{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-orange-500">{item.tag}</p>
                      <p className="text-[10px] text-slate-400">トレンドタグ</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs font-bold text-slate-600 dark:text-slate-400">{item.count} posts</span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => loadFeed(activeTab, '')}
              className="w-full mt-4 py-2 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              フィードを再読み込み
            </button>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-1">Community Guide</h3>
              <p className="text-xs text-slate-400 mb-4">誹謗中傷・スパムは禁止です。<br />違反投稿は報告してください。</p>
              <button
                onClick={() => navigate('/legal/terms')}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                コミュニティ規約を見る
              </button>
            </div>
            <Hash size={80} className="absolute -right-4 -bottom-4 text-white/10 rotate-12" />
          </div>
        </div>
      </main>
    </div>
  )
}
