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

  const consumeSearch = useCallback(async (): Promise<boolean> => {
    if (!credits || !userId) return false
    if (credits.searches_used >= credits.searches_limit) return false

    const { error } = await supabase
      .from('credits')
      .update({ searches_used: credits.searches_used + 1 })
      .eq('user_id', userId)

    if (!error) {
      setCredits(prev => prev ? { ...prev, searches_used: prev.searches_used + 1 } : null)
      return true
    }
    return false
  }, [credits, userId])

  const consumeAudit = useCallback(async (): Promise<boolean> => {
    if (!credits || !userId) return false
    if (credits.audits_used >= credits.audits_limit) return false

    const { error } = await supabase
      .from('credits')
      .update({ audits_used: credits.audits_used + 1 })
      .eq('user_id', userId)

    if (!error) {
      setCredits(prev => prev ? { ...prev, audits_used: prev.audits_used + 1 } : null)
      return true
    }
    return false
  }, [credits, userId])

  const canSearch = credits ? credits.searches_used < credits.searches_limit : true
  const canAudit = credits ? credits.audits_used < credits.audits_limit : true

  return { credits, loading, loadCredits, consumeSearch, consumeAudit, canSearch, canAudit }
}
