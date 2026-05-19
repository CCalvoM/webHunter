// Supabase Edge Function — Comprueba si una web está rota o es de mala calidad
// Deploy: supabase functions deploy check-web

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type WebStatus = 'broken_web' | 'poor_web' | 'has_web'

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Protección SSRF ────────────────────────────────────────────────────────────
function isSafeUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const h = url.hostname.toLowerCase()
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return false
    if (/^10\./.test(h)) return false
    if (/^192\.168\./.test(h)) return false
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return false
    if (/^169\.254\./.test(h)) return false
    if (/^fc00:/i.test(h) || /^fe80:/i.test(h)) return false
    return true
  } catch {
    return false
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })

  // ── Autenticación ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authError } = await client.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // ── Rate limiting: máx 20 llamadas/hora por usuario ───────────────────────
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await client
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('fn', 'check-web')
    .gte('created_at', oneHourAgo)

  if ((count ?? 0) >= 20) return json({ error: 'RATE_LIMITED' }, 429)

  // Registrar llamada y limpiar entradas antiguas en paralelo
  await Promise.all([
    client.from('rate_limits').insert({ user_id: user.id, fn: 'check-web' }),
    client.from('rate_limits').delete()
      .eq('user_id', user.id).eq('fn', 'check-web')
      .lt('created_at', oneHourAgo),
  ])

  // ── Validar URL (SSRF protection) ──────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const url = typeof body.url === 'string' ? body.url.trim().substring(0, 500) : ''
  if (!url) return json({ error: 'url requerida' }, 400)
  if (!isSafeUrl(url)) return json({ web_status: 'broken_web', pagespeed_score: null, seo_score: null })

  // ── Paso 1: HTTP check ─────────────────────────────────────────────────────
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9000)

  let httpOk = false
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebStatusChecker/1.0)' },
      redirect: 'follow',
    })
    clearTimeout(timeout)
    httpOk = res.ok
  } catch {
    clearTimeout(timeout)
    return json({ web_status: 'broken_web', pagespeed_score: null, seo_score: null })
  }

  if (!httpOk) return json({ web_status: 'broken_web', pagespeed_score: null, seo_score: null })

  // ── Paso 2: PageSpeed Insights ─────────────────────────────────────────────
  if (!GOOGLE_KEY) return json({ web_status: 'has_web', pagespeed_score: null, seo_score: null })

  try {
    const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
      `?url=${encodeURIComponent(url)}&strategy=mobile&key=${GOOGLE_KEY}` +
      `&category=PERFORMANCE&category=SEO`

    const psRes = await fetch(psUrl)
    if (!psRes.ok) return json({ web_status: 'has_web', pagespeed_score: null, seo_score: null })

    const psData = await psRes.json()
    const perfScore = Math.round((psData.lighthouseResult?.categories?.performance?.score ?? 0) * 100)
    const seoScore  = Math.round((psData.lighthouseResult?.categories?.seo?.score ?? 0) * 100)

    let webStatus: WebStatus
    if (perfScore < 20) webStatus = 'broken_web'
    else if (perfScore < 50 || seoScore < 40) webStatus = 'poor_web'
    else webStatus = 'has_web'

    return json({ web_status: webStatus, pagespeed_score: perfScore, seo_score: seoScore })
  } catch {
    return json({ web_status: 'has_web', pagespeed_score: null, seo_score: null })
  }
})
