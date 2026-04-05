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
  min_amount: number | null
  max_amount: number | null
  weight: number
}

export interface Submission {
  id?: string
  project_id: string
  answers: Record<string, string | boolean | string[]>
  created_at?: string
}
