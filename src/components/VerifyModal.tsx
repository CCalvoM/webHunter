import { ExternalLink } from 'lucide-react'

interface Props {
  name: string
  city: string
  onVerify: () => void
  onSkip: () => void
}

export default function VerifyModal({ name, city, onVerify, onSkip }: Props) {
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${name} ${city}`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onSkip}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
        translate="no"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-2xl mb-3">🗺️</div>
        <h3 className="font-display font-bold text-base text-ink mb-2">Antes de contactar</h3>
        <p className="text-sm text-ink-muted mb-5 leading-relaxed">
          Antes de contactar, un buen profesional siempre confirma. Abre Google Maps para verificar que este negocio sigue sin web.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2.5 rounded-full hover:bg-blue-100 transition-colors"
          >
            <ExternalLink size={14} /> Verificar en Google Maps
          </a>
          <button
            onClick={onVerify}
            className="text-sm bg-accent text-white px-4 py-2.5 rounded-full hover:bg-accent-dark transition-colors"
          >
            Ya verificado, continuar
          </button>
        </div>
      </div>
    </div>
  )
}
