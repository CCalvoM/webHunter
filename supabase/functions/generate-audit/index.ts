// Supabase Edge Function — Audit con Claude Sonnet
// Deploy: supabase functions deploy generate-audit
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AuditRequest {
  name: string
  address: string
  city: string
  sector: string
  web_status: 'no_web' | 'fake_web' | 'broken_web' | 'poor_web' | 'has_web'
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
  const { name, address, city, sector, web_status, rating, review_count, website } = body

  const prompt = `Eres un experto en marketing digital local español. Analiza la presencia digital de este negocio y genera un informe de auditoría persuasivo para que un diseñador web freelance lo use como argumento de venta.

DATOS DEL NEGOCIO:
- Nombre: ${name}
- Sector: ${sector}
- Ciudad: ${city}
- Dirección: ${address}
- Web actual: ${website || 'Sin web'}
- Estado web: ${web_status}
- Valoración Google: ${rating || 'Sin valoración'} (${review_count || 0} reseñas)

INSTRUCCIONES:
1. Calcula un score de presencia digital del 0 al 100
2. Lista los 3-4 problemas más críticos de forma específica y local
3. Estima los clientes perdidos mensualmente comparando con negocios similares de su ciudad que SÍ tienen web
4. El punto más importante: menciona específicamente que sus competidores locales (del mismo sector y ciudad) sí aparecen en Google para búsquedas como "${sector} en ${city}" y están captando esos clientes
5. Genera un mensaje de venta corto (máximo 150 palabras) personalizado por sector, en español, que el freelance puede enviar directamente al dueño. Debe empezar mencionando algo específico del negocio (su nombre, su ubicación) y terminar con una llamada a la acción clara

Responde ÚNICAMENTE en JSON con esta estructura exacta:
{
  "score": number,
  "web_status": "${web_status}",
  "issues": ["problema1", "problema2", "problema3"],
  "lost_clients_estimate": "string descriptivo ej: ~12-18 clientes nuevos/mes",
  "pitch": "mensaje de venta completo listo para enviar"
}`

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!anthropicRes.ok) {
    console.error('Anthropic error:', await anthropicRes.text())
    return new Response(
      JSON.stringify({ error: 'Error generando audit con IA' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const anthropicData = await anthropicRes.json()
  const rawText: string = anthropicData.content?.[0]?.text ?? '{}'

  let result
  try {
    // Extraer JSON aunque Claude añada texto adicional
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch?.[0] ?? '{}')
  } catch {
    result = { score: 0, issues: [], lost_clients_estimate: '', pitch: rawText }
  }

  return new Response(
    JSON.stringify(result),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
})
