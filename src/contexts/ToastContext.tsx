import { createContext, useContext, useState, useCallback } from 'react'
import { Check, X, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: string; message: string; type: ToastType }
interface ToastCtx { showToast: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastCtx>({ showToast: () => {} })

const ICONS = { success: Check, error: AlertCircle, info: Info }
const STYLES = {
  success: 'bg-brand-green text-white',
  error:   'bg-red-500 text-white',
  info:    'bg-ink text-white',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200)
  }, [])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const Icon = ICONS[toast.type]
          return (
            <div
              key={toast.id}
              className={`flex items-center gap-2.5 pl-3.5 pr-2.5 py-2.5 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-toast ${STYLES[toast.type]}`}
            >
              <Icon size={14} className="flex-shrink-0" />
              <span>{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
