import type { PlaceResult, WebStatus } from '../types'
import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ─── Buscar negocios via Edge Function (fallback a mock en dev) ───────────────
export async function searchPlaces(city: string, sector: string): Promise<PlaceResult[]> {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${SUPABASE_URL}/functions/v1/places-search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: `${sector} en ${city} España` }),
  })

  if (response.status === 402) throw new Error('CREDITS_EXHAUSTED')
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const data = await response.json()
  return (data.results?.length ? data.results : generateMockResults(city, sector)) as PlaceResult[]
}

// ─── Mock para desarrollo ─────────────────────────────────────────────────────
function generateMockResults(city: string, sector: string): PlaceResult[] {
  const names = [
    `${sector} La Esquina`, `${sector} El Rincón`, `${sector} Casa Pepe`,
    `${sector} Los Hermanos`, `${sector} El Centro`, `${sector} La Plaza`,
    `${sector} Don Antonio`, `${sector} Tradición`, `${sector} El Barrio`,
  ]
  return names.map((name, i) => ({
    place_id: `mock_${i}_${Date.now()}`,
    name,
    formatted_address: `Calle Mayor ${i + 1}, ${city}`,
    formatted_phone_number: i % 3 === 0 ? undefined : `+34 6${String(Math.floor(Math.random() * 90000000 + 10000000))}`,
    website: i === 0 ? undefined
      : i === 1 ? 'https://facebook.com/negocio'
      : i === 2 ? 'https://negocio.wix.com'
      : i % 4 === 0 ? undefined
      : `https://www.${name.toLowerCase().replace(/\s+/g, '')}.com`,
    rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
    user_ratings_total: Math.floor(Math.random() * 150 + 5),
    types: ['establishment'],
    url: `https://maps.google.com/?cid=${i}`,
  }))
}

// ─── Detectar estado web (síncrono, sin PageSpeed) ───────────────────────────
export function detectWebStatus(place: PlaceResult): WebStatus {
  if (!place.website) return 'no_web'

  const url = place.website.toLowerCase()

  const fakePatterns = [
    'facebook.com', 'fb.com',
    'instagram.com', 'instagr.am',
    'twitter.com', 'x.com',
    'tiktok.com',
    'linktr.ee', 'linktree',
    'wa.me', 'whatsapp',
    'google.com/maps',
    'linkedin.com',
  ]
  if (fakePatterns.some(p => url.includes(p))) return 'fake_web'

  const poorPatterns = [
    'wix.com', 'weebly.com', 'jimdo.com',
    'webnode.es', 'webnode.com',
    'negocio.site', 'business.site',
    'blogspot.com', 'wordpress.com',
    'sites.google.com',
    'godaddysites.com',
  ]
  if (poorPatterns.some(p => url.includes(p))) return 'poor_web'

  return 'has_web'
}


// ─── Web status efectivo (incorpora PageSpeed para detectar web rota) ────────
export function effectiveWebStatus(
  webStatus: WebStatus,
  pagespeedScore: number | null | undefined,
): WebStatus {
  if (
    pagespeedScore != null &&
    pagespeedScore < 20 &&
    webStatus !== 'no_web' &&
    webStatus !== 'fake_web'
  ) return 'broken_web'
  return webStatus
}

// ─── Calcular score de presencia digital ─────────────────────────────────────
export function calculateAuditScore(place: PlaceResult, webStatus?: WebStatus): number {
  let score = 0
  const status = webStatus ?? detectWebStatus(place)

  if (status === 'no_web')       score += 0
  else if (status === 'broken_web') score += 5
  else if (status === 'fake_web')   score += 10
  else if (status === 'poor_web')   score += 25
  else score += 50

  if (place.rating) {
    if (place.rating >= 4.5) score += 20
    else if (place.rating >= 4.0) score += 15
    else if (place.rating >= 3.0) score += 10
    else score += 5
  }

  if (place.user_ratings_total) {
    if (place.user_ratings_total >= 100) score += 20
    else if (place.user_ratings_total >= 50) score += 15
    else if (place.user_ratings_total >= 20) score += 10
    else score += 5
  }

  if (place.formatted_phone_number) score += 10

  return Math.min(score, 100)
}

// ─── Issues del audit (sin IA) ───────────────────────────────────────────────
export function getAuditIssues(place: PlaceResult, webStatus?: WebStatus): string[] {
  const issues: string[] = []
  const status = webStatus ?? detectWebStatus(place)

  if (status === 'no_web') {
    issues.push('Sin página web — invisible para clientes que buscan en Google')
    issues.push('No aparece en búsquedas orgánicas de su sector')
    issues.push('Sin formulario de contacto ni reservas online')
  } else if (status === 'broken_web') {
    issues.push('La web no carga correctamente o es muy lenta en móvil')
    issues.push('Google penaliza las webs lentas — baja visibilidad en búsquedas')
    issues.push('Los clientes abandonan webs que tardan más de 3 segundos')
  } else if (status === 'fake_web') {
    issues.push('Usa una red social como página web — no indexable en Google')
    issues.push('Sin dominio propio — poca credibilidad')
    issues.push('Dependiente de algoritmos de redes sociales')
  } else if (status === 'poor_web') {
    issues.push('Web en plataforma gratuita con subdominio genérico')
    issues.push('Posiblemente no optimizada para móvil ni para SEO')
    issues.push('Sin control total sobre su presencia online')
  }

  if (!place.formatted_phone_number) {
    issues.push('Sin teléfono de contacto visible en Google Maps')
  }
  if (!place.rating || (place.user_ratings_total ?? 0) < 20) {
    issues.push('Pocas reseñas en Google — baja visibilidad local')
  }

  return issues
}
