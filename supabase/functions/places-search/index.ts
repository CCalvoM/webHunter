// Supabase Edge Function — Google Places (New) API
// Deploy: supabase functions deploy places-search

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_PLACES_KEY = Deno.env.get('GOOGLE_PLACES_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })

  // ── Autenticación ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authError } = await userClient.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // ── Validar input ──────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const query = typeof body.query === 'string' ? body.query.trim().substring(0, 200) : ''
  if (!query) return json({ error: 'Campo query requerido', results: [] }, 400)

  // ── Verificar créditos (server-side) ───────────────────────────────────────
  const { data: credits } = await userClient
    .from('credits')
    .select('searches_used, searches_limit, bonus_searches')
    .eq('user_id', user.id)
    .single()

  if (!credits) return json({ error: 'No se pudieron verificar los créditos' }, 500)

  const hasBonus = (credits.bonus_searches ?? 0) > 0
  const hasDaily = credits.searches_used < credits.searches_limit
  if (!hasBonus && !hasDaily) {
    return json({ error: 'CREDITS_EXHAUSTED', limit: credits.searches_limit }, 402)
  }

  // ── Google Places API ──────────────────────────────────────────────────────
  if (!GOOGLE_PLACES_KEY) return json({ error: 'GOOGLE_PLACES_KEY no configurada', results: [] }, 500)

  const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
      'X-Goog-FieldMask': [
        'places.id', 'places.displayName', 'places.formattedAddress',
        'places.nationalPhoneNumber', 'places.websiteUri', 'places.rating',
        'places.userRatingCount', 'places.types', 'places.googleMapsUri',
      ].join(','),
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'es', regionCode: 'ES', maxResultCount: 20 }),
  })

  if (!placesRes.ok) {
    console.error('Google Places API error:', await placesRes.text())
    return json({ error: 'Error en Google Places API', results: [] }, 502)
  }

  const data = await placesRes.json()

  // ── Consumir crédito: bonus primero, luego diario ─────────────────────────
  await userClient
    .from('credits')
    .update(
      hasBonus
        ? { bonus_searches: credits.bonus_searches - 1 }
        : { searches_used: credits.searches_used + 1 }
    )
    .eq('user_id', user.id)

  const results = (data.places ?? []).map((place: Record<string, unknown>) => ({
    place_id: place.id,
    name: (place.displayName as { text?: string })?.text ?? '',
    formatted_address: place.formattedAddress,
    formatted_phone_number: place.nationalPhoneNumber,
    website: place.websiteUri,
    rating: place.rating,
    user_ratings_total: place.userRatingCount,
    types: (place.types as string[]) ?? [],
    url: place.googleMapsUri,
  }))

  return json({ results, searches_used: credits.searches_used + 1 })
})
