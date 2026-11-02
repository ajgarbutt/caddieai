import { useCallback, useEffect, useRef, useState } from 'react'
import { prefetchSpeechAudio, resolveSpeechBlob } from '../services/speechApi'
import {
  diffNewSentences,
  isSpeechSynthesisSupported,
  prepareSpeechText,
} from '../utils/speechText'

/** Minimal silent WAV — unlocks autoplay when played during a user gesture. */
const SILENT_AUDIO =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

const MALE_VOICE_HINTS = [
  'daniel',
  'arthur',
  'george',
  'oliver',
  'james',
  'male',
]

function isLikelyMale(voice) {
  const name = voice.name?.toLowerCase() ?? ''
  if (name.includes('female')) return false
  return MALE_VOICE_HINTS.some((hint) => name.includes(hint))
}

function pickVoice(voices) {
  if (!voices.length) return null

  const enGb = voices.filter((v) => v.lang?.startsWith('en-GB'))
  const en = voices.filter((v) => v.lang?.startsWith('en'))

  return (
    enGb.find(isLikelyMale) ??
    en.find(isLikelyMale) ??
    voices.find((v) => v.lang === 'en-GB') ??
    enGb[0] ??
    en[0] ??
    voices[0]
  )
}

function speakWithBrowser(text, messageId, { voicesRef, onStart, onFinish }) {
  const prepared = prepareSpeechText(text)
  if (!prepared) return false

  const synthesis = window.speechSynthesis
  if (!voicesRef.current.length) {
    voicesRef.current = synthesis.getVoices()
  }

  const utterance = new SpeechSynthesisUtterance(prepared)
  const voice = pickVoice(voicesRef.current)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'en-GB'
  }
  utterance.rate = 1.15

  utterance.onstart = () => onStart(messageId)
  utterance.onend = onFinish
  utterance.onerror = (event) => {
    if (import.meta.env.DEV && event.error !== 'canceled') {
      console.warn('[speech] browser synthesis error:', event.error)
    }
    onFinish()
  }

  synthesis.resume()
  window.setTimeout(() => {
    synthesis.resume()
    synthesis.speak(utterance)
  }, 50)

  return true
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [speechError, setSpeechError] = useState('')

  const audioRef = useRef(null)
  const objectUrlRef = useRef(null)
  const voicesRef = useRef([])
  const primedRef = useRef(false)
  const browserSupported = isSpeechSynthesisSupported()

  const queueRef = useRef([])
  const queueRunningRef = useRef(false)
  const streamStateRef = useRef(null)
  const generationRef = useRef(0)

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const finish = useCallback(() => {
    setIsSpeaking(false)
    setActiveId(null)
  }, [])

  const ensureAudioElement = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
    }
    return audioRef.current
  }, [])

  const primeAudio = useCallback(() => {
    const audio = ensureAudioElement()
    if (primedRef.current) return

    audio.volume = 0.01
    audio.src = SILENT_AUDIO
    audio
      .play()
      .then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.volume = 1
        audio.removeAttribute('src')
        audio.load()
        primedRef.current = true
      })
      .catch(() => {
        audio.volume = 1
      })
  }, [ensureAudioElement])

  const stop = useCallback(() => {
    generationRef.current += 1
    queueRef.current = []
    queueRunningRef.current = false
    streamStateRef.current = null
    revokeObjectUrl()

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }

    if (browserSupported) {
      window.speechSynthesis.cancel()
    }

    finish()
  }, [browserSupported, finish, revokeObjectUrl])

  const playAudioBlob = useCallback(
    async (blob, messageId, generation) => {
      revokeObjectUrl()

      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const audio = ensureAudioElement()
      audio.src = url
      audioRef.current = audio

      setIsSpeaking(true)
      setActiveId(messageId)
      setSpeechError('')

      await new Promise((resolve, reject) => {
        const onEnded = () => {
          if (generation !== generationRef.current) {
            resolve()
            return
          }
          audio.removeEventListener('ended', onEnded)
          audio.removeEventListener('error', onError)
          finish()
          resolve()
        }

        const onError = () => {
          audio.removeEventListener('ended', onEnded)
          audio.removeEventListener('error', onError)
          finish()
          reject(new Error('Audio playback failed.'))
        }

        audio.addEventListener('ended', onEnded)
        audio.addEventListener('error', onError)

        audio.play().catch((error) => {
          audio.removeEventListener('ended', onEnded)
          audio.removeEventListener('error', onError)
          finish()
          if (error?.name === 'NotAllowedError') {
            reject(
              new Error('Tap Read aloud to hear this — your browser blocked auto-play.')
            )
            return
          }
          reject(error)
        })
      })
    },
    [ensureAudioElement, finish, revokeObjectUrl]
  )

  const processQueue = useCallback(async () => {
    if (queueRunningRef.current) return
    queueRunningRef.current = true
    const generation = generationRef.current

    while (queueRef.current.length > 0 && generation === generationRef.current) {
      const item = queueRef.current.shift()
      try {
        const blob = await resolveSpeechBlob(item.text)
        if (generation !== generationRef.current) break
        await playAudioBlob(blob, item.messageId, generation)
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[speech] queue playback failed:', error)
        }
        if (generation === generationRef.current) {
          setSpeechError(error.message || 'Could not play speech audio.')
        }
        break
      }
    }

    queueRunningRef.current = false

    if (
      generation === generationRef.current &&
      queueRef.current.length > 0 &&
      !queueRunningRef.current
    ) {
      processQueue()
    }
  }, [playAudioBlob])

  const enqueueSentences = useCallback(
    (sentences, messageId) => {
      if (!sentences.length) return

      for (const sentence of sentences) {
        prefetchSpeechAudio(sentence)
        queueRef.current.push({ text: sentence, messageId })
      }

      processQueue()
    },
    [processQueue]
  )

  const beginStreamingSpeech = useCallback((messageId) => {
    generationRef.current += 1
    queueRef.current = []
    queueRunningRef.current = false
    streamStateRef.current = {
      messageId,
      queuedCount: 0,
      generation: generationRef.current,
      started: false,
    }
  }, [])

  const feedStreamingSpeech = useCallback(
    (fullText, messageId) => {
      if (!fullText?.trim()) return

      let state = streamStateRef.current
      if (!state || state.messageId !== messageId) {
        beginStreamingSpeech(messageId)
        state = streamStateRef.current
      }

      const { newSentences, totalComplete } = diffNewSentences(
        fullText,
        state.queuedCount
      )

      if (newSentences.length === 0) return

      state.queuedCount = totalComplete
      state.started = true
      enqueueSentences(newSentences, messageId)
    },
    [beginStreamingSpeech, enqueueSentences]
  )

  const finalizeStreamingSpeech = useCallback(
    (fullText, messageId) => {
      if (!fullText?.trim()) {
        streamStateRef.current = null
        return false
      }

      let state = streamStateRef.current
      if (!state || state.messageId !== messageId) {
        beginStreamingSpeech(messageId)
        state = streamStateRef.current
      }

      const { newSentences, totalComplete, remainder } = diffNewSentences(
        fullText,
        state.queuedCount
      )

      state.queuedCount = totalComplete

      if (newSentences.length > 0) {
        state.started = true
        enqueueSentences(newSentences, messageId)
      }

      if (remainder.length > 2) {
        state.started = true
        enqueueSentences([remainder], messageId)
      }

      const started = state.started
      streamStateRef.current = null
      return started
    },
    [beginStreamingSpeech, enqueueSentences]
  )

  const speakWithBrowserFallback = useCallback(
    (text, messageId) => {
      if (!browserSupported) {
        setSpeechError('Speech is unavailable in this browser.')
        return false
      }

      const started = speakWithBrowser(text, messageId, {
        voicesRef,
        onStart: (id) => {
          setSpeechError('')
          setIsSpeaking(true)
          setActiveId(id)
        },
        onFinish: finish,
      })

      if (!started) {
        setSpeechError('Nothing to read aloud.')
      }

      return started
    },
    [browserSupported, finish]
  )

  const speak = useCallback(
    async (text, messageId) => {
      if (!text?.trim()) return

      stop()

      try {
        const blob = await resolveSpeechBlob(text)
        await playAudioBlob(blob, messageId, generationRef.current)
      } catch (apiError) {
        if (import.meta.env.DEV) {
          console.warn('[speech] API TTS failed, trying browser speech:', apiError)
        }

        const browserStarted = speakWithBrowserFallback(text, messageId)
        if (!browserStarted) {
          setSpeechError(
            apiError.message ||
              'Could not play speech audio. Use npm run dev:full so /api/speak is available.'
          )
        }
      }
    },
    [playAudioBlob, speakWithBrowserFallback, stop]
  )

  useEffect(() => {
    if (!browserSupported) return

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
      stop()
    }
  }, [browserSupported, stop])

  return {
    supported: true,
    isSpeaking,
    activeId,
    speechError,
    primeAudio,
    speak,
    feedStreamingSpeech,
    finalizeStreamingSpeech,
    stop,
  }
}
