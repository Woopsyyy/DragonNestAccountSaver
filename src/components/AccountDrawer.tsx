import { useMemo, useState, type FormEvent } from 'react'

import { PencilLine, Plus, Search, Sparkles, Trash2 } from 'lucide-react'

import {
  CLASS_TREE,
  flattenClassPaths,
  joinClassPath,
  type ClassNode,
} from '../lib/classes'
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
  onDelete?: () => void
}

const FORM_COPY = {
  create: {
    title: 'Add Account',
    helper: 'Save an account with its class path to start tracking it in the roster.',
    submitLabel: 'Create account',
    icon: Plus,
  },
  edit: {
    title: 'Edit Account',
    helper: 'Update the account name or class path for this entry.',
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
  onDelete,
}: AccountDrawerProps) {
  const [classSearch, setClassSearch] = useState('')
  const content = mode ? FORM_COPY[mode] : null
  const DrawerIcon = content?.icon ?? PencilLine

  const allClassPaths = useMemo(() => {
    const tree = classTree.length > 0 ? classTree : CLASS_TREE
    return flattenClassPaths(tree)
  }, [classTree])

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
      size="sm"
    >
      <form className="drawer-form" onSubmit={onSubmit}>
        {/* Account name */}
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

        {/* Class path picker */}
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

          {draft.class_path.length ? (
            <p className="drawer-form__summary">
              {joinClassPath(draft.class_path)}
            </p>
          ) : null}
          {errors.class_path ? <span className="field__error">{errors.class_path}</span> : null}
        </div>

        {errors.submit ? (
          <div className="inline-error" role="alert">
            <Trash2 size={16} />
            <span>{errors.submit}</span>
          </div>
        ) : null}

        <footer className="drawer-form__footer">
          <div className="drawer-form__footer-group">
            {mode === 'edit' && onDelete ? (
              <button
                type="button"
                className="secondary-button secondary-button--warm"
                onClick={onDelete}
                disabled={pending}
              >
                <Trash2 size={16} />
                Delete
              </button>
            ) : null}
            <div className="drawer-form__actions">
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
            </div>
          </div>
        </footer>
      </form>
    </OverlaySurface>
  )
}
