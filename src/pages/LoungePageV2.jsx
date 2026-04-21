import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Search, Bell, Bookmark, User, MessageCircle, Share2, TrendingUp, TrendingDown,
  MoreHorizontal, Image as ImageIcon, BarChart2, Hash, CheckCircle2, Lightbulb,
  HelpCircle, Flame, ChevronRight, PieChart, X, Edit2, Trash2, Reply, Flag
} from 'lucide-react'
import {
  createComment,
  createPost,
  deleteOwnPost,
  fetchComments,
  fetchFeed,
  fetchNotifications,
  fetchSuggestedUsers,
  fetchTrendingTags,
  getCurrentLoungeUser,
  markNotificationRead,
  submitReport,
  toggleBookmark,
  toggleFollow,
  toggleLike,
  updateOwnPost,
} from '../lib/loungeApi'
import {
  fetchCharacterStats,
  fetchMyCharacterStats,
  fetchCharacterLeaderboardWithNames,
  expProgressInLevel,
  getBadgeByExp,
} from '../lib/loungeCharacterApi'
import LoungeCharacter, { STAGE_NAMES } from '../components/lounge/LoungeCharacter'
const MAX_POST_LENGTH = 280
const MAX_ATTACHMENTS = 4
const FEED_PAGE_SIZE = 30
const FEED_VISIBLE_STEP = 10
const PREVIEW_POST_LIMIT = 3
const PREVIEW_CONTENT_LENGTH = 180

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}時間前`
  return `${Math.floor(hour / 24)}日前`
}

const formatCount = (v) => {
  const n = Number(v || 0)
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const firstTwo = (name) => (name || 'MM').slice(0, 2).toUpperCase()
const SUGGESTED_USER_AVATAR_CLASSES = [
  'bg-blue-100 text-blue-600',
  'bg-purple-100 text-purple-600',
  'bg-pink-100 text-pink-600',
  'bg-emerald-100 text-emerald-600',
]

const buildTitleFromContent = (content) => {
  const firstLine = String(content || '').split('\n').find((line) => line.trim())
  return (firstLine || 'ラウンジ投稿').slice(0, 80)
}

const truncatePreviewContent = (content = '') => {
  const raw = String(content || '').trim()
  if (raw.length <= PREVIEW_CONTENT_LENGTH) return raw
  return `${raw.slice(0, PREVIEW_CONTENT_LENGTH)}...`
}

export default function LoungePageV2({ bootUser = undefined, authReady = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('popular')
  const [search, setSearch] = useState('')
  const [composeText, setComposeText] = useState('')
  const [composeSentiment, setComposeSentiment] = useState(null)
  const [composeTag, setComposeTag] = useState('')
  const [attachedImages, setAttachedImages] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [modalComment, setModalComment] = useState('')
  const [replyToComment, setReplyToComment] = useState(null)
  const imageInputRef = useRef(null)

  const [user, setUser] = useState(undefined)
  const [posts, setPosts] = useState([])
  const [trendingTags, setTrendingTags] = useState([])
  const [commentsByPost, setCommentsByPost] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const [busyPostId, setBusyPostId] = useState('')
  const [toast, setToast] = useState({ open: false, message: '', tone: 'neutral' })
  const [feedLimit, setFeedLimit] = useState(FEED_PAGE_SIZE)
  const [visibleCount, setVisibleCount] = useState(FEED_VISIBLE_STEP + 2)
  const [loadingMore, setLoadingMore] = useState(false)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const loadMoreRef = useRef(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [suggestedUsers, setSuggestedUsers] = useState([])
  const [suggestedUsersLoading, setSuggestedUsersLoading] = useState(false)
  const [suggestedUserBusyId, setSuggestedUserBusyId] = useState('')
  const [editModal, setEditModal] = useState({
    open: false,
    postId: '',
    content: '',
    ticker: '',
    sentiment: 'neutral',
    imageUrls: [],
    imageFiles: [],
    saving: false,
  })
  const editImageInputRef = useRef(null)
  const [otherPostMenuId, setOtherPostMenuId] = useState(null)
  const [tagInputOpen, setTagInputOpen] = useState(false)
  const [characterStatsByUserId, setCharacterStatsByUserId] = useState({})
  const [myCharacterStats, setMyCharacterStats] = useState(null)
  const [characterLeaderboard, setCharacterLeaderboard] = useState([])
  const prevLevelRef = useRef(null)

  const isLoggedIn = Boolean(user?.id)
  const feedTab = !isLoggedIn
    ? 'popular'
    : activeTab === 'following'
      ? 'following'
      : activeTab === 'saved'
        ? 'saved'
        : activeTab === 'question'
          ? 'popular'
          : 'popular'

  const showToast = (message, tone = 'neutral') => {
    setToast({ open: true, message, tone })
    window.setTimeout(() => setToast((old) => ({ ...old, open: false })), 2000)
  }

  useEffect(() => {
    if (!authReady) return
    if (bootUser !== undefined) {
      setUser(bootUser ?? null)
      return
    }
    getCurrentLoungeUser().then((u) => setUser(u)).catch(() => setUser(null))
  }, [authReady, bootUser])

  const loadLounge = async ({ silent = false, explicitLimit } = {}) => {
    if (!authReady || user === undefined) return
    if (!silent) {
      setIsLoading(true)
      setError('')
    }
    try {
      if (!silent) setSuggestedUsersLoading(true)
      const effectiveLimit = isLoggedIn ? (explicitLimit || feedLimit) : PREVIEW_POST_LIMIT
      const [feed, tags, suggestions, myStats] = await Promise.all([
        fetchFeed({
          tab: feedTab,
          search,
          userId: user?.id || null,
          limit: effectiveLimit,
        }),
        fetchTrendingTags(8),
        fetchSuggestedUsers({ userId: user?.id || null, limit: 3 }),
        user?.id ? fetchMyCharacterStats(user.id) : Promise.resolve(null),
      ])
      setPosts(feed || [])
      setTrendingTags(tags || [])
      setSuggestedUsers(suggestions || [])
      if (user?.id) {
        setMyCharacterStats(myStats || { total_exp: 0, level: 1, character_stage: 1 })
      } else {
        setMyCharacterStats(null)
      }
      const authorIds = [...new Set((feed || []).map((p) => p.author_id).filter(Boolean))]
      if (authorIds.length > 0) {
        fetchCharacterStats(authorIds)
          .then((map) => setCharacterStatsByUserId(Object.fromEntries(map)))
          .catch(() => {})
      } else {
        setCharacterStatsByUserId({})
      }
    } catch (e) {
      setError(e?.message || 'ラウンジの読み込みに失敗しました。')
    } finally {
      if (!silent) setIsLoading(false)
      if (!silent) setSuggestedUsersLoading(false)
    }
  }

  useEffect(() => {
    setVisibleCount(FEED_VISIBLE_STEP + 2)
    setFeedLimit(FEED_PAGE_SIZE)
    setNewPostsCount(0)
    loadLounge({ explicitLimit: FEED_PAGE_SIZE })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user?.id, feedTab])

  useEffect(() => {
    if (!authReady || user === undefined) return
    const t = window.setTimeout(() => {
      setVisibleCount(FEED_VISIBLE_STEP + 2)
      setFeedLimit(FEED_PAGE_SIZE)
      setNewPostsCount(0)
      loadLounge({ explicitLimit: FEED_PAGE_SIZE })
    }, 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    if (selectedPost) setOtherPostMenuId(null)
  }, [selectedPost])

  useEffect(() => {
    if (!selectedPost?.id || commentsByPost[selectedPost.id]) return
    fetchComments(selectedPost.id)
      .then((rows) => setCommentsByPost((old) => ({ ...old, [selectedPost.id]: rows || [] })))
      .catch(() => {})
  }, [selectedPost?.id, commentsByPost])

  useEffect(() => {
    if (!user?.id) {
      setMyCharacterStats(null)
      prevLevelRef.current = null
      return
    }
    fetchMyCharacterStats(user.id)
      .then((stats) => setMyCharacterStats(stats || { total_exp: 0, level: 1, character_stage: 1 }))
      .catch(() => setMyCharacterStats({ total_exp: 0, level: 1, character_stage: 1 }))
  }, [user?.id])

  useEffect(() => {
    fetchCharacterLeaderboardWithNames(5)
      .then(setCharacterLeaderboard)
      .catch(() => setCharacterLeaderboard([]))
  }, [])

  useEffect(() => {
    if (!isLoggedIn || !myCharacterStats) return
    const nextLevel = Number(myCharacterStats.level || 1)
    if (!Number.isFinite(nextLevel)) return
    if (prevLevelRef.current == null) {
      prevLevelRef.current = nextLevel
      return
    }
    if (nextLevel > prevLevelRef.current) {
      const badge = getBadgeByExp(myCharacterStats.total_exp || 0)
      showToast(`Lv.${nextLevel}達成！ ${badge?.label || 'Badge'} バッジを獲得しました。`, 'success')
      if (user?.id) {
        fetchNotifications(user.id, 20)
          .then((rows) => setNotifications(rows || []))
          .catch(() => {})
      }
    }
    prevLevelRef.current = nextLevel
  }, [isLoggedIn, myCharacterStats, user?.id])

  const normalizedPosts = useMemo(() => {
    return (posts || []).map((p) => {
      const isQuestion = (p.tags || []).some((t) => String(t).toLowerCase().includes('質問')) || p.content.includes('？') || p.content.includes('?')
      const charStats = characterStatsByUserId[p.author_id]
      const badge = getBadgeByExp(charStats?.total_exp ?? 0)
      return {
        ...p,
        type: isQuestion ? 'question' : 'insight',
        user: {
          name: p.author_name || 'Member',
          handle: `@${(p.author_name || 'member').replace(/\s+/g, '_').toLowerCase()}`,
          badge: Number(p.like_count || 0) >= 20,
          avatar: Number(p.like_count || 0) >= 20 ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
          character_stage: charStats?.character_stage ?? 1,
          character_level: charStats?.level ?? 1,
          character_badge: badge,
        },
        time: timeAgo(p.created_at),
        tag: {
          code: p.ticker || (p.tags?.[0] || 'TOPIC'),
          price: '--',
          percent: '',
          isUp: p.sentiment !== 'bearish',
        },
        stats: {
          helpful: Number(p.like_count || 0),
          comments: Number(p.comment_count || 0),
          views: formatCount(p.view_count || 0),
          shares: Number(p.bookmark_count || 0),
        },
        hasChart: Boolean(p.ticker),
      }
    })
  }, [posts, characterStatsByUserId])

  const filteredByTab = useMemo(() => {
    if (activeTab === 'question') {
      return normalizedPosts.filter((p) => p.type === 'question')
    }
    return normalizedPosts
  }, [normalizedPosts, activeTab])

  const visiblePosts = useMemo(
    () => filteredByTab.slice(0, visibleCount),
    [filteredByTab, visibleCount]
  )
  const previewPosts = useMemo(
    () => (isLoggedIn ? visiblePosts : visiblePosts.slice(0, PREVIEW_POST_LIMIT)),
    [isLoggedIn, visiblePosts]
  )
  const hasMoreVisible = visibleCount < filteredByTab.length

  const totalSentiment = useMemo(() => {
    const bullish = normalizedPosts.filter((p) => p.sentiment === 'bullish').length
    const bearish = normalizedPosts.filter((p) => p.sentiment === 'bearish').length
    const total = bullish + bearish
    if (total <= 0) return null
    return {
      bullishPct: Math.round((bullish / total) * 100),
      bearishPct: Math.round((bearish / total) * 100),
    }
  }, [normalizedPosts])
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  )

  const requireAuth = () => {
    if (user?.id) return true
    showToast('ログイン後に利用できます。', 'warn')
    navigate('/login')
    return false
  }

  const handleOpenSaved = () => {
    if (!requireAuth()) return
    setActiveTab('saved')
  }

  const handleOpenFollowing = () => {
    if (!requireAuth()) return
    setActiveTab('following')
  }

  const handleToggleNotif = async () => {
    if (!requireAuth()) return
    setNotifOpen((v) => !v)
  }

  const handleToggleFollowUser = async (row) => {
    if (!requireAuth()) return
    if (!row?.id) return
    try {
      setSuggestedUserBusyId(row.id)
      const nextFollowing = await toggleFollow({ targetUserId: row.id, userId: user.id })
      setSuggestedUsers((prev) => prev.map((item) => (
        item.id === row.id ? { ...item, isFollowing: nextFollowing } : item
      )))
      await loadLounge({ silent: true })
    } catch (err) {
      showToast(err?.message || 'フォロー更新に失敗しました。', 'warn')
    } finally {
      setSuggestedUserBusyId('')
    }
  }

  const textLength = composeText.length
  const isOverLimit = textLength > MAX_POST_LENGTH
  const canPost = !posting && !isOverLimit && Boolean(composeText.trim() || composeTag.trim() || attachedImages.length > 0)

  const handleAttachImages = () => {
    imageInputRef.current?.click()
  }

  const handleImageSelected = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setAttachedImages((old) => {
      const remain = Math.max(0, MAX_ATTACHMENTS - old.length)
      const picked = files.slice(0, remain).map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        url: URL.createObjectURL(file),
      }))
      if (files.length > remain) {
        showToast(`画像は最大${MAX_ATTACHMENTS}枚までです。`, 'warn')
      } else {
        showToast(`${picked.length}件の画像を添付しました。`, 'success')
      }
      return [...old, ...picked]
    })
    e.target.value = ''
  }

  const handleRemoveImage = (imageId) => {
    setAttachedImages((old) => {
      const target = old.find((img) => img.id === imageId)
      if (target?.url) URL.revokeObjectURL(target.url)
      return old.filter((img) => img.id !== imageId)
    })
  }

  const handlePickTag = () => {
    setTagInputOpen(true)
  }
  const handleApplyTags = () => {
    const tags = composeTag.split(/[,\s、]+/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
    setComposeTag(tags.join(', '))
    setTagInputOpen(false)
  }

  const handleInsertChartTemplate = () => {
    const nextText = composeText.trim()
      ? `${composeText.trim()}\n\n【チャート分析メモ】`
      : '【チャート分析メモ】\n・根拠:\n・注目ポイント:\n・リスク:'
    setComposeText(nextText)
    showToast('チャート分析テンプレートを挿入しました。', 'neutral')
  }

  const handlePost = async () => {
    if (!requireAuth()) return
    if (!canPost) return
    setPosting(true)
    try {
      const tagList = composeTag
        .split(/[,\s、]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3)
      const normalizedContent = composeText.trim()
        || (tagList.length > 0 ? `${tagList.map((t) => `#${t}`).join(' ')} についての投稿です。` : '画像を共有しました。')
      const imageFiles = attachedImages.map((img) => img.file).filter(Boolean)
      await createPost({
        userId: user.id,
        title: buildTitleFromContent(normalizedContent),
        content: normalizedContent,
        ticker: (tagList[0] || '').toUpperCase(),
        assetType: 'general',
        sentiment: composeSentiment || 'neutral',
        tags: tagList,
        imageFiles,
      })
      setComposeText('')
      setComposeSentiment(null)
      setComposeTag('')
      setAttachedImages((old) => {
        old.forEach((img) => img.url && URL.revokeObjectURL(img.url))
        return []
      })
      setNewPostsCount(0)
      showToast('投稿しました。', 'success')
      await loadLounge()
    } catch (e) {
      showToast(e?.message || '投稿に失敗しました。', 'error')
    } finally {
      setPosting(false)
    }
  }

  useEffect(() => {
    return () => {
      attachedImages.forEach((img) => {
        if (img.url) URL.revokeObjectURL(img.url)
      })
    }
  }, [attachedImages])

  const handleLoadMore = async () => {
    if (loadingMore) return
    if (hasMoreVisible) {
      setVisibleCount((old) => old + FEED_VISIBLE_STEP)
      return
    }
    if (normalizedPosts.length < feedLimit) return
    setLoadingMore(true)
    const nextLimit = feedLimit + FEED_PAGE_SIZE
    try {
      setFeedLimit(nextLimit)
      await loadLounge({ silent: true, explicitLimit: nextLimit })
      setVisibleCount((old) => old + FEED_VISIBLE_STEP)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting) handleLoadMore()
      },
      { rootMargin: '300px 0px 300px 0px' }
    )
    observer.observe(target)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreVisible, normalizedPosts.length, feedLimit, loadingMore])

  useEffect(() => {
    if (!authReady || user === undefined || !isLoggedIn) return undefined
    const interval = window.setInterval(async () => {
      try {
        const latest = await fetchFeed({
          tab: feedTab,
          search,
          userId: user?.id || null,
          limit: 10,
        })
        const currentIds = new Set((posts || []).map((p) => p.id))
        const fresh = (latest || []).filter((p) => !currentIds.has(p.id))
        setNewPostsCount(fresh.length)
      } catch {
        // ignore polling errors
      }
    }, 15000)
    return () => window.clearInterval(interval)
  }, [authReady, user?.id, feedTab, search, posts])

  const handleRefreshNewPosts = async () => {
    setNewPostsCount(0)
    setVisibleCount(FEED_VISIBLE_STEP + 2)
    setFeedLimit(FEED_PAGE_SIZE)
    await loadLounge({ explicitLimit: FEED_PAGE_SIZE })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleReadNotification = async (id) => {
    try {
      await markNotificationRead(id)
      setNotifications((old) => old.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    } catch {
      showToast('通知更新に失敗しました。', 'error')
    }
  }

  useEffect(() => {
    if (!authReady || !user?.id) {
      setNotifications([])
      return
    }
    fetchNotifications(user.id, 20)
      .then((rows) => setNotifications(rows || []))
      .catch(() => setNotifications([]))
  }, [authReady, user?.id, posts.length])

  const handleToggleLike = async (post) => {
    if (!requireAuth()) return
    if (!post?.id) return
    setBusyPostId(post.id)
    try {
      await toggleLike({ postId: post.id, userId: user.id })
      await loadLounge()
    } catch (e) {
      showToast(e?.message || 'いいねに失敗しました。', 'error')
    } finally {
      setBusyPostId('')
    }
  }

  const handleToggleBookmark = async (post) => {
    if (!requireAuth()) return
    if (!post?.id) return
    setBusyPostId(post.id)
    try {
      await toggleBookmark({ postId: post.id, userId: user.id })
      await loadLounge()
    } catch {
      showToast('保存に失敗しました。', 'error')
    } finally {
      setBusyPostId('')
    }
  }

  const handleModalCommentSubmit = async () => {
    if (!selectedPost?.id || !modalComment.trim()) return
    if (!requireAuth()) return
    const isReply = replyToComment && replyToComment.postId === selectedPost.id
    try {
      await createComment({
        postId: selectedPost.id,
        userId: user.id,
        content: modalComment.trim(),
        ...(isReply && {
          parentCommentId: replyToComment.commentId,
          replyToUserId: replyToComment.replyToUserId,
          replyToName: replyToComment.replyToName,
        }),
      })
      setModalComment('')
      setReplyToComment(null)
      const nextComments = await fetchComments(selectedPost.id)
      setCommentsByPost((old) => ({ ...old, [selectedPost.id]: nextComments || [] }))
      await loadLounge()
    } catch {
      showToast('コメント投稿に失敗しました。', 'error')
    }
  }

  const isOwnPost = (post) => Boolean(user?.id && post?.author_id === user.id)

  const handleDeletePost = async (post) => {
    if (!post?.id) return
    if (!requireAuth()) return
    if (!isOwnPost(post)) {
      showToast('自分の投稿のみ削除できます。', 'warn')
      return
    }
    const ok = window.confirm('この投稿を削除しますか？')
    if (!ok) return
    setBusyPostId(post.id)
    try {
      await deleteOwnPost({ postId: post.id, userId: user.id })
      if (selectedPost?.id === post.id) {
        setSelectedPost(null)
        setModalComment('')
      }
      showToast('投稿を削除しました。', 'success')
      await loadLounge()
    } catch (e) {
      showToast(e?.message || '削除に失敗しました。', 'error')
    } finally {
      setBusyPostId('')
    }
  }

  const handleEditPost = (post) => {
    if (!post?.id) return
    if (!isOwnPost(post)) {
      showToast('自分の投稿のみ編集できます。', 'warn')
      return
    }
    setEditModal({
      open: true,
      postId: post.id,
      content: post.content || '',
      ticker: post.tag?.code === 'TOPIC' ? '' : (post.tag?.code || ''),
      sentiment: post.sentiment || 'neutral',
      imageUrls: Array.isArray(post.image_urls) ? [...post.image_urls] : [],
      imageFiles: [],
      saving: false,
    })
  }

  const handleSaveEditPost = async () => {
    if (!editModal.postId || !user?.id) return
    const trimmed = String(editModal.content || '').trim()
    if (!trimmed) {
      showToast('内容は空にできません。', 'warn')
      return
    }
    setEditModal((old) => ({ ...old, saving: true }))
    setBusyPostId(editModal.postId)
    try {
      await updateOwnPost({
        postId: editModal.postId,
        userId: user.id,
        content: trimmed,
        ticker: String(editModal.ticker || '').trim(),
        sentiment: editModal.sentiment,
        imageUrls: editModal.imageUrls || [],
        imageFiles: editModal.imageFiles || [],
      })
      setEditModal({
        open: false,
        postId: '',
        content: '',
        ticker: '',
        sentiment: 'neutral',
        imageUrls: [],
        imageFiles: [],
        saving: false,
      })
      showToast('投稿を更新しました。', 'success')
      await loadLounge()
    } catch (e) {
      showToast(e?.message || '更新に失敗しました。', 'error')
      setEditModal((old) => ({ ...old, saving: false }))
    } finally {
      setBusyPostId('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 flex flex-col transition-colors">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-black text-sm">M</div>
            <span className="font-extrabold text-[16px] tracking-tight text-slate-900 dark:text-white hidden sm:inline">
              <span className="text-orange-500">Lounge</span>
            </span>
          </Link>
          <div className="flex-1 max-w-md mx-2">
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 flex items-center gap-2 border border-transparent focus-within:ring-2 focus-within:ring-orange-300 transition">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="銘柄・トピック検索..."
                className="bg-transparent text-[13px] outline-none w-full text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleOpenSaved} className="p-2 rounded-lg text-slate-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-800 transition" title="保存済み">
              <Bookmark size={20} />
            </button>
            <div className="relative">
              <button onClick={handleToggleNotif} className="relative p-2 rounded-lg text-slate-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-slate-800 transition">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-[119]" onClick={() => setNotifOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-1 z-[120] w-[300px] max-h-[280px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3">
                    <p className="text-xs font-bold text-slate-500 mb-2">通知</p>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">通知はありません。</p>
                    ) : (
                      <div className="space-y-1.5">
                        {notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => handleReadNotification(n.id)}
                            className={`w-full text-left rounded-lg px-2.5 py-2 text-xs border ${
                              n.is_read ? 'border-slate-200 text-slate-500 bg-white dark:bg-slate-800' : 'border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-950/30'
                            }`}
                          >
                            {n.type === 'like' ? 'いいねが付きました' : n.type === 'comment' ? 'コメントが届きました' : (n.type === 'badge' || n.type === 'badge_level') ? 'バッジを獲得しました' : '新しい通知があります'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <Link to="/mypage" className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-sm shadow-sm hover:ring-2 hover:ring-orange-400 transition">
              {firstTwo(user?.displayName)}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1">
        <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-[3.6rem] h-fit">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-sm shrink-0">{firstTwo(user?.displayName)}</div>
              <div className="min-w-0">
                <h2 className="font-bold text-sm text-slate-900 dark:text-white truncate">{user?.displayName || 'Guest'}</h2>
                <p className="text-[11px] text-slate-500 truncate">@{((user?.displayName || 'guest').replace(/\s+/g, '_').toLowerCase()).slice(0, 15)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 text-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                <p className="text-[10px] font-bold text-slate-500">投稿</p>
                <p className="font-black text-slate-900 dark:text-white text-sm">{posts.length}</p>
              </div>
              <div className="flex-1 text-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                <p className="text-[10px] font-bold text-slate-500">フォロー</p>
                <p className="font-black text-slate-900 dark:text-white text-sm">{suggestedUsers.filter((r) => r.isFollowing).length}</p>
              </div>
            </div>
          </div>
          {user?.id && myCharacterStats && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
              <LoungeCharacter stage={myCharacterStats?.character_stage ?? 1} level={myCharacterStats?.level ?? 1} size={48} showLevel />
              <div className="min-w-0">
                <p className="text-xs font-bold text-orange-600">{STAGE_NAMES[myCharacterStats?.character_stage ?? 1]}</p>
                <p className="text-[10px] text-slate-500">{(getBadgeByExp(myCharacterStats?.total_exp ?? 0) || {}).label || 'Rookie'}</p>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">フィード</p>
            <div className="space-y-0.5">
              {[
                { id: 'popular', icon: Flame, label: '人気', color: 'orange' },
                { id: 'following', icon: User, label: 'フォロー中', color: 'orange', auth: true },
                { id: 'question', icon: HelpCircle, label: 'Q&A', color: 'orange' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { if (t.auth && !requireAuth()) return; setActiveTab(t.id) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold transition ${activeTab === t.id ? (t.color === 'violet' ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 border border-violet-200 dark:border-violet-800' : 'bg-orange-50 dark:bg-orange-950/30 text-orange-600') : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <t.icon size={16} className="shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="col-span-1 lg:col-span-6 space-y-4" id="lounge-main">
          <div className="lg:hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-1.5 flex gap-1 overflow-x-auto shrink-0">
            {[
              { id: 'popular', label: '人気' },
              { id: 'following', label: 'フォロー', auth: true },
              { id: 'question', label: 'Q&A' },
              { id: 'saved', label: '保存', auth: true },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { if (t.auth) { if (t.id === 'following') handleOpenFollowing(); else if (t.id === 'saved') handleOpenSaved(); else if (!requireAuth()) return } setActiveTab(t.id) }}
                className={`px-3 py-2 rounded-lg text-[12px] font-bold transition whitespace-nowrap shrink-0 ${
                  activeTab === t.id ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {newPostsCount > 0 && (
            <button
              type="button"
              onClick={handleRefreshNewPosts}
              className="w-full py-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-sm font-bold hover:bg-orange-100 dark:hover:bg-orange-900/40 transition"
            >
              新着 {newPostsCount}件 を表示
            </button>
          )}

          <div className="relative">
            <div className={`${!isLoggedIn ? 'blur-[2px] pointer-events-none select-none' : ''}`}>
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all focus-within:shadow-md focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 dark:focus-within:ring-orange-900/50">
                <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">{firstTwo(user?.displayName)}</div>
              <div className="flex-1 pt-1">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelected}
                  className="hidden"
                />
                <textarea
                  placeholder="市場の動向、気になる銘柄、金融のギモンをシェアしましょう...（#ハッシュタグで銘柄・トピックを追加）"
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  className="w-full bg-transparent resize-none outline-none text-[15px] sm:text-[16px] leading-6 text-slate-900 dark:text-slate-100 placeholder-slate-400 min-h-[80px]"
                />
                {attachedImages.length > 0 ? (
                    <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {attachedImages.map((img) => (
                      <div key={img.id} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800">
                        <img src={img.url} alt={img.file?.name || 'attachment'} className="w-full h-24 object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.id)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700 mt-2 gap-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={handlePickTag}
                      className="px-3 py-1.5 rounded-xl text-[12px] leading-none font-bold flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 shadow-sm hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
                    >
                      <Hash size={14} /> #ハッシュタグ（3個まで）
                    </button>
                    {tagInputOpen ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          value={composeTag}
                          onChange={(e) => setComposeTag(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleApplyTags() }}
                          placeholder="NVDA, USD/JPY, TOPIC"
                          className="px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 w-48"
                          autoFocus
                        />
                        <button type="button" onClick={handleApplyTags} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-[12px] font-bold hover:bg-blue-600">
                          適用
                        </button>
                        <button type="button" onClick={() => setTagInputOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      (composeTag.split(/[,\s、]+/).map((s) => s.trim()).filter(Boolean).slice(0, 3) || []).map((tag) => (
                        <span key={tag} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[12px] font-bold dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                          #{tag}
                        </span>
                      ))
                    )}
                    <div className="h-5 w-px bg-slate-200 dark:bg-slate-600 mx-1" />
                    <button onClick={() => setComposeSentiment(composeSentiment === 'bullish' ? null : 'bullish')} className={`px-3 py-1.5 rounded-xl text-[12px] leading-none font-bold flex items-center gap-1.5 border transition shadow-sm ${composeSentiment === 'bullish' ? 'bg-red-50 dark:bg-red-950/40 text-red-600 border-red-200 dark:border-red-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                      <TrendingUp size={14} /> 強気
                    </button>
                    <button onClick={() => setComposeSentiment(composeSentiment === 'bearish' ? null : 'bearish')} className={`px-3 py-1.5 rounded-xl text-[12px] leading-none font-bold flex items-center gap-1.5 border transition shadow-sm ${composeSentiment === 'bearish' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                      <TrendingDown size={14} /> 弱気
                    </button>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="flex gap-1 text-slate-400 relative">
                      <button onClick={handleAttachImages} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-orange-500 rounded-full transition">
                        <ImageIcon size={20} />
                      </button>
                      <button onClick={handleInsertChartTemplate} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-orange-500 rounded-full transition">
                        <BarChart2 size={20} />
                      </button>
                    </div>
                    <span className={`text-[11px] font-bold ${isOverLimit ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}>
                      {textLength}/{MAX_POST_LENGTH}
                    </span>
                    <button
                      disabled={!canPost || posting}
                      onClick={handlePost}
                      className={`min-w-[120px] px-6 py-2.5 font-bold text-[14px] leading-none whitespace-nowrap rounded-xl flex items-center justify-center gap-2 transition shadow-sm ${canPost ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                    >
                      投稿する <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
            {!isLoggedIn && (
              <div className="absolute inset-0 rounded-2xl border border-amber-200 dark:border-amber-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="max-w-md w-full rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-5 py-5 text-center">
                  <p className="text-sm font-black text-amber-800 dark:text-amber-200">投稿・コメント・保存はログイン後に利用できます</p>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-1">下のフィードは一部プレビュー表示です</p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button type="button" onClick={() => navigate('/login', { state: { from: '/lounge' } })} className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition shadow-sm">
                      ログイン
                    </button>
                    <button type="button" onClick={() => navigate('/signup')} className="px-4 py-2 rounded-xl border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition">
                      会員登録
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400 font-medium">読み込み中...</div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl p-6 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{error}</div>
          ) : (
            <div className="space-y-6">
              {previewPosts.map((post) => (
                <article
                  key={post.id}
                  onClick={() => { if (!isLoggedIn) return; setSelectedPost(post) }}
                  className={`bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all ${isLoggedIn ? 'hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <LoungeCharacter
                        stage={post.user.character_stage}
                        level={post.user.character_level}
                        size={44}
                        showLevel
                        className="shrink-0"
                      />
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 shadow-sm ${post.user.avatar}`}>
                        {post.user.name.substring(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-[15px] sm:text-[16px] text-slate-900 dark:text-slate-100">{post.user.name}</span>
                          {post.user.badge && <CheckCircle2 size={16} className="text-blue-600 fill-blue-50" />}
                          <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{post.user.character_badge?.label || 'Rookie'}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{post.user.handle} · {post.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isOwnPost(post) ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEditPost(post) }}
                            className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 p-2 rounded-full transition"
                            title="編集"
                            disabled={busyPostId === post.id}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeletePost(post) }}
                            className="text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 p-2 rounded-full transition"
                            title="削除"
                            disabled={busyPostId === post.id}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOtherPostMenuId(otherPostMenuId === post.id ? null : post.id) }}
                            className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 p-2 rounded-full transition"
                          >
                            <MoreHorizontal size={20} />
                          </button>
                          {otherPostMenuId === post.id && (
                            <>
                              <div className="fixed inset-0 z-[90]" onClick={() => setOtherPostMenuId(null)} aria-hidden />
                              <div className="absolute right-0 top-full mt-1 z-[91] w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigator.clipboard.writeText(`${window.location.origin}/lounge?post=${post.id}`)
                                    showToast('リンクをコピーしました', 'success')
                                    setOtherPostMenuId(null)
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <Share2 size={16} /> リンクをコピー
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    if (!user?.id) return
                                    const reason = window.prompt('報告理由を入力してください（任意）')
                                    try {
                                      await submitReport({
                                        reporterId: user.id,
                                        targetType: 'post',
                                        targetPostId: post.id,
                                        reason: 'inappropriate',
                                        details: reason || '',
                                      })
                                      showToast('報告を受け付けました', 'success')
                                    } catch (err) {
                                      showToast(err?.message || '報告に失敗しました', 'error')
                                    }
                                    setOtherPostMenuId(null)
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
                                >
                                  <Flag size={16} /> 報告する
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pl-0 sm:pl-[60px]">
                    {post.type === 'question' && (
                      <div className="inline-flex items-center gap-1.5 text-teal-700 bg-teal-50 text-[12px] font-extrabold px-3 py-1.5 rounded-lg mb-3 border border-teal-100">
                        <HelpCircle size={14} /> コミュニティへの質問
                      </div>
                    )}
                    <p className="text-[15px] sm:text-[16px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{isLoggedIn ? post.content : truncatePreviewContent(post.content)}</p>
                    {(post.image_urls?.length > 0) && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {post.image_urls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 block">
                            <img src={url} alt="" className="w-full h-32 object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {((post.tags && post.tags.length > 0) ? post.tags : [post.tag?.code || 'TOPIC']).filter(Boolean).slice(0, 3).map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-[12px] font-bold">
                          #{tag}
                        </span>
                      ))}
                      {post.sentiment === 'bullish' && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 shadow-sm">
                          <TrendingUp size={14} /> 強気
                        </span>
                      )}
                      {post.sentiment === 'bearish' && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 shadow-sm">
                          <TrendingDown size={14} /> 弱気
                        </span>
                      )}
                    </div>
                    {post.hasChart && post.tag?.code && (
                      <div className="mt-5">
                        <Link
                          to={`/stocks?symbol=${encodeURIComponent(post.tag.code)}`}
                          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <BarChart2 size={20} />
                          <span className="text-[13px] font-bold">${post.tag.code} のチャートを見る</span>
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-4 sm:gap-6">
                        <button
                          disabled={busyPostId === post.id}
                          onClick={(e) => { e.stopPropagation(); handleToggleLike(post) }}
                          className="flex items-center gap-2 group cursor-pointer"
                        >
                          <div className="p-2 sm:p-2.5 rounded-full group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 group-hover:text-orange-500 transition bg-slate-100 dark:bg-slate-800">
                            <Lightbulb size={18} />
                          </div>
                          <span className="text-[13px] font-bold">{post.stats.helpful}</span>
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="p-2 sm:p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><MessageCircle size={18} /></div>
                          <span className="text-[13px] font-bold">{post.stats.comments}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 text-slate-400">
                        <span className="text-[12px] font-bold flex items-center gap-1.5 mr-2">
                          <BarChart2 size={16} /> {post.stats.views}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); handleToggleBookmark(post) }} className="hover:text-orange-500 p-2 rounded-full hover:bg-orange-50 dark:hover:bg-orange-950/30 transition">
                          <Bookmark size={18} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/lounge?post=${post.id}`) }} className="hover:text-orange-500 p-2 rounded-full hover:bg-orange-50 dark:hover:bg-orange-950/30 transition">
                          <Share2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {filteredByTab.length === 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 border border-slate-200 dark:border-slate-700 text-center">
                  <p className="text-slate-500 dark:text-slate-400 font-medium">
                    {activeTab === 'question' ? 'Q&Aの投稿がまだありません。?や質問を含む投稿がここに表示されます。' : '表示する投稿がありません。'}
                  </p>
                  {search.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="mt-4 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition"
                    >
                      全体を見る
                    </button>
                  )}
                </div>
              )}
              {filteredByTab.length > 0 && (
                <div ref={loadMoreRef} className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
                  {loadingMore ? '読み込み中...' : hasMoreVisible || normalizedPosts.length >= feedLimit ? 'さらに読み込む' : 'これ以上の投稿はありません'}
                </div>
              )}
              {!isLoggedIn && filteredByTab.length > 0 && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5 text-center">
                  <p className="text-sm font-black text-amber-800 dark:text-amber-200">プレビューはここまでです</p>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-1">ログインで全機能が使えます</p>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button type="button" onClick={() => navigate('/login', { state: { from: '/lounge' } })} className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition">ログイン</button>
                    <button type="button" onClick={() => navigate('/signup')} className="px-4 py-2 rounded-xl border-2 border-amber-400 text-amber-700 text-sm font-bold hover:bg-amber-100 transition">会員登録</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="hidden lg:block lg:col-span-3 space-y-4 sticky top-[3.6rem] h-fit">
          <div className="rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 p-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm">🐕</div>
              <div>
                <p className="font-bold text-orange-900 dark:text-orange-200 text-sm">マネマート・シバ</p>
                <p className="text-[11px] text-orange-700/90 dark:text-orange-300/80">みんなで投資の気付きをシェアしよう</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="font-extrabold text-[15px] text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
              <PieChart size={18} className="text-blue-600" /> ラウンジの相場観
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">投稿の強気/弱気センチメントを集計した参考値です</p>
            {totalSentiment ? (
              <>
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex mb-2">
                  <div className="bg-red-500 h-full transition-all" style={{ width: `${totalSentiment.bullishPct}%` }} />
                  <div className="bg-blue-500 h-full transition-all" style={{ width: `${totalSentiment.bearishPct}%` }} />
                </div>
                <div className="flex justify-between items-center text-[10px] font-black tracking-wider uppercase">
                  <span className="text-red-500">Bullish {totalSentiment.bullishPct}%</span>
                  <span className="text-blue-500">Bearish {totalSentiment.bearishPct}%</span>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-4 py-5 text-sm font-medium text-slate-400 dark:text-slate-500">
                センチメント集計に十分な投稿がまだありません。
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h2 className="font-extrabold text-[14px] text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp size={16} className="text-orange-500" /> 話題の銘柄
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">クリックで検索</p>
            </div>
            <div className="flex flex-col">
              {trendingTags.map((item, i) => (
                <button key={item.tag} onClick={() => setSearch(item.tag)} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer flex justify-between items-center border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold mb-0.5">#{i + 1}</p>
                    <p className="font-extrabold text-[13px] text-slate-900 dark:text-slate-100">${item.tag}</p>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{item.count || 0}件</p>
                </button>
              ))}
              {trendingTags.length === 0 && <div className="px-4 py-4 text-sm text-slate-400 dark:text-slate-500">データがありません</div>}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="font-extrabold text-[14px] text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span className="text-orange-500">🏆</span> キャラランキング
            </h3>
            <div className="space-y-2">
              {characterLeaderboard.map((row, index) => (
                <div key={row.user_id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <span className="text-xs font-black text-slate-400 w-5">#{index + 1}</span>
                  <LoungeCharacter stage={row.character_stage} level={row.level} size={32} showLevel className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{row.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{row.total_exp} EXP</p>
                  </div>
                </div>
              ))}
              {characterLeaderboard.length === 0 && (
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-4 py-4 text-sm font-medium text-slate-400 dark:text-slate-500">
                  ランキングはまだありません。
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="font-extrabold text-[14px] text-slate-900 dark:text-slate-100 mb-3">おすすめユーザー</h3>
            <div className="space-y-2">
              {suggestedUsers.map((row, index) => (
                <div key={row.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${SUGGESTED_USER_AVATAR_CLASSES[index % SUGGESTED_USER_AVATAR_CLASSES.length]}`}>{row.name.slice(0, 1)}</div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                        {row.name}
                        {row.badge && <CheckCircle2 size={12} className="text-blue-500 shrink-0" />}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{row.handle}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleFollowUser(row)}
                    disabled={suggestedUserBusyId === row.id}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 ${
                      row.isFollowing
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {suggestedUserBusyId === row.id ? '...' : row.isFollowing ? 'フォロー中' : 'フォロー'}
                  </button>
                </div>
              ))}
              {!suggestedUsersLoading && suggestedUsers.length === 0 && (
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-4 py-4 text-sm font-medium text-slate-400 dark:text-slate-500">
                  おすすめユーザーはまだありません。
                </div>
              )}
              {suggestedUsersLoading && (
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-4 py-4 text-sm font-medium text-slate-400 dark:text-slate-500">
                  読み込み中...
                </div>
              )}
            </div>
          </div>
        </aside>
      </main>

      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => { setSelectedPost(null); setModalComment('') }} />
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl relative flex flex-col z-10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-20">
              <h2 className="font-extrabold text-[17px] text-slate-900 dark:text-slate-100">{selectedPost.type === 'question' ? 'Q&Aの詳細' : 'インサイトの詳細'}</h2>
              <button onClick={() => { setSelectedPost(null); setModalComment('') }} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <div>
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <LoungeCharacter
                    stage={selectedPost.user.character_stage ?? 1}
                    level={selectedPost.user.character_level ?? 1}
                    size={48}
                    showLevel
                    className="shrink-0"
                  />
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 shadow-sm ${selectedPost.user.avatar}`}>
                    {selectedPost.user.name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[16px] text-slate-900 dark:text-slate-100">{selectedPost.user.name}</span>
                      {selectedPost.user.badge && <CheckCircle2 size={16} className="text-blue-600 fill-blue-50" />}
                    </div>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{selectedPost.user.handle} · {selectedPost.time}</p>
                  </div>
                </div>
                <p className="text-[16px] sm:text-[18px] font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">{selectedPost.content}</p>
                {(selectedPost.image_urls?.length > 0) && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {selectedPost.image_urls.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 block">
                        <img src={url} alt="" className="w-full h-32 object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-slate-700 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">{firstTwo(user?.displayName)}</div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 p-2 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-orange-400 transition-colors">
                  {replyToComment && replyToComment.postId === selectedPost.id ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">→ @{replyToComment.replyToName} に返信</p>
                  ) : null}
                  <textarea
                    value={modalComment}
                    onChange={(e) => setModalComment(e.target.value)}
                    placeholder={replyToComment && replyToComment.postId === selectedPost.id ? `@${replyToComment.replyToName} に返信...` : (selectedPost.type === 'question' ? '客観的な視点で回答する...' : 'このインサイトに返信する...')}
                    className="w-full bg-transparent resize-none outline-none text-[14px] text-slate-900 dark:text-slate-100 placeholder-slate-400 min-h-[60px] p-2"
                  />
                  <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-600 px-2">
                    {replyToComment && replyToComment.postId === selectedPost.id ? (
                      <button onClick={() => setReplyToComment(null)} className="text-[12px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">キャンセル</button>
                    ) : null}
                    <button onClick={handleModalCommentSubmit} className="px-5 py-2 bg-orange-500 text-white font-bold text-[13px] rounded-xl hover:bg-orange-600 transition shadow-sm">
                      返信する
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <h3 className="font-bold text-[14px] text-slate-900 dark:text-slate-100 mb-4">コメント {(commentsByPost[selectedPost.id] || []).length}</h3>
                {(commentsByPost[selectedPost.id] && commentsByPost[selectedPost.id].length > 0) ? (
                  (() => {
                    const comments = commentsByPost[selectedPost.id] || []
                    const roots = comments.filter((c) => !c.parent_comment_id)
                    const byParent = comments.reduce((acc, c) => {
                      if (!c.parent_comment_id) return acc
                      const k = c.parent_comment_id
                      if (!acc[k]) acc[k] = []
                      acc[k].push(c)
                      return acc
                    }, {})
                    return roots.map((c) => (
                      <div key={c.id}>
                        <div className="flex gap-3 sm:gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-600">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {(c.author_name || 'M').substring(0, 1)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[14px] text-slate-900 dark:text-slate-100">{c.author_name || 'Member'}</span>
                                <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">· {timeAgo(c.created_at)}</span>
                              </div>
                              {user?.id && c.author_id !== user?.id ? (
                                <button
                                  type="button"
                                  onClick={() => setReplyToComment({ postId: selectedPost.id, commentId: c.id, replyToUserId: c.author_id, replyToName: c.author_name || 'Member' })}
                                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-orange-500 flex items-center gap-0.5"
                                >
                                  <Reply size={12} /> 返信
                                </button>
                              ) : null}
                            </div>
                            <p className="text-[14px] text-slate-800 dark:text-slate-200 leading-relaxed mb-3">{c.content}</p>
                          </div>
                        </div>
                        {(byParent[c.id] || []).map((r) => (
                          <div key={r.id} className="ml-6 mt-2 pl-4 border-l-2 border-slate-200 dark:border-slate-600">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">→ @{r.reply_to_name || r.author_name || 'Member'}</p>
                            <p className="font-bold text-[13px] text-slate-900 dark:text-slate-100">{r.author_name || 'Member'}</p>
                            <p className="text-[14px] text-slate-800 dark:text-slate-200 leading-relaxed">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    ))
                  })()
                ) : (
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-4 py-5 text-sm font-medium text-slate-400 dark:text-slate-500">
                    まだコメントはありません。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast.open && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120]">
          <div className={`px-4 py-2 rounded-xl text-xs font-bold shadow-lg border ${
            toast.tone === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : toast.tone === 'error'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : toast.tone === 'warn'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {editModal.open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setEditModal({ open: false, postId: '', content: '', ticker: '', sentiment: 'neutral', imageUrls: [], imageFiles: [], saving: false })}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-3">投稿を編集</h3>
            <textarea
              value={editModal.content}
              onChange={(e) => setEditModal((old) => ({ ...old, content: e.target.value }))}
              className="w-full min-h-[140px] rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-orange-400 placeholder-slate-400"
              placeholder="投稿内容"
            />
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">画像（最大{MAX_ATTACHMENTS}枚）</p>
              <div className="flex flex-wrap gap-2">
                {(editModal.imageUrls || []).map((url, idx) => (
                  <div key={`url-${idx}`} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 w-20 h-20">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditModal((old) => ({ ...old, imageUrls: (old.imageUrls || []).filter((_, i) => i !== idx) }))}
                      className="absolute top-0.5 right-0.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {(editModal.imageFiles || []).map((f, idx) => (
                  <div key={`file-${idx}`} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 w-20 h-20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-500 truncate px-1">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setEditModal((old) => ({ ...old, imageFiles: (old.imageFiles || []).filter((_, i) => i !== idx) }))}
                      className="absolute top-0.5 right-0.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {(editModal.imageUrls?.length || 0) + (editModal.imageFiles?.length || 0) < MAX_ATTACHMENTS && (
                  <>
                    <input
                      ref={editImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        const remain = Math.max(0, MAX_ATTACHMENTS - (editModal.imageUrls?.length || 0) - (editModal.imageFiles?.length || 0))
                        const picked = files.slice(0, remain)
                        setEditModal((old) => ({ ...old, imageFiles: [...(old.imageFiles || []), ...picked] }))
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => editImageInputRef.current?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:border-orange-400 hover:text-orange-500 transition"
                    >
                      <ImageIcon size={24} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <input
                value={editModal.ticker}
                onChange={(e) => setEditModal((old) => ({ ...old, ticker: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-orange-400 placeholder-slate-400"
                placeholder="銘柄タグ（任意）"
              />
              <select
                value={editModal.sentiment}
                onChange={(e) => setEditModal((old) => ({ ...old, sentiment: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-orange-400"
              >
                <option value="bullish">bullish</option>
                <option value="neutral">neutral</option>
                <option value="bearish">bearish</option>
              </select>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModal({ open: false, postId: '', content: '', ticker: '', sentiment: 'neutral', imageUrls: [], imageFiles: [], saving: false })}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                disabled={editModal.saving}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveEditPost}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black disabled:opacity-60 transition shadow-sm"
                disabled={editModal.saving}
              >
                {editModal.saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
