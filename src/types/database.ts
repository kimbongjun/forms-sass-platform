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

export interface FormField {
  id: string
  project_id?: string
  label: string
  type: FieldType
  required: boolean
  order_index: number
  options?: string[]   // select / radio / checkbox_group 의 선택지
  content?: string     // html 타입의 WYSIWYG HTML 내용, map/youtube URL, text_block 텍스트, image URL
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
  created_at?: string
}

export interface Submission {
  id?: string
  project_id: string
  answers: Record<string, string | boolean | string[]>
  created_at?: string
}
