import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Search, Kanban, BarChart2, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCredits } from '../hooks/useCredits'
import OnboardingModal, { needsOnboarding } from '../components/OnboardingModal'
import FeedbackButton from '../components/FeedbackButton'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/app',            label: 'Dashboard',       mobileLabel: 'Inicio',   icon: BarChart2, end: true },
  { to: '/app/discovery',  label: 'Buscar negocios', mobileLabel: 'Buscar',   icon: Search,    end: false },
  { to: '/app/pipeline',   label: 'Pipeline',        mobileLabel: 'Pipeline', icon: Kanban,    end: false },
  { to: '/app/settings',   label: 'Ajustes',         mobileLabel: 'Ajustes',  icon: Settings,  end: false },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const { credits, loadCredits } = useCredits(user?.id)
  const navigate = useNavigate()
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding)

  useEffect(() => { loadCredits() }, [loadCredits])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }


  return (
    <div className="flex h-screen bg-surface overflow-hidden">

      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-white border-r border-black/8 flex-col">

        {/* Logo */}
        <div className="px-4 h-14 flex items-center gap-2.5 border-b border-black/8">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <circle cx="8" cy="8" r="5" stroke="white" strokeWidth="1.8"/>
              <line x1="12" y1="12" x2="16" y2="16" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-display font-bold text-base text-ink">Cloza</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-light text-accent'
                  : 'text-ink-muted hover:bg-black/5 hover:text-ink',
              )}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>


        {/* User */}
        <div className="border-t border-black/8 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-7 h-7 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-ink truncate">{user?.email}</div>
              <div className="text-xs text-ink-faint capitalize">{credits?.plan ?? 'Free'}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-black/5 hover:text-ink transition-colors mt-1"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}

      <FeedbackButton />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/8">
        <div className="flex">
          {NAV_ITEMS.map(({ to, mobileLabel, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-accent' : 'text-ink-muted',
              )}
            >
              <Icon size={20} />
              <span>{mobileLabel}</span>
            </NavLink>
          ))}
        </div>
      </nav>

    </div>
  )
}
