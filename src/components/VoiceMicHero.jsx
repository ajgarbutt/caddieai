import { Mic, Loader2 } from 'lucide-react'

export default function VoiceMicHero({
  state,
  onMicTap,
  compact = false,
  inverted = false,
  idleLabel = 'Tap to describe your shot',
  processingLabel = 'Working out your shot…',
}) {
  const isProcessing = state === 'processing'
  const isRecording = state === 'recording'
  const isIdle = state === 'idle'

  if (compact) {
    const statusText = isIdle ? idleLabel : isProcessing ? processingLabel : '\u00a0'

    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <div className="relative h-[72px] w-[72px] shrink-0">
          {isRecording && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-gold/30" />
              <span className="absolute -inset-1.5 animate-pulse rounded-full bg-gold/20" />
            </>
          )}
          <button
            type="button"
            onClick={onMicTap}
            disabled={isProcessing}
            aria-label={
              isRecording
                ? 'Stop recording'
                : isProcessing
                  ? 'Processing shot'
                  : 'Start recording'
            }
            className={[
              'relative flex h-[72px] w-[72px] items-center justify-center rounded-full shadow-lg transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/50',
              isProcessing
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : isRecording
                  ? 'bg-gold text-dark-green ring-4 ring-gold/40'
                  : 'bg-dark-green text-white hover:bg-[#143022]',
            ].join(' ')}
          >
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin" strokeWidth={2} />
            ) : (
              <Mic className="h-8 w-8" strokeWidth={2} />
            )}
          </button>
        </div>

        <p
          className={[
            'min-h-[20px] text-center text-sm font-semibold',
            inverted ? 'text-white' : 'text-dark-green',
          ].join(' ')}
        >
          {statusText}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative mb-4">
        {isRecording && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/30" />
            <span className="absolute -inset-2 animate-pulse rounded-full bg-gold/20" />
          </>
        )}
        <button
          type="button"
          onClick={onMicTap}
          disabled={isProcessing}
          aria-label={
            isRecording
              ? 'Stop recording'
              : isProcessing
                ? 'Processing shot'
                : 'Start recording'
          }
          className={[
            'relative flex h-28 w-28 items-center justify-center rounded-full shadow-lg transition-all',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/50',
            isProcessing
              ? 'cursor-not-allowed bg-gray-300 text-gray-500'
              : isRecording
                ? 'bg-gold text-dark-green ring-4 ring-gold/40 active:scale-95'
                : 'bg-dark-green text-white hover:bg-[#143022] active:scale-95',
          ].join(' ')}
        >
          {isProcessing ? (
            <Loader2 className="h-10 w-10 animate-spin" strokeWidth={2} />
          ) : (
            <Mic className="h-10 w-10" strokeWidth={2} />
          )}
        </button>
      </div>

      {isIdle && (
        <>
          <p className="mb-2 text-center text-base font-semibold text-dark-green">
            Tap to describe your shot
          </p>
          <p className="max-w-xs text-center text-sm leading-relaxed text-gray-600">
            For example: &lsquo;About 140 yards, light rough, bunker right, wind
            into.&rsquo;
          </p>
        </>
      )}

      {isRecording && (
        <>
          <p className="mb-2 text-center text-base font-semibold text-dark-green">
            Listening… tap again when you&apos;re done
          </p>
        </>
      )}

      {isProcessing && (
        <p className="text-center text-base font-semibold text-dark-green">
          Working out your shot…
        </p>
      )}
    </div>
  )
}
