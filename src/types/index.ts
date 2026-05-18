// ─── Auth ────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  created_at: string
}

// ─── Prospects ───────────────────────────────────────────────
export type WebStatus = 'no_web' | 'fake_web' | 'poor_web' | 'has_web'
export type PipelineStage = 'encontrado' | 'contactado' | 'respondio' | 'demo' | 'cerrado' | 'descartado'

export interface Prospect {
  id: string
  user_id: string
  // Datos de Google Places
  place_id: string
  name: string
  address: string
  city: string
  phone?: string
  website?: string
  google_maps_url?: string
  rating?: number
  review_count?: number
  category: string
  // Análisis WebHunter
  web_status: WebStatus
  audit_score?: number
  audit_summary?: string
  audit_pitch?: string
  // Pipeline
  stage: PipelineStage
  notes?: string
  followup_date?: string
  // Meta
  created_at: string
  updated_at: string
}

// ─── Activity ────────────────────────────────────────────────
export type ActivityType = 'created' | 'stage_changed' | 'email_sent' | 'note_added' | 'followup_set' | 'audit_generated'

export interface Activity {
  id: string
  prospect_id: string
  user_id: string
  type: ActivityType
  content?: string
  created_at: string
}

// ─── Templates ───────────────────────────────────────────────
export interface Template {
  id: string
  user_id: string
  name: string
  sector: string
  subject: string
  body: string
  created_at: string
}

// ─── Credits ─────────────────────────────────────────────────
export type Plan = 'free' | 'pro'

export interface Credits {
  user_id: string
  plan: Plan
  searches_used: number
  searches_limit: number
  audits_used: number
  audits_limit: number
  reset_date: string
}

// ─── Google Places ───────────────────────────────────────────
export interface PlaceResult {
  place_id: string
  name: string
  formatted_address: string
  formatted_phone_number?: string
  website?: string
  rating?: number
  user_ratings_total?: number
  types: string[]
  url?: string
}

// ─── Discovery filters ───────────────────────────────────────
export interface SearchFilters {
  city: string
  sector: string
  webStatus: WebStatus | 'all'
  minRating?: number
}

// ─── Audit ───────────────────────────────────────────────────
export interface AuditResult {
  score: number           // 0-100, cuanto más bajo peor presencia digital
  web_status: WebStatus
  issues: string[]        // qué le falta
  lost_clients_estimate: string  // "~15 clientes/mes"
  pitch: string           // mensaje de venta generado por Claude
}

// ─── Pipeline ────────────────────────────────────────────────
export interface KanbanColumn {
  id: PipelineStage
  label: string
  color: string
  prospects: Prospect[]
}

// ─── Stats ───────────────────────────────────────────────────
export interface DashboardStats {
  total_prospects: number
  contacted: number
  demos: number
  closed: number
  conversion_rate: number
  best_sector: string
  best_city: string
}
