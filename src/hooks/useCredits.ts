import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Credits } from '../types'

export function useCredits(userId: string | undefined) {
  const [credits, setCredits] = useState<Credits | null>(null)
  const [loading, setLoading] = useState(false)

  const loadCredits = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (data) setCredits(data)
    setLoading(false)
  }, [userId])


  // Plan free: límite de por vida (sin reset mensual)
  // Plan pro: límite mensual con reset automático
  const canSearch = credits ? credits.searches_used < credits.searches_limit : true
  const canAudit = credits ? credits.audits_used < credits.audits_limit : true

  const isLifetime = credits?.plan === 'free'

  return { credits, loading, loadCredits, canSearch, canAudit, isLifetime }
}
