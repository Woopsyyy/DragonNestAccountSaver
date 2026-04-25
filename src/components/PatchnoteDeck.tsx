import { useMemo, useState, type ReactNode } from 'react'
import { CalendarDays, ScrollText } from 'lucide-react'

import type { Patchnote } from '../lib/supabase'
import { OverlaySurface } from './ui/OverlaySurface'
import { SectionHeader, SurfaceState } from './ui/InsightWidgets'

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
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Published</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {sortedPatchnotes.map((note) => (
                  <tr key={note.id} className="row-clickable" onClick={() => setSelectedNote(note)}>
                    <td>
                      <div className="row-heading">
                        <strong>{note.title}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="patchnote-card__date">
                        <CalendarDays size={14} />
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <p className="row-stack" style={{ margin: 0, opacity: 0.7 }}>
                        {note.content.slice(0, 60)}...
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
