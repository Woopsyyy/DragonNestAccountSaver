import { useMemo, useState, type FormEvent } from 'react'

import { PencilLine, Plus, Search, ShieldAlert, Sparkles } from 'lucide-react'

import {
  flattenClassPaths,
  joinClassPath,
  type ClassNode,
} from '../lib/classes'
import { ClassPathPicker } from './ClassPathPicker'
import { OverlaySurface } from './ui/OverlaySurface'

export type DrawerDraft = {
  account: string
  class_path: string[]
  level: string
  spam: string
  ticket: string
}

export type DrawerErrors = Partial<
  Record<'account' | 'class_path' | 'level' | 'spam' | 'ticket' | 'submit', string>
>

type AccountDrawerProps = {
  mode: 'create' | 'edit' | null
  open: boolean
  draft: DrawerDraft
  errors: DrawerErrors
  pending: boolean
  classTree?: ClassNode[]
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFieldChange: (
    field: Exclude<keyof DrawerDraft, 'class_path'>,
    value: string,
  ) => void
  onClassPathChange: (path: string[]) => void
}

const FORM_COPY = {
  create: {
    title: 'Add Account',
    helper:
      'Write directly to Supabase with a full class path, starting counts, and a launch-ready level.',
    submitLabel: 'Create account',
    icon: Plus,
  },
  edit: {
    title: 'Edit Account',
    helper:
      'Adjust the saved class path or clean up stats. Table counters stay available for quick combat bookkeeping.',
    submitLabel: 'Save changes',
    icon: PencilLine,
  },
} as const

export function AccountDrawer({
  mode,
  open,
  draft,
  errors,
  pending,
  classTree = [],
  onClose,
  onSubmit,
  onFieldChange,
  onClassPathChange,
}: AccountDrawerProps) {
  const content = mode ? FORM_COPY[mode] : null
  const DrawerIcon = content?.icon ?? PencilLine

  const [classSearch, setClassSearch] = useState('')
  const allClassPaths = useMemo(() => flattenClassPaths(classTree), [classTree])

  const filteredPaths = useMemo(
    () =>
      allClassPaths
        .filter((path) =>
          path.some((segment) =>
            segment.toLowerCase().includes(classSearch.toLowerCase()),
          ),
        )
        .slice(0, 8),
    [allClassPaths, classSearch],
  )

  return (
    <OverlaySurface
      open={open}
      onClose={onClose}
      title={content?.title ?? 'Account drawer'}
      description={content?.helper}
      eyebrow={
        <>
          <DrawerIcon size={14} />
          Operations
        </>
      }
      variant="drawer"
      size="xl"
    >
      <form className="drawer-form" onSubmit={onSubmit}>
        <label className="field">
          <span className="field__label">Account</span>
          <input
            type="text"
            value={draft.account}
            onChange={(event) => onFieldChange('account', event.target.value)}
            placeholder="IGN / login alias"
            disabled={pending}
          />
          {errors.account ? <span className="field__error">{errors.account}</span> : null}
        </label>

        <div className="drawer-form__picker">
          <label className="field">
            <span className="field__label">Search class path</span>
            <div className="search-input">
              <Search size={16} />
              <input
                type="text"
                value={classSearch}
                onChange={(event) => setClassSearch(event.target.value)}
                placeholder="Search origin, class, or ascension"
                disabled={pending}
              />
            </div>
          </label>

          {classSearch.trim() ? (
            <div className="search-results" role="list">
              {filteredPaths.length > 0 ? (
                filteredPaths.map((path) => (
                  <button
                    key={joinClassPath(path)}
                    type="button"
                    className="search-results__item"
                    onClick={() => {
                      onClassPathChange(path)
                      setClassSearch('')
                    }}
                  >
                    <Sparkles size={14} />
                    <span>{joinClassPath(path)}</span>
                  </button>
                ))
              ) : (
                <p className="search-results__empty">No live class paths matched that search.</p>
              )}
            </div>
          ) : null}

          <ClassPathPicker
            title="Class route"
            caption="Pick the account path from the live class tree so the roster, analytics, and filters stay aligned."
            selectedPath={draft.class_path}
            onChange={onClassPathChange}
            disabled={pending}
            allowClear
            nodes={classTree}
          />

          {draft.class_path.length ? (
            <p className="drawer-form__summary">{joinClassPath(draft.class_path)}</p>
          ) : null}
          {errors.class_path ? <span className="field__error">{errors.class_path}</span> : null}
        </div>

        <div className="drawer-form__stats">
          <label className="field">
            <span className="field__label">Level</span>
            <input
              type="number"
              min="1"
              step="1"
              value={draft.level}
              onChange={(event) => onFieldChange('level', event.target.value)}
              disabled={pending}
            />
            {errors.level ? <span className="field__error">{errors.level}</span> : null}
          </label>

          <label className="field">
            <span className="field__label">Spam</span>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.spam}
              onChange={(event) => onFieldChange('spam', event.target.value)}
              disabled={pending}
            />
            {errors.spam ? <span className="field__error">{errors.spam}</span> : null}
          </label>

          <label className="field">
            <span className="field__label">Ticket</span>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.ticket}
              onChange={(event) => onFieldChange('ticket', event.target.value)}
              disabled={pending}
            />
            {errors.ticket ? <span className="field__error">{errors.ticket}</span> : null}
          </label>
        </div>

        {errors.submit ? (
          <div className="inline-error" role="alert">
            <ShieldAlert size={16} />
            <span>{errors.submit}</span>
          </div>
        ) : null}

        <footer className="drawer-form__actions">
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? 'Saving…' : content?.submitLabel}
          </button>
        </footer>
      </form>
    </OverlaySurface>
  )
}
