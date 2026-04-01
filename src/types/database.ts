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
  content?: string     // html, map/youtube URL, text_block text, image URL, table JSON
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
  created_at?: string
}

export interface Submission {
  id?: string
  project_id: string
  answers: Record<string, string | boolean | string[]>
  created_at?: string
}
