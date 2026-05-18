import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Template } from '../types'

export function useTemplates(userId: string | undefined) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)

  const loadTemplates = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setTemplates(data)
    setLoading(false)
  }, [userId])

  const createTemplate = useCallback(async (
    template: Omit<Template, 'id' | 'user_id' | 'created_at'>,
  ): Promise<Template | null> => {
    if (!userId) return null
    const { data, error } = await supabase
      .from('templates')
      .insert({ ...template, user_id: userId })
      .select()
      .single()
    if (error || !data) return null
    setTemplates(prev => [data, ...prev])
    return data
  }, [userId])

  const updateTemplate = useCallback(async (id: string, updates: Partial<Template>) => {
    const { error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', id)
    if (!error) {
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    }
  }, [])

  const deleteTemplate = useCallback(async (id: string) => {
    await supabase.from('templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }, [])

  return { templates, loading, loadTemplates, createTemplate, updateTemplate, deleteTemplate }
}
