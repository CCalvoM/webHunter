import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { detectWebStatus, calculateAuditScore } from '../lib/places'
import type { Prospect, PlaceResult, PipelineStage, AuditResult } from '../types'

export function useProspects(userId: string | undefined) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProspects = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) setError(error.message)
    else setProspects(data || [])
    setLoading(false)
  }, [userId])

  // Cargar un prospecto concreto por id (para la página de detalle)
  const loadProspect = useCallback(async (id: string): Promise<Prospect | null> => {
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return null
    return data
  }, [])

  const addProspect = useCallback(async (place: PlaceResult, city: string, sector: string): Promise<Prospect | null> => {
    if (!userId) return null

    const webStatus = detectWebStatus(place)
    const auditScore = calculateAuditScore(place)
    const normalizedCity = city.trim().replace(/\b\w/g, c => c.toUpperCase())

    const newProspect = {
      user_id: userId,
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      city: normalizedCity,
      phone: place.formatted_phone_number,
      website: place.website,
      google_maps_url: place.url,
      rating: place.rating,
      review_count: place.user_ratings_total,
      category: sector,
      web_status: webStatus,
      audit_score: auditScore,
      stage: 'encontrado' as PipelineStage,
    }

    const { data, error } = await supabase
      .from('prospects')
      .insert(newProspect)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return null
      setError(error.message)
      return null
    }

    // Registrar actividad de creación
    await supabase.from('activities').insert({
      prospect_id: data.id,
      user_id: userId,
      type: 'created',
    })
    // Registrar pipeline event inicial
    await supabase.from('pipeline_events').insert({
      prospect_id: data.id,
      user_id: userId,
      from_stage: null,
      to_stage: 'encontrado',
    })

    setProspects(prev => [data, ...prev])

    // Lanzar comprobación real de web en background (solo si tiene URL y status inicial 'has_web')
    if (data.web_status === 'has_web' && data.website) {
      supabase.functions.invoke('check-web', { body: { url: data.website } })
        .then(({ data: check }) => {
          if (!check) return
          const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
          if (check.web_status && check.web_status !== 'has_web') updates.web_status = check.web_status
          if (check.pagespeed_score != null) updates.pagespeed_score = check.pagespeed_score
          if (check.seo_score != null) updates.pagespeed_seo = check.seo_score
          if (Object.keys(updates).length <= 1) return
          supabase.from('prospects').update(updates).eq('id', data.id)
          setProspects(prev =>
            prev.map(p => p.id === data.id ? { ...p, ...updates } : p),
          )
        })
        .catch(() => {})
    }

    return data
  }, [userId])

  const updateStage = useCallback(async (
    prospectId: string,
    stage: PipelineStage,
    fromStage?: PipelineStage,
  ) => {
    const { error } = await supabase
      .from('prospects')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', prospectId)

    if (!error) {
      setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, stage } : p))

      // Pipeline event
      await supabase.from('pipeline_events').insert({
        prospect_id: prospectId,
        user_id: userId,
        from_stage: fromStage ?? null,
        to_stage: stage,
      })
      // Activity
      await supabase.from('activities').insert({
        prospect_id: prospectId,
        user_id: userId,
        type: 'stage_changed',
        content: stage,
      })
    }
  }, [userId])

  const saveAudit = useCallback(async (prospectId: string, audit: AuditResult) => {
    const { error } = await supabase
      .from('prospects')
      .update({
        audit_score: audit.score,
        audit_summary: audit.issues.join(' | '),
        audit_pitch: audit.pitch,
        web_status: audit.web_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prospectId)

    if (!error) {
      setProspects(prev => prev.map(p =>
        p.id === prospectId
          ? { ...p, audit_score: audit.score, audit_pitch: audit.pitch, web_status: audit.web_status }
          : p,
      ))
    }
  }, [])

  const updateProspect = useCallback(async (prospectId: string, updates: Partial<Prospect>) => {
    const { error } = await supabase
      .from('prospects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', prospectId)

    if (!error) {
      setProspects(prev => prev.map(p => p.id === prospectId ? { ...p, ...updates } : p))
    }
  }, [])

  const deleteProspect = useCallback(async (prospectId: string) => {
    const { error } = await supabase.from('prospects').delete().eq('id', prospectId)
    if (!error) {
      setProspects(prev => prev.filter(p => p.id !== prospectId))
    }
  }, [])

  const dismissFollowUp = useCallback(async (prospectId: string) => {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('prospects')
      .update({ follow_up_dismissed_at: now })
      .eq('id', prospectId)
    if (!error) {
      setProspects(prev => prev.map(p =>
        p.id === prospectId ? { ...p, follow_up_dismissed_at: now } : p,
      ))
    }
  }, [])

  return {
    prospects,
    loading,
    error,
    loadProspects,
    loadProspect,
    addProspect,
    updateStage,
    saveAudit,
    updateProspect,
    deleteProspect,
    dismissFollowUp,
  }
}
