// Supabase Edge Function — Crear sesión de Stripe Checkout
// Deploy: supabase functions deploy create-checkout
// Secrets:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//   supabase secrets set STRIPE_PRICE_ID=price_...
//   supabase secrets set SITE_URL=https://app.cloza.es

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check=true'

const STRIPE_SECRET_KEY       = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_PRICE_ID         = Deno.env.get('STRIPE_PRICE_ID') ?? ''
const SITE_URL                = Deno.env.get('SITE_URL') ?? 'https://app.cloza.es'
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOWED_ORIGIN          = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  )
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return json({ error: 'Stripe no configurado' }, 500)
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })

  // ── Buscar o crear customer de Stripe ────────────────────────────────────
  const { data: existingCustomer } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  let customerId: string
  if (existingCustomer?.stripe_customer_id) {
    customerId = existingCustomer.stripe_customer_id
  } else {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    })
    customerId = customer.id
    await supabase.from('stripe_customers').insert({
      user_id: user.id,
      stripe_customer_id: customerId,
    })
  }

  // ── Crear Checkout Session ────────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${SITE_URL}/app/settings?upgraded=true`,
    cancel_url: `${SITE_URL}/app/settings`,
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: user.id } },
    locale: 'es',
  })

  return json({ url: session.url })
})
