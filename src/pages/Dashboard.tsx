import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Kanban, TrendingUp, Users, CheckCircle, MessageSquare } from 'lucide-react'
import { useProspects } from '../hooks/useProspects'
import { useAuth } from '../hooks/useAuth'
import type { PipelineStage } from '../types'

const STAGE_LABELS: Record<PipelineStage, string> = {
  encontrado: 'Encontrado', contactado: 'Contactado', respondio: 'Respondió',
  demo: 'Demo', cerrado: 'Cerrado', descartado: 'Descartado',
}
const STAGE_COLORS: Record<PipelineStage, string> = {
  encontrado: 'bg-gray-100 text-gray-600', contactado: 'bg-blue-50 text-blue-600',
  respondio: 'bg-amber-50 text-amber-600', demo: 'bg-purple-50 text-purple-600',
  cerrado: 'bg-green-50 text-green-600', descartado: 'bg-red-50 text-red-500',
}
const WEB_STATUS_COLORS: Record<string, string> = {
  no_web: 'bg-red-50 text-red-600', fake_web: 'bg-amber-50 text-amber-600',
  broken_web: 'bg-orange-50 text-orange-600', poor_web: 'bg-yellow-50 text-yellow-600',
  has_web: 'bg-green-50 text-green-600',
}
const WEB_STATUS_LABELS: Record<string, string> = {
  no_web: 'Sin web', fake_web: 'Web falsa',
  broken_web: 'Web rota', poor_web: 'Web pobre', has_web: 'Con web',
}

const FUNNEL_STAGES: PipelineStage[] = ['encontrado', 'contactado', 'respondio', 'demo', 'cerrado']

export default function Dashboard() {
  const { user } = useAuth()
  const { prospects, loadProspects, loading } = useProspects(user?.id)

  useEffect(() => { loadProspects() }, [loadProspects])

  const active = prospects.filter(p => p.stage !== 'descartado')

  const stats = {
    total: active.length,
    contactados: active.filter(p => ['contactado', 'respondio', 'demo', 'cerrado'].includes(p.stage)).length,
    demos: active.filter(p => p.stage === 'demo').length,
    cerrados: active.filter(p => p.stage === 'cerrado').length,
  }

  const conversionRate = stats.total > 0
    ? Math.round((stats.cerrados / stats.total) * 100)
    : 0

  const recent = prospects.slice(0, 5)

  // Conversión por etapa del funnel
  const funnelData = FUNNEL_STAGES.map((stage, i) => {
    const count = active.filter(p => p.stage === stage).length
    const prevCount = i === 0 ? stats.total : active.filter(p => p.stage === FUNNEL_STAGES[i - 1]).length
    const rate = prevCount > 0 && i > 0 ? Math.round((count / prevCount) * 100) : null
    return { stage, count, rate }
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-ink">
          Hola{user?.email ? `, ${user.email.split('@')[0]}` : ''} 👋
        </h1>
        <p className="text-ink-muted text-sm mt-1">Aquí tienes el resumen de tu pipeline.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-3 bg-black/6 rounded w-20 mb-3" />
              <div className="h-8 bg-black/8 rounded w-12" />
            </div>
          ))
        ) : (
          [
            { label: 'Total leads', value: stats.total, icon: Users, color: 'text-ink' },
            { label: 'Contactados', value: stats.contactados, icon: MessageSquare, color: 'text-blue-500' },
            { label: 'En demo', value: stats.demos, icon: TrendingUp, color: 'text-purple-500' },
            { label: 'Cerrados', value: stats.cerrados, icon: CheckCircle, color: 'text-brand-green' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-ink-muted font-medium">{label}</span>
                <Icon size={16} className={color} />
              </div>
              <div className="font-display font-bold text-3xl text-ink">{value}</div>
            </div>
          ))
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link to="/app/discovery" className="card hover:border-accent/40 hover:-translate-y-0.5 transition-all cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-accent-light rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
              <Search size={20} className="text-accent" />
            </div>
            <div>
              <div className="font-display font-bold text-base text-ink">Buscar negocios</div>
              <div className="text-sm text-ink-muted">Encuentra negocios sin web en tu ciudad</div>
            </div>
          </div>
        </Link>
        <Link to="/app/pipeline" className="card hover:border-accent/40 hover:-translate-y-0.5 transition-all cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition-colors">
              <Kanban size={20} className="text-purple-500" />
            </div>
            <div>
              <div className="font-display font-bold text-base text-ink">Ver pipeline</div>
              <div className="text-sm text-ink-muted">{stats.total} leads · {conversionRate}% conversión</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Funnel de conversión */}
      {!loading && active.length > 0 && (
        <div className="card mb-8">
          <h2 className="font-display font-bold text-base text-ink mb-4">Conversión por etapa</h2>
          <div className="flex items-end gap-2">
            {funnelData.map(({ stage, count, rate }) => {
              const maxCount = funnelData[0].count || 1
              const barHeight = Math.max((count / maxCount) * 80, 4)
              return (
                <div key={stage} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs font-bold text-ink">{count}</span>
                  <div
                    className="w-full rounded-t-md bg-accent/20 transition-all"
                    style={{ height: `${barHeight}px` }}
                  />
                  <span className="text-xs text-ink-faint text-center leading-tight">{STAGE_LABELS[stage]}</span>
                  {rate !== null && (
                    <span className="text-xs text-ink-faint">{rate}%</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Últimos leads */}
      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-base text-ink">Últimos leads</h2>
            <Link to="/app/pipeline" className="text-sm text-accent hover:underline">Ver todos →</Link>
          </div>
          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-ink-muted text-sm">Cargando...</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5">
                    <th className="text-left text-xs text-ink-muted font-medium px-4 py-3">Negocio</th>
                    <th className="text-left text-xs text-ink-muted font-medium px-4 py-3">Ciudad</th>
                    <th className="text-left text-xs text-ink-muted font-medium px-4 py-3">Estado</th>
                    <th className="text-left text-xs text-ink-muted font-medium px-4 py-3">Etapa</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p, i) => (
                    <tr key={p.id}
                      className={`hover:bg-surface transition-colors cursor-pointer ${i < recent.length - 1 ? 'border-b border-black/5' : ''}`}
                      onClick={() => window.location.href = `/app/prospect/${p.id}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm text-ink">{p.name}</div>
                        <div className="text-xs text-ink-faint">{p.category}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted">{p.city}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${WEB_STATUS_COLORS[p.web_status]}`}>
                          {WEB_STATUS_LABELS[p.web_status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[p.stage]}`}>
                          {STAGE_LABELS[p.stage]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && prospects.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="font-display font-bold text-lg text-ink mb-2">Aún no tienes leads</h3>
          <p className="text-ink-muted text-sm mb-6">Empieza buscando negocios sin web en tu ciudad.</p>
          <Link to="/app/discovery" className="btn-primary inline-flex">Buscar negocios →</Link>
        </div>
      )}

    </div>
  )
}
