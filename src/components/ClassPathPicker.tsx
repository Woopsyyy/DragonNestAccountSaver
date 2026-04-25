import { ChevronRight } from 'lucide-react'

import {
  CLASS_TREE,
  getPickerColumns,
  type ClassNode,
} from '../lib/classes'

type ClassPathPickerProps = {
  selectedPath: string[]
  onChange: (nextPath: string[]) => void
  disabled?: boolean
  className?: string
  nodes?: ClassNode[]
}

export function ClassPathPicker({
  selectedPath,
  onChange,
  disabled = false,
  className,
  nodes = CLASS_TREE,
}: ClassPathPickerProps) {
  const columns = getPickerColumns(selectedPath, nodes)
  
  // The options to show are from the "next" depth
  const currentDepth = selectedPath.length
  const currentOptions = columns[currentDepth] || []



  return (
    <section className={['class-picker', className].filter(Boolean).join(' ')}>
      {currentOptions.length > 0 ? (
        <div className="class-picker__options-grid">
          {currentOptions.map((node) => (
            <button
              key={node.label}
              type="button"
              className="class-chip"
              onClick={() => onChange([...selectedPath, node.label])}
              disabled={disabled}
            >
              <span>{node.label}</span>
              {node.children?.length ? <ChevronRight size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
