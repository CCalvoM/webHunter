// Supabase Edge Function — Stripe Webhook Handler
// Deploy: supabase functions deploy stripe-webhook
// Secrets:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// En Stripe Dashboard → Webhooks, apunta a:
//   https://<proyecto>.supabase.co/functions/v1/stripe-webhook
// Eventos a escuchar:
//   checkout.session.completed
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted
//   invoice.payment_succeeded
//   invoice.payment_failed

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check=true'

const STRIPE_SECRET_KEY       = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_WEBHOOK_SECRET   = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const PRO_SEARCHES_LIMIT = 100
const PRO_AUDITS_LIMIT   = 50
const FREE_SEARCHES_LIMIT = 20
const FREE_AUDITS_LIMIT   = 5

serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing stripe-signature', { status: 400 })

  const body = await req.text()
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  const cryptoProvider = Stripe.createSubtleCryptoProvider()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, signature, STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  async function getUserId(customerId: string): Promise<string | null> {
    const { data } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single()
    return data?.user_id ?? null
  }

  async function syncSubscription(userId: string, sub: Stripe.Subscription) {
    const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

    await supabase.from('stripe_customers').upsert({
      user_id: userId,
      stripe_customer_id: sub.customer as string,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    if (sub.status === 'active' || sub.status === 'trialing') {
      await supabase.from('credits').update({
        plan: 'pro',
        searches_limit: PRO_SEARCHES_LIMIT,
        audits_limit: PRO_AUDITS_LIMIT,
        reset_date: periodEnd.slice(0, 10),
      }).eq('user_id', userId)
    }
  }

  async function cancelSubscription(userId: string) {
    await supabase.from('stripe_customers').update({
      stripe_subscription_id: null,
      status: 'canceled',
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    await supabase.from('credits').update({
      plan: 'free',
      searches_limit: FREE_SEARCHES_LIMIT,
      audits_limit: FREE_AUDITS_LIMIT,
      reset_date: null,
    }).eq('user_id', userId)
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.CheckoutSession
        if (session.mode !== 'subscription' || !session.subscription) break
        const userId = await getUserId(session.customer as string)
        if (!userId) break
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        await syncSubscription(userId, sub)
        // Reset créditos al activar por primera vez
        await supabase.from('credits').update({
          searches_used: 0,
          audits_used: 0,
        }).eq('user_id', userId)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getUserId(sub.customer as string)
        if (!userId) break
        if (['active', 'trialing'].includes(sub.status)) {
          await syncSubscription(userId, sub)
        } else if (sub.status === 'canceled') {
          await cancelSubscription(userId)
        } else {
          // past_due, unpaid, incomplete — actualizar solo el status
          await supabase.from('stripe_customers').update({
            status: sub.status,
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getUserId(sub.customer as string)
        if (!userId) break
        await cancelSubscription(userId)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription || invoice.billing_reason === 'subscription_create') break
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = await getUserId(sub.customer as string)
        if (!userId) break
        // Reset mensual de créditos en renovación
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
        await supabase.from('credits').update({
          searches_used: 0,
          audits_used: 0,
          reset_date: periodEnd.slice(0, 10),
        }).eq('user_id', userId).eq('plan', 'pro')
        await supabase.from('stripe_customers').update({
          status: 'active',
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = await getUserId(sub.customer as string)
        if (!userId) break
        await supabase.from('stripe_customers').update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return new Response('Internal error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
})
