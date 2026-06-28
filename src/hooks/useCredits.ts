import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Credits } from '../types'

export function useCredits(userId: string | undefined) {
  const [credits, setCredits] = useState<Credits | null>(null)
  const [loading, setLoading] = useState(false)

  const loadCredits = useCallback(async () => {
    if (!userId) return
    setLoading(true)

    // RPC con SECURITY DEFINER: resetea el contador diario si reset_date es de
    // un día anterior. No se expone UPDATE directo al cliente (ver migración
    // 20260628_reset_credits_rpc.sql) para evitar que el usuario manipule sus
    // propios créditos desde la consola del navegador.
    const { data } = await supabase.rpc('reset_daily_credits_if_needed')
    if (data) setCredits(data)

    setLoading(false)
  }, [userId])

  const canSearch = credits
    ? (credits.bonus_searches ?? 0) > 0 || credits.searches_used < credits.searches_limit
    : true
  const canAudit = credits
    ? (credits.bonus_audits ?? 0) > 0 || credits.audits_used < credits.audits_limit
    : true

  return { credits, loading, loadCredits, canSearch, canAudit }
}
