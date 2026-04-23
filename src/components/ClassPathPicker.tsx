import { ChevronRight, Sparkles } from 'lucide-react'

import {
  CLASS_TIER_LABELS,
  CLASS_TREE,
  findNodeByPath,
  getPickerColumns,
  joinClassPath,
  type ClassNode,
} from '../lib/classes'

type ClassPathPickerProps = {
  title: string
  caption: string
  selectedPath: string[]
  onChange: (nextPath: string[]) => void
  allowClear?: boolean
  disabled?: boolean
  className?: string
  nodes?: ClassNode[]
}

function pathPreview(path: string[]) {
  if (path.length === 0) {
    return 'No class selected'
  }

  return joinClassPath(path)
}

function nextPathForDepth(
  selectedPath: string[],
  depth: number,
  node: ClassNode,
): string[] {
  return [...selectedPath.slice(0, depth), node.label]
}

export function ClassPathPicker({
  title,
  caption,
  selectedPath,
  onChange,
  allowClear = false,
  disabled = false,
  className,
  nodes = CLASS_TREE,
}: ClassPathPickerProps) {
  const columns = getPickerColumns(selectedPath, nodes)
  const terminalNode = findNodeByPath(selectedPath, nodes)
  const isTerminalSelection = Boolean(selectedPath.length) && !terminalNode?.children?.length

  return (
    <section className={['class-picker', className].filter(Boolean).join(' ')}>
      <header className="class-picker__header">
        <div>
          <p className="eyebrow">{title}</p>
          <p className="class-picker__caption">{caption}</p>
        </div>
        {allowClear ? (
          <button
            type="button"
            className="ghost-button"
            onClick={() => onChange([])}
            disabled={disabled || selectedPath.length === 0}
          >
            Clear
          </button>
        ) : null}
      </header>

      <div className="class-picker__preview" aria-live="polite">
        <Sparkles size={14} />
        <span>{pathPreview(selectedPath)}</span>
        {isTerminalSelection ? (
          <span className="class-picker__preview-tag">terminal</span>
        ) : null}
      </div>

      <div className="class-picker__grid">
        {columns.map((options, depth) => (
          <div key={CLASS_TIER_LABELS[depth] ?? depth} className="class-picker__column">
            <p className="class-picker__tier">
              {CLASS_TIER_LABELS[depth] ?? `Tier ${depth + 1}`}
            </p>
            <div className="class-picker__options">
              {options.map((node) => {
                const active = selectedPath[depth] === node.label
                const nextPath = nextPathForDepth(selectedPath, depth, node)

                return (
                  <button
                    key={node.label}
                    type="button"
                    className={`class-chip${active ? ' is-active' : ''}`}
                    onClick={() => onChange(nextPath)}
                    disabled={disabled}
                    aria-pressed={active}
                  >
                    <span>{node.label}</span>
                    {node.children?.length ? <ChevronRight size={14} /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
