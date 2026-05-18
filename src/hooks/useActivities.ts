import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Activity, ActivityType } from '../types'

export function useActivities(userId: string | undefined) {
  const [activities, setActivities] = useState<Activity[]>([])

  const loadActivities = useCallback(async (prospectId: string) => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setActivities(data)
  }, [])

  const logActivity = useCallback(async (
    prospectId: string,
    type: ActivityType,
    content?: string,
  ) => {
    if (!userId) return
    const { data } = await supabase
      .from('activities')
      .insert({ prospect_id: prospectId, user_id: userId, type, content })
      .select()
      .single()
    if (data) {
      setActivities(prev => [data, ...prev])
    }
  }, [userId])

  return { activities, loadActivities, logActivity }
}
