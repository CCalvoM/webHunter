// Supabase Edge Function — Generación de pitch con Claude
// Deploy: supabase functions deploy generate-audit
// Secrets: supabase secrets set ANTHROPIC_API_KEY=<tu_api_key>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AuditRequest {
  name: string
  city: string
  sector: string
  web_status: 'no_web' | 'fake_web' | 'poor_web' | 'has_web'
  rating?: number
  review_count?: number
  website?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const body: AuditRequest = await req.json()
  const { name, city, sector, web_status, rating, review_count, website } = body

  const webStatusText: Record<string, string> = {
    no_web:   'no tiene página web propia',
    fake_web: 'usa una red social (Facebook o Instagram) como página web',
    poor_web: 'tiene una web en plataforma gratuita (tipo Wix o similar)',
    has_web:  'tiene página web propia',
  }

  const prompt = `Eres un especialista en ventas de páginas web para negocios locales en España.

Genera un mensaje de primer contacto por WhatsApp para este negocio:
- Nombre: ${name}
- Ciudad: ${city}
- Sector: ${sector}
- Situación web: ${webStatusText[web_status] ?? 'estado web desconocido'}
${rating ? `- Valoración Google: ${rating}/5 (${review_count ?? 0} reseñas)` : ''}
${website ? `- Web actual: ${website}` : ''}

Requisitos del mensaje:
1. Máximo 3-4 frases, directo y natural
2. Menciona el nombre del negocio y su ciudad
3. Señala su problema concreto de forma empática (no agresiva)
4. Propone una solución clara con llamada a la acción simple (ej: "¿Te parece si hablamos 10 minutos?")
5. Tono cercano, como si fuera de persona a persona, no corporativo
6. En español de España
7. Sin emojis ni asteriscos

Devuelve únicamente el mensaje, sin explicaciones ni comillas.`

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text()
    console.error('Anthropic API error:', errBody)
    return new Response(
      JSON.stringify({ error: 'Error generando pitch con IA' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const anthropicData = await anthropicRes.json()
  const pitch: string = anthropicData.content?.[0]?.text ?? ''

  // Issues según el estado web
  const issues: string[] = []
  if (web_status === 'no_web') {
    issues.push('Sin página web — invisible para clientes que buscan en Google')
    issues.push('No aparece en búsquedas orgánicas de su sector')
    issues.push('Sin formulario de contacto ni reservas online')
  } else if (web_status === 'fake_web') {
    issues.push('Usa red social como web — no indexable en Google')
    issues.push('Sin dominio propio — poca credibilidad')
    issues.push('Dependiente de algoritmos de redes sociales')
  } else if (web_status === 'poor_web') {
    issues.push('Web en plataforma gratuita con subdominio genérico')
    issues.push('Posiblemente no optimizada para SEO ni para móvil')
  }
  if (!rating || (review_count ?? 0) < 20) {
    issues.push('Pocas reseñas en Google — baja visibilidad local')
  }

  // Estimación de clientes perdidos por mes
  const lostEstimates: Record<string, string> = {
    no_web:   '~15-25 clientes/mes',
    fake_web: '~8-15 clientes/mes',
    poor_web: '~5-10 clientes/mes',
    has_web:  '~2-5 clientes/mes',
  }

  return new Response(
    JSON.stringify({
      pitch,
      issues,
      lost_clients_estimate: lostEstimates[web_status] ?? '~5-10 clientes/mes',
    }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
})
