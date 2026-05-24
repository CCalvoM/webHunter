// Supabase Edge Function — Follow-up reminder emails via Resend
// Deploy: supabase functions deploy send-followup-reminders
// Secrets needed:
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set CRON_SECRET=<random string>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY           = Deno.env.get('RESEND_API_KEY') ?? ''
const CRON_SECRET              = Deno.env.get('CRON_SECRET') ?? ''

const FOLLOW_UP_DAYS: Record<string, number> = {
  contactado: 2,
  respondio:  3,
  demo:       5,
}

const STAGE_LABELS: Record<string, string> = {
  contactado: 'Contactado',
  respondio:  'Respondió',
  demo:       'Demo',
}

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Auth: solo acepta llamadas con el cron secret
  const cronHeader = req.headers.get('x-cron-secret') ?? ''
  if (!CRON_SECRET || cronHeader !== CRON_SECRET) {
    return json({ error: 'Unauthorized' }, 401)
  }

  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY no configurada' }, 500)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 1. Obtener candidatos (etapas con regla + sin email enviado ni descartado)
  const { data: candidates, error: dbError } = await supabase
    .from('prospects')
    .select('id, user_id, name, city, stage, stage_updated_at')
    .in('stage', ['contactado', 'respondio', 'demo'])
    .is('follow_up_sent_at', null)
    .is('follow_up_dismissed_at', null)

  if (dbError || !candidates) {
    console.error('DB error:', dbError)
    return json({ error: 'Error consultando leads' }, 500)
  }

  // 2. Filtrar por tiempo según etapa
  const now = Date.now()
  const due = candidates.filter(lead => {
    const days = FOLLOW_UP_DAYS[lead.stage]
    const stageDate = new Date(lead.stage_updated_at).getTime()
    return (now - stageDate) / 86_400_000 >= days
  })

  if (due.length === 0) {
    return json({ sent: 0, message: 'No hay leads pendientes de follow-up' })
  }

  // 3. Agrupar por usuario
  const byUser = new Map<string, typeof due>()
  for (const lead of due) {
    if (!byUser.has(lead.user_id)) byUser.set(lead.user_id, [])
    byUser.get(lead.user_id)!.push(lead)
  }

  let emailsSent = 0
  const processedIds: string[] = []

  // 4. Enviar un email por usuario con todos sus leads pendientes
  for (const [userId, leads] of byUser) {
    const { data: userData } = await supabase.auth.admin.getUserById(userId)
    const userEmail = userData?.user?.email
    if (!userEmail) continue

    const leadLines = leads.map(lead => {
      const days = Math.floor((now - new Date(lead.stage_updated_at).getTime()) / 86_400_000)
      return `- ${lead.name} — ${lead.city} — En etapa "${STAGE_LABELS[lead.stage]}" desde hace ${days} día${days === 1 ? '' : 's'}`
    }).join('\n')

    const n = leads.length
    const subject = `Tienes ${n} lead${n === 1 ? '' : 's'} esperando seguimiento en Cloza`
    const text = [
      'Hola,',
      '',
      'Estos leads llevan varios días sin avance:',
      '',
      leadLines,
      '',
      'Entra en app.cloza.es para retomar el contacto.',
      '',
      'Cloza',
    ].join('\n')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Cloza <noreply@cloza.es>',
        to:   userEmail,
        subject,
        text,
      }),
    })

    if (res.ok) {
      emailsSent++
      processedIds.push(...leads.map(l => l.id))
    } else {
      console.error(`Resend error for ${userEmail}:`, await res.text())
    }
  }

  // 5. Marcar como enviados para no repetir
  if (processedIds.length > 0) {
    await supabase
      .from('prospects')
      .update({ follow_up_sent_at: new Date().toISOString() })
      .in('id', processedIds)
  }

  return json({ sent: emailsSent, leads_processed: processedIds.length })
})
