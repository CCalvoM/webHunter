import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useAuth } from '../hooks/useAuth'
import { useProspects } from '../hooks/useProspects'
import { useActivities } from '../hooks/useActivities'
import ProspectModal from '../components/ProspectModal'
import type { PipelineStage, Prospect, AuditResult } from '../types'

const COLUMNS: { id: PipelineStage; label: string; color: string; dot: string }[] = [
  { id: 'encontrado', label: 'Encontrado',  color: 'bg-gray-50',   dot: 'bg-gray-400' },
  { id: 'contactado', label: 'Contactado',  color: 'bg-blue-50',   dot: 'bg-blue-400' },
  { id: 'respondio',  label: 'Respondió',   color: 'bg-amber-50',  dot: 'bg-amber-400' },
  { id: 'demo',       label: 'Demo',        color: 'bg-purple-50', dot: 'bg-purple-400' },
  { id: 'cerrado',    label: 'Cerrado ✓',   color: 'bg-green-50',  dot: 'bg-green-500' },
]

const WEB_STATUS_COLORS: Record<string, string> = {
  no_web:   'bg-red-50 text-red-600',
  fake_web: 'bg-amber-50 text-amber-700',
  poor_web: 'bg-yellow-50 text-yellow-700',
  has_web:  'bg-green-50 text-green-600',
}

const WEB_STATUS_LABELS: Record<string, string> = {
  no_web: 'Sin web', fake_web: 'Web falsa',
  poor_web: 'Web pobre', has_web: 'Con web',
}

function ProspectCard({
  prospect,
  onClick,
}: {
  prospect: Prospect
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-black/8 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-black/20 transition-all cursor-pointer"
    >
      <div className="font-medium text-sm text-ink mb-1 leading-tight">{prospect.name}</div>
      <div className="text-xs text-ink-muted mb-2">{prospect.city} · {prospect.category}</div>
      <div className="flex items-center justify-between">
        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${WEB_STATUS_COLORS[prospect.web_status]}`}>
          {WEB_STATUS_LABELS[prospect.web_status]}
        </span>
        {prospect.audit_score !== undefined && (
          <span className={`text-xs font-bold ${
            prospect.audit_score < 30 ? 'text-red-500' :
            prospect.audit_score < 55 ? 'text-amber-600' : 'text-green-600'
          }`}>
            {prospect.audit_score}pts
          </span>
        )}
      </div>
      {prospect.followup_date && (
        <div className="mt-2 text-xs text-accent">
          📅 {new Date(prospect.followup_date).toLocaleDateString('es-ES')}
        </div>
      )}
    </div>
  )
}

export default function Pipeline() {
  const { user } = useAuth()
  const { prospects, loadProspects, updateStage, updateProspect, deleteProspect, saveAudit, loading } = useProspects(user?.id)
  const { logActivity } = useActivities(user?.id)

  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)

  useEffect(() => { loadProspects() }, [loadProspects])

  // Sincronizar el prospecto seleccionado con cambios en la lista (e.g. tras actualizar notas)
  useEffect(() => {
    if (selectedProspect) {
      const updated = prospects.find(p => p.id === selectedProspect.id)
      if (updated) setSelectedProspect(updated)
    }
  }, [prospects]) // eslint-disable-line react-hooks/exhaustive-deps

  const getByStage = (stage: PipelineStage): Prospect[] =>
    prospects.filter(p => p.stage === stage)

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const { draggableId, source, destination } = result
    if (source.droppableId === destination.droppableId) return

    const newStage = destination.droppableId as PipelineStage
    await updateStage(draggableId, newStage)
    await logActivity(draggableId, 'stage_changed', newStage)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-ink-muted text-sm">Cargando pipeline...</p>
      </div>
    )
  }

  return (
    <div className="p-6 h-full flex flex-col">

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-ink">Pipeline</h1>
        <p className="text-ink-muted text-sm mt-1">
          {prospects.length} leads · Arrastra para cambiar etapa · Haz click para ver detalle
        </p>
      </div>

      {/* Kanban */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map(col => {
            const colProspects = getByStage(col.id)
            return (
              <div key={col.id} className="flex-shrink-0 w-60">

                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-xs font-medium text-ink">{col.label}</span>
                  <span className="ml-auto text-xs text-ink-faint bg-black/5 px-1.5 py-0.5 rounded-full">
                    {colProspects.length}
                  </span>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-24 rounded-xl p-2 space-y-2 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-accent-light' : col.color
                      }`}
                    >
                      {colProspects.map((prospect, index) => (
                        <Draggable key={prospect.id} draggableId={prospect.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.85 : 1,
                              }}
                            >
                              <ProspectCard
                                prospect={prospect}
                                onClick={() => setSelectedProspect(prospect)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {colProspects.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-center py-6 text-xs text-ink-faint">
                          Arrastra aquí
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>

              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Modal de detalle */}
      {selectedProspect && user && (
        <ProspectModal
          prospect={selectedProspect}
          userId={user.id}
          onClose={() => setSelectedProspect(null)}
          onUpdate={updateProspect}
          onDelete={deleteProspect}
          onSaveAudit={saveAudit}
        />
      )}

    </div>
  )
}
