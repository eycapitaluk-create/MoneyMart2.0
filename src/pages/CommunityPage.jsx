import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Heart, MessageCircle, Lock, Send, Bookmark,
  Loader2, LogIn, PenLine, Trash2, ImagePlus, X,
} from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import CommunityGuidePanel from '../components/community/CommunityGuidePanel'
import CommunityTierBadge from '../components/community/CommunityTierBadge'
import CommunitySidebar from '../components/community/CommunitySidebar'
import { SentimentBadge, SentimentPicker } from '../components/community/SentimentBadge'
import {
  createComment,
  createPost,
  deleteOwnComment,
  deleteOwnPost,
  fetchComments,
  fetchFeed,
  fetchTrendingTags,
  getCurrentLoungeUser,
  toggleLike,
  toggleBookmark,
} from '../lib/loungeApi'
import { fetchMyCharacterStats, fetchCharacterStats, fetchCharacterLeaderboardWithNames } from '../lib/loungeCharacterApi'
import { fetchCommunitySentimentSummary, fetchTrendingTickersFromPosts } from '../lib/communitySidebarApi'
import { fetchInsightPublicCatalog } from '../lib/insightApi'
import {
  applyFeedTierGating,
  expProgressToNextTier,
  getTierForExp,
  permissionsFromExp,
} from '../lib/communityTiers'
import { awardDailyLoginExp } from '../lib/communityExpApi'
import { userHasCommunityPortfolioAsset } from '../lib/communityPortfolioGate'
import { notifyCommunityTierRefresh } from '../hooks/useCommunityTier'

const MAX_POST_LENGTH = 500

const formatDate = (iso) => {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const pick = (type) => parts.find((p) => p.type === type)?.value || ''
  return `${pick('year')}/${pick('month')}/${pick('day')} ${pick('hour')}:${pick('minute')} JST`
}

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}時間前`
  const days = Math.floor(hour / 24)
  if (days < 7) return `${days}日前`
  return formatDate(iso)
}

const formatCount = (v) => {
  const n = Number(v || 0)
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const firstTwo = (name) => {
  const n = String(name || '会員').trim()
  if (!n) return '会'
  return n.slice(0, 2)
}

import { getCommunityPostBody, getCommunityPostTitle, filterPublicCommunityTags, stripCommunitySeedMarker } from '../lib/communitySeed'

export default function CommunityPage({ bootUser = undefined, authReady = false }) {
  useDocumentTitle('コミュニティ')
  const navigate = useNavigate()

  const [user, setUser] = useState(undefined)
  const [posts, setPosts] = useState([])
  const [trendingTags, setTrendingTags] = useState([])
  const [myExp, setMyExp] = useState(0)
  const [hasPortfolioAsset, setHasPortfolioAsset] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composeText, setComposeText] = useState('')
  const [composeSentiment, setComposeSentiment] = useState('neutral')
  const [composeImages, setComposeImages] = useState([])
  const [posting, setPosting] = useState(false)
  const imageInputRef = useRef(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [authorExpMap, setAuthorExpMap] = useState({})
  const [toast, setToast] = useState('')
  const [feedTab, setFeedTab] = useState('popular')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sentimentSummary, setSentimentSummary] = useState(null)
  const [trendingTickers, setTrendingTickers] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [latestInsight, setLatestInsight] = useState(null)

  const feedTabForApi = feedTab === 'saved' ? 'saved' : feedTab === 'mine' ? 'mine' : feedTab === 'new' ? 'new' : 'popular'

  const isLoggedIn = Boolean(user?.id)
  const perms = useMemo(() => permissionsFromExp(myExp), [myExp])
  const canCompose = perms.canPost || hasPortfolioAsset
  const myTier = perms.tier
  const progress = useMemo(() => expProgressToNextTier(myExp), [myExp])
  const gatedPosts = useMemo(() => applyFeedTierGating(posts, myExp, { isLoggedIn }), [posts, myExp, isLoggedIn])

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2200)
  }

  useEffect(() => {
    if (!authReady) return
    if (bootUser !== undefined) {
      setUser(bootUser ?? null)
      return
    }
    getCurrentLoungeUser().then((u) => setUser(u)).catch(() => setUser(null))
  }, [authReady, bootUser])

  const loadFeed = useCallback(async ({ tabOverride } = {}) => {
    const apiTab = tabOverride || feedTabForApi
    setLoading(true)
    setError('')
    try {
      const [feed, tags, sentiment, tickers, leaders, insights] = await Promise.all([
        fetchFeed({
          tab: apiTab,
          search: appliedSearch,
          userId: user?.id || null,
          limit: 50,
          preferLounge: true,
        }),
        fetchTrendingTags(8),
        fetchCommunitySentimentSummary().catch(() => null),
        fetchTrendingTickersFromPosts(8).catch(() => []),
        fetchCharacterLeaderboardWithNames(5).catch(() => []),
        fetchInsightPublicCatalog(1).catch(() => []),
      ])
      setPosts(feed)
      setTrendingTags(tags)
      setSentimentSummary(sentiment)
      setTrendingTickers(tickers)
      setLeaderboard(leaders)
      setLatestInsight(insights?.[0] || null)
      const authorIds = [...new Set(feed.map((p) => p.author_id).filter(Boolean))]
      const statsMap = await fetchCharacterStats(authorIds)
      const expObj = {}
      statsMap.forEach((val, uid) => { expObj[uid] = val.total_exp })
      setAuthorExpMap(expObj)
    } catch (err) {
      setError(err?.message || 'フィードの読み込みに失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [user?.id, feedTabForApi, appliedSearch])

  useEffect(() => {
    if (!authReady) return
    loadFeed()
  }, [authReady, loadFeed])

  const refreshMyProgress = useCallback(async () => {
    if (!user?.id) {
      setMyExp(0)
      setHasPortfolioAsset(false)
      return
    }
    try {
      const [stats, hasAsset] = await Promise.all([
        fetchMyCharacterStats(user.id),
        userHasCommunityPortfolioAsset(user.id),
      ])
      setMyExp(Number(stats?.total_exp || 0))
      setHasPortfolioAsset(Boolean(hasAsset))
      notifyCommunityTierRefresh()
    } catch {
      setMyExp(0)
      setHasPortfolioAsset(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setMyExp(0)
      setHasPortfolioAsset(false)
      return undefined
    }
    refreshMyProgress()
    awardDailyLoginExp()
      .then((res) => {
        if (res?.awarded && res?.total_exp != null) {
          setMyExp(Number(res.total_exp))
          notifyCommunityTierRefresh()
          showToast(`ログインボーナス +${res.exp_delta} EXP`)
        }
      })
      .catch(() => {})

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshMyProgress()
    }
    window.addEventListener('focus', refreshMyProgress)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refreshMyProgress)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user?.id, refreshMyProgress])

  const requireAuth = () => {
    if (isLoggedIn) return true
    navigate('/login', { state: { from: '/community' } })
    return false
  }

  const postingGuard = useRef(false)

  const handlePost = async () => {
    if (postingGuard.current) return
    if (!requireAuth()) return
    if (!canCompose) {
      showToast(hasPortfolioAsset
        ? '投稿権限を確認中です。しばらくしてから再度お試しください'
        : '投稿するにはマイページで資産を1件以上登録してください')
      return
    }
    const text = composeText.trim()
    if (!text) return
    if (text.length > MAX_POST_LENGTH) return
    postingGuard.current = true
    setPosting(true)
    try {
      await createPost({
        userId: user.id,
        title: getCommunityPostTitle({ content: text }),
        content: text,
        sentiment: composeSentiment || 'neutral',
        imageFiles: composeImages,
        preferLounge: true,
      })
      setComposeText('')
      setComposeImages([])
      setFeedTab('new')
      await loadFeed({ tabOverride: 'new' })
      const stats = await fetchMyCharacterStats(user.id)
      setMyExp(Number(stats?.total_exp || 0))
      showToast('投稿しました')
    } catch (err) {
      showToast(err?.message || '投稿に失敗しました')
    } finally {
      postingGuard.current = false
      setPosting(false)
    }
  }

  const handleOpenPost = async (post) => {
    setSelectedPost(post)
    setCommentText('')
    if (!post?.id) return
    try {
      const rows = await fetchComments(post.id, { preferLounge: true })
      setComments(rows)
    } catch {
      setComments([])
    }
  }

  const isOwnPost = (post) => Boolean(user?.id && post?.author_id === user.id)
  const likeInFlightRef = useRef(new Set())

  const applyLikeLocal = (postId, nextLiked) => {
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p
      const wasLiked = Boolean(p.isLiked)
      if (wasLiked === nextLiked) return p
      return {
        ...p,
        isLiked: nextLiked,
        like_count: Math.max(0, Number(p.like_count || 0) + (nextLiked ? 1 : -1)),
      }
    }))
    setSelectedPost((old) => {
      if (!old || old.id !== postId) return old
      const wasLiked = Boolean(old.isLiked)
      if (wasLiked === nextLiked) return old
      return {
        ...old,
        isLiked: nextLiked,
        like_count: Math.max(0, Number(old.like_count || 0) + (nextLiked ? 1 : -1)),
      }
    })
  }

  const handleLike = async (post, e) => {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    if (!requireAuth()) return
    if (isOwnPost(post)) {
      showToast('自分の投稿にはいいねできません')
      return
    }
    if (!post?.id || likeInFlightRef.current.has(post.id)) return

    const prevLiked = Boolean(post.isLiked)
    const nextLiked = !prevLiked
    likeInFlightRef.current.add(post.id)
    applyLikeLocal(post.id, nextLiked)

    try {
      const confirmed = await toggleLike({
        postId: post.id,
        userId: user.id,
        preferLounge: true,
        desiredLiked: nextLiked,
      })
      applyLikeLocal(post.id, confirmed)
    } catch (err) {
      applyLikeLocal(post.id, prevLiked)
      showToast(err?.message || 'いいねに失敗しました')
    } finally {
      likeInFlightRef.current.delete(post.id)
    }
  }

  const handleComment = async () => {
    if (!requireAuth() || !selectedPost?.id) return
    if (!perms.canComment) {
      showToast('コメントにはメンバーバッジ（900 EXP）が必要です')
      return
    }
    const text = commentText.trim()
    if (!text) return
    setCommentBusy(true)
    try {
      await createComment({ postId: selectedPost.id, userId: user.id, content: text, preferLounge: true })
      setCommentText('')
      const rows = await fetchComments(selectedPost.id, { preferLounge: true })
      setComments(rows)
      setPosts((prev) => prev.map((p) => (
        p.id === selectedPost.id
          ? { ...p, comment_count: Number(p.comment_count || 0) + 1 }
          : p
      )))
      showToast('コメントしました')
    } catch (err) {
      showToast(err?.message || 'コメントに失敗しました')
    } finally {
      setCommentBusy(false)
    }
  }

  const handleBookmark = async (post, e) => {
    e?.stopPropagation?.()
    if (!requireAuth()) return
    try {
      const next = await toggleBookmark({ postId: post.id, userId: user.id, preferLounge: true })
      setPosts((prev) => prev.map((p) => (
        p.id === post.id ? { ...p, isBookmarked: next } : p
      )))
      if (feedTab === 'saved' && !next) {
        setPosts((prev) => prev.filter((p) => p.id !== post.id))
      }
      if (selectedPost?.id === post.id) {
        setSelectedPost((old) => ({ ...old, isBookmarked: next }))
      }
      showToast(next ? 'ブックマークに保存しました' : 'ブックマークを解除しました')
    } catch (err) {
      showToast(err?.message || 'ブックマークに失敗しました')
    }
  }

  const handleDelete = async (post, e) => {
    e?.stopPropagation?.()
    if (!user?.id || post.author_id !== user.id) return
    if (!window.confirm('この投稿を削除しますか？')) return
    try {
      await deleteOwnPost({ postId: post.id, userId: user.id })
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      if (selectedPost?.id === post.id) setSelectedPost(null)
      showToast('投稿を削除しました')
    } catch (err) {
      showToast(err?.message || '削除に失敗しました')
    }
  }

  const handleDeleteComment = async (comment) => {
    if (!user?.id || comment.author_id !== user.id) return
    if (!window.confirm('このコメントを削除しますか？')) return
    try {
      await deleteOwnComment({ commentId: comment.id, userId: user.id, postId: selectedPost?.id })
      setComments((prev) => prev.filter((c) => c.id !== comment.id))
      setPosts((prev) => prev.map((p) => (
        p.id === selectedPost?.id
          ? { ...p, comment_count: Math.max(0, Number(p.comment_count || 0) - 1) }
          : p
      )))
      showToast('コメントを削除しました')
    } catch (err) {
      showToast(err?.message || 'コメント削除に失敗しました')
    }
  }

  const handleSearchSubmit = (e) => {
    e?.preventDefault?.()
    setAppliedSearch(searchInput.trim())
    if (feedTab === 'saved') setFeedTab('popular')
  }

  const clearSearch = () => {
    setSearchInput('')
    setAppliedSearch('')
  }

  const handleTagSearch = (tag) => {
    const q = `#${tag}`
    setSearchInput(q)
    setAppliedSearch(q)
    if (feedTab === 'saved') setFeedTab('popular')
  }

  const handleTickerSearch = (ticker) => {
    const sym = String(ticker || '').trim().toUpperCase()
    setSearchInput(sym)
    setAppliedSearch(sym)
    if (feedTab === 'saved') setFeedTab('popular')
  }

  const handleFeedTabChange = (tab) => {
    if ((tab === 'saved' || tab === 'mine') && !isLoggedIn) {
      navigate('/login', { state: { from: '/community' } })
      return
    }
    setFeedTab(tab)
  }

  const expToNext = progress.nextTier ? progress.need - progress.current : null

  const feedTabClass = (tab) => (
    feedTab === tab
      ? 'text-orange-600 dark:text-orange-400 font-black border-b-2 border-orange-500'
      : 'text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-slate-200 border-b-2 border-transparent'
  )

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-orange-500">コミュニティ</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">投資コミュニティ</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            テーマ別の議論・意見交換。資産登録で投稿、EXPでコメントやバッジアップ。
          </p>
        </div>
        {isLoggedIn ? (
          <div className="inline-flex items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm">
            <CommunityTierBadge tier={myTier} size="md" />
            <div className="text-xs leading-tight">
              <p className="font-black text-slate-900 dark:text-white">{myTier.labelJa}</p>
              <p className="text-slate-500 dark:text-slate-400">{myExp} EXP</p>
            </div>
          </div>
        ) : null}
      </header>

      <CommunityGuidePanel
        tier={isLoggedIn ? myTier : null}
        totalExp={myExp}
        expToNext={expToNext}
        hasPortfolioAsset={hasPortfolioAsset}
        canCompose={canCompose}
        compact
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
        <div className="space-y-4 min-w-0 order-2 lg:order-none">
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button type="button" onClick={() => handleFeedTabChange('popular')} className={`flex-1 py-2.5 text-sm ${feedTabClass('popular')}`}>
              人気
            </button>
            <button type="button" onClick={() => handleFeedTabChange('new')} className={`flex-1 py-2.5 text-sm ${feedTabClass('new')}`}>
              新着
            </button>
            {isLoggedIn ? (
              <button type="button" onClick={() => handleFeedTabChange('mine')} className={`flex-1 py-2.5 text-sm inline-flex items-center justify-center gap-1 ${feedTabClass('mine')}`}>
                <PenLine size={14} />
                自分の
              </button>
            ) : null}
            <button type="button" onClick={() => handleFeedTabChange('saved')} className={`flex-1 py-2.5 text-sm inline-flex items-center justify-center gap-1 ${feedTabClass('saved')}`}>
              <Bookmark size={14} />
              保存
            </button>
          </div>

          {appliedSearch ? (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2">
              <span>検索: <strong className="text-slate-900 dark:text-white">{appliedSearch}</strong></span>
              <button type="button" onClick={clearSearch} className="font-bold text-orange-600 dark:text-orange-400">クリア</button>
            </div>
          ) : null}

          {isLoggedIn ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              {canCompose ? (
                <>
                  <SentimentPicker
                    value={composeSentiment}
                    onChange={setComposeSentiment}
                    className="mb-3"
                  />
                  <textarea
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    placeholder="いま気になっている銘柄やマクロの話題を共有…"
                    rows={3}
                    maxLength={MAX_POST_LENGTH}
                    className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  {composeImages.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {composeImages.map((file, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img
                            src={URL.createObjectURL(file)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setComposeImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400">{composeText.length}/{MAX_POST_LENGTH}</span>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-orange-500 transition"
                        title="画像を追加"
                      >
                        <ImagePlus size={16} />
                      </button>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = [...(e.target.files || [])]
                          if (files.length === 0) return
                          setComposeImages((prev) => [...prev, ...files].slice(0, 4))
                          e.target.value = ''
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handlePost}
                      disabled={posting || !composeText.trim()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 w-full sm:w-auto transition"
                    >
                      {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      投稿
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <Lock size={18} className="text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100">投稿には資産登録が必要です</p>
                    <p className="text-xs mt-1 leading-relaxed">
                      マイページで関心銘柄・株式・ファンド・資産のいずれかを1件以上登録すると、すぐに投稿できます。
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Link to="/mypage?tab=stock" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">
                        株式を登録 →
                      </Link>
                      <Link to="/mypage?tab=fund" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">
                        ファンドを登録 →
                      </Link>
                      <Link to="/mypage?tab=wealth" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">
                        資産を登録 →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">ログインして議論に参加しましょう</p>
              <button
                type="button"
                onClick={() => navigate('/login', { state: { from: '/community' } })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2"
              >
                <LogIn size={16} />
                ログイン
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400 text-center py-8">{error}</p>
          ) : gatedPosts.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">
              {feedTab === 'mine'
                ? '自分の投稿はまだありません。'
                : feedTab === 'saved'
                  ? 'ブックマークした投稿がありません。'
                  : appliedSearch
                    ? '該当する投稿が見つかりませんでした。'
                    : 'まだ投稿がありません。'}
            </p>
          ) : (
            <ul className="space-y-3">
              {gatedPosts.map((post) => {
                const authorTier = getTierForExp(authorExpMap[post.author_id] || 0)
                return (
                  <li key={post.id}>
                    <article
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenPost(post)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleOpenPost(post) }}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 sm:p-4 hover:border-orange-300 dark:hover:border-orange-800 transition cursor-pointer text-left"
                    >
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-[11px] sm:text-xs font-black flex items-center justify-center shrink-0">
                          {firstTwo(post.author_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <span className="font-bold text-slate-900 dark:text-white">{post.author_name}</span>
                            <CommunityTierBadge tier={authorTier} size="xs" showLabel />
                            <SentimentBadge sentiment={post.sentiment} />
                            <span className="text-slate-400 w-full sm:w-auto">
                              {formatDate(post.created_at)}
                              <span className="ml-1">({timeAgo(post.created_at)})</span>
                            </span>
                            {post.ticker ? (
                              <span className="text-orange-600 dark:text-orange-400 font-bold">${post.ticker}</span>
                            ) : null}
                            {filterPublicCommunityTags(post.tags || []).slice(0, 2).map((tag) => (
                              <button
                                key={`${post.id}-${tag}`}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleTagSearch(tag) }}
                                className="text-sky-600 dark:text-sky-400 font-bold hover:underline"
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                          <h2 className="font-black text-slate-900 dark:text-white mt-1 leading-snug">
                            {getCommunityPostTitle(post)}
                          </h2>
                          {post.contentLocked ? (
                            <div className="mt-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2.5 flex items-start gap-2">
                              <Lock size={14} className="text-orange-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                本文は会員限定です。
                                <Link to="/login" onClick={(e) => e.stopPropagation()} className="font-bold text-orange-600 hover:underline">ログイン</Link>
                                （無料）すると全文が読めます。
                              </p>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap line-clamp-4">
                                {getCommunityPostBody(post)}
                              </p>
                              {post.image_urls?.length > 0 ? (
                                <div className="flex gap-2 mt-2 overflow-x-auto">
                                  {post.image_urls.slice(0, 4).map((url, idx) => (
                                    <img
                                      key={idx}
                                      src={url}
                                      alt=""
                                      className="w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                      loading="lazy"
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                            <button
                              type="button"
                              onClick={(e) => handleLike(post, e)}
                              disabled={isOwnPost(post)}
                              title={isOwnPost(post) ? '自分の投稿にはいいねできません' : undefined}
                              className={`inline-flex items-center gap-1 transition ${
                                isOwnPost(post)
                                  ? 'opacity-40 cursor-not-allowed'
                                  : `hover:text-red-500 ${post.isLiked ? 'text-red-500' : ''}`
                              }`}
                            >
                              <Heart size={14} fill={post.isLiked ? 'currentColor' : 'none'} />
                              {formatCount(post.like_count)}
                            </button>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle size={14} />
                              {formatCount(post.comment_count)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleBookmark(post, e)}
                              className={`inline-flex items-center gap-1 hover:text-orange-500 transition ${post.isBookmarked ? 'text-orange-500' : ''}`}
                              title="ブックマーク"
                            >
                              <Bookmark size={14} fill={post.isBookmarked ? 'currentColor' : 'none'} />
                            </button>
                            {post.contentLocked ? (
                              <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-bold">
                                <PenLine size={12} />
                                続きを読む
                              </span>
                            ) : null}
                            {user?.id && post.author_id === user.id ? (
                              <button
                                type="button"
                                onClick={(e) => handleDelete(post, e)}
                                className="ml-auto inline-flex items-center gap-1 text-slate-400 hover:text-red-500 transition"
                                title="削除"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="order-1 lg:order-none min-h-0">
          <CommunitySidebar
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onSearchSubmit={handleSearchSubmit}
            onClearSearch={clearSearch}
            trendingTags={trendingTags}
            onTagSearch={handleTagSearch}
            sentimentSummary={sentimentSummary}
            trendingTickers={trendingTickers}
            onTickerSearch={handleTickerSearch}
            leaderboard={leaderboard}
            latestInsight={latestInsight}
            showMobileSearch
          />
        </div>
      </div>

      {selectedPost ? (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="閉じる" onClick={() => setSelectedPost(null)} />
          <div className="relative w-full sm:max-w-lg max-h-[85vh] overflow-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex flex-wrap items-start gap-2 min-w-0 flex-1">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">{selectedPost.author_name} · {formatDate(selectedPost.created_at)} ({timeAgo(selectedPost.created_at)})</p>
                  <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white mt-0.5 leading-snug">
                    {getCommunityPostTitle(selectedPost)}
                  </h3>
                </div>
                <SentimentBadge sentiment={selectedPost.sentiment} size="lg" className="shrink-0" />
              </div>
              <button type="button" onClick={() => setSelectedPost(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold shrink-0 p-1">✕</button>
            </div>

            {selectedPost.contentLocked ? (
              <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                <p className="font-bold flex items-center gap-2">
                  <Lock size={16} className="text-orange-500" />
                  本文はロック中
                </p>
                <p className="text-xs mt-2 text-slate-600 dark:text-slate-400">
                  ログイン（無料）すると全文が読めます。
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{getCommunityPostBody(selectedPost)}</p>
                {selectedPost.image_urls?.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedPost.image_urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
                      >
                        <img
                          src={url}
                          alt=""
                          className="max-w-full max-h-80 object-contain"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            <div className="flex gap-4 mt-4 text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={(e) => handleLike(selectedPost, e)}
                disabled={isOwnPost(selectedPost)}
                title={isOwnPost(selectedPost) ? '自分の投稿にはいいねできません' : undefined}
                className={`inline-flex items-center gap-1 ${
                  isOwnPost(selectedPost)
                    ? 'opacity-40 cursor-not-allowed'
                    : selectedPost.isLiked ? 'text-red-500' : ''
                }`}
              >
                <Heart size={14} fill={selectedPost.isLiked ? 'currentColor' : 'none'} />
                {formatCount(selectedPost.like_count)}
              </button>
              <span className="inline-flex items-center gap-1">
                <MessageCircle size={14} />
                {formatCount(selectedPost.comment_count)}
              </span>
              <button
                type="button"
                onClick={(e) => handleBookmark(selectedPost, e)}
                className={`inline-flex items-center gap-1 ${selectedPost.isBookmarked ? 'text-orange-500' : ''}`}
              >
                <Bookmark size={14} fill={selectedPost.isBookmarked ? 'currentColor' : 'none'} />
                保存
              </button>
              {user?.id && selectedPost.author_id === user.id ? (
                <button
                  type="button"
                  onClick={(e) => handleDelete(selectedPost, e)}
                  className="ml-auto inline-flex items-center gap-1 text-slate-400 hover:text-red-500 transition"
                >
                  <Trash2 size={14} />
                  削除
                </button>
              ) : null}
            </div>

            {comments.length > 0 ? (
              <ul className="mt-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                {comments.map((c) => (
                  <li key={c.id} className="text-sm group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {c.author_name}
                          {c.created_at ? (
                            <span className="ml-1 font-medium text-slate-400">
                              · {formatDate(c.created_at)}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5">{stripCommunitySeedMarker(c.content)}</p>
                      </div>
                      {user?.id && c.author_id === user.id ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition shrink-0 p-0.5"
                          title="削除"
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {isLoggedIn ? (
              perms.canComment ? (
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="コメントを書く…"
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleComment}
                    disabled={commentBusy || !commentText.trim()}
                    className="rounded-xl bg-orange-500 text-white text-sm font-bold px-3 disabled:opacity-50"
                  >
                    送信
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500 flex items-center gap-1">
                  <Lock size={12} />
                  コメントはメンバーバッジ（900 EXP）から
                </p>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] rounded-full bg-slate-900 text-white text-xs font-bold px-4 py-2 shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
