/** Bound existing CRM reads; never retry or substitute an empty successful result. */
export async function runCrmQuery(makeQuery, { label = 'CRM source', timeoutMs = 30000 } = {}) {
  const controller = new AbortController()
  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds. Counts are not confirmed. Please refresh later.`))
      controller.abort()
    }, timeoutMs)
  })
  try {
    return await Promise.race([Promise.resolve().then(() => makeQuery(controller.signal)), deadline])
  } finally {
    clearTimeout(timer)
  }
}
