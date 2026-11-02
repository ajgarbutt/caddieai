import { toDisplayAdvice } from './adviceFormat'

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function prepareSpeechText(text) {
  if (!text) return ''

  return toDisplayAdvice(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split prepared text into complete sentences and any trailing fragment. */
export function splitSpeakableSentences(text) {
  const prepared = prepareSpeechText(text)
  if (!prepared) return { complete: [], remainder: '' }

  const complete = []
  let buffer = ''

  for (let i = 0; i < prepared.length; i += 1) {
    buffer += prepared[i]
    const char = prepared[i]

    if (char !== '.' && char !== '!' && char !== '?') continue

    let end = i + 1
    while (end < prepared.length && /['"]/.test(prepared[end])) {
      buffer += prepared[end]
      end += 1
    }

    const sentence = buffer.trim()
    if (sentence.length > 2) {
      complete.push(sentence)
    }
    buffer = ''
    i = end - 1
  }

  return { complete, remainder: buffer.trim() }
}

/** Return newly completed sentences since the last feed call. */
export function diffNewSentences(fullText, alreadyQueuedCount) {
  const { complete, remainder } = splitSpeakableSentences(fullText)
  return {
    newSentences: complete.slice(alreadyQueuedCount),
    totalComplete: complete.length,
    remainder,
    isFinalized: false,
  }
}
