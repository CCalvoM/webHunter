import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, BarChart2, Send, X, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const STORAGE_KEY = 'cloza_onboarded'

export function markOnboarded() {
  localStorage.setItem(STORAGE_KEY, '1')
}

export function needsOnboarding() {
  return !localStorage.getItem(STORAGE_KEY)
}

const HOW_IT_WORKS = [
  {
    title: 'Busca negocios',
    description: 'Encuentra negocios sin web o con web mala en cualquier ciudad usando Google Maps.',
    icon: Search,
    color: 'bg-accent-light text-accent',
  },
  {
    title: 'Analiza su web',
    description: 'La IA audita la web del negocio y genera un pitch personalizado listo para enviar.',
    icon: BarChart2,
    color: 'bg-purple-50 text-purple-500',
  },
  {
    title: 'Envía tu oferta',
    description: 'Usa el pitch generado para contactar al negocio y cerrar la venta.',
    icon: Send,
    color: 'bg-green-50 text-green-600',
  },
]

export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(user?.user_metadata?.display_name || '')
  const [saving, setSaving] = useState(false)

  const handleSaveName = async () => {
    if (!name.trim()) { setStep(1); return }
    setSaving(true)
    await supabase.auth.updateUser({ data: { display_name: name.trim() } })
    setSaving(false)
    setStep(1)
  }

  const handleFinish = () => {
    markOnboarded()
    onClose()
    navigate('/app/discovery')
  }

  const handleSkip = () => {
    markOnboarded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-soft w-full max-w-md relative animate-slide-up">

        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-ink-faint hover:text-ink transition-colors p-1 rounded-lg hover:bg-black/5"
        >
          <X size={18} />
        </button>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pt-6 pb-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-accent' : i < step ? 'w-1.5 bg-accent/40' : 'w-1.5 bg-black/10'
              }`}
            />
          ))}
        </div>

        <div className="px-6 pb-6 pt-2">

          {/* Step 0 — nombre */}
          {step === 0 && (
            <>
              <div className="text-center mb-6 mt-2">
                <div className="w-14 h-14 bg-accent-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 18 18" fill="none">
                    <circle cx="8" cy="8" r="5" stroke="#e85d2f" strokeWidth="1.8"/>
                    <line x1="12" y1="12" x2="16" y2="16" stroke="#e85d2f" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <h2 className="font-display font-bold text-xl text-ink mb-2">Bienvenido a Cloza</h2>
                <p className="text-ink-muted text-sm leading-relaxed">
                  ¿Cómo te llamas? Lo usaremos para firmar los mensajes de venta que genera la IA.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  placeholder="Tu nombre, ej: Carlos"
                  className="input w-full"
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {saving ? 'Guardando...' : <><span>Continuar</span><ArrowRight size={16} /></>}
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="w-full text-center text-xs text-ink-faint hover:text-ink-muted transition-colors py-1"
                >
                  Saltar por ahora
                </button>
              </div>
            </>
          )}

          {/* Step 1 — cómo funciona */}
          {step === 1 && (
            <>
              <div className="text-center mb-5 mt-2">
                <h2 className="font-display font-bold text-xl text-ink mb-1">Así funciona Cloza</h2>
                <p className="text-ink-muted text-sm">Del lead al cierre en tres pasos.</p>
              </div>
              <div className="space-y-4 mb-6">
                {HOW_IT_WORKS.map(({ title, description, icon: Icon, color }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-ink">{title}</div>
                      <div className="text-xs text-ink-muted leading-relaxed mt-0.5">{description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <span>Siguiente</span><ArrowRight size={16} />
              </button>
            </>
          )}

          {/* Step 2 — listo */}
          {step === 2 && (
            <>
              <div className="text-center mb-6 mt-4">
                <div className="text-5xl mb-3">🎯</div>
                <h2 className="font-display font-bold text-xl text-ink mb-2">
                  {name.trim() ? `¡Todo listo, ${name.trim()}!` : '¡Todo listo!'}
                </h2>
                <p className="text-ink-muted text-sm leading-relaxed">
                  Empieza buscando negocios sin web en tu ciudad. Encuentra tu primer lead en menos de un minuto.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={handleFinish}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <span>Hacer mi primera búsqueda</span><ArrowRight size={16} />
                </button>
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-xs text-ink-faint hover:text-ink-muted transition-colors py-1"
                >
                  Explorar primero
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
