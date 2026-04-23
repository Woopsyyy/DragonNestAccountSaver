import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type OverlayVariant = 'modal' | 'drawer'
type OverlaySize = 'sm' | 'md' | 'lg' | 'xl'

type OverlaySurfaceProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  eyebrow?: ReactNode
  variant?: OverlayVariant
  size?: OverlaySize
  footer?: ReactNode
  children: ReactNode
  closeLabel?: string
}

export function OverlaySurface({
  open,
  onClose,
  title,
  description,
  eyebrow,
  variant = 'modal',
  size = 'lg',
  footer,
  children,
  closeLabel = 'Close panel',
}: OverlaySurfaceProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    const frameId = window.requestAnimationFrame(() => {
      panelRef.current?.focus()
    })

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div className={`overlay-shell overlay-shell--${variant}`} role="presentation">
      <button
        type="button"
        className="overlay-shell__backdrop"
        aria-label={closeLabel}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={`overlay-panel overlay-panel--${variant} overlay-panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="overlay-panel__header">
          <div className="overlay-panel__copy">
            {eyebrow ? <div className="overlay-panel__eyebrow">{eyebrow}</div> : null}
            <h2 id={titleId}>{title}</h2>
            {description ? (
              <p id={descriptionId} className="overlay-panel__description">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="icon-button"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="overlay-panel__body">{children}</div>

        {footer ? <footer className="overlay-panel__footer">{footer}</footer> : null}
      </div>
    </div>
  )
}
