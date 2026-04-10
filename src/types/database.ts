import type { Locale, LocaleStrings } from '@/constants/locale'

export type { Locale }

export interface LocaleSettings {
  enabled: boolean
  default_locale: Locale
  available_locales: Locale[]
  /** Per-locale string overrides (partial — only overridden keys needed) */
  overrides: Partial<Record<Locale, Partial<LocaleStrings>>>
}

export type FieldType =
  | 'text'
  | 'email'
  | 'textarea'
  | 'checkbox'
  | 'select'
  | 'radio'
  | 'checkbox_group'
  | 'date'
  | 'rating'
  | 'section'
  | 'html'
  | 'map'
  | 'youtube'
  | 'text_block'
  | 'image'
  | 'divider'
  | 'table'

export interface FormField {
  id: string
  project_id?: string
  label: string
  description?: string  // 필드 상세 설명 (레이블 아래 표시)
  type: FieldType
  required: boolean
  order_index: number
  options?: string[]   // select / radio / checkbox_group
  content?: string     // html, map/youtube URL, text_block text, image URL, table JSON, rating max
  logic?: Record<string, string>  // radio: { "optionValue": "sectionFieldId" }
}

export interface Project {
  id?: string
  user_id?: string
  title: string
  slug: string
  banner_url?: string | null
  notification_email?: string | null
  theme_color?: string | null
  is_published?: boolean
  deadline?: string | null
  max_submissions?: number | null
  webhook_url?: string | null
  submission_message?: string | null
  admin_email_template?: string | null
  user_email_template?: string | null
  thumbnail_url?: string | null
  locale_settings?: LocaleSettings | null
  seo_title?: string | null
  seo_description?: string | null
  seo_og_image?: string | null
  category?: string | null
  start_date?: string | null
  end_date?: string | null
  budget?: number | null
  country?: string | null
  venue_name?: string | null
  venue_map_url?: string | null
  created_at?: string
}

export interface ProjectBudgetItem {
  id: string
  name: string
  type: 'media' | 'production' | 'operation' | 'staff' | 'venue' | 'etc'
  amount: number
  actual_amount: number | null
  min_amount: number | null
  max_amount: number | null
  weight: number
}

export interface ProjectGoalItem {
  id: string
  item: string
  metric: string
  evaluation_method: '정량' | '정성'
  unit: string
  target: string
  actual: string
  gap: string
  final_evaluation: string
  weight_percent: number
}

export interface Submission {
  id?: string
  project_id: string
  answers: Record<string, string | boolean | string[]>
  created_at?: string
}

// ── 웹 모니터링 ────────────────────────────────────────────────────
export type MonitorStatus = 'up' | 'down' | 'slow' | 'error' | 'unknown'
export type MonitorInterval = 5 | 10 | 15 | 30 | 60 | 360 | 720 | 1440 // minutes

export interface MonitorSite {
  id: string
  user_id: string
  name: string
  url: string
  check_interval: MonitorInterval
  is_active: boolean
  notify_email: string | null
  last_checked_at: string | null
  last_status: MonitorStatus | null
  last_response_time: number | null   // ms (전체 응답시간)
  last_ttfb: number | null            // ms (Time to First Byte)
  last_status_code: number | null
  last_error: string | null
  display_order: number | null        // drag & drop 순서
  // ── Web Vitals (Google PageSpeed Insights) ────────────────────
  vitals_lcp: number | null           // ms — Largest Contentful Paint
  vitals_inp: number | null           // ms — Interaction to Next Paint
  vitals_cls: number | null           // score — Cumulative Layout Shift
  vitals_ttfb: number | null          // ms — Server Response Time (TTFB)
  vitals_perf_score: number | null    // 0-100 — Lighthouse Performance Score
  vitals_checked_at: string | null
  created_at: string
  updated_at: string
}

export interface MonitorCheck {
  id: string
  site_id: string
  checked_at: string
  status: MonitorStatus
  response_time: number | null        // ms
  ttfb: number | null                 // ms
  status_code: number | null
  error_message: string | null
}

// Web Vitals 임계값 (Google 기준)
export interface VitalsThreshold {
  good: number
  needsImprovement: number
}
export const VITALS_THRESHOLDS = {
  lcp:  { good: 2500,  needsImprovement: 4000  },  // ms
  inp:  { good: 200,   needsImprovement: 500   },  // ms
  cls:  { good: 0.1,   needsImprovement: 0.25  },  // score
  ttfb: { good: 800,   needsImprovement: 1800  },  // ms
} satisfies Record<string, VitalsThreshold>
