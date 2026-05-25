import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { useAuth } from '../hooks/useAuth'
import { useProspects } from '../hooks/useProspects'
import { useToast } from '../contexts/ToastContext'
import VerifyModal from '../components/VerifyModal'
import type { PipelineStage, Prospect } from '../types'

const FOLLOW_UP_DAYS: Partial<Record<PipelineStage, number>> = {
  contactado: 2,
  respondio: 3,
  demo: 5,
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function isFollowUpDue(p: Prospect): boolean {
  const days = FOLLOW_UP_DAYS[p.stage]
  if (!days || p.follow_up_dismissed_at) return false
  const ref = p.stage_updated_at ?? p.updated_at
  return daysSince(ref) >= days
}

const COLUMNS: { id: PipelineStage; label: string; color: string; dot: string }[] = [
  { id: 'encontrado', label: 'Encontrado',  color: 'bg-gray-50',   dot: 'bg-gray-400' },
  { id: 'contactado', label: 'Contactado',  color: 'bg-blue-50',   dot: 'bg-blue-400' },
  { id: 'respondio',  label: 'Respondió',   color: 'bg-amber-50',  dot: 'bg-amber-400' },
  { id: 'demo',       label: 'Demo',        color: 'bg-purple-50', dot: 'bg-purple-400' },
  { id: 'cerrado',    label: 'Cerrado ✓',   color: 'bg-green-50',  dot: 'bg-green-500' },
]

const WEB_STATUS_COLORS: Record<string, string> = {
  no_web:     'bg-red-50 text-red-600',
  fake_web:   'bg-amber-50 text-amber-700',
  broken_web: 'bg-orange-50 text-orange-600',
  poor_web:   'bg-yellow-50 text-yellow-700',
  has_web:    'bg-green-50 text-green-600',
}

const WEB_STATUS_LABELS: Record<string, string> = {
  no_web: 'Sin web', fake_web: 'Web falsa',
  broken_web: 'Web rota', poor_web: 'Web pobre', has_web: 'Con web',
}

function ProspectCard({
  prospect,
  onClick,
  onDismissFollowUp,
}: {
  prospect: Prospect
  onClick: () => void
  onDismissFollowUp: (id: string) => void
}) {
  const followUpDue = isFollowUpDue(prospect)
  const followUpDays = followUpDue
    ? daysSince(prospect.stage_updated_at ?? prospect.updated_at)
    : 0

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
      {prospect.audit_pitch && (
        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-green inline-block" title="Audit generado" />
      )}
      {followUpDue && (
        <div className="mt-2 pt-2 border-t border-orange-100 flex items-center justify-between gap-2">
          <span className="text-xs text-orange-500 leading-tight">
            🟠 Seguimiento pendiente · hace {followUpDays} día{followUpDays === 1 ? '' : 's'}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onDismissFollowUp(prospect.id) }}
            className="text-xs text-ink-faint hover:text-ink transition-colors flex-shrink-0"
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  )
}

export default function Pipeline() {
  const { user } = useAuth()
  const { prospects, loadProspects, updateStage, updateProspect, dismissFollowUp, loading } = useProspects(user?.id)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [mobileStage, setMobileStage] = useState<PipelineStage>('encontrado')
  const [verifyModal, setVerifyModal] = useState<{
    prospectId: string
    name: string
    city: string
    fromStage: PipelineStage
  } | null>(null)

  useEffect(() => { loadProspects() }, [loadProspects])

  const getByStage = (stage: PipelineStage): Prospect[] =>
    prospects.filter(p => p.stage === stage && p.stage !== 'descartado')

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const { draggableId, source, destination } = result
    if (source.droppableId === destination.droppableId) return

    const fromStage = source.droppableId as PipelineStage
    const toStage = destination.droppableId as PipelineStage

    if (toStage === 'contactado') {
      const prospect = prospects.find(p => p.id === draggableId)
      if (prospect && !prospect.verified_at) {
        setVerifyModal({ prospectId: draggableId, name: prospect.name, city: prospect.city, fromStage })
        return
      }
    }

    await updateStage(draggableId, toStage, fromStage)
    const col = COLUMNS.find(c => c.id === toStage)
    if (col) showToast(`Movido a ${col.label}`, 'info')
  }

  const handleVerifyConfirm = async () => {
    if (!verifyModal) return
    await updateProspect(verifyModal.prospectId, { verified_at: new Date().toISOString() })
    await updateStage(verifyModal.prospectId, 'contactado', verifyModal.fromStage)
    showToast('Movido a Contactado', 'info')
    setVerifyModal(null)
  }

  const handleVerifySkip = async () => {
    if (!verifyModal) return
    await updateStage(verifyModal.prospectId, 'contactado', verifyModal.fromStage)
    showToast('Movido a Contactado', 'info')
    setVerifyModal(null)
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 md:flex md:flex-col md:h-full">
        <div className="mb-6">
          <div className="h-7 bg-black/6 rounded-lg w-32 mb-2 animate-pulse" />
          <div className="h-4 bg-black/4 rounded w-48 animate-pulse" />
        </div>
        <div className="flex gap-4 flex-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-60">
              <div className="h-4 bg-black/6 rounded w-24 mb-3 animate-pulse" />
              <div className="min-h-24 rounded-xl bg-black/4 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const activeProspects = prospects.filter(p => p.stage !== 'descartado')

  return (
    <>
    <div className="p-4 md:p-6 md:h-full md:flex md:flex-col">

      <div className="mb-4 md:mb-6">
        <h1 className="font-display font-bold text-2xl text-ink">Pipeline</h1>
        <p className="text-ink-muted text-sm mt-1 hidden md:block">
          {activeProspects.length} leads activos · Arrastra para cambiar etapa · Click para ver detalle
        </p>
        <p className="text-ink-muted text-sm mt-1 md:hidden">
          {activeProspects.length} leads activos
        </p>
      </div>

      {/* ── Vista móvil: tabs + lista vertical ─────────────────────────── */}
      <div className="md:hidden flex flex-col flex-1">
        {/* Stage tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
          {COLUMNS.map(col => {
            const count = getByStage(col.id).length
            return (
              <button
                key={col.id}
                onClick={() => setMobileStage(col.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  mobileStage === col.id
                    ? 'bg-ink text-white'
                    : 'bg-white border border-black/10 text-ink-muted'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${col.dot}`} />
                {col.label}
                <span className={`rounded-full px-1.5 text-xs leading-5 ${
                  mobileStage === col.id ? 'bg-white/20 text-white' : 'bg-black/8 text-ink-faint'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Cards de la etapa seleccionada */}
        <div className="space-y-2 overflow-y-auto flex-1">
          {getByStage(mobileStage).map(prospect => (
            <ProspectCard
              key={prospect.id}
              prospect={prospect}
              onClick={() => navigate(`/app/prospect/${prospect.id}`)}
              onDismissFollowUp={dismissFollowUp}
            />
          ))}
          {getByStage(mobileStage).length === 0 && (
            <div className="text-center py-16 text-ink-faint text-sm">
              Sin leads en esta etapa
            </div>
          )}
        </div>
      </div>

      {/* ── Vista desktop: kanban drag & drop ──────────────────────────── */}
      <div className="hidden md:flex flex-col flex-1">
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
                                style={{ ...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.85 : 1 }}
                              >
                                <ProspectCard
                                  prospect={prospect}
                                  onClick={() => navigate(`/app/prospect/${prospect.id}`)}
                                  onDismissFollowUp={dismissFollowUp}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {colProspects.length === 0 && !snapshot.isDraggingOver && (
                          <div className="text-center py-6 text-xs text-ink-faint">Arrastra aquí</div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      </div>

    </div>

    {verifyModal && (
      <VerifyModal
        name={verifyModal.name}
        city={verifyModal.city}
        onVerify={handleVerifyConfirm}
        onSkip={handleVerifySkip}
      />
    )}
    </>
  )
}
