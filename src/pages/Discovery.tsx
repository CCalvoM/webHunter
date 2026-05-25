import { useEffect, useState } from 'react'
import { Search, MapPin, Globe, AlertCircle, Plus, ExternalLink, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useProspects } from '../hooks/useProspects'
import { useCredits } from '../hooks/useCredits'
import { useToast } from '../contexts/ToastContext'
import { searchPlaces, detectWebStatus, calculateAuditScore } from '../lib/places'
import type { PlaceResult, WebStatus } from '../types'

const SECTORS = [
  'Restaurantes', 'Bares y cafeterías', 'Peluquerías', 'Barberías',
  'Clínicas dentales', 'Fisioterapeutas', 'Fontaneros', 'Electricistas',
  'Talleres mecánicos', 'Academias', 'Gimnasios', 'Tiendas de ropa',
  'Panaderías', 'Carnicerías', 'Ferreterías', 'Ópticas',
]

const WEB_STATUS_LABELS: Record<WebStatus, string> = {
  no_web:      'Sin web',
  fake_web:    'Web falsa',
  broken_web:  'Web rota',
  poor_web:    'Web pobre',
  has_web:     'Con web',
}

const WEB_STATUS_COLORS: Record<WebStatus, string> = {
  no_web:      'bg-red-50 text-red-600',
  fake_web:    'bg-amber-50 text-amber-700',
  broken_web:  'bg-orange-50 text-orange-600',
  poor_web:    'bg-yellow-50 text-yellow-700',
  has_web:     'bg-green-50 text-green-600',
}

export default function Discovery() {
  const { user } = useAuth()
  const { addProspect, prospects, loadProspects } = useProspects(user?.id)
  const { credits, loadCredits, canSearch } = useCredits(user?.id)
  const { showToast } = useToast()

  const [city, setCity] = useState('')
  const [sector, setSector] = useState('')
  const [filterStatus, setFilterStatus] = useState<WebStatus | 'all'>('all')
  const [results, setResults] = useState<PlaceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [added, setAdded] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadCredits()
    loadProspects()
  }, [loadCredits, loadProspects])

  const existingPlaceIds = new Set(prospects.map(p => p.place_id))

  const handleSearch = async () => {
    if (!city.trim() || !sector.trim()) return
    setSearchError('')

    if (credits && !canSearch) {
      setSearchError(`Has alcanzado el límite de ${credits.searches_limit} búsquedas este mes.`)
      return
    }

    setSearching(true)
    try {
      const data = await searchPlaces(city, sector)
      setResults(data)
      loadCredits()
    } catch (err) {
      if (err instanceof Error && err.message === 'CREDITS_EXHAUSTED') {
        setSearchError(`Has alcanzado el límite de ${credits?.searches_limit ?? ''} búsquedas.`)
      } else {
        setSearchError('Error al buscar negocios. Inténtalo de nuevo.')
      }
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async (place: PlaceResult) => {
    const prospect = await addProspect(place, city, sector)
    if (prospect) {
      setAdded(prev => new Set(prev).add(place.place_id))
      showToast(`${place.name} añadido al pipeline`)
    }
  }

  const filtered = results
    .filter(r => filterStatus === 'all' ? true : detectWebStatus(r) === filterStatus)

  const noWebCount   = results.filter(r => detectWebStatus(r) === 'no_web').length
  const fakeWebCount = results.filter(r => detectWebStatus(r) === 'fake_web').length

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink">Buscar negocios</h1>
          <p className="text-ink-muted text-sm mt-1">Encuentra negocios locales sin presencia digital en tu ciudad.</p>
        </div>

        {/* Credits badge */}
        {credits && (
          <div className="flex items-center gap-1.5 text-xs text-ink-muted bg-white border border-black/10 rounded-full px-3 py-1.5 flex-shrink-0">
            <Zap size={12} className={canSearch ? 'text-accent' : 'text-red-400'} />
            <span>
              {credits.searches_used}/{credits.searches_limit} búsquedas
            </span>
          </div>
        )}
      </div>

      {/* Search form */}
      <div className="card mb-6">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              placeholder="Ciudad (ej: Madrid, Barcelona...)"
              value={city}
              onChange={e => setCity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input pl-9"
            />
          </div>
          <div className="flex-1 min-w-48 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              placeholder="Sector (ej: Restaurantes, Fontaneros...)"
              value={sector}
              onChange={e => setSector(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input pl-9"
              list="sectors-list"
            />
            <datalist id="sectors-list">
              {SECTORS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <button
            onClick={handleSearch}
            disabled={!city || !sector || searching || (!!credits && !canSearch)}
            className="btn-primary flex items-center gap-2 px-6 w-full sm:w-auto justify-center"
          >
            <Search size={15} />
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {searchError && (
          <p className="text-xs text-red-500 mt-3 flex items-center gap-1">
            <AlertCircle size={12} /> {searchError}
          </p>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Summary + filters */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-muted">{results.length} negocios encontrados</span>
              {noWebCount > 0 && (
                <span className="inline-flex px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                  {noWebCount} sin web
                </span>
              )}
              {fakeWebCount > 0 && (
                <span className="inline-flex px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-xs font-medium">
                  {fakeWebCount} web falsa
                </span>
              )}
            </div>
            <div className="flex gap-1 flex-wrap justify-end">
              {(['all', 'no_web', 'fake_web', 'broken_web', 'poor_web'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterStatus === status
                      ? 'bg-ink text-white'
                      : 'bg-white border border-black/10 text-ink-muted hover:border-black/20'
                  }`}
                >
                  {status === 'all' ? 'Todos' : WEB_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>

          {/* Results list */}
          <div className="space-y-2">
            {filtered.map(place => {
              const webStatus = detectWebStatus(place)
              const score = calculateAuditScore(place)
              const isAdded = added.has(place.place_id) || existingPlaceIds.has(place.place_id)

              const actionButtons = (
                <>
                  {place.url && (
                    <a
                      href={place.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost p-2"
                      title="Ver en Google Maps"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => handleAdd(place)}
                    disabled={isAdded}
                    className={isAdded
                      ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-brand-green-light text-brand-green cursor-default'
                      : 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent text-white hover:bg-accent-dark transition-colors'
                    }
                  >
                    {isAdded
                      ? <><span>✓</span> Añadido</>
                      : <><Plus size={12} /> Añadir al pipeline</>
                    }
                  </button>
                </>
              )

              return (
                <div key={place.place_id} className="card hover:border-black/20 transition-all">
                  <div className="flex items-start gap-3">

                    {/* Score estimado */}
                    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                      score < 30 ? 'bg-red-50 text-red-600' :
                      score < 55 ? 'bg-amber-50 text-amber-700' :
                      'bg-green-50 text-green-600'
                    }`}>
                      <span className="text-sm font-bold leading-none">{score}</span>
                      <span className="text-[9px] opacity-60 leading-none mt-0.5">est.</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-ink">{place.name}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${WEB_STATUS_COLORS[webStatus]}`}>
                          {WEB_STATUS_LABELS[webStatus]}
                        </span>
                        {webStatus === 'no_web' && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-500">
                            <AlertCircle size={11} /> Oportunidad alta
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">{place.formatted_address}</div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {place.rating && (
                          <span className="text-xs text-ink-muted">
                            ⭐ {place.rating} ({place.user_ratings_total} reseñas)
                          </span>
                        )}
                        {place.formatted_phone_number && (
                          <span className="text-xs text-ink-muted">{place.formatted_phone_number}</span>
                        )}
                        {place.website && (
                          <a
                            href={place.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent flex items-center gap-1 hover:underline"
                          >
                            <Globe size={11} />
                            {place.website.replace(/^https?:\/\//, '').substring(0, 30)}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Desktop actions */}
                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                      {actionButtons}
                    </div>

                  </div>

                  {/* Mobile actions */}
                  <div className="flex sm:hidden items-center justify-end gap-2 mt-3 pt-2.5 border-t border-black/6">
                    {actionButtons}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Empty state */}
      {results.length === 0 && !searching && (
        <div className="text-center py-16 text-ink-muted">
          <div className="text-5xl mb-4">🗺️</div>
          <p className="text-sm">Introduce una ciudad y un sector para empezar.</p>
        </div>
      )}

    </div>
  )
}
