import type { ReactNode } from 'react'
import { ArrowRight, type LucideIcon } from 'lucide-react'

type ChartDatum = {
  label: string
  value: number
}

type SectionHeaderProps = {
  eyebrow: ReactNode
  title: string
  description: string
  action?: ReactNode
}

type MetricCardProps = {
  label: string
  value: string | number
  icon: LucideIcon
  hint: string
  accent?: 'cool' | 'warm' | 'success'
}

type ChartCardProps = {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}

type SurfaceStateProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  tone?: 'default' | 'danger'
}

function safeMax(values: number[]) {
  const maxValue = Math.max(...values, 1)
  return maxValue
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <header className="section-heading">
      <div className="section-heading__copy">
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {action ? <div className="section-heading__action">{action}</div> : null}
    </header>
  )
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 'cool',
}: MetricCardProps) {
  const trendPercent = accent === 'success' ? '+12%' : accent === 'warm' ? '+3%' : '+8%'
  const safeId = label.replace(/\s+/g, '')

  return (
    <article className={`metric-card metric-card--${accent}`} tabIndex={0}>
      <div className="metric-card-info">
        <div className="metric-card-header">
          <div className="icon-wrapper">
            <Icon size={18} />
          </div>
          <span className="metric-card-title">{label}</span>
        </div>
        <div className="metric-card-value">{value}</div>
        <span className="metric-card-trend">
          <strong className="trend-badge">{trendPercent}</strong>
          {hint}
        </span>
      </div>
      <div className="metric-card-chart">
        <svg viewBox="0 0 100 50" preserveAspectRatio="none">
          <path className="animated-path" d="M0,35 C20,30 30,10 50,20 S80,5 100,0" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M0,35 C20,30 30,10 50,20 S80,5 100,0 L100,50 L0,50 Z" fill={`url(#metricGradient-${safeId})`} fillOpacity="0.4" stroke="none" />
          <defs>
            <linearGradient id={`metricGradient-${safeId}`} x1={0} y1={0} x2={0} y2={1}>
              <stop offset="0%" stopOpacity={0.6} />
              <stop offset="100%" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </article>
  )
}

export function ChartCard({
  eyebrow,
  title,
  description,
  action,
  children,
}: ChartCardProps) {
  return (
    <article className="panel chart-card">
      <header className="chart-card__header">
        <div>
          <span className="chart-card__eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        {action ? <div className="chart-card__action">{action}</div> : null}
      </header>

      <div className="chart-card__body">{children}</div>
    </article>
  )
}

export function TrendAreaChart({
  data,
  accent = '#72ddff',
}: {
  data: ChartDatum[]
  accent?: string
}) {
  if (data.length === 0) {
    return <div className="chart-card__empty">No trend data yet.</div>
  }

  const values = data.map((item) => item.value)
  const maxValue = safeMax(values)
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100
    const y = 100 - (item.value / maxValue) * 78
    return `${x},${y}`
  })

  const areaPath = `M ${points.join(' L ')} L 100,100 L 0,100 Z`

  return (
    <div className="trend-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="trend-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trend-area-fill)" />
        <polyline
          fill="none"
          stroke={accent}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.join(' ')}
        />
      </svg>

      <div className="trend-chart__labels">
        {data.map((item) => (
          <span key={item.label}>
            <strong>{item.value}</strong>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function BarChart({
  data,
  accent = 'cool',
}: {
  data: ChartDatum[]
  accent?: 'cool' | 'warm'
}) {
  if (data.length === 0) {
    return <div className="chart-card__empty">No bar data yet.</div>
  }

  const maxValue = safeMax(data.map((item) => item.value))

  return (
    <div className={`bar-chart bar-chart--${accent}`}>
      {data.map((item) => (
        <div key={item.label} className="bar-chart__row">
          <div className="bar-chart__copy">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="bar-chart__track" aria-hidden="true">
            <span
              className="bar-chart__fill"
              style={{ width: `${Math.max((item.value / maxValue) * 100, 6)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DonutChart({
  data,
  accent = 'cool',
}: {
  data: ChartDatum[]
  accent?: 'cool' | 'warm'
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (total === 0) {
    return <div className="chart-card__empty">No ratio data yet.</div>
  }

  const radius = 42
  const circumference = Math.PI * 2 * radius
  const segments = data.reduce<Array<{ label: string; dasharray: string; dashoffset: number; index: number; nextOffset: number }>>(
    (currentSegments, item, index) => {
      const ratio = item.value / total
      const dash = circumference * ratio
      const previousOffset = currentSegments[currentSegments.length - 1]?.nextOffset ?? 0

      return [
        ...currentSegments,
        {
          label: item.label,
          dasharray: `${dash} ${circumference - dash}`,
          dashoffset: -previousOffset,
          index,
          nextOffset: previousOffset + dash,
        },
      ]
    },
    [],
  )

  return (
    <div className="donut-chart">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle
          className="donut-chart__track"
          cx="60"
          cy="60"
          r={radius}
          strokeWidth="12"
        />
        {segments.map((segment) => (
          <circle
            key={segment.label}
            className={`donut-chart__segment donut-chart__segment--${accent}-${segment.index + 1}`}
            cx="60"
            cy="60"
            r={radius}
            strokeWidth="12"
            strokeDasharray={segment.dasharray}
            strokeDashoffset={segment.dashoffset}
          />
        ))}
        <text x="60" y="56" textAnchor="middle" className="donut-chart__value">
          {total}
        </text>
        <text x="60" y="72" textAnchor="middle" className="donut-chart__label">
          Total
        </text>
      </svg>

      <div className="donut-chart__legend">
        {data.map((item, index) => (
          <div key={item.label} className="donut-chart__legend-item">
            <span className={`donut-chart__swatch donut-chart__swatch--${accent}-${index + 1}`} />
            <div>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SurfaceState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'default',
}: SurfaceStateProps) {
  return (
    <div className={`panel surface-state surface-state--${tone}`}>
      <div className="surface-state__icon">
        <Icon size={20} />
      </div>
      <div className="surface-state__copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div className="surface-state__action">{action}</div> : null}
    </div>
  )
}

export function DetailLink({ label }: { label: string }) {
  return (
    <span className="detail-link">
      {label}
      <ArrowRight size={15} />
    </span>
  )
}
