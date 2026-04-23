import { useState, type ReactNode } from 'react'
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react'

type CommandTheme = 'user' | 'admin'
type ActionVariant = 'primary' | 'ghost' | 'warm'

export type CommandNavItem<T extends string> = {
  key: T
  label: string
  icon: LucideIcon
}

export type CommandMetric = {
  label: string
  value: string
  icon: LucideIcon
}

export type CommandAction = {
  label: string
  icon: LucideIcon
  onClick: () => void
  variant?: ActionVariant
}

type CommandShellProps<T extends string> = {
  theme: CommandTheme
  brandInitial: string
  brandTitle: string
  brandSubtitle: string
  roleLabel: string
  navItems: CommandNavItem<T>[]
  activeTab: T
  onTabChange: (key: T) => void
  heroEyebrow: ReactNode
  heroTitle: string
  heroDescription: string
  breadcrumb: string[]
  heroMetrics: CommandMetric[]
  heroActions?: CommandAction[]
  heroAside?: ReactNode
  switchAction?: CommandAction
  onSignOut: () => void | Promise<void>
  children: ReactNode
}

function buttonClassName(variant: ActionVariant = 'ghost') {
  if (variant === 'primary') {
    return 'primary-button'
  }

  if (variant === 'warm') {
    return 'secondary-button secondary-button--warm'
  }

  return 'ghost-button'
}

export function CommandShell<T extends string>({
  theme,
  brandInitial,
  brandTitle,
  brandSubtitle,
  roleLabel,
  navItems,
  activeTab,
  onTabChange,
  heroEyebrow,
  heroTitle,
  heroDescription,
  breadcrumb,
  heroMetrics,
  heroActions = [],
  heroAside,
  switchAction,
  onSignOut,
  children,
}: CommandShellProps<T>) {
  const [navOpen, setNavOpen] = useState(false)

  const activeItem = navItems.find((item) => item.key === activeTab)

  function handleTabChange(nextTab: T) {
    onTabChange(nextTab)
    setNavOpen(false)
  }

  return (
    <div className={`command-shell command-shell--${theme}`}>
      <button
        type="button"
        className={`command-shell__scrim${navOpen ? ' is-open' : ''}`}
        aria-label="Close navigation"
        onClick={() => setNavOpen(false)}
      />

      <aside className={`command-sidebar${navOpen ? ' is-open' : ''}`}>
        <div className="command-sidebar__brand">
          <div className="command-sidebar__brand-mark">{brandInitial}</div>
          <div className="command-sidebar__brand-copy">
            <strong>{brandTitle}</strong>
            <span>{brandSubtitle}</span>
            <em>{roleLabel}</em>
          </div>
        </div>

        {switchAction ? (
          <button
            type="button"
            className={`command-sidebar__switch ${buttonClassName(switchAction.variant)}`}
            onClick={() => {
              switchAction.onClick()
              setNavOpen(false)
            }}
          >
            <switchAction.icon size={16} />
            {switchAction.label}
          </button>
        ) : null}

        <nav className="command-sidebar__nav" aria-label="Dashboard sections">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`command-sidebar__nav-item${activeTab === key ? ' is-active' : ''}`}
              onClick={() => handleTabChange(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="ghost-button command-sidebar__logout" onClick={() => void onSignOut()}>
          <LogOut size={16} />
          Log out
        </button>
      </aside>

      <div className="command-main">
        <header className="command-topbar">
          <button
            type="button"
            className="icon-button command-topbar__menu"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={18} />
          </button>

          <div className="command-topbar__copy">
            <span>{brandTitle}</span>
            <strong>{activeItem?.label ?? heroTitle}</strong>
          </div>

          <button
            type="button"
            className="icon-button command-topbar__close"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <X size={18} />
          </button>
        </header>

        <section className="panel command-hero">
          <div className="command-hero__copy">
            <div className="eyebrow">{heroEyebrow}</div>

            <div className="command-hero__breadcrumbs" aria-label="Current location">
              {breadcrumb.map((segment, index) => (
                <span key={`${segment}-${index}`} className="command-hero__breadcrumb">
                  {segment}
                </span>
              ))}
            </div>

            <h1>{heroTitle}</h1>
            <p>{heroDescription}</p>

            {heroActions.length > 0 ? (
              <div className="command-hero__actions">
                {heroActions.map(({ label, icon: Icon, onClick, variant }) => (
                  <button
                    key={label}
                    type="button"
                    className={buttonClassName(variant)}
                    onClick={onClick}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="command-hero__metrics">
              {heroMetrics.map(({ label, value, icon: Icon }) => (
                <article key={label} className="command-hero__metric">
                  <span className="command-hero__metric-icon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="command-hero__aside">{heroAside}</div>
        </section>

        <div className="command-main__content">{children}</div>
      </div>
    </div>
  )
}
