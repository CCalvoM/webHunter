import { useState } from 'react'
import { MessageSquarePlus, X, Send, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type FeedbackType = 'bug' | 'sugerencia' | 'otro'

const TYPES: { value: FeedbackType; label: string; emoji: string }[] = [
  { value: 'bug',        label: 'Algo no funciona', emoji: '🐛' },
  { value: 'sugerencia', label: 'Sugerencia',        emoji: '💡' },
  { value: 'otro',       label: 'Otro',              emoji: '💬' },
]

export default function FeedbackButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('sugerencia')
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

  const handleSubmit = async () => {
    if (!message.trim()) return
    setState('sending')
    await supabase.from('feedback').insert({
      user_id: user?.id ?? null,
      type,
      message: message.trim(),
      page: window.location.pathname,
    })
    setState('sent')
    setTimeout(() => {
      setOpen(false)
      setMessage('')
      setType('sugerencia')
      setState('idle')
    }, 2000)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        title="Enviar feedback"
        className="fixed bottom-6 right-6 z-40 w-11 h-11 bg-white border border-black/10 rounded-full shadow-md flex items-center justify-center text-ink-muted hover:text-accent hover:border-accent/30 hover:shadow-lg transition-all"
      >
        <MessageSquarePlus size={18} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-black/8 pointer-events-auto">

            <div className="flex items-center justify-between px-5 py-4 border-b border-black/6">
              <span className="font-display font-bold text-sm text-ink">Enviar feedback</span>
              <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink transition-colors p-1 rounded-lg hover:bg-black/5">
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              {state === 'sent' ? (
                <div className="text-center py-4">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check size={18} className="text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-ink">¡Gracias por el feedback!</p>
                </div>
              ) : (
                <>
                  {/* Tipo */}
                  <div className="flex gap-2 mb-4">
                    {TYPES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setType(t.value)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                          type === t.value
                            ? 'border-accent bg-accent-light text-accent'
                            : 'border-black/10 text-ink-muted hover:border-black/20'
                        }`}
                      >
                        <span className="text-base">{t.emoji}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Mensaje */}
                  <textarea
                    autoFocus
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={
                      type === 'bug' ? 'Describe qué pasó y en qué página...' :
                      type === 'sugerencia' ? '¿Qué mejorarías o añadirías?' :
                      'Cuéntanos lo que quieras...'
                    }
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all mb-3"
                  />

                  <button
                    onClick={handleSubmit}
                    disabled={state === 'sending' || !message.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                  >
                    <Send size={14} />
                    {state === 'sending' ? 'Enviando...' : 'Enviar'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
