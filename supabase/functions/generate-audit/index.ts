// Supabase Edge Function — Audit con Claude Sonnet
// Deploy: supabase functions deploy generate-audit
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY      = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOWED_ORIGIN          = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Elimina caracteres que podrían romper el prompt o inyectar instrucciones
function sanitize(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().substring(0, maxLen).replace(/[<>{}[\]]/g, '').replace(/\n+/g, ' ')
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
  pagespeed_score?: number | null
  pagespeed_seo?: number | null
}

function interpretPagespeed(perf: number | null | undefined, seo: number | null | undefined): string {
  if (perf == null) return 'Rendimiento web: no analizado.'

  const perfLine = perf < 20
    ? `Rendimiento móvil CRÍTICO (${perf}/100) — tiempo de carga estimado >10 segundos. Google penaliza severamente estas webs en búsquedas.`
    : perf < 40
    ? `Rendimiento móvil MUY MALO (${perf}/100) — tiempo de carga estimado 6-10 segundos. El 70% de usuarios abandona antes de que cargue.`
    : perf < 60
    ? `Rendimiento móvil MALO (${perf}/100) — tiempo de carga estimado 4-6 segundos. Por debajo del estándar de Google (menos de 3 segundos).`
    : perf < 80
    ? `Rendimiento móvil MEJORABLE (${perf}/100) — carga en 2-4 segundos. Aceptable pero no óptimo.`
    : `Rendimiento móvil BUENO (${perf}/100).`

  const seoLine = seo == null ? ''
    : seo < 40
    ? ` SEO técnico MUY DÉBIL (${seo}/100) — prácticamente invisible para Google.`
    : seo < 60
    ? ` SEO técnico DÉBIL (${seo}/100) — visibilidad muy limitada en buscadores.`
    : seo < 80
    ? ` SEO técnico MEJORABLE (${seo}/100) — posicionamiento por debajo de competidores optimizados.`
    : ` SEO técnico ACEPTABLE (${seo}/100).`

  return perfLine + seoLine
}

function scoringGuide(
  web_status: string,
  perf: number | null | undefined,
  seo: number | null | undefined,
): string {
  const perfPenalty = perf != null ? (perf < 20 ? -10 : perf < 40 ? -5 : 0) : 0

  if (web_status === 'no_web')
    return `Sin web propia: score máximo 35. Penalización PageSpeed no aplica.`
  if (web_status === 'fake_web')
    return `Usa redes sociales como web: score máximo 50.`
  if (web_status === 'broken_web')
    return `Web rota o inaccesible: score base máximo 45. Penalización adicional por PageSpeed: ${perfPenalty} puntos.`
  if (web_status === 'poor_web')
    return `Web básica/gratuita: score base máximo 60. Penalización adicional por PageSpeed: ${perfPenalty} puntos.`

  // has_web
  const seoBonus = seo != null && seo > 80 ? '+5 si SEO > 80' : ''
  return `Tiene web real: score base entre 55-80 según calidad. Penalización por PageSpeed lento: ${perfPenalty} puntos. ${seoBonus}`
}

function sectorInsights(sector: string): string {
  const s = sector.toLowerCase()
  if (s.includes('restaurante') || s.includes('bar') || s.includes('cafetería'))
    return 'El 78% de las personas busca online dónde comer antes de salir de casa. Sin web, no entras en esa decisión.'
  if (s.includes('fontanero') || s.includes('electricista') || s.includes('cerrajero'))
    return 'El 73% de los clientes busca en Google cuando tiene una urgencia en casa. En esos momentos, quien no aparece, no existe.'
  if (s.includes('peluquería') || s.includes('barbería'))
    return 'El 65% de los nuevos clientes de peluquería elige por las fotos y reseñas que encuentran online antes de llamar.'
  if (s.includes('clínica') || s.includes('dentista') || s.includes('fisio'))
    return 'El 80% de los pacientes investiga al profesional online antes de pedir cita. La confianza se construye antes del primer contacto.'
  if (s.includes('taller') || s.includes('mecánico'))
    return 'El 68% de los conductores busca taller en Google cuando tiene una avería, priorizando los que tienen web y reseñas.'
  if (s.includes('academia') || s.includes('gimnasio') || s.includes('clases'))
    return 'El 72% de las personas busca clases o entrenamiento online antes de decidirse, comparando horarios y precios.'
  if (s.includes('tienda') || s.includes('ropa') || s.includes('moda'))
    return 'El 55% de los compradores consulta online antes de visitar una tienda física, y el 30% directamente no visita si no encuentra información.'
  return 'Los negocios locales con presencia web de calidad reciben un 40% más de contactos nuevos que los que no tienen o tienen una web deficiente.'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })

  // ── Autenticación ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
  }

  // ── Verificar créditos de audit ────────────────────────────────────────────
  const { data: credits } = await supabase
    .from('credits')
    .select('audits_used, audits_limit')
    .eq('user_id', user.id)
    .single()

  if (!credits) {
    return new Response(JSON.stringify({ error: 'No se pudieron verificar los créditos' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
  }
  if (credits.audits_used >= credits.audits_limit) {
    return new Response(JSON.stringify({ error: 'CREDITS_EXHAUSTED', limit: credits.audits_limit }), { status: 402, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Sanitizar inputs (anti prompt injection) ───────────────────────────────
  const raw: AuditRequest = await req.json()
  const name           = sanitize(raw.name, 100)
  const address        = sanitize(raw.address, 200)
  const city           = sanitize(raw.city, 100)
  const sector         = sanitize(raw.sector, 100)
  const website        = sanitize(raw.website, 200)
  const web_status     = raw.web_status
  const rating         = raw.rating
  const review_count   = raw.review_count
  const pagespeed_score = raw.pagespeed_score
  const pagespeed_seo   = raw.pagespeed_seo

  const pagespdInterp = interpretPagespeed(pagespeed_score, pagespeed_seo)
  const scoring = scoringGuide(web_status, pagespeed_score, pagespeed_seo)
  const sectorData = sectorInsights(sector)

  const prompt = `Eres un consultor senior de marketing digital especializado en negocios locales españoles. Tu misión es generar un informe de auditoría tan concreto, convincente y basado en datos que el dueño del negocio sienta que ignorarlo le cuesta dinero real cada día.

DATOS DEL NEGOCIO:
- Nombre: ${name}
- Sector: ${sector}
- Ciudad: ${city}
- Dirección: ${address}
- Web actual: ${website || 'Sin web propia'}
- Estado web: ${web_status}
- Valoración Google: ${rating ? `${rating}/5 (${review_count ?? 0} reseñas)` : 'Sin valoración'}
- ${pagespdInterp}

DATO SECTORIAL (úsalo en el pitch):
${sectorData}

REGLA DE PUNTUACIÓN: ${scoring}

INSTRUCCIONES — genera cada sección con estas prioridades:

1. SCORE (0-100): Aplica la regla de puntuación. Sé preciso, no redondees a múltiplos de 10.

2. ISSUES (3-5 problemas): Cada problema debe ser ESPECÍFICO, LOCAL y CUANTIFICABLE:
   - Menciona búsquedas reales que está perdiendo: "${sector} en ${city}", "${sector} cerca de mí", "${sector} barato ${city}"
   - Si hay PageSpeed score malo: cita el dato exacto y su consecuencia ("${pagespeed_score != null ? `tu web puntúa ${pagespeed_score}/100 en móvil` : ''}")
   - Si tiene pocas reseñas: compara con el estándar del sector en ciudades similares
   - Si usa red social como web: explica por qué Google no la indexa
   - Nunca uses frases genéricas — cada issue debe sentirse escrito para ESTE negocio concreto

3. LOST_CLIENTS_ESTIMATE: Da un rango mensual realista y creíble basado en:
   - El volumen de búsquedas típico del sector en una ciudad como ${city}
   - El % de conversión de búsqueda a contacto para el sector
   - Ejemplo correcto: "~18-30 clientes nuevos al mes que buscan ${sector} en ${city} y no te encuentran"
   - Evita números exagerados que resten credibilidad

4. PITCH (máximo 160 palabras): Escribe aplicando los principios de Dale Carnegie de "Cómo ganar amigos e influir en las personas". Este mensaje lo enviará un freelancer directamente al dueño del negocio.

   PRINCIPIOS CARNEGIE A APLICAR:
   - Habla siempre en términos de lo que le interesa AL RECEPTOR, nunca de lo que ofreces tú
   - Empieza con reconocimiento genuino y específico de algo positivo del negocio (sus reseñas, algo de su sector, su presencia — nunca adulación vacía)
   - Despierta un DESEO, no un miedo: "hay clientes buscándote ahora" en vez de "estás perdiendo clientes"
   - Nunca critiques ni condenes — presenta la situación como una oportunidad que todavía está disponible, no como un fallo suyo
   - Que el siguiente paso parezca una IDEA SUYA: la pregunta final le da control total ("¿os interesaría saber...?" no "te preparo yo un análisis")
   - Muestra que conoces SU negocio, SU ciudad, SUS clientes — no hables de ti mismo

   ESTRUCTURA:
   - APERTURA: Reconocimiento genuino de algo específico del negocio + contexto natural de por qué escribes (buscaste ese sector en esa ciudad)
   - CUERPO (2-3 frases): La situación sin juicio + la oportunidad concreta con los datos reales del análisis + quién se lleva esa oportunidad ahora en ${city}
   - CIERRE: Una sola pregunta suave que despierta curiosidad y le da el control, sin presión ni compromiso
   - FIRMA: [nombre]
   - Tono: como un conocido del sector que comparte algo que le pareció relevante, no un vendedor. Sin exclamaciones. Sin "potenciar", "impulsar", "sinergias", "soluciones digitales". Sin hablar de ti en más de una frase.

Responde ÚNICAMENTE con este JSON exacto, sin texto adicional:
{
  "score": number,
  "web_status": "${web_status}",
  "issues": ["issue específico 1", "issue específico 2", "issue específico 3"],
  "lost_clients_estimate": "estimación concreta y creíble",
  "pitch": "mensaje listo para enviar"
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
      max_tokens: 1200,
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
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch?.[0] ?? '{}')
  } catch {
    result = { score: 0, issues: [], lost_clients_estimate: '', pitch: rawText }
  }

  // ── Consumir crédito de audit ──────────────────────────────────────────────
  await supabase
    .from('credits')
    .update({ audits_used: credits.audits_used + 1 })
    .eq('user_id', user.id)

  return new Response(
    JSON.stringify(result),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  )
})
