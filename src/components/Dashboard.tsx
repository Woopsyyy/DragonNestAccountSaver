import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BookOpen,
  CircleGauge,
  Database,
  FilterX,
  LayoutDashboard,
  PencilLine,
  Plus,
  RefreshCcw,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AccountDrawer, type DrawerDraft, type DrawerErrors } from './AccountDrawer'
import ClockCard from './ClockCard'
import LightRays from './LightRays'
import ToastNotification from './ToastNotification'
import { PatchnoteDeck } from './PatchnoteDeck'
import {
  buildClassTree,
  filterAccountsByClassPath,
  getClassBase,
  joinClassPath,
  sortAccountsNewestFirst,
} from '../lib/classes'
import {
  createDragonAccount,
  getBrowserClient,
  listClassTree,
  listDragonAccounts,
  listPatchnotes,
  updateDragonAccount,
  updateDragonAccountCounter,
  updateMyPassword,
  updateMyUsername,
  type CounterField,
  type DragonAccount,
  type DragonAccountInput,
  type ClassNode as FlatClassNode,
  type Patchnote,
  type User,
} from '../lib/supabase'
import {
  BarChart,
  ChartCard,
  DonutChart,
  MetricCard,
  SectionHeader,
  SurfaceState,
  TrendAreaChart,
} from './ui/InsightWidgets'
import { CommandShell, type CommandAction, type CommandNavItem } from './ui/CommandShell'

type DrawerMode = 'create' | 'edit' | null
type LoadState = 'loading' | 'ready' | 'error'
type PendingCounterMap = Record<string, boolean>
type Tab = 'overview' | 'accounts' | 'patchnotes' | 'settings'

const ROSTER_TIMEOUT_MS = 8000

function createEmptyDraft(): DrawerDraft {
  return {
    account: '',
    class_path: [],
    level: '1',
    spam: '0',
    ticket: '0',
  }
}

function createDraftFromAccount(account: DragonAccount): DrawerDraft {
  return {
    account: account.account,
    class_path: account.class_path,
    level: String(account.level),
    spam: String(account.spam),
    ticket: String(account.ticket),
  }
}

function parseIntegerField(
  value: string,
  minimum: number,
  label: string,
): { parsed: number | null; error?: string } {
  const trimmed = value.trim()

  if (!trimmed || !/^-?\d+$/.test(trimmed)) {
    return { parsed: null, error: `${label} must be a whole number.` }
  }

  const parsed = Number.parseInt(trimmed, 10)

  if (parsed < minimum) {
    return { parsed, error: `${label} must be at least ${minimum}.` }
  }

  return { parsed }
}

function validateDraft(draft: DrawerDraft): {
  data: DragonAccountInput | null
  errors: DrawerErrors
} {
  const errors: DrawerErrors = {}
  const account = draft.account.trim()

  if (!account) {
    errors.account = 'Account name is required.'
  }

  if (draft.class_path.length === 0) {
    errors.class_path = 'Choose a class path before saving.'
  }

  const level = parseIntegerField(draft.level, 1, 'Level')
  const spam = parseIntegerField(draft.spam, 0, 'Spam')
  const ticket = parseIntegerField(draft.ticket, 0, 'Ticket')

  if (level.error) {
    errors.level = level.error
  }

  if (spam.error) {
    errors.spam = spam.error
  }

  if (ticket.error) {
    errors.ticket = ticket.error
  }

  if (Object.keys(errors).length > 0) {
    return { data: null, errors }
  }

  return {
    data: {
      account,
      class_base: getClassBase(draft.class_path),
      class_path: draft.class_path,
      class_label: joinClassPath(draft.class_path),
      level: level.parsed ?? 1,
      spam: spam.parsed ?? 0,
      ticket: ticket.parsed ?? 0,
    },
    errors,
  }
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message

    if (typeof message === 'string') {
      return message
    }
  }

  return 'Unexpected error. Please check your Supabase connection and table permissions.'
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs)

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

function counterKey(id: string, field: CounterField) {
  return `${id}:${field}`
}

function monthlyTrend(records: string[], length = 6) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short' })
  const now = new Date()
  const buckets = Array.from({ length }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (length - index - 1), 1)
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: formatter.format(date),
      value: 0,
    }
  })

  records.forEach((createdAt) => {
    const date = new Date(createdAt)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const bucket = buckets.find((entry) => entry.key === key)

    if (bucket) {
      bucket.value += 1
    }
  })

  return buckets.map(({ label, value }) => ({ label, value }))
}

function levelBandData(accounts: DragonAccount[]) {
  return [
    {
      label: '1-39',
      value: accounts.filter((account) => account.level < 40).length,
    },
    {
      label: '40-79',
      value: accounts.filter((account) => account.level >= 40 && account.level < 80).length,
    },
    {
      label: '80-99',
      value: accounts.filter((account) => account.level >= 80 && account.level < 100).length,
    },
    {
      label: '100+',
      value: accounts.filter((account) => account.level >= 100).length,
    },
  ]
}

function ticketTotalsByClass(accounts: DragonAccount[]) {
  const totals = new Map<string, number>()

  accounts.forEach((account) => {
    totals.set(account.class_base, (totals.get(account.class_base) ?? 0) + account.ticket)
  })

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }))
}

function ButtonLink({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" className="ghost-button" onClick={onClick}>
      {label}
    </button>
  )
}

function SettingsView({
  user,
  onUsernameUpdate,
}: {
  user: User | null
  onUsernameUpdate: (name: string) => void
}) {
  const [newUsername, setNewUsername] = useState(user?.username ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function handleUsernameUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!newUsername.trim()) {
      setUsernameError('Username is required.')
      return
    }

    setSavingUsername(true)
    setUsernameMessage(null)
    setUsernameError(null)

    try {
      await updateMyUsername(newUsername.trim())
      onUsernameUpdate(newUsername.trim())
      setUsernameMessage('Username updated successfully.')
    } catch (error) {
      setUsernameError(toMessage(error))
    } finally {
      setSavingUsername(false)
    }
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setSavingPassword(true)
    setPasswordMessage(null)
    setPasswordError(null)

    try {
      await updateMyPassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password updated successfully.')
    } catch (error) {
      setPasswordError(toMessage(error))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <section className="stack-section">
      <SectionHeader
        eyebrow={
          <>
            <Settings size={14} />
            Account settings
          </>
        }
        title="Keep your access details current."
        description="Manage the identity details tied to your command center without leaving the dashboard shell."
      />

      <div className="settings-grid">
        <form className="panel form-panel" onSubmit={handleUsernameUpdate}>
          <div className="form-panel__header">
            <h3>Update username</h3>
            <p>Current username: {user?.username ?? 'No username yet'}</p>
          </div>

          <label className="field">
            <span className="field__label">New username</span>
            <input
              type="text"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="Choose a new username"
            />
          </label>

          {usernameError ? (
            <div className="inline-error" role="alert">
              <Shield size={16} />
              <span>{usernameError}</span>
            </div>
          ) : null}

          {usernameMessage ? <span className="status-chip status-chip--success">{usernameMessage}</span> : null}

          <button type="submit" className="primary-button" disabled={savingUsername}>
            {savingUsername ? 'Saving…' : 'Update username'}
          </button>
        </form>

        <form className="panel form-panel" onSubmit={handlePasswordUpdate}>
          <div className="form-panel__header">
            <h3>Update password</h3>
            <p>Set a stronger password for this Dragon Nest account.</p>
          </div>

          <label className="field">
            <span className="field__label">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter a new password"
            />
          </label>

          <label className="field">
            <span className="field__label">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm your new password"
            />
          </label>

          {passwordError ? (
            <div className="inline-error" role="alert">
              <Shield size={16} />
              <span>{passwordError}</span>
            </div>
          ) : null}

          {passwordMessage ? <span className="status-chip status-chip--success">{passwordMessage}</span> : null}

          <button type="submit" className="primary-button" disabled={savingPassword}>
            {savingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default function Dashboard({ user: initialUser }: { user: User | null }) {
  const navigate = useNavigate()
  const [usernameOverride, setUsernameOverride] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [accounts, setAccounts] = useState<DragonAccount[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)
  const [filterPath, setFilterPath] = useState<string[]>([])
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DrawerDraft>(createEmptyDraft)
  const [drawerErrors, setDrawerErrors] = useState<DrawerErrors>({})
  const [saving, setSaving] = useState(false)
  const [pendingCounters, setPendingCounters] = useState<PendingCounterMap>({})
  const [classNodes, setClassNodes] = useState<FlatClassNode[]>([])
  const [patchnotes, setPatchnotes] = useState<Patchnote[]>([])

  const liveClassTree = useMemo(() => buildClassTree(classNodes), [classNodes])
  const rootClassOptions = liveClassTree.map((node) => node.label)
  const currentUser = initialUser
    ? { ...initialUser, username: usernameOverride ?? initialUser.username }
    : null

  const filteredAccounts = useMemo(
    () =>
      filterAccountsByClassPath(accounts, filterPath).filter((account) =>
        account.account.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [accounts, filterPath, searchQuery],
  )

  const ticketTotal = accounts.reduce((sum, account) => sum + account.ticket, 0)
  const completedAccounts = accounts.filter((account) => account.spam > 0).length

  const heroMetrics = [
    { label: 'Tracked accounts', value: String(accounts.length), icon: Users },
    { label: 'Tickets in queue', value: String(ticketTotal), icon: Ticket },
    { label: 'Cleared spam runs', value: String(completedAccounts), icon: ShieldCheck },
  ]

  const heroActions: CommandAction[] = [
    {
      label: 'Add account',
      icon: Plus,
      onClick: () => openCreateDrawer(),
      variant: 'primary',
    },
    {
      label: 'Patchnotes',
      icon: BookOpen,
      onClick: () => setActiveTab('patchnotes'),
      variant: 'ghost',
    },
  ]

  const accountGrowthData = useMemo(
    () => monthlyTrend(accounts.map((account) => account.created_at)),
    [accounts],
  )
  const accountLevelData = useMemo(() => levelBandData(accounts), [accounts])
  const spamRatioData = useMemo(
    () => [
      { label: 'Finished', value: completedAccounts },
      { label: 'Pending', value: Math.max(accounts.length - completedAccounts, 0) },
    ],
    [accounts.length, completedAccounts],
  )
  const ticketByClassData = useMemo(() => ticketTotalsByClass(accounts), [accounts])

  const navItems: CommandNavItem<Tab>[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'accounts', label: 'Accounts', icon: Users },
    { key: 'patchnotes', label: 'Patchnotes', icon: BookOpen },
    { key: 'settings', label: 'Settings', icon: Settings },
  ]

  async function reloadAccounts() {
    setLoadState('loading')
    setLoadError(null)

    try {
      const nextAccounts = await withTimeout(
        listDragonAccounts().then(sortAccountsNewestFirst),
        ROSTER_TIMEOUT_MS,
        'Loading the roster timed out. Check your Supabase connection and try again.',
      )
      setAccounts(nextAccounts)
      setLoadState('ready')
    } catch (error) {
      setLoadError(toMessage(error))
      setLoadState('error')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialState() {
      try {
        const [nextAccounts, nextClassNodes, nextPatchnotes] = await Promise.all([
          withTimeout(
            listDragonAccounts().then(sortAccountsNewestFirst),
            ROSTER_TIMEOUT_MS,
            'Loading the roster timed out. Check your Supabase connection and try again.',
          ),
          listClassTree(),
          listPatchnotes(),
        ])

        if (cancelled) {
          return
        }

        setAccounts(nextAccounts)
        setClassNodes(nextClassNodes)
        setPatchnotes(nextPatchnotes)
        setLoadState('ready')
      } catch (error) {
        if (cancelled) {
          return
        }

        setLoadError(toMessage(error))
        setLoadState('error')
      }
    }

    void loadInitialState()

    return () => {
      cancelled = true
    }
  }, [])

  function openCreateDrawer() {
    setDrawerMode('create')
    setEditingId(null)
    setDraft(createEmptyDraft())
    setDrawerErrors({})
  }

  function openEditDrawer(account: DragonAccount) {
    setDrawerMode('edit')
    setEditingId(account.id)
    setDraft(createDraftFromAccount(account))
    setDrawerErrors({})
  }

  function closeDrawer() {
    if (saving) {
      return
    }

    setDrawerMode(null)
    setEditingId(null)
    setDraft(createEmptyDraft())
    setDrawerErrors({})
  }

  function updateField(
    field: Exclude<keyof DrawerDraft, 'class_path'>,
    value: string,
  ) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
    setDrawerErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      submit: undefined,
    }))
  }

  function updateClassPath(path: string[]) {
    setDraft((currentDraft) => ({ ...currentDraft, class_path: path }))
    setDrawerErrors((currentErrors) => ({
      ...currentErrors,
      class_path: undefined,
      submit: undefined,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!drawerMode) {
      return
    }

    const { data, errors } = validateDraft(draft)

    if (!data) {
      setDrawerErrors(errors)
      return
    }

    setSaving(true)
    setDrawerErrors({})

    if (drawerMode === 'create') {
      const tempId = `temp-${Date.now()}`
      const now = new Date().toISOString()
      const optimisticAccount: DragonAccount = {
        id: tempId,
        ...data,
        created_at: now,
        updated_at: now,
      }

      setAccounts((currentAccounts) => [optimisticAccount, ...currentAccounts])

      try {
        const savedAccount = await createDragonAccount(data)
        setAccounts((currentAccounts) =>
          sortAccountsNewestFirst(
            currentAccounts.map((account) =>
              account.id === tempId ? savedAccount : account,
            ),
          ),
        )
        setLoadState('ready')
        closeDrawer()
      } catch (error) {
        setAccounts((currentAccounts) =>
          currentAccounts.filter((account) => account.id !== tempId),
        )
        setDrawerErrors({ submit: toMessage(error) })
      } finally {
        setSaving(false)
      }

      return
    }

    const currentAccount = accounts.find((account) => account.id === editingId)

    if (!currentAccount || !editingId) {
      setSaving(false)
      setDrawerErrors({
        submit: 'The selected account is no longer available. Reload and try again.',
      })
      return
    }

    const optimisticAccount: DragonAccount = {
      ...currentAccount,
      ...data,
      updated_at: new Date().toISOString(),
    }

    setAccounts((currentAccounts) =>
      currentAccounts.map((account) =>
        account.id === editingId ? optimisticAccount : account,
      ),
    )

    try {
      const savedAccount = await updateDragonAccount(editingId, data)
      setAccounts((currentAccounts) =>
        currentAccounts.map((account) =>
          account.id === editingId ? savedAccount : account,
        ),
      )
      closeDrawer()
    } catch (error) {
      setAccounts((currentAccounts) =>
        currentAccounts.map((account) =>
          account.id === editingId ? currentAccount : account,
        ),
      )
      setDrawerErrors({ submit: toMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  async function handleQuickCounterChange(
    account: DragonAccount,
    field: CounterField,
    delta: number,
  ) {
    const nextValue = account[field] + delta

    if (nextValue < 0) {
      return
    }

    const pendingKey = counterKey(account.id, field)

    setPendingCounters((current) => ({ ...current, [pendingKey]: true }))
    setTableError(null)
    setAccounts((currentAccounts) =>
      currentAccounts.map((currentAccount) =>
        currentAccount.id === account.id
          ? {
              ...currentAccount,
              [field]: nextValue,
              updated_at: new Date().toISOString(),
            }
          : currentAccount,
      ),
    )

    try {
      const savedAccount = await updateDragonAccountCounter(account.id, field, nextValue)
      setAccounts((currentAccounts) =>
        currentAccounts.map((currentAccount) =>
          currentAccount.id === account.id ? savedAccount : currentAccount,
        ),
      )
    } catch (error) {
      setAccounts((currentAccounts) =>
        currentAccounts.map((currentAccount) =>
          currentAccount.id === account.id ? account : currentAccount,
        ),
      )
      setTableError(
        `Unable to update ${field} for ${account.account}: ${toMessage(error)}`,
      )
    } finally {
      setPendingCounters((current) => {
        const nextPending = { ...current }
        delete nextPending[pendingKey]
        return nextPending
      })
    }
  }

  async function handleSignOut() {
    await getBrowserClient().auth.signOut()
  }

  return (
    <>
      <div className="shell-light-rays">
        <LightRays raysColor="#ffffff" rayLength={1.35} />
      </div>

      <CommandShell
        theme="user"
        brandInitial="D"
        brandTitle="Dragon Nest"
        brandSubtitle="Account Saver"
        roleLabel={currentUser?.is_admin ? 'Admin access' : 'User access'}
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        heroEyebrow={
          <>
            <Sparkles size={14} />
            User command deck
          </>
        }
        heroTitle="Center every account, graph, and weekly task in one view."
        heroDescription="The user dashboard now leads with live stats, cleaner account tools, responsive rows, and centered overlays that stay readable on every screen."
        breadcrumb={['User', navItems.find((item) => item.key === activeTab)?.label ?? 'Overview']}
        heroMetrics={heroMetrics}
        heroActions={heroActions}
        heroAside={<ClockCard />}
        switchAction={
          currentUser?.is_admin
            ? {
                label: 'Open admin panel',
                icon: Shield,
                onClick: () => navigate('/admin'),
                variant: 'warm',
              }
            : undefined
        }
        onSignOut={() => void handleSignOut()}
      >
        {activeTab === 'overview' ? (
          <section className="stack-section">
            <SectionHeader
              eyebrow={
                <>
                  <LayoutDashboard size={14} />
                  Overview
                </>
              }
              title="A real dashboard for the whole roster."
              description="Track growth, class distribution, spam completion, and ticket totals without leaving the shell."
            />

            <div className="metric-grid">
              <MetricCard
                label="Tracked accounts"
                value={accounts.length}
                hint="Everything currently saved in Supabase."
                icon={Users}
              />
              <MetricCard
                label="Max-level roster"
                value={accounts.filter((account) => account.level >= 100).length}
                hint="Characters at level 100 or higher."
                icon={CircleGauge}
                accent="success"
              />
              <MetricCard
                label="Pending spam"
                value={accounts.filter((account) => account.spam === 0).length}
                hint="Accounts still waiting on completion."
                icon={Database}
                accent="warm"
              />
              <MetricCard
                label="Total tickets"
                value={ticketTotal}
                hint="Combined ticket count across every account."
                icon={Ticket}
              />
            </div>

            <div className="chart-grid">
              <ChartCard
                eyebrow="Account growth"
                title="New accounts over the last six months"
                description="See when the roster expanded recently."
              >
                <TrendAreaChart data={accountGrowthData} />
              </ChartCard>

              <ChartCard
                eyebrow="Level bands"
                title="How the roster is distributed right now"
                description="Split by early, mid, late, and capped accounts."
              >
                <BarChart data={accountLevelData} />
              </ChartCard>

              <ChartCard
                eyebrow="Spam status"
                title="Finished versus pending spam runs"
                description="A quick ratio view for the current weekly state."
              >
                <DonutChart data={spamRatioData} />
              </ChartCard>

              <ChartCard
                eyebrow="Ticket pressure"
                title="Where tickets are concentrated by class"
                description="Top class bases holding the most ticket volume."
              >
                <BarChart data={ticketByClassData} />
              </ChartCard>
            </div>
          </section>
        ) : null}

        {activeTab === 'accounts' ? (
          <section className="stack-section">
            <SectionHeader
              eyebrow={
                <>
                  <Users size={14} />
                  Account roster
                </>
              }
              title="Aligned rows, fast counters, and cleaner filters."
              description="Search, filter, edit, and update accounts from one centered management surface."
              action={
                <button type="button" className="primary-button" onClick={openCreateDrawer}>
                  <Plus size={16} />
                  Add account
                </button>
              }
            />

            <section className="panel table-shell">
              <div className="section-table__toolbar">
                <div className="toolbar-row toolbar-row__grow">
                  <label className="field toolbar-row__grow">
                    <span className="field__label">Search account</span>
                    <input
                      type="text"
                      placeholder="Search by account name"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">Root class</span>
                    <select
                      value={filterPath[0] ?? ''}
                      onChange={(event) =>
                        setFilterPath(event.target.value ? [event.target.value] : [])
                      }
                    >
                      <option value="">All classes</option>
                      {rootClassOptions.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {(filterPath.length > 0 || searchQuery) ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setFilterPath([])
                      setSearchQuery('')
                    }}
                  >
                    <FilterX size={16} />
                    Clear filters
                  </button>
                ) : null}
              </div>

              {tableError ? (
                <div className="inline-error" role="alert">
                  <Shield size={16} />
                  <span>{tableError}</span>
                </div>
              ) : null}

              {loadState === 'loading' ? (
                <SurfaceState
                  icon={RefreshCcw}
                  title="Loading the roster"
                  description="Pulling the latest Dragon Nest accounts from Supabase."
                />
              ) : null}

              {loadState === 'error' && loadError ? (
                <SurfaceState
                  icon={Shield}
                  title="The roster could not be loaded"
                  description={loadError}
                  tone="danger"
                  action={
                    <button type="button" className="ghost-button" onClick={() => void reloadAccounts()}>
                      <RefreshCcw size={16} />
                      Retry
                    </button>
                  }
                />
              ) : null}

              {loadState === 'ready' && filteredAccounts.length === 0 ? (
                <SurfaceState
                  icon={Users}
                  title={accounts.length === 0 ? 'No accounts saved yet' : 'No accounts match the current filter'}
                  description={
                    accounts.length === 0
                      ? 'Create the first account to start filling the roster.'
                      : 'Clear the active filters or search query to see more accounts.'
                  }
                  action={
                    accounts.length === 0 ? (
                      <button type="button" className="primary-button" onClick={openCreateDrawer}>
                        <Plus size={16} />
                        Add account
                      </button>
                    ) : (
                      <ButtonLink
                        label="Clear filters"
                        onClick={() => {
                          setFilterPath([])
                          setSearchQuery('')
                        }}
                      />
                    )
                  }
                />
              ) : null}

              {loadState === 'ready' && filteredAccounts.length > 0 ? (
                <>
                  <div className="desktop-only">
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Class path</th>
                            <th>Level</th>
                            <th>Spam</th>
                            <th>Tickets</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAccounts.map((account) => (
                            <tr key={account.id}>
                              <td>
                                <div className="row-heading">
                                  <strong>{account.account}</strong>
                                  <span>{new Date(account.updated_at).toLocaleDateString()}</span>
                                </div>
                              </td>
                              <td>
                                <div className="row-stack">
                                  {account.class_path.map((segment, index) => (
                                    <span key={`${segment}-${index}`} className="pill">
                                      {segment}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>{account.level}</td>
                              <td>
                                <button
                                  type="button"
                                  className={`counter-pill__state${account.spam > 0 ? ' is-done' : ''}`}
                                  disabled={Boolean(pendingCounters[counterKey(account.id, 'spam')])}
                                  onClick={() =>
                                    void handleQuickCounterChange(
                                      account,
                                      'spam',
                                      account.spam > 0 ? -account.spam : 1,
                                    )
                                  }
                                >
                                  {account.spam > 0 ? 'Finished' : 'Pending'}
                                </button>
                              </td>
                              <td>
                                <div className="counter-stepper">
                                  <button
                                    type="button"
                                    aria-label={`Decrease tickets for ${account.account}`}
                                    disabled={Boolean(pendingCounters[counterKey(account.id, 'ticket')])}
                                    onClick={() => void handleQuickCounterChange(account, 'ticket', -1)}
                                  >
                                    -
                                  </button>
                                  <strong>{account.ticket}</strong>
                                  <button
                                    type="button"
                                    aria-label={`Increase tickets for ${account.account}`}
                                    disabled={Boolean(pendingCounters[counterKey(account.id, 'ticket')])}
                                    onClick={() => void handleQuickCounterChange(account, 'ticket', 1)}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => openEditDrawer(account)}
                                >
                                  <PencilLine size={16} />
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mobile-only data-card-grid">
                    {filteredAccounts.map((account) => (
                      <article key={account.id} className="account-card">
                        <div className="table-card__header">
                          <div className="row-heading">
                            <strong>{account.account}</strong>
                            <span>{joinClassPath(account.class_path)}</span>
                          </div>
                          <span className="status-chip">{account.level}</span>
                        </div>

                        <div className="table-card__stats">
                          <button
                            type="button"
                            className={`counter-pill__state${account.spam > 0 ? ' is-done' : ''}`}
                            disabled={Boolean(pendingCounters[counterKey(account.id, 'spam')])}
                            onClick={() =>
                              void handleQuickCounterChange(
                                account,
                                'spam',
                                account.spam > 0 ? -account.spam : 1,
                              )
                            }
                          >
                            {account.spam > 0 ? 'Finished' : 'Pending'}
                          </button>

                          <div className="counter-stepper">
                            <button
                              type="button"
                              aria-label={`Decrease tickets for ${account.account}`}
                              disabled={Boolean(pendingCounters[counterKey(account.id, 'ticket')])}
                              onClick={() => void handleQuickCounterChange(account, 'ticket', -1)}
                            >
                              -
                            </button>
                            <strong>{account.ticket}</strong>
                            <button
                              type="button"
                              aria-label={`Increase tickets for ${account.account}`}
                              disabled={Boolean(pendingCounters[counterKey(account.id, 'ticket')])}
                              onClick={() => void handleQuickCounterChange(account, 'ticket', 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="account-card__action ghost-button"
                          onClick={() => openEditDrawer(account)}
                        >
                          <PencilLine size={16} />
                          Edit account
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          </section>
        ) : null}

        {activeTab === 'patchnotes' ? (
          <PatchnoteDeck
            patchnotes={patchnotes}
            eyebrow={
              <>
                <BookOpen size={14} />
                Update logs
              </>
            }
            title="Patchnotes now sit inside the same command shell."
            description="Read the latest updates from a cleaner grid and centered detail overlay."
            emptyTitle="No patchnotes yet"
            emptyDescription="Admin updates will appear here once the first patchnote is published."
          />
        ) : null}

        {activeTab === 'settings' ? (
          <SettingsView
            user={currentUser}
            onUsernameUpdate={setUsernameOverride}
          />
        ) : null}
      </CommandShell>

      <AccountDrawer
        mode={drawerMode}
        open={drawerMode !== null}
        draft={draft}
        errors={drawerErrors}
        pending={saving}
        classTree={liveClassTree}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        onFieldChange={updateField}
        onClassPathChange={updateClassPath}
      />

      {loadError ? (
        <ToastNotification
          message="Dashboard error"
          subText={loadError}
          tone="danger"
          onClose={() => setLoadError(null)}
        />
      ) : null}

      {tableError ? (
        <ToastNotification
          message="Update error"
          subText={tableError}
          tone="danger"
          onClose={() => setTableError(null)}
        />
      ) : null}
    </>
  )
}
