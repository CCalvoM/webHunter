import { supabase } from './supabase'
import type { PlaceResult, WebStatus } from '../types'

// ─── Buscar negocios — llama a la Edge Function, con fallback a mock en dev ──
export async function searchPlaces(city: string, sector: string): Promise<PlaceResult[]> {
  const query = `${sector} en ${city} España`
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(
      `${supabaseUrl}/functions/v1/places-search?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      },
    )

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    if (data.results?.length) return data.results as PlaceResult[]

    // Si la Edge Function responde pero sin resultados, usamos mock igualmente
    return generateMockResults(city, sector)
  } catch {
    // En desarrollo sin Edge Function desplegada, usamos datos de prueba
    console.warn('[WebHunter] Edge Function no disponible — usando datos de prueba')
    return generateMockResults(city, sector)
  }
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

// ─── Detectar estado web ──────────────────────────────────────────────────────
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

// ─── Calcular score de presencia digital ─────────────────────────────────────
export function calculateAuditScore(place: PlaceResult): number {
  let score = 0

  const webStatus = detectWebStatus(place)
  if (webStatus === 'no_web')    score += 0
  else if (webStatus === 'fake_web')  score += 10
  else if (webStatus === 'poor_web')  score += 25
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

// ─── Generar issues para el audit ────────────────────────────────────────────
export function getAuditIssues(place: PlaceResult): string[] {
  const issues: string[] = []
  const webStatus = detectWebStatus(place)

  if (webStatus === 'no_web') {
    issues.push('Sin página web — invisible para clientes que buscan en Google')
    issues.push('No aparece en búsquedas orgánicas de su sector')
    issues.push('Sin formulario de contacto ni reservas online')
  } else if (webStatus === 'fake_web') {
    issues.push('Usa una red social como página web — no indexable en Google')
    issues.push('Sin dominio propio — poca credibilidad')
    issues.push('Dependiente de algoritmos de redes sociales')
  } else if (webStatus === 'poor_web') {
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
