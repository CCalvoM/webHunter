import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center animate-pulse">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <circle cx="8" cy="8" r="5" stroke="white" strokeWidth="1.8"/>
              <line x1="12" y1="12" x2="16" y2="16" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-xs text-ink-faint">Cargando WebHunter...</p>
        </div>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />
}
