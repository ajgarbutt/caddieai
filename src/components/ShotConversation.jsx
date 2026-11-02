import { useEffect, useRef } from 'react'
import TypingIndicator from './TypingIndicator'
import ReadAloudControls from './ReadAloudControls'
import { toDisplayAdvice } from '../utils/adviceFormat'

function GolferBubble({ text, inverted = false }) {
  return (
    <div
      className={[
        'max-w-[88%] rounded-2xl rounded-br-sm px-4 py-3 text-[15px] leading-relaxed shadow-sm',
        inverted ? 'bg-white/18 text-white' : 'bg-dark-green text-white',
      ].join(' ')}
    >
      {text}
    </div>
  )
}

function AssistantBubble({
  text,
  speechSupported,
  isSpeaking,
  isActive,
  onSpeak,
  onStop,
  inverted = false,
}) {
  const displayText = toDisplayAdvice(text)

  return (
    <div className="flex max-w-[92%] flex-col items-start">
      <div
        className={[
          'w-full rounded-2xl rounded-bl-sm border px-4 py-3 text-[15px] shadow-sm',
          inverted
            ? 'border-white/25 bg-white/10 text-white'
            : 'border-gray-300 bg-gray-50 text-dark-green',
        ].join(' ')}
      >
        <p className="leading-relaxed">{displayText}</p>
      </div>
      {speechSupported && displayText && (
        <ReadAloudControls
          isSpeaking={isSpeaking}
          isActive={isActive}
          onSpeak={onSpeak}
          onStop={onStop}
          inverted={inverted}
        />
      )}
    </div>
  )
}

export default function ShotConversation({
  messages,
  isAwaitingAdvice,
  streamingReply = '',
  speechSupported,
  isSpeaking,
  activeSpeechId,
  onSpeak,
  onStop,
  inverted = false,
}) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isAwaitingAdvice, streamingReply])

  if (!messages.length && !isAwaitingAdvice) return null

  const showTyping = isAwaitingAdvice && !streamingReply

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p
        className={[
          'mb-3 shrink-0 text-xs font-semibold uppercase tracking-wide',
          inverted ? 'text-white/70' : 'text-gray-500',
        ].join(' ')}
      >
        This shot
      </p>
      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={isAwaitingAdvice}
      >
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1
          const isStreamingAssistant =
            isLast &&
            message.role === 'assistant' &&
            isAwaitingAdvice &&
            streamingReply
          const displayText = isStreamingAssistant
            ? streamingReply
            : message.text

          return (
            <div
              key={`${message.createdAt}-${index}`}
              className={[
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              ].join(' ')}
            >
              {message.role === 'user' ? (
                <GolferBubble text={message.text} inverted={inverted} />
              ) : displayText ? (
                <AssistantBubble
                  text={displayText}
                  speechSupported={speechSupported}
                  isSpeaking={isSpeaking}
                  isActive={activeSpeechId === `${message.createdAt}-${index}`}
                  onSpeak={() =>
                    onSpeak(displayText, `${message.createdAt}-${index}`)
                  }
                  onStop={onStop}
                  inverted={inverted}
                />
              ) : null}
            </div>
          )
        })}

        {showTyping && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
