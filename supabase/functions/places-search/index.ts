// Supabase Edge Function — Google Places (New) API
// Deploy: supabase functions deploy places-search
// Secrets: supabase secrets set GOOGLE_PLACES_KEY=<tu_api_key>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOOGLE_PLACES_KEY = Deno.env.get('GOOGLE_PLACES_KEY') ?? ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  const { query } = await req.json()

  if (!query) {
    return new Response(
      JSON.stringify({ error: 'Campo query requerido', results: [] }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  if (!GOOGLE_PLACES_KEY) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_PLACES_KEY no configurada', results: [] }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Google Places API (New) — Text Search
  // Permite obtener website, phone, etc. en una sola llamada con FieldMask
  const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.websiteUri',
        'places.rating',
        'places.userRatingCount',
        'places.types',
        'places.googleMapsUri',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'es',
      regionCode: 'ES',
      maxResultCount: 20,
    }),
  })

  if (!placesRes.ok) {
    const errBody = await placesRes.text()
    console.error('Google Places API error:', errBody)
    return new Response(
      JSON.stringify({ error: 'Error en Google Places API', results: [] }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const data = await placesRes.json()

  // Normalizar al formato que espera el frontend (PlaceResult)
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

  return new Response(
    JSON.stringify({ results }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
})
