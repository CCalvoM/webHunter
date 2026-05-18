import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { FlagType } from '../types'

export function useDataFlags(userId: string | undefined) {
  const submitFlag = useCallback(async (
    prospectId: string,
    flagType: FlagType,
    notes?: string,
  ): Promise<boolean> => {
    if (!userId) return false

    const { error: flagError } = await supabase
      .from('data_flags')
      .insert({ prospect_id: prospectId, user_id: userId, flag_type: flagType, notes })

    if (flagError) return false

    // Registrar en activities
    await supabase.from('activities').insert({
      prospect_id: prospectId,
      user_id: userId,
      type: 'data_flagged',
      content: flagType,
    })

    return true
  }, [userId])

  return { submitFlag }
}
