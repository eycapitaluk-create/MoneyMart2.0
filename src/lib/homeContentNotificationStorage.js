/** ホーム「新着コンテンツ」バナー用。未初期化時はベースラインのみ保存し通知しない。 */
export const HOME_CONTENT_NOTIFY_KEY = 'mm_home_content_notify_v1'

export function loadHomeContentMarks() {
  try {
    const raw = localStorage.getItem(HOME_CONTENT_NOTIFY_KEY)
    if (!raw) {
      return {
        initialized: false,
        insightMaxPub: null,
        aiNewsMaxUpdated: null,
        manualNewsMaxPub: null,
      }
    }
    const j = JSON.parse(raw)
    return {
      initialized: Boolean(j.initialized),
      insightMaxPub: typeof j.insightMaxPub === 'string' ? j.insightMaxPub : null,
      aiNewsMaxUpdated: typeof j.aiNewsMaxUpdated === 'string' ? j.aiNewsMaxUpdated : null,
      manualNewsMaxPub: typeof j.manualNewsMaxPub === 'string' ? j.manualNewsMaxPub : null,
    }
  } catch {
    return {
      initialized: false,
      insightMaxPub: null,
      aiNewsMaxUpdated: null,
      manualNewsMaxPub: null,
    }
  }
}

export function saveHomeContentMarks(partial) {
  const prev = loadHomeContentMarks()
  const next = {
    ...prev,
    ...partial,
    initialized: true,
  }
  localStorage.setItem(HOME_CONTENT_NOTIFY_KEY, JSON.stringify(next))
}

/** Supabase JSON や API 応答を正規化（無効なら null） */
export function normalizeRemoteContentMarks(raw) {
  if (!raw || typeof raw !== 'object') return null
  const insightMaxPub = typeof raw.insightMaxPub === 'string' ? raw.insightMaxPub : null
  const aiNewsMaxUpdated = typeof raw.aiNewsMaxUpdated === 'string' ? raw.aiNewsMaxUpdated : null
  const manualNewsMaxPub = typeof raw.manualNewsMaxPub === 'string' ? raw.manualNewsMaxPub : null
  if (!insightMaxPub && !aiNewsMaxUpdated && !manualNewsMaxPub) return null
  return { insightMaxPub, aiNewsMaxUpdated, manualNewsMaxPub }
}

function maxSeenTimestamp(a, b) {
  if (!a) return b ?? null
  if (!b) return a
  return String(a) > String(b) ? a : b
}

/** 端末ローカルとサーバー既読のうち「より新しく見た」ほうを採用 */
export function mergeHomeContentMarks(local, remoteRaw) {
  const remote = normalizeRemoteContentMarks(remoteRaw)
  if (!remote) return local
  return {
    initialized: true,
    insightMaxPub: maxSeenTimestamp(local.insightMaxPub, remote.insightMaxPub),
    aiNewsMaxUpdated: maxSeenTimestamp(local.aiNewsMaxUpdated, remote.aiNewsMaxUpdated),
    manualNewsMaxPub: maxSeenTimestamp(local.manualNewsMaxPub, remote.manualNewsMaxPub),
  }
}

export function persistMergedHomeContentMarks(merged) {
  try {
    localStorage.setItem(
      HOME_CONTENT_NOTIFY_KEY,
      JSON.stringify({
        initialized: Boolean(merged.initialized),
        insightMaxPub: merged.insightMaxPub,
        aiNewsMaxUpdated: merged.aiNewsMaxUpdated,
        manualNewsMaxPub: merged.manualNewsMaxPub,
      }),
    )
  } catch {
    /* ignore */
  }
}

/** ISO 文字列の大小比較（同一フォーマット想定） */
export function isTimestampNewer(latest, seen) {
  if (!latest) return false
  if (!seen) return true
  return String(latest) > String(seen)
}
