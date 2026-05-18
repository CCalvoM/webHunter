import { useState, useEffect } from 'react'
import { X, Copy, Check, Sparkles, Calendar, FileText, Trash2, ExternalLink, AlertCircle, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getAuditIssues } from '../lib/places'
import { useActivities } from '../hooks/useActivities'
import type { Prospect, PlaceResult, AuditResult } from '../types'

const WEB_STATUS_LABELS: Record<string, string> = {
  no_web: 'Sin web',
  fake_web: 'Web falsa',
  poor_web: 'Web pobre',
  has_web: 'Con web',
}

const WEB_STATUS_COLORS: Record<string, string> = {
  no_web: 'bg-red-50 text-red-600',
  fake_web: 'bg-amber-50 text-amber-700',
  poor_web: 'bg-yellow-50 text-yellow-700',
  has_web: 'bg-green-50 text-green-600',
}

const ACTIVITY_LABELS: Record<string, string> = {
  created: 'Añadido al pipeline',
  stage_changed: 'Etapa cambiada',
  email_sent: 'Email enviado',
  note_added: 'Nota añadida',
  followup_set: 'Seguimiento programado',
  audit_generated: 'Audit generado con IA',
}

interface Props {
  prospect: Prospect
  userId: string
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Prospect>) => void
  onDelete: (id: string) => void
  onSaveAudit: (id: string, audit: AuditResult) => void
}

export default function ProspectModal({ prospect, userId, onClose, onUpdate, onDelete, onSaveAudit }: Props) {
  const { activities, loadActivities, logActivity } = useActivities(userId)
  const [notes, setNotes] = useState(prospect.notes || '')
  const [followupDate, setFollowupDate] = useState(prospect.followup_date || '')
  const [pitch, setPitch] = useState(prospect.audit_pitch || '')
  const [generatingPitch, setGeneratingPitch] = useState(false)
  const [pitchError, setPitchError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    loadActivities(prospect.id)
  }, [prospect.id, loadActivities])

  // Construir objeto PlaceResult para reutilizar getAuditIssues
  const placeForIssues: PlaceResult = {
    place_id: prospect.place_id,
    name: prospect.name,
    formatted_address: prospect.address,
    formatted_phone_number: prospect.phone,
    website: prospect.website,
    rating: prospect.rating,
    user_ratings_total: prospect.review_count,
    types: [],
  }
  const issues = getAuditIssues(placeForIssues)

  const handleSaveNotes = async () => {
    if (notes === prospect.notes) return
    setSaving(true)
    await onUpdate(prospect.id, { notes })
    await logActivity(prospect.id, 'note_added', notes.substring(0, 80))
    setSaving(false)
  }

  const handleSaveFollowup = async () => {
    if (followupDate === prospect.followup_date) return
    await onUpdate(prospect.id, { followup_date: followupDate })
    await logActivity(prospect.id, 'followup_set', followupDate)
  }

  const handleGeneratePitch = async () => {
    setGeneratingPitch(true)
    setPitchError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-audit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            name: prospect.name,
            city: prospect.city,
            sector: prospect.category,
            web_status: prospect.web_status,
            rating: prospect.rating,
            review_count: prospect.review_count,
            website: prospect.website,
          }),
        },
      )

      if (!response.ok) throw new Error('Error en la respuesta del servidor')
      const data = await response.json()

      const auditResult: AuditResult = {
        score: prospect.audit_score || 0,
        web_status: prospect.web_status,
        issues: data.issues || [],
        lost_clients_estimate: data.lost_clients_estimate || '',
        pitch: data.pitch,
      }

      setPitch(data.pitch)
      await onSaveAudit(prospect.id, auditResult)
      await logActivity(prospect.id, 'audit_generated')
    } catch {
      setPitchError('No se pudo generar el pitch. Comprueba que la Edge Function está desplegada.')
    } finally {
      setGeneratingPitch(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pitch)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = () => {
    onDelete(prospect.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-black/8">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-display font-bold text-xl text-ink leading-tight">{prospect.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-sm text-ink-muted">{prospect.city} · {prospect.category}</span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${WEB_STATUS_COLORS[prospect.web_status]}`}>
                {WEB_STATUS_LABELS[prospect.web_status]}
              </span>
              {prospect.audit_score !== undefined && (
                <span className={`text-xs font-bold ${
                  prospect.audit_score < 30 ? 'text-red-500' :
                  prospect.audit_score < 55 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {prospect.audit_score} pts
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Datos de contacto */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {prospect.phone && (
              <div>
                <div className="text-xs text-ink-muted mb-0.5 flex items-center gap-1">
                  <Phone size={11} /> Teléfono
                </div>
                <a href={`tel:${prospect.phone}`} className="text-ink hover:text-accent transition-colors">
                  {prospect.phone}
                </a>
              </div>
            )}
            {prospect.website && (
              <div>
                <div className="text-xs text-ink-muted mb-0.5">Web actual</div>
                <a href={prospect.website} target="_blank" rel="noopener noreferrer"
                  className="text-accent hover:underline flex items-center gap-1 break-all">
                  {prospect.website.replace(/^https?:\/\//, '').substring(0, 35)}
                  <ExternalLink size={11} className="flex-shrink-0" />
                </a>
              </div>
            )}
            {prospect.rating && (
              <div>
                <div className="text-xs text-ink-muted mb-0.5">Google Maps</div>
                <span className="text-ink">⭐ {prospect.rating} ({prospect.review_count} reseñas)</span>
              </div>
            )}
            {prospect.google_maps_url && (
              <div>
                <div className="text-xs text-ink-muted mb-0.5">Ubicación</div>
                <a href={prospect.google_maps_url} target="_blank" rel="noopener noreferrer"
                  className="text-accent hover:underline flex items-center gap-1">
                  Ver en Maps <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>

          {/* Problemas detectados */}
          {issues.length > 0 && (
            <div className="bg-red-50/60 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 mb-2">
                <AlertCircle size={13} /> Problemas detectados
              </div>
              <ul className="space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="text-xs text-ink-muted flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pitch con IA */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <Sparkles size={13} /> Pitch personalizado (WhatsApp / Email)
              </div>
              <div className="flex gap-2">
                {pitch && (
                  <button onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors">
                    {copied
                      ? <><Check size={12} className="text-brand-green" /> Copiado</>
                      : <><Copy size={12} /> Copiar</>}
                  </button>
                )}
                <button
                  onClick={handleGeneratePitch}
                  disabled={generatingPitch}
                  className="flex items-center gap-1 text-xs bg-accent text-white px-2.5 py-1 rounded-full hover:bg-accent-dark transition-colors disabled:opacity-60"
                >
                  <Sparkles size={11} />
                  {generatingPitch ? 'Generando...' : pitch ? 'Regenerar' : 'Generar con IA'}
                </button>
              </div>
            </div>

            {pitch ? (
              <div className="bg-surface rounded-xl p-4 text-sm text-ink leading-relaxed whitespace-pre-wrap border border-black/8">
                {pitch}
              </div>
            ) : (
              <div className="bg-surface rounded-xl p-4 text-sm text-ink-faint text-center border border-dashed border-black/10">
                Genera un mensaje de primer contacto personalizado con IA
              </div>
            )}
            {pitchError && <p className="text-xs text-red-500 mt-1">{pitchError}</p>}
          </div>

          {/* Notas */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mb-2">
              <FileText size={13} /> Notas
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Añade notas sobre este prospecto..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
            />
            {saving && <p className="text-xs text-ink-faint mt-1">Guardando...</p>}
          </div>

          {/* Fecha de seguimiento */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mb-2">
              <Calendar size={13} /> Fecha de seguimiento
            </div>
            <input
              type="date"
              value={followupDate}
              onChange={e => setFollowupDate(e.target.value)}
              onBlur={handleSaveFollowup}
              className="px-3 py-2 rounded-xl border border-black/10 text-sm text-ink focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
            />
          </div>

          {/* Historial de actividad */}
          {activities.length > 0 && (
            <div>
              <div className="text-xs font-medium text-ink-muted mb-3">Historial</div>
              <div className="space-y-3">
                {activities.map(activity => (
                  <div key={activity.id} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-black/25 mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-ink">
                        {ACTIVITY_LABELS[activity.type] || activity.type}
                      </span>
                      {activity.content && (
                        <span className="text-xs text-ink-faint ml-1">
                          — {activity.content.substring(0, 60)}
                        </span>
                      )}
                      <div className="text-xs text-ink-faint mt-0.5">
                        {new Date(activity.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-black/8 px-6 py-4 flex items-center justify-between">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-red-600">¿Eliminar este prospecto?</span>
              <button onClick={handleDelete}
                className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-full hover:bg-red-600 transition-colors">
                Confirmar
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="text-xs text-ink-muted hover:text-ink transition-colors">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-red-500 transition-colors"
            >
              <Trash2 size={13} /> Eliminar prospecto
            </button>
          )}
          <button onClick={onClose} className="text-sm text-ink-muted hover:text-ink transition-colors">
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}
