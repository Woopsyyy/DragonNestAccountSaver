import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type FormEvent } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  ChevronDown,
  CircleGauge,
  Clock3,
  Database,
  FilterX,
  LayoutDashboard,
  PawPrint,
  Pencil,
  Plus,
  RefreshCcw,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react'

import { AccountDrawer, type DrawerDraft, type DrawerErrors } from './AccountDrawer'
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
  createPet,
  createTicket,
  deleteDragonAccount,
  deletePet,
  deleteTicket,
  deleteUserAccount,
  getBrowserClient,
  listClassTree,
  listDragonAccounts,
  listPatchnotes,
  listPets,
  listTickets,
  resetFinishedSpamRuns,
  updateDragonAccount,
  updateDragonAccountCounter,
  updateDragonAccountLevel,
  updateMyPassword,
  updateMyUsername,
  type CounterField,
  type DnPet,
  type DnTicket,
  type DragonAccount,
  type DragonAccountInput,
  type ClassNode as FlatClassNode,
  type Patchnote,
  type User,
} from '../lib/supabase'
import {
  MetricCard,
  SectionHeader,
  SurfaceState,
} from './ui/InsightWidgets'
import { CommandShell, type CommandNavItem } from './ui/CommandShell'

import {
  FileText,
  GitBranch,
  KeyRound,
  Layers3,
  Trash2,
} from 'lucide-react'
import { OverlaySurface } from './ui/OverlaySurface'
import {
  BarChart,
  ChartCard,
  DonutChart,
  TrendAreaChart,
} from './ui/InsightWidgets'
import {
  createClassNode,
  createPatchnote,
  deleteClassNode,
  deletePatchnote,
  listAllUsers,
  resetUserPassword,
  toggleUserAdmin,
} from '../lib/supabase'
import ResetLoader from './ResetLoader'


type DrawerMode = 'create' | 'edit' | null
type LoadState = 'loading' | 'ready' | 'error'
type PendingCounterMap = Record<string, boolean>
type PendingLevelMap = Record<string, boolean>
type Tab = 'overview' | 'classes' | 'calculator' | 'spam' | 'ticket-tab' | 'patchnotes' | 'pet' | 'settings' | 'admin-overview' | 'users' | 'admin-patchnotes' | 'admin-classes'
type AddMode = 'class' | 'type_class' | 'sub_class'
type ResetOverlayState = {
  title: string
  detail: string
} | null

type TicketDraft = {
  ign: string
  ticket_name: string
  expiration_date: string
}
type TicketDrawerMode = 'create' | null

type PetDraft = {
  ign: string
  expiration_date: string
}
type PetDrawerMode = 'create' | null

const ROSTER_TIMEOUT_MS = 8000
const MAX_LEVEL_THRESHOLD = 100
const DAILY_RESET_HOUR = 9
const WEEKLY_RESET_DAY = 6
const DAILY_RESET_STORAGE_KEY = 'dragonnest:last-daily-reset'
const WEEKLY_RESET_STORAGE_KEY = 'dragonnest:last-weekly-reset'

function createEmptyDraft(): DrawerDraft {
  return {
    account: '',
    class_path: [],
    level: '1',
    spam: '0',
    ticket: '0',
  }
}

function createEmptyTicketDraft(): TicketDraft {
  return { ign: '', ticket_name: '', expiration_date: '' }
}

function createEmptyPetDraft(): PetDraft {
  return { ign: '', expiration_date: '' }
}

function normalizeIgn(value: string): string {
  return value.trim().toLowerCase()
}

function isNearExpiration(dateStr: string): boolean {
  const expDate = new Date(dateStr)
  const now = new Date()
  const diffTime = expDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= 1
}

function isMaxLevelAccount(account: DragonAccount): boolean {
  return account.level >= MAX_LEVEL_THRESHOLD
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

  if (Object.keys(errors).length > 0) {
    return { data: null, errors }
  }

  return {
    data: {
      account,
      class_base: getClassBase(draft.class_path),
      class_path: draft.class_path,
      class_label: joinClassPath(draft.class_path),
      level: 1,
      spam: 0,
      ticket: 0,
    },
    errors,
  }
}

function toMessage(error: unknown, fallback?: string): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message

    if (typeof message === 'string') {
      return message
    }
  }

  return fallback ?? 'Unexpected error. Please check your Supabase connection and table permissions.'
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

function levelKey(id: string) {
  return `${id}:level`
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

function buildPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const special = '!@#$%^&*()-_=+'
  const randomValues = new Uint32Array(10)
  crypto.getRandomValues(randomValues)

  return Array.from(randomValues, (value, index) =>
    index < 8
      ? chars[value % chars.length]
      : special[value % special.length],
  ).join('')
}

function toResetKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
  ].join('-')
}

function getMostRecentDailyReset(now: Date): Date {
  const reset = new Date(now)
  reset.setHours(DAILY_RESET_HOUR, 0, 0, 0)

  if (now.getTime() < reset.getTime()) {
    reset.setDate(reset.getDate() - 1)
  }

  return reset
}

function getNextDailyReset(now: Date): Date {
  const reset = new Date(now)
  reset.setHours(DAILY_RESET_HOUR, 0, 0, 0)

  if (now.getTime() >= reset.getTime()) {
    reset.setDate(reset.getDate() + 1)
  }

  return reset
}

function getMostRecentWeeklyReset(now: Date): Date {
  const reset = new Date(now)
  reset.setHours(DAILY_RESET_HOUR, 0, 0, 0)
  const dayOffset = (reset.getDay() - WEEKLY_RESET_DAY + 7) % 7
  reset.setDate(reset.getDate() - dayOffset)

  if (now.getTime() < reset.getTime()) {
    reset.setDate(reset.getDate() - 7)
  }

  return reset
}

function getNextWeeklyReset(now: Date): Date {
  const reset = new Date(now)
  reset.setHours(DAILY_RESET_HOUR, 0, 0, 0)
  const dayOffset = (WEEKLY_RESET_DAY - reset.getDay() + 7) % 7
  reset.setDate(reset.getDate() + dayOffset)

  if (now.getTime() >= reset.getTime()) {
    reset.setDate(reset.getDate() + 7)
  }

  return reset
}

function formatCountdown(target: Date, now: Date): string {
  const totalSeconds = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const clock = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')

  return days > 0 ? `${days}d ${clock}` : clock
}

function formatResetMoment(target: Date): string {
  return target.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function mergeUpdatedAccounts(
  currentAccounts: DragonAccount[],
  updatedAccounts: DragonAccount[],
): DragonAccount[] {
  if (updatedAccounts.length === 0) {
    return currentAccounts
  }

  const updatesById = new Map(updatedAccounts.map((account) => [account.id, account]))
  return sortAccountsNewestFirst(
    currentAccounts.map((account) => updatesById.get(account.id) ?? account),
  )
}

function ClassTreeManager({
  nodes,
  onCreate,
  onDelete,
}: {
  nodes: FlatClassNode[]
  onCreate: (label: string, parentId: string | null, sortOrder: number) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<AddMode>('class')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedTypeClassId, setSelectedTypeClassId] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rootNodes = nodes.filter((node) => node.parent_id === null)

  function getChildren(parentId: string) {
    return nodes
      .filter((node) => node.parent_id === parentId)
      .sort((left, right) => left.sort_order - right.sort_order)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!newLabel.trim()) {
      setError('Node name is required.')
      return
    }

    let parentId: string | null = null

    if (addMode === 'type_class') {
      if (!selectedClassId) {
        setError('Select a class first.')
        return
      }
      parentId = selectedClassId || null
    }

    if (addMode === 'sub_class') {
      if (!selectedTypeClassId) {
        setError('Select a type class first.')
        return
      }
      parentId = selectedTypeClassId || null
    }

    const siblingCount = nodes.filter((node) => node.parent_id === parentId).length
    setSaving(true)

    try {
      await onCreate(newLabel.trim(), parentId, siblingCount)
      setNewLabel('')
      setSelectedClassId('')
      setSelectedTypeClassId('')
      setAddMode('class')
      setIsAddOpen(false)
    } catch (createError) {
      setError(toMessage(createError, 'Failed to add class node.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="stack-section">
        <SectionHeader
          eyebrow={
            <>
              <GitBranch size={14} />
              Live class tree
            </>
          }
          title="Manage the class hierarchy with cleaner centered detail views."
          description="Classes, type classes, and subclasses now live inside the same panel language as the rest of the admin dashboard."
          action={
            <button type="button" className="primary-button" onClick={() => setIsAddOpen(true)}>
              <Plus size={16} />
              Add node
            </button>
          }
        />

        {rootNodes.length === 0 ? (
          <SurfaceState
            icon={GitBranch}
            title="No class nodes yet"
            description="Create the first class root to start building the hierarchy."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Structure</th>
                  <th>Inventory</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {rootNodes.map((node) => {
                  const typeNodes = getChildren(node.id)
                  const subclassCount = typeNodes.reduce(
                    (sum, typeNode) => sum + getChildren(typeNode.id).length,
                    0,
                  )

                  return (
                    <tr key={node.id} className="row-clickable" onClick={() => setExpandedClassId(node.id)}>
                      <td>
                        <div className="row-heading">
                          <strong>{node.label}</strong>
                          <span>Root class</span>
                        </div>
                      </td>
                      <td>
                        <span className="status-chip">{typeNodes.length} types</span>
                      </td>
                      <td>
                        <span className="pill">{subclassCount} subclasses</span>
                      </td>
                      <td>
                        <span className="pill">Sort #{node.sort_order + 1}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <OverlaySurface
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title=""
        description=""
        eyebrow={null}
        variant="modal"
        size="md"
      >
        <form className="drawer-form centered-form" onSubmit={handleSubmit}>
          <div className="class-mode-toggle" style={{ margin: '0 auto' }}>
            <button
              type="button"
              className={`class-mode-toggle__item${addMode === 'class' ? ' is-active' : ''}`}
              onClick={() => setAddMode('class')}
            >
              Root class
            </button>
            <button
              type="button"
              className={`class-mode-toggle__item${addMode === 'type_class' ? ' is-active' : ''}`}
              onClick={() => setAddMode('type_class')}
            >
              Type class
            </button>
            <button
              type="button"
              className={`class-mode-toggle__item${addMode === 'sub_class' ? ' is-active' : ''}`}
              onClick={() => setAddMode('sub_class')}
            >
              Subclass
            </button>
          </div>

          <div className="field-group" style={{ display: 'grid', gap: '20px', width: '100%', justifyItems: 'center' }}>
            {addMode !== 'class' ? (
              <label className="field field--full">
                <select
                  value={selectedClassId}
                  onChange={(event) => {
                    setSelectedClassId(event.target.value)
                    setSelectedTypeClassId('')
                  }}
                >
                  <option value="">Select a root class</option>
                  {rootNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {addMode === 'sub_class' && selectedClassId ? (
              <label className="field field--full">
                <select
                  value={selectedTypeClassId}
                  onChange={(event) => setSelectedTypeClassId(event.target.value)}
                >
                  <option value="">Select a type class</option>
                  {getChildren(selectedClassId).map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field">
              <input
                type="text"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="Enter the new node name"
              />
            </label>
          </div>

          {error ? (
            <div className="inline-error" role="alert">
              <Shield size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="drawer-form__actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="ghost-button" onClick={() => setIsAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving…' : 'Create node'}
            </button>
          </div>
        </form>
      </OverlaySurface>

      <OverlaySurface
        open={expandedClassId !== null}
        onClose={() => setExpandedClassId(null)}
        title={nodes.find((node) => node.id === expandedClassId)?.label ?? 'Class details'}
        description="Inspect type classes and subclasses, or delete nodes from this centered detail view."
        eyebrow={
          <>
            <Layers3 size={14} />
            Class detail
          </>
        }
        variant="modal"
        size="xl"
        footer={
          expandedClassId ? (
            <button
              type="button"
              className="secondary-button secondary-button--warm"
              onClick={() => {
                void onDelete(expandedClassId)
                setExpandedClassId(null)
              }}
            >
              <Trash2 size={16} />
              Delete class
            </button>
          ) : undefined
        }
      >
        <div className="class-detail-grid">
          {expandedClassId ? (
            getChildren(expandedClassId).map((typeNode) => (
              <article key={typeNode.id} className="table-card">
                <div className="class-card__header">
                  <div className="row-heading">
                    <strong>{typeNode.label}</strong>
                    <span>Type class</span>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${typeNode.label}`}
                    onClick={() => void onDelete(typeNode.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="class-node-list">
                  {getChildren(typeNode.id).length > 0 ? (
                    getChildren(typeNode.id).map((subNode) => (
                      <div key={subNode.id} className="class-node-row">
                        <span>{subNode.label}</span>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Delete ${subNode.label}`}
                          onClick={() => void onDelete(subNode.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="field__help">No subclasses yet.</span>
                  )}
                </div>
              </article>
            ))
          ) : null}
        </div>
      </OverlaySurface>
    </>
  )
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

function ResetTimerCard({
  label,
  countdown,
  nextAt,
  hint,
}: {
  label: string
  countdown: string
  nextAt: string
  hint: string
}) {
  return (
    <section className="clock-card reset-timer-card" aria-label={`${label} countdown`}>
      <div className="clock-card__heading">
        <div className="eyebrow">
          <Clock3 size={14} />
          {label}
        </div>
        <span className="status-chip">
          <Sparkles size={14} />
          Auto
        </span>
      </div>

      <div>
        <div className="clock-card__time">{countdown}</div>
        <p>{nextAt}</p>
      </div>

      <div className="clock-card__meta">
        <span className="pill">{hint}</span>
      </div>
    </section>
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
  const [pendingLevels, setPendingLevels] = useState<PendingLevelMap>({})
  const [classNodes, setClassNodes] = useState<FlatClassNode[]>([])
  const [patchnotes, setPatchnotes] = useState<Patchnote[]>([])

  // Ticket state
  const [tickets, setTickets] = useState<DnTicket[]>([])
  const [ticketDrawerMode, setTicketDrawerMode] = useState<TicketDrawerMode>(null)
  const [ticketDraft, setTicketDraft] = useState<TicketDraft>(createEmptyTicketDraft)
  const [ticketErrors, setTicketErrors] = useState<Partial<Record<'ign' | 'ticket_name' | 'expiration_date' | 'submit', string>>>({})
  const [savingTicket, setSavingTicket] = useState(false)
  const [expandedTicketIgn, setExpandedTicketIgn] = useState<string | null>(null)

  // Pet state
  const [pets, setPets] = useState<DnPet[]>([])
  const [petDrawerMode, setPetDrawerMode] = useState<PetDrawerMode>(null)
  const [petDraft, setPetDraft] = useState<PetDraft>(createEmptyPetDraft)
  const [petErrors, setPetErrors] = useState<Partial<Record<'ign' | 'expiration_date' | 'submit', string>>>({})
  const [savingPet, setSavingPet] = useState(false)
  const [expandedPetIgn, setExpandedPetIgn] = useState<string | null>(null)

  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [resetting, setResetting] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [passwordResult, setPasswordResult] = useState<{ username: string; password: string } | null>(null)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [patchTitle, setPatchTitle] = useState('')
  const [patchContent, setPatchContent] = useState('')
  const [savingPatchnote, setSavingPatchnote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetOverlay, setResetOverlay] = useState<ResetOverlayState>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const resetInFlightRef = useRef(false)
  const failedResetKeyRef = useRef<string | null>(null)

  const userGrowthData = useMemo(() => monthlyTrend(users.map((entry) => entry.created_at)), [users])
  const patchnoteActivityData = useMemo(() => monthlyTrend(patchnotes.map((entry) => entry.created_at)), [patchnotes])
  const roleSplitData = useMemo(() => [
    { label: 'Admins', value: users.filter((entry) => entry.is_admin).length },
    { label: 'Users', value: users.filter((entry) => !entry.is_admin).length },
  ], [users])
  const classDepthData = useMemo(() => {
    const roots = classNodes.filter((node) => node.parent_id === null)
    const rootIds = new Set(roots.map((node) => node.id))
    const types = classNodes.filter((node) => node.parent_id && rootIds.has(node.parent_id))
    const typeIds = new Set(types.map((node) => node.id))
    const subclasses = classNodes.filter((node) => node.parent_id && typeIds.has(node.parent_id))
    return [
      { label: 'Roots', value: roots.length },
      { label: 'Types', value: types.length },
      { label: 'Subclasses', value: subclasses.length },
    ]
  }, [classNodes])

  const filteredUsers = useMemo(
    () => users.filter((entry) => `${entry.username ?? ''} ${entry.id}`.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  )

  const liveClassTree = useMemo(() => buildClassTree(classNodes), [classNodes])
  const rootClassOptions = liveClassTree.map((node) => node.label)
  const currentUser = initialUser
    ? { ...initialUser, username: usernameOverride ?? initialUser.username }
    : null
  const now = useMemo(() => new Date(nowTick), [nowTick])
  const nextDailyReset = useMemo(() => getNextDailyReset(now), [now])
  const nextWeeklyReset = useMemo(() => getNextWeeklyReset(now), [now])
  const dailyResetCountdown = useMemo(() => formatCountdown(nextDailyReset, now), [nextDailyReset, now])
  const weeklyResetCountdown = useMemo(() => formatCountdown(nextWeeklyReset, now), [nextWeeklyReset, now])
  const urgentTicketIgns = useMemo(
    () => new Set(tickets.filter((ticket) => isNearExpiration(ticket.expiration_date)).map((ticket) => normalizeIgn(ticket.ign))),
    [tickets],
  )

  const filteredAccounts = useMemo(
    () =>
      filterAccountsByClassPath(accounts, filterPath).filter((account) =>
        account.account.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [accounts, filterPath, searchQuery],
  )
  const spamAccounts = useMemo(
    () => filteredAccounts.filter((account) => isMaxLevelAccount(account)),
    [filteredAccounts],
  )
  const maxLevelAccounts = useMemo(
    () => accounts.filter((account) => isMaxLevelAccount(account)),
    [accounts],
  )

  const navItems: CommandNavItem<Tab>[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'classes', label: 'Account', icon: Users },
    { key: 'ticket-tab', label: 'Ticket', icon: Ticket },
    { key: 'spam', label: 'Spam Runs', icon: ShieldCheck },
    { key: 'calculator', label: 'Calculator', icon: Calculator },
    { key: 'pet', label: 'Pet', icon: PawPrint },
    { key: 'patchnotes', label: 'Patchnotes', icon: BookOpen },
    { key: 'settings', label: 'Settings', icon: Settings },
  ]

  if (currentUser?.is_admin) {
    navItems.push({
      key: 'admin-group',
      label: 'Admin Panel',
      icon: Shield,
      children: [
        { key: 'admin-overview', label: 'Admin Overview', icon: LayoutDashboard },
        { key: 'users', label: 'Users', icon: Users },
        { key: 'admin-patchnotes', label: 'Manage Patchnotes', icon: FileText },
        { key: 'admin-classes', label: 'Class Tree', icon: GitBranch },
      ],
    })
  }

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
        const [nextAccounts, nextClassNodes, nextPatchnotes, nextTickets, nextPets] = await Promise.all([
          withTimeout(
            listDragonAccounts().then(sortAccountsNewestFirst),
            ROSTER_TIMEOUT_MS,
            'Loading the roster timed out. Check your Supabase connection and try again.',
          ),
          listClassTree(),
          listPatchnotes(),
          listTickets(),
          listPets(),
        ])

        if (cancelled) {
          return
        }

        setAccounts(nextAccounts)
        setClassNodes(nextClassNodes)
        setPatchnotes(nextPatchnotes)
        setTickets(nextTickets)
        setPets(nextPets)
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

  // Separate effect: load all users whenever admin status resolves.
  // This handles the race where initialUser was null on first mount.
  useEffect(() => {
    if (!initialUser?.is_admin) {
      return
    }

    let cancelled = false

    listAllUsers()
      .then((nextUsers) => {
        if (!cancelled) setUsers(nextUsers)
      })
      .catch(() => { /* silently ignore — non-critical for the main dashboard */ })

    return () => {
      cancelled = true
    }
  }, [initialUser?.is_admin])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  async function handleScheduledReset(
    modes: Array<'daily' | 'weekly'>,
    resettableAccounts: DragonAccount[],
    dailyKey: string,
    weeklyKey: string,
  ) {
    const resetLabel =
      modes.length === 2
        ? 'Running daily and weekly reset'
        : modes[0] === 'weekly'
          ? 'Running weekly reset'
          : 'Running daily reset'

    setResetOverlay({
      title: resetLabel,
      detail: 'Refreshing finished spam runs and updating the roster.',
    })

    try {
      const updatedAccounts = await resetFinishedSpamRuns(
        resettableAccounts.map((account) => account.id),
      )

      setAccounts((currentAccounts) =>
        mergeUpdatedAccounts(currentAccounts, updatedAccounts),
      )

      if (modes.includes('daily')) {
        window.localStorage.setItem(DAILY_RESET_STORAGE_KEY, dailyKey)
      }

      if (modes.includes('weekly')) {
        window.localStorage.setItem(WEEKLY_RESET_STORAGE_KEY, weeklyKey)
      }

      failedResetKeyRef.current = null
    } catch (resetError) {
      failedResetKeyRef.current = `${dailyKey}|${weeklyKey}`
      setTableError(toMessage(resetError, 'The automatic spam reset failed.'))
    } finally {
      window.setTimeout(() => {
        setResetOverlay(null)
        resetInFlightRef.current = false
      }, 600)
    }
  }

  useEffect(() => {
    if (loadState !== 'ready' || resetInFlightRef.current) {
      return
    }

    const mostRecentDailyReset = getMostRecentDailyReset(now)
    const mostRecentWeeklyReset = getMostRecentWeeklyReset(now)
    const dailyKey = toResetKey(mostRecentDailyReset)
    const weeklyKey = toResetKey(mostRecentWeeklyReset)
    const attemptedKey = `${dailyKey}|${weeklyKey}`

    if (failedResetKeyRef.current === attemptedKey) {
      return
    }

    const dueModes: Array<'daily' | 'weekly'> = []

    if (window.localStorage.getItem(DAILY_RESET_STORAGE_KEY) !== dailyKey) {
      dueModes.push('daily')
    }

    if (window.localStorage.getItem(WEEKLY_RESET_STORAGE_KEY) !== weeklyKey) {
      dueModes.push('weekly')
    }

    if (dueModes.length === 0) {
      return
    }

    const resettableAccounts = accounts.filter((account) => account.spam > 0)

    if (resettableAccounts.length === 0) {
      if (dueModes.includes('daily')) {
        window.localStorage.setItem(DAILY_RESET_STORAGE_KEY, dailyKey)
      }

      if (dueModes.includes('weekly')) {
        window.localStorage.setItem(WEEKLY_RESET_STORAGE_KEY, weeklyKey)
      }

      failedResetKeyRef.current = null
      return
    }

    resetInFlightRef.current = true
    const timeoutId = window.setTimeout(() => {
      void handleScheduledReset(dueModes, resettableAccounts, dailyKey, weeklyKey)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [accounts, loadState, now])

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

  const closeDrawer = useCallback(() => {
    if (saving) {
      return
    }

    setDrawerMode(null)
    setEditingId(null)
    setDraft(createEmptyDraft())
    setDrawerErrors({})
  }, [saving])

  const updateField = useCallback((
    field: Exclude<keyof DrawerDraft, 'class_path'>,
    value: string,
  ) => {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
    setDrawerErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
      submit: undefined,
    }))
  }, [])

  const updateClassPath = useCallback((path: string[]) => {
    setDraft((currentDraft) => ({ ...currentDraft, class_path: path }))
    setDrawerErrors((currentErrors) => ({
      ...currentErrors,
      class_path: undefined,
      submit: undefined,
    }))
  }, [])

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
        sortAccountsNewestFirst(
          currentAccounts.map((account) =>
            account.id === editingId ? savedAccount : account,
          ),
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

  async function handleDeleteAccount() {
    if (!editingId) return

    const confirmed = window.confirm('Are you sure you want to delete this account? This action cannot be undone.')
    if (!confirmed) return

    setSaving(true)
    try {
      await deleteDragonAccount(editingId)
      setAccounts((current) => current.filter((account) => account.id !== editingId))
      closeDrawer()
    } catch (error) {
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
      sortAccountsNewestFirst(
        currentAccounts.map((currentAccount) =>
          currentAccount.id === account.id
            ? {
                ...currentAccount,
                [field]: nextValue,
                updated_at: new Date().toISOString(),
              }
            : currentAccount,
        ),
      ),
    )

    try {
      const savedAccount = await updateDragonAccountCounter(account.id, field, nextValue)
      setAccounts((currentAccounts) =>
        sortAccountsNewestFirst(
          currentAccounts.map((currentAccount) =>
            currentAccount.id === account.id ? savedAccount : currentAccount,
          ),
        ),
      )
    } catch (error) {
      setAccounts((currentAccounts) =>
        sortAccountsNewestFirst(
          currentAccounts.map((currentAccount) =>
            currentAccount.id === account.id ? account : currentAccount,
          ),
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

  async function handleToggleLevel(account: DragonAccount) {
    const pendingKey = levelKey(account.id)
    const nextLevel = isMaxLevelAccount(account) ? 1 : MAX_LEVEL_THRESHOLD

    setPendingLevels((current) => ({ ...current, [pendingKey]: true }))
    setTableError(null)
    setAccounts((currentAccounts) =>
      sortAccountsNewestFirst(
        currentAccounts.map((currentAccount) =>
          currentAccount.id === account.id
            ? {
                ...currentAccount,
                level: nextLevel,
                updated_at: new Date().toISOString(),
              }
            : currentAccount,
        ),
      ),
    )

    try {
      const savedAccount = await updateDragonAccountLevel(account.id, nextLevel)
      setAccounts((currentAccounts) =>
        sortAccountsNewestFirst(
          currentAccounts.map((currentAccount) =>
            currentAccount.id === account.id ? savedAccount : currentAccount,
          ),
        ),
      )
    } catch (levelError) {
      setAccounts((currentAccounts) =>
        sortAccountsNewestFirst(
          currentAccounts.map((currentAccount) =>
            currentAccount.id === account.id ? account : currentAccount,
          ),
        ),
      )
      setTableError(
        `Unable to update level for ${account.account}: ${toMessage(levelError)}`,
      )
    } finally {
      setPendingLevels((current) => {
        const nextPending = { ...current }
        delete nextPending[pendingKey]
        return nextPending
      })
    }
  }

  async function handleToggleRole(entry: User) {
    const nextIsAdmin = !entry.is_admin
    setError(null)

    // Optimistic update
    setUsers((current) =>
      current.map((u) => (u.id === entry.id ? { ...u, is_admin: nextIsAdmin } : u)),
    )

    try {
      await toggleUserAdmin(entry.id, nextIsAdmin)
    } catch (toggleError) {
      // Revert on error
      setUsers((current) =>
        current.map((u) => (u.id === entry.id ? { ...u, is_admin: entry.is_admin } : u)),
      )
      setError(toMessage(toggleError, 'Failed to update user role.'))
    }
  }

  async function handleDeleteUser(entry: User) {
    if (entry.id === currentUser?.id) {
      setError('You cannot delete your own account while you are still logged in.')
      return
    }

    const confirmed = window.confirm(
      `Delete ${entry.username ?? entry.id}? This will remove the user account and their roster data.`,
    )

    if (!confirmed) {
      return
    }

    setDeletingUserId(entry.id)
    setError(null)

    try {
      await deleteUserAccount(entry.id)
      setUsers((current) => current.filter((userEntry) => userEntry.id !== entry.id))
      void reloadAccounts()
    } catch (deleteError) {
      setError(toMessage(deleteError, 'Failed to delete the user account.'))
    } finally {
      setDeletingUserId(null)
    }
  }

  async function handleResetPassword(entry: User) {
    setResetting(entry.id)
    setError(null)

    try {
      const newPassword = buildPassword()
      await resetUserPassword(entry.id, newPassword)
      setPasswordResult({
        username: entry.username ?? entry.id,
        password: newPassword,
      })
    } catch (resetError) {
      setError(toMessage(resetError, 'Failed to reset password.'))
    } finally {
      setResetting(null)
    }
  }

  async function handleCreatePatchnote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!patchTitle.trim() || !patchContent.trim()) {
      setError('Patchnote title and content are required.')
      return
    }

    setSavingPatchnote(true)
    setError(null)

    try {
      const createdPatchnote = await createPatchnote(patchTitle.trim(), patchContent.trim())
      setPatchnotes((current) => [createdPatchnote, ...current])
      setPatchTitle('')
      setPatchContent('')
      setIsComposerOpen(false)
    } catch (createError) {
      setError(toMessage(createError, 'Failed to publish patchnote.'))
    } finally {
      setSavingPatchnote(false)
    }
  }

  async function handleDeletePatchnote(id: string) {
    try {
      await deletePatchnote(id)
      setPatchnotes((current) => current.filter((note) => note.id !== id))
    } catch (deleteError) {
      setError(toMessage(deleteError, 'Failed to delete patchnote.'))
    }
  }

  async function handleCreateClassNode(label: string, parentId: string | null, sortOrder: number) {
    try {
      const createdNode = await createClassNode(label, parentId, sortOrder)
      setClassNodes((current) => [...current, createdNode])
    } catch (createError) {
      setError(toMessage(createError, 'Failed to create class node.'))
      throw createError // Re-throw for the manager to catch
    }
  }

  async function handleDeleteClassNode(id: string) {
    try {
      await deleteClassNode(id)
      const relatedIds = new Set<string>()

      function collect(nodeId: string) {
        relatedIds.add(nodeId)
        classNodes
          .filter((node) => node.parent_id === nodeId)
          .forEach((child) => collect(child.id))
      }

      collect(id)
      setClassNodes((current) => current.filter((node) => !relatedIds.has(node.id)))
    } catch (deleteError) {
      setError(toMessage(deleteError, 'Failed to delete class node.'))
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
        brandIcon={<Sparkles size={24} />}
        brandTitle="Menu"
        brandSubtitle="Account Saver"
        roleLabel={currentUser?.is_admin ? 'Admin access' : 'User access'}
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as Tab)}
        switchAction={undefined}
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
              title="The whole roster, plus the next reset window."
              description="Track max-level runs, urgent ticket pressure, and the exact time left before the daily and weekly spam reset."
            />

            <div className="metric-grid">
              <MetricCard
                label="Tracked accounts"
                value={accounts.length}
                hint=""
                icon={Users}
              />
              <MetricCard
                label="Max-level roster"
                value={maxLevelAccounts.length}
                hint=""
                icon={CircleGauge}
                accent="success"
              />
              <MetricCard
                label="Pending spam"
                value={maxLevelAccounts.filter((account) => account.spam === 0).length}
                hint=""
                icon={Database}
                accent="warm"
              />
              <MetricCard
                label="Urgent ticket rows"
                value={urgentTicketIgns.size}
                hint=""
                icon={AlertTriangle}
                accent="warm"
              />
            </div>

            <div className="reset-timer-grid">
              <ResetTimerCard
                label="Daily reset"
                countdown={dailyResetCountdown}
                nextAt={`Next: ${formatResetMoment(nextDailyReset)}`}
                hint="Finished spam runs reset every day at 9:00 AM."
              />
              <ResetTimerCard
                label="Weekly reset"
                countdown={weeklyResetCountdown}
                nextAt={`Next: ${formatResetMoment(nextWeeklyReset)}`}
                hint="The weekly reset lands every Saturday at 9:00 AM."
              />
            </div>
          </section>
        ) : null}

        {activeTab === 'classes' ? (
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
            />

            <section className="panel table-shell">
              <div className="section-table__toolbar">
                <div className="toolbar-row toolbar-row--account">
                  <label className="field toolbar-field toolbar-field--search">
                    <span className="field__label">Search account</span>
                    <input
                      type="text"
                      placeholder="Search by account name"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </label>

                  <label className="field toolbar-field toolbar-field--filter">
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

                  <button type="button" className="primary-button toolbar-button" onClick={openCreateDrawer}>
                    <Plus size={16} />
                    Add account
                  </button>

                  {(filterPath.length > 0 || searchQuery) ? (
                    <button
                      type="button"
                      className="ghost-button toolbar-button"
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
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Class path</th>
                          <th>Level</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.map((account) => (
                          <tr
                            key={account.id}
                            className={`account-row${urgentTicketIgns.has(normalizeIgn(account.account)) ? ' row--alert' : ''}`}
                          >
                            <td>
                              <div className="row-heading">
                                <strong>{account.account}</strong>
                              </div>
                            </td>
                            <td>
                              <span className="row-stack">
                                {joinClassPath(account.class_path)}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`counter-pill__state${isMaxLevelAccount(account) ? ' is-done' : ''}`}
                                disabled={Boolean(pendingLevels[levelKey(account.id)])}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleToggleLevel(account)
                                }}
                                style={{ margin: 0 }}
                              >
                                {isMaxLevelAccount(account) ? 'Max' : 'Not max'}
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="icon-button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditDrawer(account)
                                }}
                                aria-label={`Edit ${account.account}`}
                              >
                                <Pencil size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>
          </section>
        ) : null}

        {activeTab === 'calculator' ? (
          <section className="stack-section" style={{ display: 'grid', placeItems: 'center', height: '50vh' }}>
            <SurfaceState
              icon={Calculator}
              title="Under Construction"
              description="The calculator module is currently being built. Check back soon."
            />
          </section>
        ) : null}

        {activeTab === 'ticket-tab' ? (
          <section className="stack-section">
            <SectionHeader
              eyebrow={
                <>
                  <Ticket size={14} />
                  Tickets
                </>
              }
              title="Track your account tickets."
              description="Log ticket names and expiration dates per account. Expand a row to see its tickets."
              action={
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setTicketDraft(createEmptyTicketDraft())
                    setTicketErrors({})
                    setTicketDrawerMode('create')
                  }}
                >
                  <Plus size={16} />
                  Add new ticket
                </button>
              }
            />

            <section className="panel table-shell">
              {accounts.length === 0 ? (
                <SurfaceState
                  icon={Ticket}
                  title="No accounts to assign tickets"
                  description="Create an account first to start tracking its tickets."
                />
              ) : (() => {
                // Group tickets by IGN, starting with all known accounts
                const ignGroupsMap = new Map<string, DnTicket[]>();
                accounts.forEach(acc => ignGroupsMap.set(acc.account, []));
                tickets.forEach(t => {
                  if (!ignGroupsMap.has(t.ign)) {
                    ignGroupsMap.set(t.ign, []);
                  }
                  ignGroupsMap.get(t.ign)!.push(t);
                });
                const ignGroups = Array.from(ignGroupsMap);
                return (
                  <>

                    <div className="table-wrap">
                      <table className="data-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>IGN / Account</th>
                          <th>Tickets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ignGroups.map(([ign, ignTickets]) => {
                          const isExpanded = expandedTicketIgn === ign
                          const hasUrgentTicket = ignTickets.some((ticket) =>
                            isNearExpiration(ticket.expiration_date),
                          )
                          return (
                            <Fragment key={ign}>
                              <tr
                                className={`account-row${isExpanded ? ' is-expanded' : ''}${hasUrgentTicket ? ' row--alert' : ''}`}
                                onClick={() => setExpandedTicketIgn(isExpanded ? null : ign)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td className="row-chevron-cell">
                                  <ChevronDown
                                    size={15}
                                    className={`row-chevron${isExpanded ? ' is-open' : ''}`}
                                  />
                                </td>
                                <td>
                                  <div className="row-heading">
                                    <strong>{ign}</strong>
                                  </div>
                                </td>
                                <td>
                                  <span className={`status-chip${hasUrgentTicket ? ' status-chip--danger' : ''}`}>
                                    {ignTickets.length} ticket{ignTickets.length !== 1 ? 's' : ''}
                                  </span>
                                </td>
                              </tr>

                              {isExpanded ? (
                                <tr className="account-row-expand">
                                  <td colSpan={3}>
                                    <div className="row-expand-panel">
                                      <div className="ticket-sub-table-wrap">
                                        <table className="data-table data-table--nested">
                                          <thead>
                                            <tr>
                                              <th>Name of ticket</th>
                                              <th>Expiration date</th>
                                              <th></th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {ignTickets.map((t) => (
                                              <tr key={t.id} className={isNearExpiration(t.expiration_date) ? 'row--expiring' : ''}>
                                                <td>
                                                  <div className="row-heading">
                                                    <strong>{t.ticket_name}</strong>
                                                  </div>
                                                </td>
                                                <td>
                                                  <span className={`status-chip${isNearExpiration(t.expiration_date) ? ' status-chip--danger' : ''}`}>
                                                    {new Date(t.expiration_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                  </span>
                                                </td>
                                                <td>
                                                  <button
                                                    type="button"
                                                    className="icon-button"
                                                    aria-label={`Delete ${t.ticket_name}`}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      void deleteTicket(t.id).then(() =>
                                                        setTickets((cur) => cur.filter((x) => x.id !== t.id))
                                                      ).catch((err) => setError(toMessage(err)))
                                                    }}
                                                  >
                                                    <Trash2 size={14} />
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )
              })()}
            </section>

            {/* Add ticket drawer */}
            <OverlaySurface
              open={ticketDrawerMode === 'create'}
              onClose={() => setTicketDrawerMode(null)}
              title="Add new ticket"
              description="Record a ticket for one of your accounts."
              eyebrow={
                <>
                  <Ticket size={14} />
                  New ticket
                </>
              }
              variant="drawer"
              size="sm"
            >
              <form
                className="drawer-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const errs: typeof ticketErrors = {}
                  if (!ticketDraft.ign.trim()) errs.ign = 'IGN is required.'
                  if (!ticketDraft.ticket_name.trim()) errs.ticket_name = 'Ticket name is required.'
                  if (!ticketDraft.expiration_date) errs.expiration_date = 'Expiration date is required.'
                  if (Object.keys(errs).length > 0) { setTicketErrors(errs); return }
                  setSavingTicket(true)
                  try {
                    const saved = await createTicket(
                      ticketDraft.ign.trim(),
                      ticketDraft.ticket_name.trim(),
                      ticketDraft.expiration_date,
                    )
                    setTickets((cur) => [saved, ...cur])
                    setTicketDrawerMode(null)
                    setTicketDraft(createEmptyTicketDraft())
                  } catch (err) {
                    setTicketErrors({ submit: toMessage(err) })
                  } finally {
                    setSavingTicket(false)
                  }
                }}
              >
                <label className="field">
                  <span className="field__label">IGN / Account</span>
                  <input
                    type="text"
                    list={ticketDraft.ign.trim().length > 0 ? "account-suggestions" : undefined}
                    value={ticketDraft.ign}
                    onChange={(e) => setTicketDraft((d) => ({ ...d, ign: e.target.value }))}
                    placeholder="Enter or select an account"
                    disabled={savingTicket}
                  />
                  <datalist id="account-suggestions">
                    {ticketDraft.ign.trim().length > 0 && accounts.map((acc) => (
                      <option key={acc.id} value={acc.account} />
                    ))}
                  </datalist>
                  {ticketErrors.ign ? <span className="field__error">{ticketErrors.ign}</span> : null}
                </label>

                <label className="field">
                  <span className="field__label">Name of ticket</span>
                  <input
                    type="text"
                    value={ticketDraft.ticket_name}
                    onChange={(e) => setTicketDraft((d) => ({ ...d, ticket_name: e.target.value }))}
                    placeholder="e.g. Dragon Jewel, Nest Pass"
                    disabled={savingTicket}
                  />
                  {ticketErrors.ticket_name ? <span className="field__error">{ticketErrors.ticket_name}</span> : null}
                </label>

                <label className="field">
                  <span className="field__label">Expiration date</span>
                  <input
                    type="date"
                    value={ticketDraft.expiration_date}
                    onChange={(e) => setTicketDraft((d) => ({ ...d, expiration_date: e.target.value }))}
                    disabled={savingTicket}
                  />
                  {ticketErrors.expiration_date ? <span className="field__error">{ticketErrors.expiration_date}</span> : null}
                </label>

                {ticketErrors.submit ? (
                  <div className="inline-error" role="alert">
                    <Shield size={16} />
                    <span>{ticketErrors.submit}</span>
                  </div>
                ) : null}

                <footer className="drawer-form__footer">
                  <div className="drawer-form__footer-group">
                    <div className="drawer-form__actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setTicketDrawerMode(null)}
                        disabled={savingTicket}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="primary-button" disabled={savingTicket}>
                        {savingTicket ? 'Saving…' : 'Add ticket'}
                      </button>
                    </div>
                  </div>
                </footer>
              </form>
            </OverlaySurface>
          </section>
        ) : null}

        {activeTab === 'pet' ? (
          <section className="stack-section">
            <SectionHeader
              eyebrow={
                <>
                  <PawPrint size={14} />
                  Pet Management
                </>
              }
              title="Manage your pets' expiration dates."
              description="Keep track of your pets and renew them before they expire."
              action={
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setPetDraft(createEmptyPetDraft())
                    setPetErrors({})
                    setPetDrawerMode('create')
                  }}
                >
                  <Plus size={16} />
                  Add new pet
                </button>
              }
            />

            <section className="panel table-shell">
              {accounts.length === 0 ? (
                <SurfaceState
                  icon={PawPrint}
                  title="No accounts to assign pets"
                  description="Create an account first to start tracking its pets."
                />
              ) : (() => {
                const ignGroupsMap = new Map<string, DnPet[]>();
                accounts.forEach(acc => ignGroupsMap.set(acc.account, []));
                pets.forEach(p => {
                  if (!ignGroupsMap.has(p.ign)) {
                    ignGroupsMap.set(p.ign, []);
                  }
                  ignGroupsMap.get(p.ign)!.push(p);
                });
                const ignGroups = Array.from(ignGroupsMap);
                return (
                  <>
                    <div className="table-wrap">
                      <table className="data-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>IGN / Account</th>
                          <th>Pets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ignGroups.map(([ign, ignPets]) => {
                          const isExpanded = expandedPetIgn === ign
                          return (
                            <Fragment key={ign}>
                              <tr
                                className={`account-row${isExpanded ? ' is-expanded' : ''}`}
                                onClick={() => setExpandedPetIgn(isExpanded ? null : ign)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td className="row-chevron-cell">
                                  <ChevronDown
                                    size={15}
                                    className={`row-chevron${isExpanded ? ' is-open' : ''}`}
                                  />
                                </td>
                                <td>
                                  <div className="row-heading">
                                    <strong>{ign}</strong>
                                  </div>
                                </td>
                                <td>
                                  <span className="status-chip">{ignPets.length} pet{ignPets.length !== 1 ? 's' : ''}</span>
                                </td>
                              </tr>

                              {isExpanded ? (
                                <tr className="account-row-expand">
                                  <td colSpan={3}>
                                    <div className="row-expand-panel">
                                      <div className="ticket-sub-table-wrap">
                                        <table className="data-table data-table--nested">
                                          <thead>
                                            <tr>
                                              <th>Expiration date</th>
                                              <th></th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {ignPets.map((p) => (
                                              <tr key={p.id} className={isNearExpiration(p.expiration_date) ? 'row--expiring' : ''}>
                                                <td>
                                                  <span className={`status-chip${new Date(p.expiration_date) < new Date() ? ' status-chip--warm' : ''}`}>
                                                    {new Date(p.expiration_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                  </span>
                                                </td>
                                                <td>
                                                  <button
                                                    type="button"
                                                    className="icon-button"
                                                    aria-label={`Delete pet`}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      void deletePet(p.id).then(() =>
                                                        setPets((cur) => cur.filter((x) => x.id !== p.id))
                                                      ).catch((err) => setError(toMessage(err)))
                                                    }}
                                                  >
                                                    <Trash2 size={14} />
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )
              })()}
            </section>

            <OverlaySurface
              open={petDrawerMode === 'create'}
              onClose={() => setPetDrawerMode(null)}
              title="Add new pet"
              description="Record a pet for one of your accounts."
              eyebrow={
                <>
                  <PawPrint size={14} />
                  New pet
                </>
              }
              variant="drawer"
              size="sm"
            >
              <form
                className="drawer-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const errs: typeof petErrors = {}
                  if (!petDraft.ign.trim()) errs.ign = 'IGN is required.'
                  if (!petDraft.expiration_date) errs.expiration_date = 'Expiration date is required.'
                  if (Object.keys(errs).length > 0) { setPetErrors(errs); return }
                  setSavingPet(true)
                  try {
                    const saved = await createPet(
                      petDraft.ign.trim(),
                      petDraft.expiration_date,
                    )
                    setPets((cur) => [saved, ...cur])
                    setPetDrawerMode(null)
                    setPetDraft(createEmptyPetDraft())
                  } catch (err) {
                    setPetErrors({ submit: toMessage(err) })
                  } finally {
                    setSavingPet(false)
                  }
                }}
              >
                <label className="field">
                  <span className="field__label">IGN / Account</span>
                  <input
                    type="text"
                    list={petDraft.ign.trim().length > 0 ? "account-suggestions-pet" : undefined}
                    value={petDraft.ign}
                    onChange={(e) => setPetDraft((d) => ({ ...d, ign: e.target.value }))}
                    placeholder="Enter or select an account"
                    disabled={savingPet}
                  />
                  <datalist id="account-suggestions-pet">
                    {petDraft.ign.trim().length > 0 && accounts.map((acc) => (
                      <option key={acc.id} value={acc.account} />
                    ))}
                  </datalist>
                  {petErrors.ign ? <span className="field__error">{petErrors.ign}</span> : null}
                </label>

                <label className="field">
                  <span className="field__label">Expiration date</span>
                  <input
                    type="date"
                    value={petDraft.expiration_date}
                    onChange={(e) => setPetDraft((d) => ({ ...d, expiration_date: e.target.value }))}
                    disabled={savingPet}
                  />
                  {petErrors.expiration_date ? <span className="field__error">{petErrors.expiration_date}</span> : null}
                </label>

                {petErrors.submit ? (
                  <div className="inline-error" role="alert">
                    <Shield size={16} />
                    <span>{petErrors.submit}</span>
                  </div>
                ) : null}

                <footer className="drawer-form__footer">
                  <div className="drawer-form__footer-group">
                    <div className="drawer-form__actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setPetDrawerMode(null)}
                        disabled={savingPet}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="primary-button" disabled={savingPet}>
                        {savingPet ? 'Saving…' : 'Add pet'}
                      </button>
                    </div>
                  </div>
                </footer>
              </form>
            </OverlaySurface>
          </section>
        ) : null}

        {activeTab === 'spam' ? (
          <section className="stack-section">
            <SectionHeader
              eyebrow={
                <>
                  <ShieldCheck size={14} />
                  Spam Runs
                </>
              }
              title="Track your daily spam runs."
              description="Quickly mark accounts as done or pending for the day."
            />

            <section className="panel table-shell">
              <div className="section-table__toolbar">
                <div className="toolbar-row toolbar-row--account">
                  <label className="field toolbar-field toolbar-field--search">
                    <span className="field__label">Search account</span>
                    <input
                      type="text"
                      placeholder="Search by account name"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </label>
                  {(searchQuery) ? (
                    <button
                      type="button"
                      className="ghost-button toolbar-button"
                      onClick={() => setSearchQuery('')}
                    >
                      <FilterX size={16} />
                      Clear filters
                    </button>
                  ) : null}
                </div>
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

              {loadState === 'ready' && spamAccounts.length === 0 ? (
                <SurfaceState
                  icon={ShieldCheck}
                  title={accounts.length === 0 ? 'No accounts saved yet' : 'No max-level accounts match the search'}
                  description={
                    accounts.length === 0
                      ? 'Create an account in the Accounts tab to start tracking spam runs.'
                      : 'Only accounts marked as max show here. Clear the search or switch more accounts to max.'
                  }
                  action={
                    filteredAccounts.length > 0 ? (
                      <ButtonLink
                        label="Show max-level accounts"
                        onClick={() => setSearchQuery('')}
                      />
                    ) : accounts.length > 0 ? (
                      <ButtonLink
                        label="Open accounts"
                        onClick={() => setActiveTab('classes')}
                      />
                    ) : undefined
                  }
                />
              ) : null}

              {loadState === 'ready' && spamAccounts.length > 0 ? (
                <>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Spam Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spamAccounts.map((account) => (
                          <tr
                            key={account.id}
                            className={`account-row${urgentTicketIgns.has(normalizeIgn(account.account)) ? ' row--alert' : ''}`}
                          >
                            <td>
                              <div className="row-heading">
                                <strong>{account.account}</strong>
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`counter-pill__state${account.spam > 0 ? ' is-done' : ''}`}
                                disabled={Boolean(pendingCounters[counterKey(account.id, 'spam')])}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleQuickCounterChange(
                                    account,
                                    'spam',
                                    account.spam > 0 ? -account.spam : 1,
                                  )
                                }}
                                style={{ margin: 0 }}
                              >
                                {account.spam > 0 ? '✓ Finished' : 'Mark done'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mobile-only data-card-grid">
                    {spamAccounts.map((account) => (
                      <article
                        key={account.id}
                        className={`table-card${urgentTicketIgns.has(normalizeIgn(account.account)) ? ' table-card--alert' : ''}`}
                      >
                        <div className="table-card__header">
                          <div className="row-heading">
                            <strong>{account.account}</strong>
                          </div>
                        </div>
                        <div className="table-card__meta">
                          <button
                            type="button"
                            className={`counter-pill__state${account.spam > 0 ? ' is-done' : ''}`}
                            disabled={Boolean(pendingCounters[counterKey(account.id, 'spam')])}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleQuickCounterChange(
                                account,
                                'spam',
                                account.spam > 0 ? -account.spam : 1,
                              )
                            }}
                            style={{ margin: 0, width: '100%', justifyContent: 'center' }}
                          >
                            {account.spam > 0 ? '✓ Finished' : 'Mark done'}
                          </button>
                        </div>
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

        {activeTab === 'pet' ? (
          <section className="stack-section">
            <SectionHeader
              eyebrow={
                <>
                  <PawPrint size={14} />
                  Pet
                </>
              }
              title="Your Dragon Nest companions."
              description="Track and manage your in-game pets from one place. Pet management features are coming soon."
            />
            <div className="panel" style={{ padding: '48px 32px', textAlign: 'center', display: 'grid', gap: '16px', justifyItems: 'center' }}>
              <span style={{ fontSize: '3rem' }}>🐾</span>
              <h3 style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Pet tracker coming soon</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '40ch', margin: 0 }}>This section will let you track your pets, equipment, and buffs per account.</p>
            </div>
          </section>
        ) : null}

{activeTab === 'admin-overview' ? (
          <section className="stack-section">
            <SectionHeader
              eyebrow={
                <>
                  <LayoutDashboard size={14} />
                  Overview
                </>
              }
              title="A cleaner admin snapshot across the whole system."
              description="Review user growth, role split, publishing cadence, and class-tree depth without leaving the centered shell."
            />

            <div className="metric-grid">
              <MetricCard
                label="Total users"
                value={users.length}
                hint="All registered Dragon Nest users."
                icon={Users}
                accent="warm"
              />
              <MetricCard
                label="Admins"
                value={users.filter((entry) => entry.is_admin).length}
                hint="Accounts with elevated access."
                icon={Shield}
                accent="warm"
              />
              <MetricCard
                label="Patchnotes"
                value={patchnotes.length}
                hint="Published update logs."
                icon={FileText}
              />
              <MetricCard
                label="Class roots"
                value={liveClassTree.length}
                hint="Top-level class families."
                icon={GitBranch}
              />
            </div>

            <div className="chart-grid">
              <ChartCard
                eyebrow="User growth"
                title="Recent registrations"
                description="New user accounts created over the last six months."
              >
                <TrendAreaChart data={userGrowthData} accent="#ffb16f" />
              </ChartCard>

              <ChartCard
                eyebrow="Role split"
                title="Admin versus user ratio"
                description="Monitor access distribution across the system."
              >
                <DonutChart data={roleSplitData} accent="warm" />
              </ChartCard>

              <ChartCard
                eyebrow="Publishing rhythm"
                title="Patchnotes over the last six months"
                description="See when communication volume has changed."
              >
                <TrendAreaChart data={patchnoteActivityData} accent="#ffd39a" />
              </ChartCard>

              <ChartCard
                eyebrow="Class hierarchy"
                title="Depth distribution"
                description="Track how many nodes exist at each tree level."
              >
                <BarChart data={classDepthData} accent="warm" />
              </ChartCard>
            </div>
          </section>
        ) : null}

        {activeTab === 'users' ? (
          <section className="stack-section">
            <SectionHeader
              eyebrow={
                <>
                  <Users size={14} />
                  User management
                </>
              }
              title="Aligned rows, safer resets, and direct account cleanup."
              description="Search users, inspect joined dates, reset passwords, and delete accounts without allowing self-deletion from the active session."
            />

            <section className="panel table-shell">
              <div className="section-table__toolbar">
                <label className="field toolbar-row__grow">
                  <span className="field__label">Search users</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by username or user ID"
                  />
                </label>
              </div>

              {filteredUsers.length === 0 ? (
                <SurfaceState
                  icon={Users}
                  title="No users matched the current search"
                  description="Try a different username or clear the current filter."
                />
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              <div className="row-heading">
                                <strong>{entry.username ?? 'Unnamed user'}</strong>
                                <span>{entry.id}</span>
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`status-chip${entry.is_admin ? ' status-chip--warm' : ''}`}
                                onClick={() => void handleToggleRole(entry)}
                                title={`Click to make ${entry.is_admin ? 'User' : 'Admin'}`}
                                disabled={entry.id === currentUser?.id} // Don't allow self-demotion
                              >
                                {entry.is_admin ? 'Admin' : 'User'}
                              </button>
                            </td>
                            <td>{new Date(entry.created_at).toLocaleDateString()}</td>
                            <td>
                              <div className="row-action-group">
                                <button
                                  type="button"
                                  className="ghost-button"
                                  disabled={resetting === entry.id}
                                  onClick={() => void handleResetPassword(entry)}
                                >
                                  <KeyRound size={16} />
                                  {resetting === entry.id ? 'Resetting…' : 'Reset password'}
                                </button>
                                <button
                                  type="button"
                                  className="secondary-button secondary-button--warm"
                                  disabled={deletingUserId === entry.id || entry.id === currentUser?.id}
                                  onClick={() => void handleDeleteUser(entry)}
                                  title={entry.id === currentUser?.id ? 'You cannot delete your own active account.' : undefined}
                                >
                                  <Trash2 size={16} />
                                  {deletingUserId === entry.id ? 'Deleting…' : 'Delete account'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </section>
        ) : null}

        {activeTab === 'admin-patchnotes' ? (
          <PatchnoteDeck
            patchnotes={patchnotes}
            eyebrow={
              <>
                <FileText size={14} />
                Patchnote control
              </>
            }
            title="Publish and review patchnotes from the same shell."
            description="Create update logs, inspect details, and delete entries from centered overlays."
            actions={
              <button type="button" className="primary-button" onClick={() => setIsComposerOpen(true)}>
                <Plus size={16} />
                Publish note
              </button>
            }
            emptyTitle="No patchnotes published yet"
            emptyDescription="Create the first patchnote to start the update timeline."
            detailActions={(note) => (
              <button
                type="button"
                className="secondary-button secondary-button--warm"
                onClick={() => void handleDeletePatchnote(note.id)}
              >
                <Trash2 size={16} />
                Delete patchnote
              </button>
            )}
          />
        ) : null}

        {activeTab === 'admin-classes' ? (
          <ClassTreeManager
            nodes={classNodes}
            onCreate={handleCreateClassNode}
            onDelete={handleDeleteClassNode}
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
        onDelete={handleDeleteAccount}
      />

      <OverlaySurface
        open={passwordResult !== null}
        onClose={() => setPasswordResult(null)}
        title="Password reset complete"
        description="Copy the generated password and share it through your secure admin workflow."
        eyebrow={
          <>
            <KeyRound size={14} />
            User reset result
          </>
        }
        variant="modal"
        size="md"
      >
        <div className="form-panel">
          <div className="row-heading">
            <strong>{passwordResult?.username}</strong>
            <span>Generated password</span>
          </div>
          <div className="panel form-panel">
            <code>{passwordResult?.password}</code>
          </div>
        </div>
      </OverlaySurface>

      <OverlaySurface
        open={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        title="Publish patchnote"
        description="Create a new update entry for every user dashboard."
        eyebrow={
          <>
            <BookOpen size={14} />
            Publish update
          </>
        }
        variant="drawer"
        size="lg"
      >
        <form className="drawer-form" onSubmit={handleCreatePatchnote}>
          <label className="field">
            <span className="field__label">Patchnote title</span>
            <input
              type="text"
              value={patchTitle}
              onChange={(event) => setPatchTitle(event.target.value)}
              placeholder="Version or headline"
            />
          </label>

          <label className="field">
            <span className="field__label">Patchnote content</span>
            <textarea
              value={patchContent}
              onChange={(event) => setPatchContent(event.target.value)}
              placeholder="Write the patch details..."
              rows={8}
            />
          </label>

          <div className="drawer-form__actions">
            <button type="button" className="ghost-button" onClick={() => setIsComposerOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={savingPatchnote}>
              {savingPatchnote ? 'Publishing…' : 'Publish note'}
            </button>
          </div>
        </form>
      </OverlaySurface>

      {resetOverlay ? (
        <ResetLoader
          title={resetOverlay.title}
          detail={resetOverlay.detail}
        />
      ) : null}

      {error ? (
        <ToastNotification
          message="Action failed"
          subText={error}
          tone="danger"
          onClose={() => setError(null)}
        />
      ) : null}

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
