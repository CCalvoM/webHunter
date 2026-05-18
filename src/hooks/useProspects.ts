import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { detectWebStatus, calculateAuditScore } from '../lib/places'
import type { Prospect, PlaceResult, PipelineStage, AuditResult } from '../types'

export function useProspects(userId: string | undefined) {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Cargar todos los prospectos del usuario ──────────────
  const loadProspects = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('prospects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setProspects(data || [])
    setLoading(false)
  }, [userId])

  // ─── Añadir prospecto desde resultado de Places ───────────
  const addProspect = useCallback(async (place: PlaceResult, city: string, sector: string): Promise<Prospect | null> => {
    if (!userId) return null

    const webStatus = detectWebStatus(place)
    const auditScore = calculateAuditScore(place)

    const newProspect = {
      user_id: userId,
      place_id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      city,
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
      // Si ya existe (mismo place_id + user_id), no es error crítico
      if (error.code === '23505') return null
      setError(error.message)
      return null
    }

    setProspects(prev => [data, ...prev])
    return data
  }, [userId])

  // ─── Cambiar etapa en el pipeline ────────────────────────
  const updateStage = useCallback(async (prospectId: string, stage: PipelineStage) => {
    const { error } = await supabase
      .from('prospects')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', prospectId)

    if (!error) {
      setProspects(prev => prev.map(p =>
        p.id === prospectId ? { ...p, stage } : p
      ))
    }
  }, [])

  // ─── Guardar audit generado por Claude ───────────────────
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
          ? { ...p, audit_score: audit.score, audit_pitch: audit.pitch }
          : p
      ))
    }
  }, [])

  // ─── Actualizar notas y seguimiento ──────────────────────
  const updateProspect = useCallback(async (prospectId: string, updates: Partial<Prospect>) => {
    const { error } = await supabase
      .from('prospects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', prospectId)

    if (!error) {
      setProspects(prev => prev.map(p =>
        p.id === prospectId ? { ...p, ...updates } : p
      ))
    }
  }, [])

  // ─── Eliminar prospecto ───────────────────────────────────
  const deleteProspect = useCallback(async (prospectId: string) => {
    const { error } = await supabase
      .from('prospects')
      .delete()
      .eq('id', prospectId)

    if (!error) {
      setProspects(prev => prev.filter(p => p.id !== prospectId))
    }
  }, [])

  return {
    prospects,
    loading,
    error,
    loadProspects,
    addProspect,
    updateStage,
    saveAudit,
    updateProspect,
    deleteProspect,
  }
}
