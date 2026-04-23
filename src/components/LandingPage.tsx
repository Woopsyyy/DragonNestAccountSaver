import { useState } from 'react'
import {
  ArrowRight,
  Castle,
  Crown,
  Gem,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  WandSparkles,
} from 'lucide-react'

import LoginPage from './LoginPage'
import Lanyard from './Lanyard'
import { OverlaySurface } from './ui/OverlaySurface'

const HERO_STATS = [
  { label: 'All characters', value: 'One roster view' },
  { label: 'Quick resets', value: 'Track spam and tickets' },
  { label: 'Live dashboards', value: 'User and admin command centers' },
] as const

const FEATURES = [
  {
    icon: Castle,
    title: 'Command shell',
    description: 'Move through the user and admin experience inside one shared visual system.',
  },
  {
    icon: Gem,
    title: 'Class path clarity',
    description: 'Keep origin, discipline, and ascension routes readable in both forms and analytics.',
  },
  {
    icon: ShieldCheck,
    title: 'Aligned controls',
    description: 'Centered drawers, cleaner rows, and responsive cards keep the interface easier to scan.',
  },
] as const

const JOURNEY = [
  {
    title: 'Map the roster',
    description: 'Create accounts once, lock in class paths, and keep the whole nest visible.',
  },
  {
    title: 'Track weekly flow',
    description: 'Update ticket and spam counters from a command surface that stays consistent.',
  },
  {
    title: 'Move with confidence',
    description: 'Open the dashboard and see stats, graphs, patchnotes, and admin controls at a glance.',
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
            <h1>Run every alt like a polished raid command deck.</h1>
            <p>
              The app now lands as a full neon-fantasy command center, from login to user
              dashboard to admin control. Everything stays centered, aligned, and easier to
              read under pressure.
            </p>

            <div className="landing-hero__actions">
              <button type="button" className="primary-button" onClick={() => setDrawerOpen(true)}>
                Enter the Nest
                <ArrowRight size={18} />
              </button>
              <a href="#landing-workflow" className="ghost-button">
                See the workflow
                <ScrollText size={18} />
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
                    Command preview
                  </div>
                  <h2>Dashboard-first design</h2>
                </div>
                <span className="landing-preview__badge">Live redesign</span>
              </div>

              <div className="landing-preview__grid">
                <article className="landing-preview__card">
                  <strong>Hero summaries</strong>
                  <p>Centered navigation context, quick actions, and real metrics in the first glance.</p>
                </article>
                <article className="landing-preview__card">
                  <strong>Pure SVG graphs</strong>
                  <p>Track account growth, level bands, role splits, and ticket totals without heavy chart libraries.</p>
                </article>
                <article className="landing-preview__card">
                  <strong>Unified overlays</strong>
                  <p>Drawers and modals now share the same polished shell, spacing, and focus behavior.</p>
                </article>
                <article className="landing-preview__card">
                  <strong>Responsive rows</strong>
                  <p>Tables stay aligned on desktop and collapse into clean cards on smaller screens.</p>
                </article>
              </div>

              <div className="landing-preview__float landing-preview__card">
                <strong>Animated atmosphere</strong>
                <p>Light rays, subtle float motion, and richer depth without turning the UI into noise.</p>
              </div>

              <Lanyard />
            </div>
          </div>
        </section>

        <section id="landing-workflow" className="panel landing-panel landing-section">
          <div className="landing-section__header">
            <div className="eyebrow">
              <WandSparkles size={14} />
              What changed
            </div>
            <h2>Everything now follows one command-center language.</h2>
            <p>
              Shared panels, responsive tables, centered drawers, aligned forms, and cleaner
              graphs now connect the whole app instead of leaving each screen in its own style island.
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

        <section className="panel landing-panel landing-section">
          <div className="landing-section__header">
            <div className="eyebrow">
              <ScrollText size={14} />
              Weekly loop
            </div>
            <h2>Built around the actual player workflow.</h2>
            <p>From setup to tracking to admin maintenance, the screens now feel like one continuous product.</p>
          </div>

          <div className="landing-journey">
            {JOURNEY.map((step, index) => (
              <article key={step.title} className="landing-step">
                <span className="landing-step__index">0{index + 1}</span>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel landing-panel landing-cta">
          <div className="landing-cta__copy">
            <div className="eyebrow">
              <Crown size={14} />
              Ready to organize the nest?
            </div>
            <h2>Sign in, open the dashboards, and keep the roster under control.</h2>
          </div>

          <div className="landing-cta__actions">
            <button type="button" className="primary-button" onClick={() => setDrawerOpen(true)}>
              Start now
              <ArrowRight size={18} />
            </button>
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
