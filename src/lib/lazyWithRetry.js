import { lazy } from 'react'

/** 한 탭에서 배포 직후 등으로 청크 로드가 깨졌을 때 자동 새로고침은 최대 1회만 */
export const CHUNK_AUTO_RELOAD_SESSION_KEY = 'mm_chunk_autoreload_v1'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isChunkLoadError = (err) => {
  const msg = String(err?.message || err || '')
  return (
    /Loading chunk \d+ failed/i.test(msg)
    || /Failed to fetch dynamically imported module/i.test(msg)
    || /Importing a module script failed/i.test(msg)
    || /error loading dynamically imported module/i.test(msg)
    || /ChunkLoadError/i.test(msg)
  )
}

/**
 * React.lazy + 동적 import 재시도. 모바일·캐시 불일치로 흔한 청크 로드 실패를 완화する。
 */
export function lazyWithRetry(importer, options = {}) {
  const retries = Number.isFinite(Number(options.retries)) ? Math.max(1, Math.floor(Number(options.retries))) : 3
  const delayMs = Number.isFinite(Number(options.delayMs)) ? Math.max(0, Number(options.delayMs)) : 450

  return lazy(async () => {
    let lastErr
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        return await importer()
      } catch (e) {
        lastErr = e
        const chunk = isChunkLoadError(e)
        if (!chunk) throw e
        if (attempt < retries - 1) {
          await sleep(delayMs * (attempt + 1))
          continue
        }
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            if (!window.sessionStorage.getItem(CHUNK_AUTO_RELOAD_SESSION_KEY)) {
              window.sessionStorage.setItem(CHUNK_AUTO_RELOAD_SESSION_KEY, String(Date.now()))
              window.location.reload()
              return await new Promise(() => {})
            }
          }
        } catch {
          // private mode など
        }
        throw lastErr
      }
    }
    throw lastErr
  })
}

const isChunkLoadMessage = (msg) => {
  const s = String(msg || '')
  return (
    /Loading chunk \d+ failed/i.test(s)
    || /Failed to fetch dynamically imported module/i.test(s)
    || /Importing a module script failed/i.test(s)
    || /error loading dynamically imported module/i.test(s)
    || /ChunkLoadError/i.test(s)
  )
}

/**
 * lazy 바깥에서 터지는 동적 import 실패에 대해 1회만 자동 새로고침（sessionStorage 공유）
 */
export function installChunkErrorRecovery() {
  if (typeof window === 'undefined') return

  const maybeReload = (msg) => {
    if (!isChunkLoadMessage(msg)) return
    try {
      if (!window.sessionStorage?.getItem(CHUNK_AUTO_RELOAD_SESSION_KEY)) {
        window.sessionStorage.setItem(CHUNK_AUTO_RELOAD_SESSION_KEY, String(Date.now()))
        window.location.reload()
      }
    } catch {
      // ignore
    }
  }

  window.addEventListener('unhandledrejection', (event) => {
    const r = event?.reason
    maybeReload(r?.message || r)
  })

  window.addEventListener('error', (event) => {
    maybeReload(event?.message || '')
  })
}
