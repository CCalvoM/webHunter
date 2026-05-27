import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Trash2, Edit2, Check, X, LogOut, Zap, ExternalLink, Loader2, Star } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCredits } from '../hooks/useCredits'
import { useTemplates } from '../hooks/useTemplates'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { redirectToCheckout, redirectToPortal } from '../lib/stripe'
import type { Template } from '../types'

const SECTORS = [
  'General', 'Restaurantes', 'Bares y cafeterías', 'Peluquerías', 'Barberías',
  'Clínicas dentales', 'Fisioterapeutas', 'Fontaneros', 'Electricistas',
  'Talleres mecánicos', 'Academias', 'Gimnasios', 'Tiendas de ropa',
]

const TEMPLATE_PLACEHOLDERS = {
  subject: 'Ej: Tu negocio en Google — una oportunidad que no debes perder',
  body: 'Ej: Hola [nombre], he visto que [negocio] no tiene página web propia...',
}

interface TemplateFormData {
  name: string
  sector: string
  subject: string
  body: string
}

const EMPTY_FORM: TemplateFormData = { name: '', sector: 'General', subject: '', body: '' }

function TemplateRow({
  template,
  onDelete,
  onUpdate,
}: {
  template: Template
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<Template>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<TemplateFormData>({
    name: template.name,
    sector: template.sector || 'General',
    subject: template.subject,
    body: template.body,
  })

  const handleSave = async () => {
    await onUpdate(template.id, form)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="border border-accent/30 rounded-xl p-4 space-y-3 bg-accent-light/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-muted font-medium mb-1 block">Nombre</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input text-sm" />
          </div>
          <div>
            <label className="text-xs text-ink-muted font-medium mb-1 block">Sector</label>
            <select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
              className="input text-sm">
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-ink-muted font-medium mb-1 block">Asunto</label>
          <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            className="input text-sm" />
        </div>
        <div>
          <label className="text-xs text-ink-muted font-medium mb-1 block">Cuerpo</label>
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={4} className="w-full px-3 py-2.5 rounded-lg border border-black/15 text-sm text-ink resize-none focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="btn-ghost text-xs flex items-center gap-1">
            <X size={13} /> Cancelar
          </button>
          <button onClick={handleSave} className="btn-primary text-xs flex items-center gap-1 py-1.5 px-4">
            <Check size={13} /> Guardar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-black/10 rounded-xl p-4 hover:border-black/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-ink">{template.name}</span>
            <span className="text-xs text-ink-faint bg-black/5 px-2 py-0.5 rounded-full">{template.sector}</span>
          </div>
          <div className="text-xs text-ink-muted mb-1">{template.subject}</div>
          <div className="text-xs text-ink-faint line-clamp-2">{template.body}</div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="btn-ghost p-1.5 rounded-lg" title="Editar">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(template.id)} className="btn-ghost p-1.5 rounded-lg text-ink-faint hover:text-red-500" title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { credits, loadCredits } = useCredits(user?.id)
  const { templates, loading: loadingTemplates, loadTemplates, createTemplate, updateTemplate, deleteTemplate } = useTemplates(user?.id)
  const { showToast } = useToast()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TemplateFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '')
  const [savingName, setSavingName] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)

  const handleSaveName = async () => {
    if (!displayName.trim()) return
    setSavingName(true)
    await supabase.auth.updateUser({ data: { display_name: displayName.trim() } })
    setSavingName(false)
  }

  useEffect(() => {
    loadCredits()
    loadTemplates()
  }, [loadCredits, loadTemplates])

  // Mostrar toast de éxito tras upgrade
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('upgraded') === 'true') {
      loadCredits()
      showToast('¡Plan Pro activado! Tus créditos se han actualizado.')
      navigate('/app/settings', { replace: true })
    }
  }, [location.search, loadCredits, showToast, navigate])

  const handleUpgrade = async () => {
    setBillingLoading(true)
    try {
      await redirectToCheckout()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al iniciar el pago', 'error')
      setBillingLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setBillingLoading(true)
    try {
      await redirectToPortal()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al abrir el portal', 'error')
      setBillingLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!form.name || !form.subject || !form.body) return
    setSaving(true)
    await createTemplate(form)
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
  }

  const searchPct = credits
    ? Math.round((credits.searches_used / credits.searches_limit) * 100)
    : 0
  const auditPct = credits
    ? Math.round((credits.audits_used / credits.audits_limit) * 100)
    : 0

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-ink">Ajustes</h1>
        <p className="text-ink-muted text-sm mt-1">Configura tu cuenta y plantillas de outreach.</p>
      </div>

      {/* Cuenta */}
      <div className="card mb-4">
        <h2 className="font-display font-bold text-base text-ink mb-4">Cuenta</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-muted font-medium">Email</label>
            <div className="mt-1 text-sm text-ink">{user?.email}</div>
          </div>
          <div>
            <label className="text-xs text-ink-muted font-medium">Tu nombre</label>
            <p className="text-xs text-ink-faint mb-1 mt-0.5">Se usa para firmar los mensajes de venta generados con IA.</p>
            <div className="flex gap-2">
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Ej: Carlos"
                className="input text-sm flex-1"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !displayName.trim()}
                className="btn-primary text-xs px-4"
              >
                {savingName ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-muted font-medium">Plan actual</label>
            <div className="mt-1">
              <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                credits?.plan === 'pro'
                  ? 'bg-brand-green-light text-brand-green'
                  : 'bg-accent-light text-accent'
              }`}>
                {credits?.plan === 'pro' ? 'Pro' : 'Free'}
              </span>
            </div>
          </div>

          {/* Créditos */}
          {credits && (
            <div className="pt-2 border-t border-black/6">
              <label className="text-xs text-ink-muted font-medium block mb-3">
                {(credits.bonus_searches ?? 0) > 0 || (credits.bonus_audits ?? 0) > 0
                  ? 'Créditos de bienvenida'
                  : 'Uso hoy (se renueva cada día)'}
              </label>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-ink-muted">Búsquedas</span>
                    <span className="text-ink font-medium">
                      {(credits.bonus_searches ?? 0) > 0
                        ? `${credits.bonus_searches} restantes`
                        : `${credits.searches_used} / ${credits.searches_limit} hoy`
                      }
                    </span>
                  </div>
                  <div className="h-1.5 bg-black/6 rounded-full overflow-hidden">
                    {(credits.bonus_searches ?? 0) > 0
                      ? <div className="h-full rounded-full transition-all bg-accent" style={{ width: `${Math.min((credits.bonus_searches / 20) * 100, 100)}%` }} />
                      : <div className={`h-full rounded-full transition-all ${searchPct >= 90 ? 'bg-red-400' : 'bg-accent'}`} style={{ width: `${Math.min(searchPct, 100)}%` }} />
                    }
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-ink-muted">Audits con IA</span>
                    <span className="text-ink font-medium">
                      {(credits.bonus_audits ?? 0) > 0
                        ? `${credits.bonus_audits} restantes`
                        : `${credits.audits_used} / ${credits.audits_limit} hoy`
                      }
                    </span>
                  </div>
                  <div className="h-1.5 bg-black/6 rounded-full overflow-hidden">
                    {(credits.bonus_audits ?? 0) > 0
                      ? <div className="h-full rounded-full transition-all bg-accent" style={{ width: `${Math.min((credits.bonus_audits / 5) * 100, 100)}%` }} />
                      : <div className={`h-full rounded-full transition-all ${auditPct >= 90 ? 'bg-red-400' : 'bg-accent'}`} style={{ width: `${Math.min(auditPct, 100)}%` }} />
                    }
                  </div>
                </div>
              </div>
              <p className="text-xs text-ink-faint mt-2">
                {(credits.bonus_searches ?? 0) > 0 || (credits.bonus_audits ?? 0) > 0
                  ? 'Bonus de bienvenida — cuando se agoten, se renuevan 5 búsquedas y 2 audits al día'
                  : credits.reset_date
                    ? `Se renueva el ${new Date(credits.reset_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`
                    : null
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Plantillas de outreach */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base text-ink">Plantillas de outreach</h2>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-xs bg-accent text-white px-3 py-1.5 rounded-full hover:bg-accent-dark transition-colors"
          >
            <Plus size={13} /> Nueva plantilla
          </button>
        </div>

        {/* Formulario de nueva plantilla */}
        {showForm && (
          <div className="border border-accent/30 rounded-xl p-4 mb-4 space-y-3 bg-accent-light/30">
            <p className="text-xs font-medium text-ink-muted">Nueva plantilla</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-muted font-medium mb-1 block">Nombre</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Sin web — WhatsApp"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted font-medium mb-1 block">Sector</label>
                <select
                  value={form.sector}
                  onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                  className="input text-sm"
                >
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-ink-muted font-medium mb-1 block">Asunto (para email)</label>
              <input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder={TEMPLATE_PLACEHOLDERS.subject}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted font-medium mb-1 block">
                Cuerpo — usa [nombre], [ciudad], [sector] como variables
              </label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder={TEMPLATE_PLACEHOLDERS.body}
                rows={5}
                className="w-full px-3 py-2.5 rounded-lg border border-black/15 text-sm text-ink resize-none focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                className="btn-ghost text-xs flex items-center gap-1">
                <X size={13} /> Cancelar
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={saving || !form.name || !form.subject || !form.body}
                className="btn-primary text-xs flex items-center gap-1 py-1.5 px-4"
              >
                <Check size={13} /> {saving ? 'Guardando...' : 'Crear plantilla'}
              </button>
            </div>
          </div>
        )}

        {/* Lista de plantillas */}
        {loadingTemplates ? (
          <p className="text-sm text-ink-muted text-center py-4">Cargando plantillas...</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-black/10 rounded-xl">
            <div className="text-3xl mb-2">📧</div>
            <p className="text-sm text-ink-muted">Aún no tienes plantillas.</p>
            <p className="text-xs text-ink-faint mt-1">Crea una para agilizar tu outreach.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <TemplateRow
                key={t.id}
                template={t}
                onDelete={deleteTemplate}
                onUpdate={updateTemplate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cerrar sesión — solo visible en móvil (en desktop está en el sidebar) */}
      <div className="md:hidden card mb-4">
        <button
          onClick={async () => { await signOut(); navigate('/login') }}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>

      {/* Plan y facturación */}
      {credits?.plan === 'pro' ? (
        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-display font-bold text-base text-ink">Plan y facturación</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-green-light text-brand-green text-xs font-bold rounded-full">
              <Star size={10} fill="currentColor" /> Pro
            </span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Búsquedas este mes</span>
              <span className="font-medium text-ink">{credits.searches_used} / {credits.searches_limit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Audits este mes</span>
              <span className="font-medium text-ink">{credits.audits_used} / {credits.audits_limit}</span>
            </div>
            {credits.reset_date && (
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Próxima renovación</span>
                <span className="font-medium text-ink">
                  {new Date(credits.reset_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleManageSubscription}
            disabled={billingLoading}
            className="mt-4 flex items-center gap-1.5 text-xs text-ink-muted border border-black/15 px-3 py-1.5 rounded-full hover:border-black/30 transition-colors disabled:opacity-50"
          >
            {billingLoading ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
            Gestionar suscripción
          </button>
        </div>
      ) : (
        <div className="card mb-4 border-accent/20 bg-gradient-to-br from-white to-accent-light/30">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display font-bold text-base text-ink">Pasa a Pro</h2>
              <p className="text-sm text-ink-muted mt-0.5">Más búsquedas, más audits, sin límites de por vida.</p>
            </div>
            <span className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-accent text-white text-xs font-bold rounded-full">
              <Zap size={11} /> Pro
            </span>
          </div>

          {/* Comparativa */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-black/4 rounded-xl p-3">
              <div className="text-xs font-medium text-ink-muted mb-2">Plan actual · Free</div>
              <ul className="space-y-1 text-xs text-ink-muted">
                <li>· {credits?.searches_limit ?? 20} búsquedas (de por vida)</li>
                <li>· {credits?.audits_limit ?? 5} audits con IA (de por vida)</li>
                <li>· Sin reseteo mensual</li>
              </ul>
            </div>
            <div className="bg-accent-light rounded-xl p-3 border border-accent/20">
              <div className="text-xs font-medium text-accent mb-2">Plan Pro</div>
              <ul className="space-y-1 text-xs text-ink">
                <li className="font-medium">· 100 búsquedas / mes</li>
                <li className="font-medium">· 50 audits con IA / mes</li>
                <li className="font-medium">· Reset automático mensual</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleUpgrade}
            disabled={billingLoading}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            {billingLoading
              ? <><Loader2 size={15} className="animate-spin" /> Redirigiendo...</>
              : <><Zap size={15} /> Activar Plan Pro</>
            }
          </button>
        </div>
      )}

      {/* Próximamente */}
      <div className="card">
        <h2 className="font-display font-bold text-base text-ink mb-4">Próximamente</h2>
        <ul className="space-y-2 text-sm text-ink-muted">
          <li>🔑 Integración Google Calendar para seguimientos</li>
          <li>📊 Exportar leads a CSV</li>
        </ul>
      </div>
    </div>
  )
}
