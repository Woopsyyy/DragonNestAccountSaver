import { useMemo, useState, type ReactNode } from 'react'
import { CalendarDays, ScrollText, Sparkles } from 'lucide-react'

import type { Patchnote } from '../lib/supabase'
import { OverlaySurface } from './ui/OverlaySurface'
import { DetailLink, SectionHeader, SurfaceState } from './ui/InsightWidgets'

type PatchnoteDeckProps = {
  patchnotes: Patchnote[]
  eyebrow: ReactNode
  title: string
  description: string
  actions?: ReactNode
  emptyTitle: string
  emptyDescription: string
  detailActions?: (note: Patchnote) => ReactNode
}

export function PatchnoteDeck({
  patchnotes,
  eyebrow,
  title,
  description,
  actions,
  emptyTitle,
  emptyDescription,
  detailActions,
}: PatchnoteDeckProps) {
  const [selectedNote, setSelectedNote] = useState<Patchnote | null>(null)

  const sortedPatchnotes = useMemo(
    () =>
      [...patchnotes].sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ),
    [patchnotes],
  )

  return (
    <>
      <section className="stack-section">
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={actions}
        />

        {sortedPatchnotes.length === 0 ? (
          <SurfaceState
            icon={ScrollText}
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          <div className="patchnote-grid">
            {sortedPatchnotes.map((note) => (
              <button
                key={note.id}
                type="button"
                className="patchnote-card"
                onClick={() => setSelectedNote(note)}
              >
                <div className="patchnote-card__top">
                  <span className="patchnote-card__icon">
                    <Sparkles size={16} />
                  </span>
                  <span className="patchnote-card__date">
                    <CalendarDays size={14} />
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                <strong>{note.title}</strong>
                <p>{note.content}</p>
                <DetailLink label="Read full patchnote" />
              </button>
            ))}
          </div>
        )}
      </section>

      <OverlaySurface
        open={selectedNote !== null}
        onClose={() => setSelectedNote(null)}
        title={selectedNote?.title ?? 'Patchnote'}
        description={selectedNote ? new Date(selectedNote.created_at).toLocaleString() : undefined}
        eyebrow={<><ScrollText size={14} /> Patchnote detail</>}
        variant="modal"
        size="lg"
        footer={selectedNote && detailActions ? detailActions(selectedNote) : undefined}
      >
        <div className="patchnote-detail">
          <p>{selectedNote?.content}</p>
        </div>
      </OverlaySurface>
    </>
  )
}
