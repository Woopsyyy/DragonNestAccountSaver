import { useEffect, useState } from 'react'
import { Clock3, Sparkles } from 'lucide-react'

type ClockState = {
  time: string
  meridiem: string
  date: string
}

function getClockState(): ClockState {
  const now = new Date()
  let hours = now.getHours()
  const meridiem = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12

  return {
    time: `${hours}:${String(now.getMinutes()).padStart(2, '0')}`,
    meridiem,
    date: now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
  }
}

export default function ClockCard() {
  const [clock, setClock] = useState<ClockState>(() => getClockState())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClock(getClockState())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <section className="clock-card" aria-label="Current local time">
      <div className="clock-card__heading">
        <div className="eyebrow">
          <Clock3 size={14} />
          Local command time
        </div>
        <span className="status-chip">
          <Sparkles size={14} />
          Live
        </span>
      </div>

      <div>
        <div className="clock-card__time">
          {clock.time}
          <span className="clock-card__meridiem">
            {clock.meridiem}
          </span>
        </div>
        <p>{clock.date}</p>
      </div>

      <div className="clock-card__meta">
        <span className="pill">Fast glance</span>
        <span className="pill">Synchronized with your browser</span>
      </div>
    </section>
  )
}
