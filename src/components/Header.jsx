import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Button from './Button'

export default function Header({
  title,
  subtitle,
  showBack = false,
  backTo,
  onBack,
  rightAction,
  inverted = false,
  dense = false,
}) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (backTo) {
      navigate(backTo)
    } else {
      navigate(-1)
    }
  }

  return (
    <header
      className={[
        'safe-top sticky top-0 z-30 border-b pl-[max(env(safe-area-inset-left,0px),1.5rem)] pr-[max(env(safe-area-inset-right,0px),1.5rem)]',
        dense ? 'pb-3 pt-2' : 'pb-4 pt-3',
        inverted
          ? 'border-gray-200/80 bg-off-white text-dark-green'
          : 'border-gray-200/80 bg-off-white',
      ].join(' ')}
    >
      <div className={['flex items-center', dense ? 'gap-2.5' : 'gap-3'].join(' ')}>
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label="Go back"
            className={[
              '!min-h-[48px] !min-w-[48px] shrink-0',
              inverted ? '!text-dark-green hover:!bg-dark-green/10' : '',
            ].join(' ')}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1
            className={[
              'truncate font-bold',
              dense ? 'text-lg' : 'text-xl',
              'text-dark-green',
            ].join(' ')}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={[
                'truncate',
                dense ? 'text-xs' : 'text-sm',
                'text-dark-green/75',
              ].join(' ')}
            >
              {subtitle}
            </p>
          )}
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
    </header>
  )
}
