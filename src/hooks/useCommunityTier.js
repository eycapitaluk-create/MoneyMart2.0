import { useCallback, useEffect, useState } from 'react'
import { getTierForExp } from '../lib/communityTiers'
import { fetchMyCharacterStats } from '../lib/loungeCharacterApi'
import { scheduleIdleTask } from '../lib/scheduleIdle'

/**
 * Logged-in user's community badge tier + EXP for global nav chip.
 * Listens for `mm-community-tier-refresh` (e.g. after EXP award on Community page).
 */
export function useCommunityTier(session, enabled = true) {
  const [totalExp, setTotalExp] = useState(0)
  const [ready, setReady] = useState(false)
  const userId = session?.user?.id ?? null

  const refresh = useCallback(async () => {
    if (!userId) {
      setTotalExp(0)
      setReady(true)
      return
    }
    try {
      const stats = await fetchMyCharacterStats(userId)
      setTotalExp(Number(stats?.total_exp || 0))
    } catch {
      setTotalExp(0)
    } finally {
      setReady(true)
    }
  }, [userId])

  useEffect(() => {
    if (!enabled || !userId) {
      setTotalExp(0)
      setReady(!userId)
      return undefined
    }
    let cancelled = false
    setReady(false)
    const cancelIdle = scheduleIdleTask(() => {
      fetchMyCharacterStats(userId)
        .then((stats) => {
          if (!cancelled) setTotalExp(Number(stats?.total_exp || 0))
        })
        .catch(() => {
          if (!cancelled) setTotalExp(0)
        })
        .finally(() => {
          if (!cancelled) setReady(true)
        })
    })
    return () => {
      cancelled = true
      cancelIdle?.()
    }
  }, [enabled, userId])

  useEffect(() => {
    if (!enabled || !userId) return undefined
    const onRefresh = () => { refresh() }
    window.addEventListener('mm-community-tier-refresh', onRefresh)
    return () => window.removeEventListener('mm-community-tier-refresh', onRefresh)
  }, [enabled, userId, refresh])

  const tier = getTierForExp(totalExp)
  return { totalExp, tier, ready, refresh }
}

export function notifyCommunityTierRefresh() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('mm-community-tier-refresh'))
}
