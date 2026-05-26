import { supabase } from './supabase'
import { effectiveWebStatus } from './places'
import type { Prospect, AuditResult } from '../types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// Genera el audit llamando a la Edge Function.
// Comprueba cache antes de llamar a Claude — si ya tiene pitch, lo devuelve directamente.
export async function generateAudit(prospect: Prospect): Promise<AuditResult> {
  // Cache: si ya tiene pitch guardado, no regenerar
  if (prospect.audit_pitch && prospect.audit_summary) {
    return {
      score: prospect.audit_score ?? 0,
      web_status: prospect.web_status,
      issues: prospect.audit_summary.split(' | '),
      lost_clients_estimate: '',
      pitch: prospect.audit_pitch,
    }
  }

  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      name: prospect.name,
      address: prospect.address,
      city: prospect.city,
      sector: prospect.category,
      web_status: effectiveWebStatus(prospect.web_status, prospect.pagespeed_score),
      rating: prospect.rating,
      review_count: prospect.review_count,
      website: prospect.website,
      pagespeed_score: prospect.pagespeed_score ?? null,
      pagespeed_seo: prospect.pagespeed_seo ?? null,
    }),
  })

  if (response.status === 402) throw new Error('CREDITS_EXHAUSTED')
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (!response.ok) throw new Error(`Error generando audit: HTTP ${response.status}`)

  const data = await response.json()

  return {
    score: data.score ?? 0,
    web_status: data.web_status ?? prospect.web_status,
    issues: data.issues ?? [],
    lost_clients_estimate: data.lost_clients_estimate ?? '',
    pitch: data.pitch ?? '',
  }
}
