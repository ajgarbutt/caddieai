import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Button from './Button'

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function getFocusableElements(root) {
  if (!root) return []
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.disabled && el.offsetParent !== null
  )
}

function getInitialFocusTarget(root) {
  if (!root) return null

  const preferred =
    root.querySelector('input, textarea, select') ||
    root.querySelector('[autofocus], [data-autofocus]')

  if (preferred && !preferred.disabled) return preferred

  return getFocusableElements(root)[0] ?? null
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
}) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (e.key !== 'Tab' || !dialogRef.current) return

      const focusable = getFocusableElements(dialogRef.current)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    const focusTimer = window.setTimeout(() => {
      getInitialFocusTarget(dialogRef.current)?.focus()
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close modal"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="safe-bottom relative z-10 w-full max-w-[430px] rounded-t-2xl bg-off-white p-6 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold text-dark-green">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="!min-h-[44px] !min-w-[44px] shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mb-6">{children}</div>
        {actions && <div className="flex flex-col gap-3">{actions}</div>}
      </div>
    </div>
  )
}
