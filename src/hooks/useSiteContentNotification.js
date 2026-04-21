import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { trackAnalyticsEvent } from '../lib/analytics'
import {
  loadHomeContentMarks,
  saveHomeContentMarks,
  isTimestampNewer,
  mergeHomeContentMarks,
  normalizeRemoteContentMarks,
  persistMergedHomeContentMarks,
} from '../lib/homeContentNotificationStorage'
import { NEWS_PAGE_MANUAL_BUCKET } from '../lib/aiNewsClient'

const SITE_CONTENT_SYNC = 'mm-site-content-marks-sync'

async function fetchProfileContentMarks(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('user_profiles')
    .select('site_content_notify_marks')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data.site_content_notify_marks
}

function pushContentMarksToProfile(userId, marks) {
  if (!userId) return Promise.resolve()
  const payload = {
    insightMaxPub: marks.insightMaxPub ?? null,
    manualNewsMaxPub: marks.manualNewsMaxPub ?? null,
    aiNewsMaxUpdated: marks.aiNewsMaxUpdated ?? null,
  }
  return supabase
    .from('user_profiles')
    .update({ site_content_notify_marks: payload })
    .eq('user_id', userId)
}

/**
 * insight_articles / news_manual / ai_news_summaries の新着を既読と比較。
 * 未ログイン時はベル対象外（計算しない）。
 * ログイン時は user_profiles.site_content_notify_marks と localStorage をマージ（端末間でベル状態を揃える）。
 * 既読保存後は Supabase 更新＋ mm-site-content-marks-sync／フォアグラウンド復帰で再フェッチ。
 */
export function useSiteContentNotification(userId = null) {
  const [insightNew, setInsightNew] = useState(false)
  const [newsNew, setNewsNew] = useState(false)
  const [insightLatest, setInsightLatest] = useState(null)
  const [newsLatest, setNewsLatest] = useState(null)
  const [marksSyncTick, setMarksSyncTick] = useState(0)
  const latestNewsMarksRef = useRef({ manualPub: null, aiTs: null })
  const insightLatestRef = useRef(null)
  const userIdRef = useRef(null)

  useEffect(() => {
    insightLatestRef.current = insightLatest
  }, [insightLatest])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const syncAfterAcknowledge = useCallback(() => {
    const uid = userIdRef.current
    if (!uid) return
    const marks = loadHomeContentMarks()
    void pushContentMarksToProfile(uid, marks)
      .then(() => {
        window.dispatchEvent(new CustomEvent(SITE_CONTENT_SYNC))
      })
      .catch(() => {})
  }, [])

  /** 他タブでの既読 / 別端末で user_profiles 更新後、フォアグラウンド復帰で再取得 */
  useEffect(() => {
    const bump = () => setMarksSyncTick((t) => t + 1)
    window.addEventListener(SITE_CONTENT_SYNC, bump)
    return () => window.removeEventListener(SITE_CONTENT_SYNC, bump)
  }, [])

  useEffect(() => {
    if (!userId) return undefined
    let timer = null
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      clearTimeout(timer)
      timer = setTimeout(() => setMarksSyncTick((t) => t + 1), 500)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setInsightNew(false)
      setNewsNew(false)
      setInsightLatest(null)
      setNewsLatest(null)
      return undefined
    }
    let cancelled = false
    const run = async () => {
      try {
        const uidAtStart = userId
        const [insRes, manualRes, aiRes, remoteRaw] = await Promise.all([
          supabase
            .from('insight_articles')
            .select('published_at,updated_at,page_title,slug')
            .eq('is_published', true)
            .order('published_at', { ascending: false })
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('news_manual')
            .select('id,published_at,title')
            .eq('bucket', NEWS_PAGE_MANUAL_BUCKET)
            .eq('is_active', true)
            .order('published_at', { ascending: false })
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('ai_news_summaries')
            .select('id,updated_at,published_at,headline')
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle(),
          fetchProfileContentMarks(uidAtStart),
        ])
        if (cancelled) return

        const ins = insRes.error ? null : insRes.data
        const manual = manualRes.error ? null : manualRes.data
        const ai = aiRes.error ? null : aiRes.data

        const insightPub = ins?.published_at || ins?.updated_at || null
        const manualPub = manual?.published_at || null
        const aiTs = ai?.updated_at || ai?.published_at || null
        latestNewsMarksRef.current = { manualPub, aiTs }

        setInsightLatest(
          insightPub
            ? {
                at: insightPub,
                headline: ins?.page_title || '',
                slug: String(ins?.slug || '').trim(),
              }
            : null,
        )

        const localBefore = loadHomeContentMarks()
        const marks = mergeHomeContentMarks(localBefore, remoteRaw)

        if (normalizeRemoteContentMarks(remoteRaw)) {
          persistMergedHomeContentMarks({ ...marks, initialized: true })
        }

        if (!marks.initialized) {
          saveHomeContentMarks({
            insightMaxPub: insightPub,
            aiNewsMaxUpdated: aiTs,
            manualNewsMaxPub: manualPub,
          })
          if (uidAtStart) {
            const baseline = loadHomeContentMarks()
            void pushContentMarksToProfile(uidAtStart, baseline).catch(() => {})
          }
          setInsightNew(false)
          setNewsNew(false)
          setNewsLatest(null)
          return
        }

        const inew = isTimestampNewer(insightPub, marks.insightMaxPub)
        const manualIsNew = isTimestampNewer(manualPub, marks.manualNewsMaxPub)
        const aiIsNew = isTimestampNewer(aiTs, marks.aiNewsMaxUpdated)
        const nnew = manualIsNew || aiIsNew

        if (nnew) {
          const candidates = []
          if (manualIsNew && manualPub && manual?.id) {
            candidates.push({
              at: manualPub,
              headline: manual?.title || '',
              kind: 'manual',
              newsId: String(manual.id),
            })
          }
          if (aiIsNew && aiTs && ai?.id) {
            candidates.push({
              at: aiTs,
              headline: ai?.headline || '',
              kind: 'ai',
              newsId: String(ai.id),
            })
          }
          candidates.sort((a, b) => String(b.at).localeCompare(String(a.at)))
          const top = candidates[0]
          setNewsLatest(
            top?.at
              ? {
                  at: top.at,
                  headline: top.headline || '',
                  kind: top.kind,
                  newsId: top.newsId,
                }
              : null,
          )
        } else {
          setNewsLatest(null)
        }

        setInsightNew(inew)
        setNewsNew(nnew)
      } catch {
        /* silent */
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [userId, marksSyncTick])

  const acknowledgeInsight = useCallback(() => {
    const at = insightLatestRef.current?.at || null
    saveHomeContentMarks({ insightMaxPub: at })
    setInsightNew(false)
    syncAfterAcknowledge()
    trackAnalyticsEvent('site_content_notify_dismiss', { channel: 'insight' })
  }, [syncAfterAcknowledge])

  const acknowledgeNews = useCallback(() => {
    const { manualPub, aiTs } = latestNewsMarksRef.current
    saveHomeContentMarks({
      manualNewsMaxPub: manualPub,
      aiNewsMaxUpdated: aiTs,
    })
    setNewsNew(false)
    setNewsLatest(null)
    syncAfterAcknowledge()
    trackAnalyticsEvent('site_content_notify_dismiss', { channel: 'news_feed' })
  }, [syncAfterAcknowledge])

  const acknowledgeAllSiteContent = useCallback(() => {
    const { manualPub, aiTs } = latestNewsMarksRef.current
    saveHomeContentMarks({
      insightMaxPub: insightLatestRef.current?.at || null,
      manualNewsMaxPub: manualPub,
      aiNewsMaxUpdated: aiTs,
    })
    setInsightNew(false)
    setNewsNew(false)
    setNewsLatest(null)
    syncAfterAcknowledge()
    trackAnalyticsEvent('site_content_notify_dismiss', { channel: 'all' })
  }, [syncAfterAcknowledge])

  return {
    siteContentActive: insightNew || newsNew,
    insightNew,
    newsNew,
    insightLatest,
    newsLatest,
    acknowledgeInsight,
    acknowledgeNews,
    acknowledgeAllSiteContent,
  }
}
