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

    if (data) {
      const today = new Date().toISOString().slice(0, 10)
      const lastReset = (data.reset_date ?? '').slice(0, 10)

      if (lastReset < today) {
        const { data: updated } = await supabase
          .from('credits')
          .update({
            searches_used: 0,
            audits_used: 0,
            reset_date: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .select()
          .single()

        setCredits(updated ?? data)
      } else {
        setCredits(data)
      }
    }

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
