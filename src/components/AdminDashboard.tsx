import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BookOpen,
  FileText,
  GitBranch,
  KeyRound,
  Layers3,
  LayoutDashboard,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import ClockCard from './ClockCard'
import LightRays from './LightRays'
import ToastNotification from './ToastNotification'
import { PatchnoteDeck } from './PatchnoteDeck'
import { buildClassTree } from '../lib/classes'
import {
  createClassNode,
  createPatchnote,
  deleteClassNode,
  deletePatchnote,
  getBrowserClient,
  listAllUsers,
  listClassTree,
  listPatchnotes,
  resetUserPassword,
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
import { CommandShell, type CommandNavItem } from './ui/CommandShell'
import { OverlaySurface } from './ui/OverlaySurface'

type AdminTab = 'overview' | 'users' | 'patchnotes' | 'classes'
type AddMode = 'class' | 'type_class' | 'sub_class'

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message

    if (typeof message === 'string') {
      return message
    }
  }

  return fallback
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
      parentId = selectedClassId
    }

    if (addMode === 'sub_class') {
      if (!selectedTypeClassId) {
        setError('Select a type class first.')
        return
      }
      parentId = selectedTypeClassId
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
          <div className="class-card-grid">
            {rootNodes.map((node) => {
              const typeNodes = getChildren(node.id)
              const subclassCount = typeNodes.reduce(
                (sum, typeNode) => sum + getChildren(typeNode.id).length,
                0,
              )

              return (
                <button
                  key={node.id}
                  type="button"
                  className="table-card"
                  onClick={() => setExpandedClassId(node.id)}
                >
                  <div className="class-card__header">
                    <div className="row-heading">
                      <strong>{node.label}</strong>
                      <span>Root class</span>
                    </div>
                    <span className="status-chip">{typeNodes.length} types</span>
                  </div>
                  <div className="table-card__stats">
                    <span className="pill">{subclassCount} subclasses</span>
                    <span className="pill">Sort #{node.sort_order + 1}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <OverlaySurface
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add class node"
        description="Create a root class, a type class under a root, or a subclass under a type class."
        eyebrow={
          <>
            <Plus size={14} />
            Hierarchy editor
          </>
        }
        variant="drawer"
        size="lg"
      >
        <form className="drawer-form" onSubmit={handleSubmit}>
          <div className="class-mode-toggle">
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

          {addMode !== 'class' ? (
            <label className="field">
              <span className="field__label">Parent class</span>
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
            <label className="field">
              <span className="field__label">Parent type class</span>
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
            <span className="field__label">Node label</span>
            <input
              type="text"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder="Enter the new node name"
            />
          </label>

          {error ? (
            <div className="inline-error" role="alert">
              <Shield size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="drawer-form__actions">
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

export default function AdminDashboard({ user }: { user: User }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [users, setUsers] = useState<User[]>([])
  const [patchnotes, setPatchnotes] = useState<Patchnote[]>([])
  const [classNodes, setClassNodes] = useState<FlatClassNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [resetting, setResetting] = useState<string | null>(null)
  const [passwordResult, setPasswordResult] = useState<{ username: string; password: string } | null>(null)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [patchTitle, setPatchTitle] = useState('')
  const [patchContent, setPatchContent] = useState('')
  const [savingPatchnote, setSavingPatchnote] = useState(false)

  const liveClassTree = useMemo(() => buildClassTree(classNodes), [classNodes])
  const userGrowthData = useMemo(() => monthlyTrend(users.map((entry) => entry.created_at)), [users])
  const patchnoteActivityData = useMemo(
    () => monthlyTrend(patchnotes.map((entry) => entry.created_at)),
    [patchnotes],
  )
  const roleSplitData = useMemo(
    () => [
      { label: 'Admins', value: users.filter((entry) => entry.is_admin).length },
      { label: 'Users', value: users.filter((entry) => !entry.is_admin).length },
    ],
    [users],
  )
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
    () =>
      users.filter((entry) =>
        `${entry.username ?? ''} ${entry.id}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [users, search],
  )

  const navItems: CommandNavItem<AdminTab>[] = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'patchnotes', label: 'Patchnotes', icon: FileText },
    { key: 'classes', label: 'Class tree', icon: GitBranch },
  ]

  const heroMetrics = [
    { label: 'Registered users', value: String(users.length), icon: Users },
    { label: 'Patchnotes', value: String(patchnotes.length), icon: FileText },
    { label: 'Class nodes', value: String(classNodes.length), icon: GitBranch },
  ]

  useEffect(() => {
    let cancelled = false

    async function loadAdminData() {
      try {
        const [nextUsers, nextPatchnotes, nextClassNodes] = await Promise.all([
          listAllUsers(),
          listPatchnotes(),
          listClassTree(),
        ])

        if (cancelled) {
          return
        }

        setUsers(nextUsers)
        setPatchnotes(nextPatchnotes)
        setClassNodes(nextClassNodes)
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setError(toMessage(loadError, 'Failed to load admin dashboard data.'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAdminData()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut() {
    await getBrowserClient().auth.signOut()
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
    const createdNode = await createClassNode(label, parentId, sortOrder)
    setClassNodes((current) => [...current, createdNode])
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

  if (loading) {
    return (
      <div className="app-loading">
        <div className="panel app-loading__panel">
          <div className="app-loading__orb" aria-hidden="true" />
          <h2>Loading admin command center</h2>
          <p>Syncing users, patchnotes, and class-tree data.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="shell-light-rays">
        <LightRays raysColor="#ffffff" rayLength={1.35} />
      </div>

      <CommandShell
        theme="admin"
        brandInitial="A"
        brandTitle="Dragon Nest"
        brandSubtitle="Admin Console"
        roleLabel={`Signed in as ${user.username ?? 'admin'}`}
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        heroEyebrow={
          <>
            <Sparkles size={14} />
            Admin command center
          </>
        }
        heroTitle="Run users, patchnotes, and class data from one aligned control surface."
        heroDescription="The admin dashboard now uses the same command-shell language as the user experience, with warm accent guidance and centered management overlays."
        breadcrumb={['Admin', navItems.find((item) => item.key === activeTab)?.label ?? 'Overview']}
        heroMetrics={heroMetrics}
        heroActions={[
          {
            label: 'Publish patchnote',
            icon: Plus,
            onClick: () => setIsComposerOpen(true),
            variant: 'primary',
          },
          {
            label: 'Manage class tree',
            icon: GitBranch,
            onClick: () => setActiveTab('classes'),
            variant: 'ghost',
          },
        ]}
        heroAside={<ClockCard />}
        switchAction={{
          label: 'Open user dashboard',
          icon: UserCog,
          onClick: () => navigate('/dashboard'),
          variant: 'ghost',
        }}
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
              title="Aligned rows and centered password reset feedback."
              description="Search users, inspect joined dates, and reset passwords from a cleaner management surface."
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
                  <div className="desktop-only">
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
                                <span className={`status-chip${entry.is_admin ? ' status-chip--warm' : ''}`}>
                                  {entry.is_admin ? 'Admin' : 'User'}
                                </span>
                              </td>
                              <td>{new Date(entry.created_at).toLocaleDateString()}</td>
                              <td>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  disabled={resetting === entry.id}
                                  onClick={() => void handleResetPassword(entry)}
                                >
                                  <KeyRound size={16} />
                                  {resetting === entry.id ? 'Resetting…' : 'Reset password'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mobile-only data-card-grid">
                    {filteredUsers.map((entry) => (
                      <article key={entry.id} className="table-card">
                        <div className="table-card__header">
                          <div className="row-heading">
                            <strong>{entry.username ?? 'Unnamed user'}</strong>
                            <span>{entry.id}</span>
                          </div>
                          <span className={`status-chip${entry.is_admin ? ' status-chip--warm' : ''}`}>
                            {entry.is_admin ? 'Admin' : 'User'}
                          </span>
                        </div>

                        <div className="table-card__meta">
                          <span>Joined {new Date(entry.created_at).toLocaleDateString()}</span>
                        </div>

                        <button
                          type="button"
                          className="ghost-button"
                          disabled={resetting === entry.id}
                          onClick={() => void handleResetPassword(entry)}
                        >
                          <KeyRound size={16} />
                          {resetting === entry.id ? 'Resetting…' : 'Reset password'}
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </section>
        ) : null}

        {activeTab === 'patchnotes' ? (
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

        {activeTab === 'classes' ? (
          <ClassTreeManager
            nodes={classNodes}
            onCreate={handleCreateClassNode}
            onDelete={handleDeleteClassNode}
          />
        ) : null}
      </CommandShell>

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
              placeholder="Describe the update in detail"
            />
          </label>

          <div className="drawer-form__actions">
            <button type="button" className="ghost-button" onClick={() => setIsComposerOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={savingPatchnote}>
              {savingPatchnote ? 'Publishing…' : 'Publish patchnote'}
            </button>
          </div>
        </form>
      </OverlaySurface>

      {error ? (
        <ToastNotification
          message="Admin update"
          subText={error}
          tone="danger"
          onClose={() => setError(null)}
        />
      ) : null}
    </>
  )
}
