import { prepareSpeechText } from '../utils/speechText'

const blobCache = new Map()
const pendingCache = new Map()
const MAX_CACHE_ENTRIES = 24

function trimCache() {
  while (blobCache.size > MAX_CACHE_ENTRIES) {
    const oldest = blobCache.keys().next().value
    blobCache.delete(oldest)
  }
}

export function clearSpeechCache() {
  blobCache.clear()
  pendingCache.clear()
}

export async function fetchSpeechAudio(text, { stream = true } = {}) {
  const prepared = prepareSpeechText(text)
  if (!prepared) {
    throw new Error('No text to speak.')
  }

  const cached = blobCache.get(prepared)
  if (cached) return cached

  const pending = pendingCache.get(prepared)
  if (pending) return pending

  const promise = (async () => {
    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prepared, stream }),
    })

    if (!response.ok) {
      let message = 'Could not load speech audio.'
      try {
        const data = await response.json()
        if (data?.error) message = data.error
      } catch {
        // ignore
      }
      throw new Error(message)
    }

    const blob = await response.blob()
    blobCache.set(prepared, blob)
    pendingCache.delete(prepared)
    trimCache()
    return blob
  })()

  pendingCache.set(prepared, promise)
  return promise
}

/** Prefetch audio without waiting — used to pipeline sentence TTS. */
export function prefetchSpeechAudio(text) {
  const prepared = prepareSpeechText(text)
  if (!prepared || blobCache.has(prepared) || pendingCache.has(prepared)) {
    return null
  }
  fetchSpeechAudio(prepared, { stream: true }).catch(() => {
    pendingCache.delete(prepared)
  })
  return true
}

export async function resolveSpeechBlob(textOrPromise) {
  if (textOrPromise instanceof Blob) return textOrPromise
  if (typeof textOrPromise === 'string') {
    return fetchSpeechAudio(textOrPromise, { stream: true })
  }
  throw new Error('Could not load speech audio.')
}
