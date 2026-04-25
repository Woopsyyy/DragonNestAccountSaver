import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, LogOut, Menu, X, type LucideIcon } from 'lucide-react'

type CommandTheme = 'user' | 'admin'
type ActionVariant = 'primary' | 'ghost' | 'warm'

export type CommandNavChild<T extends string> = {
  key: T
  label: string
  icon: LucideIcon
}

export type CommandNavItem<T extends string> = {
  key: string
  label: string
  icon: LucideIcon
  children?: CommandNavChild<T>[]
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

type RailAction = {
  label: string
  icon: LucideIcon
  onClick: () => void
  variant: ActionVariant
}

type CommandShellProps<T extends string> = {
  theme: CommandTheme
  brandIcon?: ReactNode
  brandTitle: string
  brandSubtitle: string
  roleLabel: string
  navItems: CommandNavItem<T>[]
  activeTab: T
  onTabChange: (key: T) => void
  switchAction?: CommandAction
  onSignOut: () => void | Promise<void>
  children: ReactNode
}

// ── Portal tooltip state ───────────────────────────────────────────────────────
type TooltipState = { label: string; x: number; y: number } | null

function railItemClassName(variant: ActionVariant = 'ghost') {
  if (variant === 'primary') return 'command-sidebar__rail-item is-primary'
  if (variant === 'warm') return 'command-sidebar__rail-item is-warm'
  return 'command-sidebar__rail-item'
}

export function CommandShell<T extends string>({
  theme,
  brandIcon,
  brandTitle,
  brandSubtitle,
  roleLabel,
  navItems,
  activeTab,
  onTabChange,
  switchAction,
  onSignOut,
  children,
}: CommandShellProps<T>) {
  const [navOpen, setNavOpen] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  // Initialise expanded key to whichever group contains the current active tab
  const [openNavKey, setOpenNavKey] = useState<string | null>(() => {
    for (const item of navItems) {
      if (item.children?.some((c) => c.key === activeTab)) return item.key
    }
    return null
  })

  // Derive the topbar label from active tab
  const activeLabel = (() => {
    for (const item of navItems) {
      if (item.children) {
        const child = item.children.find((c) => c.key === activeTab)
        if (child) return child.label
      } else if (item.key === activeTab) {
        return item.label
      }
    }
    return 'Dashboard'
  })()

  const utilityItems: RailAction[] = [
    switchAction
      ? {
          label: switchAction.label,
          icon: switchAction.icon,
          onClick: () => { switchAction.onClick(); setNavOpen(false) },
          variant: switchAction.variant ?? 'ghost',
        }
      : null,
    {
      label: 'Log out',
      icon: LogOut,
      onClick: () => { void onSignOut(); setNavOpen(false) },
      variant: 'ghost' as const,
    },
  ].filter((item): item is RailAction => item !== null)

  function handleTabChange(nextTab: T) {
    onTabChange(nextTab)
    setNavOpen(false)
  }

  function handleNavItemClick(item: CommandNavItem<T>) {
    if (item.children) {
      setOpenNavKey((prev) => (prev === item.key ? null : item.key))
    } else {
      handleTabChange(item.key as T)
    }
  }

  // ── Portal tooltip helpers ───────────────────────────────────────────────────
  function showTooltip(el: HTMLElement, label: string) {
    // Don't show tooltip when mobile drawer is open (labels are already visible)
    if (navOpen) return
    const rect = el.getBoundingClientRect()
    setTooltip({ label, x: rect.right + 14, y: rect.top + rect.height / 2 })
  }

  function hideTooltip() {
    setTooltip(null)
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
        <div className="command-sidebar__rail">
          <div
            className="command-sidebar__brand"
            aria-label={`${brandSubtitle} · ${roleLabel}`}
            title={`${brandSubtitle} · ${roleLabel}`}
          >
            {brandIcon ? (
              <div className="command-sidebar__brand-icon">{brandIcon}</div>
            ) : null}
            <div className="command-sidebar__brand-copy">
              <strong>{brandTitle}</strong>
              <span>{brandSubtitle}</span>
              <em>{roleLabel}</em>
            </div>
          </div>

          <nav className="command-sidebar__nav" aria-label="Dashboard sections">
            {navItems.map((item) => {
              const hasChildren = Boolean(item.children?.length)
              const isGroupOpen = openNavKey === item.key
              const isActive = hasChildren
                ? item.children!.some((c) => c.key === activeTab)
                : item.key === activeTab

              return (
                <div key={item.key} className="command-sidebar__nav-group">
                  {/* Parent / leaf button */}
                  <button
                    type="button"
                    className={[
                      'command-sidebar__nav-item',
                      isActive ? 'is-active' : '',
                      hasChildren ? 'has-children' : '',
                    ].filter(Boolean).join(' ')}
                    aria-label={item.label}
                    title={item.label}
                    data-label={item.label}
                    onClick={() => handleNavItemClick(item)}
                    onMouseEnter={(e) => showTooltip(e.currentTarget, item.label)}
                    onMouseLeave={hideTooltip}
                    onFocus={(e) => showTooltip(e.currentTarget, item.label)}
                    onBlur={hideTooltip}
                  >
                    <span className="command-sidebar__icon-wrap" aria-hidden="true">
                      <item.icon size={18} />
                    </span>
                    <span className="command-sidebar__item-label">{item.label}</span>
                    {hasChildren && (
                      <ChevronDown
                        size={12}
                        className={`nav-group__chevron${isGroupOpen ? ' is-open' : ''}`}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {/* Children slide-down */}
                  {hasChildren && isGroupOpen ? (
                    <div className="command-sidebar__nav-children">
                      {item.children!.map((child) => (
                        <button
                          key={child.key}
                          type="button"
                          className={`command-sidebar__nav-child${activeTab === child.key ? ' is-active' : ''}`}
                          aria-label={child.label}
                          title={child.label}
                          data-label={child.label}
                          onClick={() => handleTabChange(child.key)}
                          onMouseEnter={(e) => showTooltip(e.currentTarget, child.label)}
                          onMouseLeave={hideTooltip}
                          onFocus={(e) => showTooltip(e.currentTarget, child.label)}
                          onBlur={hideTooltip}
                        >
                          <span className="command-sidebar__icon-wrap" aria-hidden="true">
                            <child.icon size={15} />
                          </span>
                          <span className="command-sidebar__item-label">{child.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </nav>

          <div className="command-sidebar__spine" aria-hidden="true" />

          <div className="command-sidebar__utility" aria-label="Dashboard actions">
            {utilityItems.map(({ label, icon: Icon, onClick, variant }) => (
              <button
                key={label}
                type="button"
                className={railItemClassName(variant)}
                aria-label={label}
                title={label}
                data-label={label}
                onClick={onClick}
              >
                <span className="command-sidebar__icon-wrap" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="command-sidebar__item-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
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
            <span>{brandSubtitle}</span>
            <strong>{activeLabel}</strong>
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

        <div className="command-main__content">{children}</div>
      </div>

      {/* Portal tooltip — renders at document.body, outside any overflow container */}
      {tooltip !== null && !navOpen
        ? createPortal(
            <div
              className="sidebar-tooltip"
              style={{ left: tooltip.x, top: tooltip.y }}
              aria-hidden="true"
            >
              {tooltip.label}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
