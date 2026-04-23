import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

type ToastTone = 'default' | 'danger' | 'success'

type ToastNotificationProps = {
  message?: string
  subText?: string
  tone?: ToastTone
  onClose?: () => void
}

function resolveTone(message: string, tone?: ToastTone): ToastTone {
  if (tone) {
    return tone
  }

  if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
    return 'danger'
  }

  return 'default'
}

function resolveIcon(tone: ToastTone) {
  if (tone === 'danger') {
    return <AlertTriangle size={18} />
  }

  if (tone === 'success') {
    return <CheckCircle2 size={18} />
  }

  return <Info size={18} />
}

export default function ToastNotification({
  message = 'Heads up',
  subText = 'Something changed in the command center.',
  tone,
  onClose,
}: ToastNotificationProps) {
  const [visible, setVisible] = useState(true)
  const resolvedTone = resolveTone(message, tone)
  const icon = resolveIcon(resolvedTone)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, 4500)

    return () => window.clearTimeout(timer)
  }, [onClose])

  if (!visible) {
    return null
  }

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <div className={`toast${resolvedTone !== 'default' ? ` toast--${resolvedTone}` : ''}`}>
        <div className="toast__header">
          <div className="toast__title">
            {icon}
            <strong>{message}</strong>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => {
              setVisible(false)
              onClose?.()
            }}
          >
            <X size={16} />
          </button>
        </div>
        <p className="toast__body">{subText}</p>
      </div>
    </div>
  )
}
