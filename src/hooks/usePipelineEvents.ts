import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PipelineStage } from '../types'

export function usePipelineEvents(userId: string | undefined) {
  const logStageChange = useCallback(async (
    prospectId: string,
    fromStage: PipelineStage | null,
    toStage: PipelineStage,
  ) => {
    if (!userId) return
    await supabase.from('pipeline_events').insert({
      prospect_id: prospectId,
      user_id: userId,
      from_stage: fromStage,
      to_stage: toStage,
    })
  }, [userId])

  return { logStageChange }
}
