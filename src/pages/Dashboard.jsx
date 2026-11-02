import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Button from '../components/Button'
import Modal from '../components/Modal'
import VoiceMicHero from '../components/VoiceMicHero'
import ShotConversation from '../components/ShotConversation'
import { useApp } from '../context/AppContext'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { hasActiveConversation } from '../utils/shot'
import { shouldAutoReadAdvice } from '../utils/adviceFormat'
import { transcribeAudio } from '../services/audioApi'
import { getCaddieAdvice } from '../services/caddieApi'
import { MAX_RECORDING_SECONDS } from '../constants/recording.js'
import { holesInPlay } from '../golf/roundPlay'
import { buildSgExpertBrief } from '../golf/sgExpertBrief.ts'
import { expertRoundLabel, resolveSgScope, sgScopeReply } from '../golf/sgExpertScope.ts'
import { DEFAULT_REFERENCE_HANDICAP, DEFAULT_SG_MODE } from '../golf/schema.js'

const TRANSCRIBE_ERROR =
  "I couldn't hear that clearly. Tap the mic and try again."
const CADDIE_ERROR = 'Sorry, something went wrong. Please try again.'

function pickRecorderMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/m4a']
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function buildDashboardSubtitle(profile, currentShot, expert) {
  const name = profile?.name?.trim()
  if (expert) {
    return name ? `Ask about your stats, ${name}.` : 'Ask about your stats.'
  }
  if (hasActiveConversation(currentShot)) {
    return name
      ? `Continuing your shot, ${name}. Tap the mic to add more.`
      : 'Continuing your shot. Tap the mic to add more.'
  }
  return name
    ? `What are we hitting, ${name}?`
    : 'Tell me about your next shot.'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    profile,
    clubs,
    voiceSettings,
    rounds = [],
    courses = [],
    golfShots = [],
    currentShot,
    sgChat,
    clearCurrentShot,
    addShotMessage,
    removeLastShotMessage,
    updateLastAssistantMessage,
    updateShotDetails,
    addSgMessage,
    removeLastSgMessage,
    updateLastSgMessage,
    clearSgChat,
    setSgScope,
  } = useApp()

  const [coachMode, setCoachMode] = useState('caddie')
  const expert = coachMode === 'sg'

  const { supported: speechSupported, isSpeaking, activeId, speechError, primeAudio, speak, stop } =
    useSpeechSynthesis()

  const [micState, setMicState] = useState('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [showNewShotModal, setShowNewShotModal] = useState(false)
  const [isAwaitingAdvice, setIsAwaitingAdvice] = useState(false)
  const [streamingReply, setStreamingReply] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [retryMode, setRetryMode] = useState(null)

  const timerRef = useRef(null)
  const processingRef = useRef(false)
  const lastAutoReadRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const stopRecordingToBlobRef = useRef(null)
  const streamingTextRef = useRef('')

  const messages = expert ? (sgChat?.messages ?? []) : (currentShot?.messages ?? [])
  const finishedRoundCount = rounds.filter(
    (round) => round.status === 'complete' && round.includeInAnalysis !== false
  ).length
  const sgInputs = useMemo(
    () =>
      rounds.map((round) => ({
        id: round.id,
        playedAt: round.playedAt,
        createdAt: round.createdAt,
        courseId: round.courseId,
        status: round.status === 'complete' ? 'complete' : 'in_progress',
        includeInAnalysis: round.includeInAnalysis !== false,
        nineHoles: round.nineHoles,
        courseRating: round.courseRating,
        slopeRating: round.slopeRating,
        handicapScoreOverride: round.handicapScoreOverride,
        holes: holesInPlay(round),
        shots: golfShots.filter((shot) => shot.roundId === round.id),
      })),
    [golfShots, rounds]
  )
  const sgCatalog = useMemo(
    () =>
      rounds.map((round) => ({
        id: round.id,
        playedAt: round.playedAt,
        createdAt: round.createdAt,
        courseName: courses.find((course) => course.id === round.courseId)?.name ?? 'Course',
        finished: round.status === 'complete' && round.includeInAnalysis !== false,
      })),
    [courses, rounds]
  )

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cleanupRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(
    () => () => {
      stopTimer()
      cleanupRecording()
      stop()
    },
    [stopTimer, cleanupRecording, stop]
  )

  const lastMessage = messages[messages.length - 1]
  const lastMessageKey = lastMessage
    ? `${lastMessage.createdAt}-${messages.length - 1}`
    : null

  useEffect(() => {
    if (isAwaitingAdvice || !speechSupported || !voiceSettings.autoReadResponses) {
      return
    }

    if (
      !lastMessage ||
      lastMessage.role !== 'assistant' ||
      !shouldAutoReadAdvice(lastMessage.text)
    ) {
      return
    }

    if (lastAutoReadRef.current === lastMessageKey) return
    lastAutoReadRef.current = lastMessageKey
    const timer = window.setTimeout(() => {
      speak(lastMessage.text, lastMessageKey)
    }, 100)

    return () => window.clearTimeout(timer)
  }, [
    lastMessage,
    lastMessageKey,
    isAwaitingAdvice,
    speechSupported,
    speak,
    voiceSettings.autoReadResponses,
  ])

  const stopRecordingToBlob = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: mimeType })
            : null
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        mediaRecorderRef.current = null
        chunksRef.current = []
        resolve(blob)
      }

      recorder.stop()
    })
  }, [])

  stopRecordingToBlobRef.current = stopRecordingToBlob

  const requestCaddieAdvice = useCallback(
    async (conversationMessages) => {
      const askingExpert = coachMode === 'sg'
      const addAssistant = askingExpert ? addSgMessage : addShotMessage
      const updateAssistant = askingExpert ? updateLastSgMessage : updateLastAssistantMessage
      const removeAssistant = askingExpert ? removeLastSgMessage : removeLastShotMessage
      setIsAwaitingAdvice(true)
      setStreamingReply('')
      streamingTextRef.current = ''
      addAssistant('assistant', '')

      try {
        let brief = null
        if (askingExpert) {
          const latest = [...conversationMessages].reverse().find((message) => message.role === 'user')
          const choice = resolveSgScope(latest?.text ?? '', sgCatalog, sgChat?.scope ?? null)
          if (choice.kind !== 'career' && choice.kind !== 'round') {
            updateAssistant(sgScopeReply(choice, sgCatalog))
            setStreamingReply('')
            return
          }
          const scope =
            choice.kind === 'round'
              ? { kind: 'round', roundId: choice.round.id, label: expertRoundLabel(choice.round) }
              : { kind: 'career' }
          setSgScope(choice.kind === 'round' ? choice.round.id : 'career')
          brief = buildSgExpertBrief(sgInputs, {
            referenceHandicap: profile.referenceHandicap ?? DEFAULT_REFERENCE_HANDICAP,
            sgMode: profile.sgMode ?? DEFAULT_SG_MODE,
          }, scope).text
        }
        const { reply, extractedShotDetails } = await getCaddieAdvice({
          profile,
          clubs,
          shotDetails: askingExpert ? null : (currentShot?.details ?? null),
          messages: conversationMessages,
          stream: true,
          mode: askingExpert ? 'sg' : 'caddie',
          brief,
          onDelta: (delta) => {
            streamingTextRef.current += delta
            setStreamingReply(streamingTextRef.current)
          },
        })

        updateAssistant(reply)
        setStreamingReply('')

        if (!askingExpert && extractedShotDetails) {
          updateShotDetails(extractedShotDetails)
        }
      } catch (error) {
        removeAssistant()
        setStreamingReply('')
        streamingTextRef.current = ''
        throw error
      } finally {
        setIsAwaitingAdvice(false)
      }
    },
    [
      addSgMessage,
      addShotMessage,
      clubs,
      coachMode,
      currentShot?.details,
      profile,
      removeLastSgMessage,
      removeLastShotMessage,
      setSgScope,
      sgCatalog,
      sgChat?.scope,
      sgInputs,
      updateLastAssistantMessage,
      updateLastSgMessage,
      updateShotDetails,
    ]
  )

  const processRecording = useCallback(
    async (blob) => {
      if (processingRef.current) return
      processingRef.current = true
      setMicState('processing')
      setErrorMessage('')
      setRetryMode(null)

      let transcriptAdded = false

      try {
        const transcript = await transcribeAudio(blob)
        const userMessage = {
          role: 'user',
          text: transcript,
          createdAt: new Date().toISOString(),
        }

        const addUser = coachMode === 'sg' ? addSgMessage : addShotMessage
        addUser('user', transcript)
        transcriptAdded = true

        await requestCaddieAdvice([...messages, userMessage])
      } catch (error) {
        if (transcriptAdded) {
          setRetryMode('caddie')
          setErrorMessage(CADDIE_ERROR)
        } else {
          setRetryMode('transcribe')
          setErrorMessage(error.message || TRANSCRIBE_ERROR)
        }
      } finally {
        processingRef.current = false
        setMicState('idle')
      }
    },
    [addSgMessage, addShotMessage, coachMode, messages, requestCaddieAdvice]
  )

  const startRecording = useCallback(async () => {
    setErrorMessage('')
    setRetryMode(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage(
        'Microphone recording is not supported in this browser. Use HTTPS in production.'
      )
      return false
    }

    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices()
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      streamRef.current = stream
      mediaRecorderRef.current = recorder
      recorder.start()
      return true
    } catch {
      setErrorMessage(
        'Microphone access is required. Please allow access and try again.'
      )
      return false
    }
  }, [])

  const handleMicTap = async () => {
    if (micState === 'processing' || isAwaitingAdvice) return

    if (micState === 'idle') {
      primeAudio()
      const started = await startRecording()
      if (!started) return

      setRecordingSeconds(0)
      setMicState('recording')
      timerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => {
          const next = seconds + 1
          if (next >= MAX_RECORDING_SECONDS) {
            stopTimer()
            stopRecordingToBlobRef.current?.().then((blob) => {
              if (blob && blob.size > 0) {
                processRecording(blob)
              } else {
                setMicState('idle')
                setErrorMessage(TRANSCRIBE_ERROR)
              }
            })
            setMicState('processing')
          }
          return next
        })
      }, 1000)
      return
    }

    if (micState === 'recording') {
      stopTimer()
      const blob = await stopRecordingToBlob()
      if (!blob || blob.size === 0) {
        setMicState('idle')
        setErrorMessage(TRANSCRIBE_ERROR)
        setRetryMode('transcribe')
        return
      }
      await processRecording(blob)
    }
  }

  const handleRetry = async () => {
    setErrorMessage('')
    primeAudio()
    if (retryMode === 'caddie' && messages.length > 0) {
      processingRef.current = true
      setMicState('processing')
      try {
        await requestCaddieAdvice(messages)
        setRetryMode(null)
      } catch {
        setRetryMode('caddie')
        setErrorMessage(CADDIE_ERROR)
      } finally {
        processingRef.current = false
        setMicState('idle')
      }
      return
    }

    const started = await startRecording()
    if (!started) return
    setRecordingSeconds(0)
    setMicState('recording')
    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1)
    }, 1000)
  }

  const switchCoach = (next) => {
    if (next === coachMode || isAwaitingAdvice) return
    stop()
    stopTimer()
    cleanupRecording()
    setMicState('idle')
    setRecordingSeconds(0)
    setErrorMessage('')
    setRetryMode(null)
    setStreamingReply('')
    setCoachMode(next)
  }

  const handleNewShotClick = () => {
    if (expert) {
      if (messages.length > 0) setShowNewShotModal(true)
      return
    }
    if (hasActiveConversation(currentShot)) {
      setShowNewShotModal(true)
      return
    }
    stop()
    lastAutoReadRef.current = null
    clearCurrentShot()
    setMicState('idle')
    setErrorMessage('')
    setRetryMode(null)
    stopTimer()
    cleanupRecording()
    setRecordingSeconds(0)
  }

  const handleConfirmNewShot = () => {
    stop()
    lastAutoReadRef.current = null
    if (expert) clearSgChat()
    else clearCurrentShot()
    setMicState('idle')
    setErrorMessage('')
    setRetryMode(null)
    stopTimer()
    cleanupRecording()
    setRecordingSeconds(0)
    setShowNewShotModal(false)
  }

  const showResumingHint =
    !expert && hasActiveConversation(currentShot) && !isAwaitingAdvice && micState === 'idle'

  return (
    <>
      <div className="fixed top-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2">
        <Header
          title="CaddieAI"
          subtitle={buildDashboardSubtitle(profile, currentShot, expert)}
          dense
          rightAction={
            expert && messages.length === 0 ? null : (
            <Button
              variant="gold"
              size="sm"
              onClick={handleNewShotClick}
              className="!min-h-[40px] !rounded-lg !px-3 !border !border-soft-green/35 !bg-white !text-soft-green hover:!bg-[#f4faf7]"
            >
              {expert ? 'Clear' : 'New Shot'}
            </Button>
            )
          }
        />
        <div className="grid grid-cols-2 gap-1 border-b border-gray-200/80 bg-off-white px-4 pb-3" role="group" aria-label="Coach">
          <button
            type="button"
            aria-pressed={!expert}
            onClick={() => switchCoach('caddie')}
            className={[
              'min-h-11 rounded-xl text-sm font-semibold',
              expert ? 'bg-light-grey text-dark-green' : 'bg-dark-green text-white',
            ].join(' ')}
          >
            Caddie
          </button>
          <button
            type="button"
            aria-pressed={expert}
            onClick={() => switchCoach('sg')}
            className={[
              'min-h-11 rounded-xl text-sm font-semibold',
              expert ? 'bg-dark-green text-white' : 'bg-light-grey text-dark-green',
            ].join(' ')}
          >
            Strokes gained
          </button>
        </div>
      </div>
      <div className="h-[124px] shrink-0" />

      {showResumingHint && (
        <p className="border-b border-dark-green/10 bg-white px-4 py-2 text-center text-xs font-medium text-gray-600">
          Resuming your previous shot — tap New Shot to start fresh.
        </p>
      )}

      {!expert && clubs.length === 0 && (
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="w-full border-b border-gold/30 bg-gold/15 px-4 py-3 text-left text-sm font-medium text-dark-green transition-colors hover:bg-gold/25"
        >
          Add your clubs first for personalised advice →
        </button>
      )}

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[168px] pt-4">
        {messages.length === 0 && !isAwaitingAdvice && micState === 'idle' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="mb-2 text-base font-semibold text-dark-green">
              {expert ? 'Strokes Gained Expert' : 'Ready when you are'}
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-gray-600">
              {expert
                ? finishedRoundCount === 0
                  ? 'Finish a round first. A round still in progress is left out.'
                  : 'Tap the mic and ask about a round or your averages. If you don’t say which, I’ll ask. For example: “How am I losing strokes on putting when I only had 34 putts?”'
                : 'Tap the mic below and describe your shot — for example: ‘About 140 yards, light rough, bunker right, wind into.’'}
            </p>
          </div>
        )}

        {errorMessage && (
          <div
            className="mb-4 rounded-xl border border-danger/20 bg-red-50 px-4 py-3"
            role="alert"
          >
            <p className="text-sm font-medium text-danger">{errorMessage}</p>
            {retryMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-3 !min-h-[44px]"
              >
                {retryMode === 'caddie' ? 'Retry advice' : 'Try again'}
              </Button>
            )}
          </div>
        )}

        {speechError && (
          <p
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
            role="status"
          >
            {speechError}
          </p>
        )}

        <ShotConversation
          messages={messages}
          isAwaitingAdvice={isAwaitingAdvice}
          streamingReply={streamingReply}
          speechSupported={speechSupported}
          isSpeaking={isSpeaking}
          activeSpeechId={activeId}
          onSpeak={speak}
          onStop={stop}
        />
      </div>

      <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-1/2 z-30 flex h-[124px] w-full max-w-[430px] -translate-x-1/2 items-center justify-center border-t border-gray-200/80 bg-off-white/95 px-4 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] backdrop-blur">
        <VoiceMicHero
          state={isAwaitingAdvice ? 'processing' : micState}
          onMicTap={handleMicTap}
          compact
          idleLabel={expert ? 'Tap to ask about your stats' : 'Tap to describe your shot'}
          processingLabel={expert ? 'Looking at your stats…' : 'Working out your shot…'}
        />
      </div>

      <Modal
        isOpen={showNewShotModal}
        onClose={() => setShowNewShotModal(false)}
        title={expert ? 'Clear this conversation?' : 'Start a new shot?'}
        actions={
          <>
            <Button variant="primary" fullWidth onClick={handleConfirmNewShot}>
              {expert ? 'Clear conversation' : 'Start new shot'}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowNewShotModal(false)}
            >
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {expert
            ? 'This clears your strokes gained questions. Your rounds stay as they are.'
            : 'This will clear your current conversation. Tap the mic to describe your next shot.'}
        </p>
      </Modal>
    </>
  )
}
