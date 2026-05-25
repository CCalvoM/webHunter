import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Copy, Check, Sparkles, Calendar, FileText,
  Trash2, ExternalLink, Phone, Globe, AlertCircle, Flag, MapPin, Loader2, MessageCircle,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useProspects } from '../hooks/useProspects'
import { useActivities } from '../hooks/useActivities'
import { useCredits } from '../hooks/useCredits'
import { useDataFlags } from '../hooks/useDataFlags'
import { useToast } from '../contexts/ToastContext'
import { generateAudit } from '../lib/audit'
import { getAuditIssues } from '../lib/places'
import VerifyModal from '../components/VerifyModal'
import type { AuditResult, FlagType, PipelineStage, Prospect } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().+]/g, '').replace(/^0034/, '').replace(/^34(?=\d{9}$)/, '')
}

function isMobile(raw: string): boolean {
  const n = normalizePhone(raw)
  return /^[67]/.test(n) && n.length === 9
}

function whatsappUrl(raw: string, text: string): string {
  const n = normalizePhone(raw)
  return `https://wa.me/34${n}?text=${encodeURIComponent(text)}`
}

// ─── Constantes de UI ─────────────────────────────────────────────────────────
const WEB_STATUS_LABELS: Record<string, string> = {
  no_web: 'Sin web', fake_web: 'Web falsa',
  broken_web: 'Web rota', poor_web: 'Web pobre', has_web: 'Con web',
}
const WEB_STATUS_COLORS: Record<string, string> = {
  no_web:     'bg-red-50 text-red-600',
  fake_web:   'bg-amber-50 text-amber-700',
  broken_web: 'bg-orange-50 text-orange-600',
  poor_web:   'bg-yellow-50 text-yellow-700',
  has_web:    'bg-green-50 text-green-600',
}
const STAGE_LABELS: Record<PipelineStage, string> = {
  encontrado: 'Encontrado', contactado: 'Contactado', respondio: 'Respondió',
  demo: 'Demo', cerrado: 'Cerrado', descartado: 'Descartado',
}
const PIPELINE_STAGES: PipelineStage[] = ['encontrado', 'contactado', 'respondio', 'demo', 'cerrado', 'descartado']
const ACTIVITY_LABELS: Record<string, string> = {
  created: 'Añadido al pipeline', stage_changed: 'Etapa cambiada',
  email_sent: 'Email enviado', note_added: 'Nota añadida',
  followup_set: 'Seguimiento programado', audit_generated: 'Audit generado con IA',
  data_flagged: 'Lead marcado con problema',
}
const FLAG_LABELS: Record<FlagType, string> = {
  wrong_address: 'Dirección incorrecta',
  wrong_phone: 'Teléfono incorrecto',
  wrong_website: 'Web incorrecta',
  business_closed: 'Negocio cerrado',
  already_has_web: 'Ya tiene web propia',
  other: 'Otro problema',
}

// ─── Componente FlagModal ─────────────────────────────────────────────────────
function FlagModal({
  prospectId,
  onSubmit,
  onClose,
}: {
  prospectId: string
  onSubmit: (prospectId: string, flagType: FlagType, notes?: string) => Promise<boolean>
  onClose: () => void
}) {
  const [flagType, setFlagType] = useState<FlagType>('wrong_address')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    const ok = await onSubmit(prospectId, flagType, notes || undefined)
    if (ok) setDone(true)
    setSubmitting(false)
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center" translate="no" onClick={e => e.stopPropagation()}>
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm text-ink font-medium">Gracias. El flag se ha enviado.</p>
          <button onClick={onClose} className="mt-4 btn-primary text-sm px-6">Cerrar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" translate="no" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-base text-ink mb-4">Marcar problema con este lead</h3>
        <div className="space-y-2 mb-4">
          {(Object.keys(FLAG_LABELS) as FlagType[]).map(type => (
            <label key={type} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              flagType === type ? 'border-accent bg-accent-light' : 'border-black/10 hover:border-black/20'
            }`}>
              <input type="radio" name="flag" value={type} checked={flagType === type}
                onChange={() => setFlagType(type)} className="accent-accent" />
              <span className="text-sm text-ink">{FLAG_LABELS[type]}</span>
            </label>
          ))}
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notas adicionales (opcional)"
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm text-ink resize-none focus:outline-none focus:border-accent/40 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="btn-primary text-sm flex items-center gap-1.5">
            <Flag size={13} /> {submitting ? 'Enviando...' : 'Enviar flag'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProspectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { loadProspect, updateStage, saveAudit, updateProspect, deleteProspect } = useProspects(user?.id)
  const { activities, loadActivities, logActivity } = useActivities(user?.id)
  const { credits, loadCredits, canAudit } = useCredits(user?.id)
  const { submitFlag } = useDataFlags(user?.id)
  const { showToast } = useToast()

  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [loadingProspect, setLoadingProspect] = useState(true)
  const [notes, setNotes] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [generatingAudit, setGeneratingAudit] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [copied, setCopied] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [pendingStage, setPendingStage] = useState<PipelineStage | null>(null)

  useEffect(() => {
    if (!id) return
    setLoadingProspect(true)
    loadProspect(id).then(p => {
      if (p) {
        setProspect(p)
        setNotes(p.notes || '')
        setFollowupDate(p.followup_date || '')
      }
      setLoadingProspect(false)
    })
    loadActivities(id)
    loadCredits()
  }, [id, loadProspect, loadActivities, loadCredits])

  const handleStageChange = async (stage: PipelineStage) => {
    if (!prospect) return
    if (stage === 'contactado' && !prospect.verified_at) {
      setPendingStage(stage)
      setShowVerifyModal(true)
      return
    }
    await updateStage(prospect.id, stage, prospect.stage)
    setProspect(prev => prev ? { ...prev, stage } : null)
    showToast(`Etapa: ${STAGE_LABELS[stage]}`, 'info')
  }

  const handleVerifyConfirm = async () => {
    if (!prospect || !pendingStage) return
    const now = new Date().toISOString()
    await updateProspect(prospect.id, { verified_at: now })
    await updateStage(prospect.id, pendingStage, prospect.stage)
    setProspect(prev => prev ? { ...prev, stage: pendingStage, verified_at: now } : null)
    showToast(`Etapa: ${STAGE_LABELS[pendingStage]}`, 'info')
    setShowVerifyModal(false)
    setPendingStage(null)
  }

  const handleVerifySkip = async () => {
    if (!prospect || !pendingStage) return
    await updateStage(prospect.id, pendingStage, prospect.stage)
    setProspect(prev => prev ? { ...prev, stage: pendingStage } : null)
    showToast(`Etapa: ${STAGE_LABELS[pendingStage]}`, 'info')
    setShowVerifyModal(false)
    setPendingStage(null)
  }

  const handleGenerateAudit = async () => {
    if (!prospect) return
    if (!canAudit) {
      setAuditError(`Has alcanzado el límite de ${credits?.audits_limit} audits este mes.`)
      return
    }
    setGeneratingAudit(true)
    setAuditError('')
    try {
      const result: AuditResult = await generateAudit(prospect)
      await saveAudit(prospect.id, result)
      loadCredits()
      await logActivity(prospect.id, 'audit_generated')
      setProspect(prev => prev ? {
        ...prev,
        audit_score: result.score,
        audit_pitch: result.pitch,
        audit_summary: result.issues.join(' | '),
        web_status: result.web_status,
      } : null)
      showToast('Audit generado con IA')
    } catch (err) {
      if (err instanceof Error && err.message === 'CREDITS_EXHAUSTED') {
        setAuditError(`Has alcanzado el límite de ${credits?.audits_limit ?? ''} audits.`)
      } else {
        setAuditError('No se pudo generar el audit. Comprueba que la Edge Function está desplegada.')
      }
      showToast('Error al generar el audit', 'error')
    } finally {
      setGeneratingAudit(false)
    }
  }

  const resolvePitch = () => {
    const name = user?.user_metadata?.display_name?.trim() || ''
    return (prospect?.audit_pitch ?? '').replace(/\[nombre\]/gi, name || '[nombre]')
  }

  const handleCopyPitch = async () => {
    if (!prospect?.audit_pitch) return
    await navigator.clipboard.writeText(resolvePitch())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Mensaje copiado al portapapeles')
  }

  const handleGmailDraft = () => {
    if (!prospect?.audit_pitch) return
    const subject = encodeURIComponent(`Sobre la presencia digital de ${prospect.name}`)
    const body = encodeURIComponent(resolvePitch())
    window.open(`https://mail.google.com/mail/?view=cm&su=${subject}&body=${body}`, '_blank')
  }

  const handleSaveNotes = async () => {
    if (!prospect || notes === prospect.notes) return
    setSavingNotes(true)
    await updateProspect(prospect.id, { notes })
    await logActivity(prospect.id, 'note_added', notes.substring(0, 80))
    setSavingNotes(false)
    showToast('Notas guardadas', 'info')
  }

  const handleSaveFollowup = async () => {
    if (!prospect || followupDate === prospect.followup_date) return
    await updateProspect(prospect.id, { followup_date: followupDate })
    await logActivity(prospect.id, 'followup_set', followupDate)
    setProspect(prev => prev ? { ...prev, followup_date: followupDate } : null)
    showToast('Seguimiento guardado')
  }

  const handleDelete = async () => {
    if (!prospect) return
    await deleteProspect(prospect.id)
    navigate('/app/pipeline')
  }

  if (loadingProspect) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <p className="text-ink-muted text-sm">Cargando prospecto...</p>
      </div>
    )
  }

  if (!prospect) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-16">
        <p className="text-ink-muted">Prospecto no encontrado.</p>
        <Link to="/app/pipeline" className="btn-primary inline-flex mt-4">Volver al pipeline</Link>
      </div>
    )
  }

  const issues = prospect.audit_summary
    ? prospect.audit_summary.split(' | ')
    : getAuditIssues(
        {
          place_id: prospect.place_id, name: prospect.name,
          formatted_address: prospect.address, formatted_phone_number: prospect.phone,
          website: prospect.website, rating: prospect.rating,
          user_ratings_total: prospect.review_count, types: [],
        },
        prospect.web_status,
      )

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">

      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6">
        <ArrowLeft size={15} /> Volver al pipeline
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-2xl text-ink">{prospect.name}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-sm text-ink-muted">
              <MapPin size={13} /> {prospect.city}
            </span>
            <span className="text-ink-faint">·</span>
            <span className="text-sm text-ink-muted">{prospect.category}</span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${WEB_STATUS_COLORS[prospect.web_status]}`}>
              {WEB_STATUS_LABELS[prospect.web_status]}
            </span>
            {prospect.audit_score !== undefined && (
              <span className={`text-xs font-bold ${
                prospect.audit_score < 30 ? 'text-red-500' :
                prospect.audit_score < 55 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {prospect.audit_score} {prospect.audit_pitch ? 'pts IA' : 'pts'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowFlagModal(true)}
          title="Reporta un dato incorrecto (dirección, teléfono, web…) para mejorar la calidad del lead"
          className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-amber-600 transition-colors border border-black/10 rounded-full px-3 py-1.5 flex-shrink-0"
        >
          <Flag size={12} /> Marcar problema
        </button>
      </div>

      {/* Stage selector */}
      <div className="card mb-4" translate="no">
        <label className="text-xs font-medium text-ink-muted mb-2 block">Etapa del pipeline</label>
        <div className="flex gap-2 flex-wrap">
          {PIPELINE_STAGES.filter(s => s !== 'descartado').map(stage => (
            <button
              key={stage}
              onClick={() => handleStageChange(stage)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                prospect.stage === stage
                  ? 'bg-accent text-white'
                  : 'bg-black/5 text-ink-muted hover:bg-black/10'
              }`}
            >
              {STAGE_LABELS[stage]}
            </button>
          ))}
          <button
            onClick={() => handleStageChange('descartado')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              prospect.stage === 'descartado'
                ? 'bg-red-500 text-white'
                : 'bg-black/5 text-ink-muted hover:bg-red-50 hover:text-red-500'
            }`}
          >
            {STAGE_LABELS['descartado']}
          </button>
        </div>
      </div>

      {/* Datos de contacto */}
      <div className="card mb-4">
        <h2 className="font-display font-bold text-sm text-ink mb-3">Contacto</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {prospect.phone && (
            <div>
              <div className="text-xs text-ink-faint mb-0.5 flex items-center gap-1"><Phone size={11} /> Teléfono</div>
              <a href={`tel:${prospect.phone}`} className="text-ink hover:text-accent transition-colors">{prospect.phone}</a>
            </div>
          )}
          {prospect.website && (
            <div>
              <div className="text-xs text-ink-faint mb-0.5 flex items-center gap-1"><Globe size={11} /> Web actual</div>
              <a href={prospect.website} target="_blank" rel="noopener noreferrer"
                className="text-accent hover:underline flex items-center gap-1 break-all">
                {prospect.website.replace(/^https?:\/\//, '').substring(0, 35)}
                <ExternalLink size={11} className="flex-shrink-0" />
              </a>
            </div>
          )}
          {prospect.rating && (
            <div>
              <div className="text-xs text-ink-faint mb-0.5">Google Maps</div>
              <span>⭐ {prospect.rating} ({prospect.review_count} reseñas)</span>
            </div>
          )}
          {prospect.google_maps_url && (
            <div>
              <div className="text-xs text-ink-faint mb-0.5">Ubicación</div>
              <a href={prospect.google_maps_url} target="_blank" rel="noopener noreferrer"
                className="text-accent hover:underline flex items-center gap-1">
                Ver en Maps <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Audit panel */}
      <div className="card mb-4">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-display font-bold text-sm text-ink">Audit de presencia digital</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            {credits && (
              <span className="text-xs text-ink-faint">
                {credits.audits_used}/{credits.audits_limit} audits usados
              </span>
            )}
            <button
              onClick={handleGenerateAudit}
              disabled={generatingAudit || !canAudit}
              className="flex items-center gap-1.5 text-xs bg-accent text-white px-3 py-1.5 rounded-full hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {generatingAudit
                ? <Loader2 size={12} className="animate-spin" />
                : <Sparkles size={12} />
              }
              {generatingAudit ? 'Generando...' : prospect.audit_pitch ? 'Regenerar audit' : 'Generar audit con IA'}
            </button>
          </div>
        </div>

        {auditError && (
          <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
            <AlertCircle size={12} /> {auditError}
          </p>
        )}

        {/* Problemas detectados */}
        {issues.length > 0 && (
          <div className="bg-red-50/60 rounded-xl p-4 mb-4">
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

        {/* Pitch / mensaje de venta */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ink-muted">Mensaje de venta generado</span>
            {prospect.audit_pitch && (
              <button onClick={handleCopyPitch}
                className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors">
                {copied ? <><Check size={12} className="text-brand-green" /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            )}
          </div>

          {prospect.audit_pitch && /\[nombre\]/i.test(prospect.audit_pitch) && !user?.user_metadata?.display_name && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              <AlertCircle size={13} className="flex-shrink-0" />
              <span>
                El mensaje contiene <strong>[nombre]</strong> sin rellenar.{' '}
                <Link to="/app/settings" className="underline hover:no-underline">Añade tu nombre en Ajustes</Link>
                {' '}para que se sustituya al copiar.
              </span>
            </div>
          )}

          {prospect.audit_pitch ? (
            <div className="bg-surface rounded-xl p-4 text-sm text-ink leading-relaxed whitespace-pre-wrap border border-black/8">
              {resolvePitch()}
            </div>
          ) : (
            <div className="bg-surface rounded-xl p-4 text-sm text-ink-faint text-center border border-dashed border-black/10">
              Genera el audit con IA para obtener un mensaje de venta personalizado
            </div>
          )}
        </div>
      </div>

      {/* Outreach */}
      {prospect.audit_pitch && (
        <div className="card mb-4">
          <h2 className="font-display font-bold text-sm text-ink mb-3">Enviar outreach</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleCopyPitch}
              className="flex items-center gap-1.5 text-sm border border-black/15 text-ink px-4 py-2 rounded-full hover:border-black/30 transition-colors">
              {copied ? <><Check size={14} className="text-brand-green" /> Copiado</> : <><Copy size={14} /> Copiar mensaje</>}
            </button>
            <button onClick={handleGmailDraft}
              className="flex items-center gap-1.5 text-sm bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-full hover:bg-red-100 transition-colors">
              <ExternalLink size={14} /> Crear borrador en Gmail
            </button>
            {prospect.phone && isMobile(prospect.phone) && (
              <a
                href={whatsappUrl(prospect.phone, resolvePitch())}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-full hover:bg-green-100 transition-colors"
              >
                <MessageCircle size={14} /> Enviar por WhatsApp
              </a>
            )}
            {prospect.phone && !isMobile(prospect.phone) && (
              <a
                href={`tel:${prospect.phone}`}
                className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors"
              >
                <Phone size={14} /> Llamar ({prospect.phone})
              </a>
            )}
          </div>
        </div>
      )}

      {/* Notas */}
      <div className="card mb-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mb-2">
          <FileText size={13} /> Notas
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={handleSaveNotes}
          placeholder="Añade notas sobre este prospecto..."
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all"
        />
        {savingNotes && <p className="text-xs text-ink-faint mt-1">Guardando...</p>}
      </div>

      {/* Seguimiento */}
      <div className="card mb-4">
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

      {/* Timeline de actividad */}
      {activities.length > 0 && (
        <div className="card mb-4">
          <h2 className="font-display font-bold text-sm text-ink mb-4">Historial</h2>
          <div className="space-y-3">
            {activities.map(activity => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-black/25 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-xs text-ink">{ACTIVITY_LABELS[activity.type] || activity.type}</span>
                  {activity.content && (
                    <span className="text-xs text-ink-faint ml-1">— {activity.content.substring(0, 60)}</span>
                  )}
                  <div className="text-xs text-ink-faint mt-0.5">
                    {new Date(activity.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Eliminar */}
      <div className="flex justify-end pb-8">
        {confirmDelete ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600">¿Eliminar este prospecto?</span>
            <button onClick={handleDelete} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-full hover:bg-red-600 transition-colors">
              Confirmar
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-ink-muted hover:text-ink transition-colors">
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-red-500 transition-colors">
            <Trash2 size={13} /> Eliminar prospecto
          </button>
        )}
      </div>

      {/* Flag modal */}
      {showFlagModal && (
        <FlagModal
          prospectId={prospect.id}
          onSubmit={submitFlag}
          onClose={() => setShowFlagModal(false)}
        />
      )}

      {/* Verify modal */}
      {showVerifyModal && (
        <VerifyModal
          name={prospect.name}
          city={prospect.city}
          onVerify={handleVerifyConfirm}
          onSkip={handleVerifySkip}
        />
      )}

    </div>
  )
}
