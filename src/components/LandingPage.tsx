import { useState } from 'react'
import {
  ArrowRight,
  Castle,
  Clock3,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Swords,
  Ticket,
} from 'lucide-react'

import LoginPage from './LoginPage'
import { OverlaySurface } from './ui/OverlaySurface'

const HERO_STATS = [
  { label: 'Daily reset', value: 'Every day at 9:00 AM' },
  { label: 'Weekly reset', value: 'Saturday at 9:00 AM' },
  { label: 'Ticket warning', value: 'Red rows flag urgent runs' },
] as const

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard first',
    description: 'Open the roster, spam runs, tickets, and admin tools from one cleaner shell.',
  },
  {
    icon: Clock3,
    title: 'Timed resets',
    description: 'Daily and weekly timers stay visible so the next spam reset is always easy to read.',
  },
  {
    icon: Ticket,
    title: 'Urgent ticket signal',
    description: 'Accounts with near-expiring tickets stand out immediately before you lose the run.',
  },
] as const

export default function LandingPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <main className="landing-shell">
        <section className="panel landing-panel landing-hero">
          <div className="landing-hero__copy">
            <div className="eyebrow">
              <Swords size={14} />
              Dragon Nest Account Saver
            </div>
            <h1>Keep the nest tight, reset on time, and run the right account first.</h1>
            <p>
              One cleaner landing page, one dashboard shell, and the exact loop that matters:
              watch the timers, spot urgent tickets, and reset finished spam runs automatically.
            </p>

            <div className="landing-hero__actions">
              <button type="button" className="primary-button" onClick={() => setDrawerOpen(true)}>
                Enter the Nest
                <ArrowRight size={18} />
              </button>
              <a href="#landing-overview" className="ghost-button">
                See the reset flow
                <Clock3 size={18} />
              </a>
            </div>

            <div className="landing-metrics">
              {HERO_STATS.map((stat) => (
                <article key={stat.label} className="landing-stat">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="landing-hero__visual">
            <div className="landing-preview">
              <div className="landing-preview__header">
                <div>
                  <div className="eyebrow">
                    <Castle size={14} />
                    Quick loop
                  </div>
                  <h2>What the dashboard now watches</h2>
                </div>
                <span className="landing-preview__badge">Live timers</span>
              </div>

              <div className="landing-preview__list">
                <article className="landing-preview__row">
                  <strong>Daily reset</strong>
                  <span>9:00 AM</span>
                </article>
                <article className="landing-preview__row">
                  <strong>Weekly reset</strong>
                  <span>Saturday 9:00 AM</span>
                </article>
                <article className="landing-preview__row">
                  <strong>Spam visibility</strong>
                  <span>Only max-level accounts stay in the run list</span>
                </article>
                <article className="landing-preview__row">
                  <strong>Ticket warning</strong>
                  <span>Urgent accounts turn red so the next run is obvious</span>
                </article>
              </div>

              <div className="landing-preview__summary">
                <span className="landing-preview__status">
                  <ShieldCheck size={16} />
                  Cleaner first glance
                </span>
                <p>Sign in once, open the shell, and keep the real account loop in front of you.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="landing-overview" className="panel landing-panel landing-section">
          <div className="landing-section__header">
            <div className="eyebrow">
              <Sparkles size={14} />
              Overview
            </div>
            <h2>The first screen now stays focused on the actual workflow.</h2>
            <p>
              The landing page is lighter, the timers are part of the dashboard flow, and the
              ticket pressure points are easier to spot before you start running accounts.
            </p>
          </div>

          <div className="landing-feature-grid">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <article key={title} className="landing-feature">
                <span className="landing-feature__icon">
                  <Icon size={18} />
                </span>
                <strong>{title}</strong>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <OverlaySurface
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Enter the command center"
        description="Authenticate once, then move straight into your redesigned Dragon Nest dashboards."
        eyebrow={
          <>
            <Sparkles size={14} />
            Access portal
          </>
        }
        variant="drawer"
        size="xl"
      >
        <div className="landing-login-wrap">
          <LoginPage />
        </div>
      </OverlaySurface>
    </>
  )
}
