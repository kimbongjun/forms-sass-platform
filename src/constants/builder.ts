import type { FieldType } from '@/types/database'

export const INPUT_TYPES: FieldType[] = [
  'text', 'email', 'textarea', 'checkbox', 'select', 'radio', 'checkbox_group',
]

export const CONTENT_TYPES: FieldType[] = [
  'text_block', 'image', 'divider', 'map', 'youtube', 'table',
]

export const PRESET_COLORS = [
  '#111827', '#2563EB', '#16A34A', '#DC2626', '#9333EA', '#F59E0B', '#0891B2', '#EC4899',
]

export const TEMPLATE_VARS = [
  { var: '{{form_title}}', desc: '폼 이름' },
  { var: '{{submitted_at}}', desc: '제출 시각' },
  { var: '{{answers_table}}', desc: '응답 내용 표 (자동 생성)' },
]

export const INPUT_CLASS =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900'

export function generateId() {
  return Math.random().toString(36).slice(2, 10)
}
