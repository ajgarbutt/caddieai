import { Volume2, Square } from 'lucide-react'
import Button from './Button'

export default function ReadAloudControls({
  isSpeaking,
  isActive,
  onSpeak,
  onStop,
  inverted = false,
}) {
  const textClass = inverted
    ? '!text-white/80 hover:!bg-white/10'
    : 'text-gray-600'

  return (
    <div className="mt-2 flex gap-2">
      {!isActive || !isSpeaking ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSpeak}
          className={`!min-h-[44px] !px-2 text-xs ${textClass}`}
        >
          <Volume2 className="h-4 w-4" />
          Read aloud
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          className={`!min-h-[44px] !px-2 text-xs ${textClass}`}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          Stop
        </Button>
      )}
    </div>
  )
}
