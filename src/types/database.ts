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

// ── 업계 분석 ────────────────────────────────────────────────────
export type IndustryRegion = 'domestic' | 'global'
export type IndustryCategory =
  | 'trend'          // 주요 동향
  | 'advertising'    // 온라인 광고
  | 'celebrity'      // 연예인/모델 콘텐츠
  | 'medical_device' // 의료기기 동향
  | 'conference'     // 학회/행사
  | 'sns_event'      // SNS 이벤트
  | 'ai_case'        // AI 활용 사례
  | 'press_release'  // 보도자료
  | 'finance'        // 재무 상태

export const INDUSTRY_CATEGORY_META: Record<IndustryCategory, { label: string; color: string }> = {
  trend:          { label: '주요 동향',      color: 'blue'   },
  advertising:    { label: '온라인 광고',    color: 'purple' },
  celebrity:      { label: '연예인/모델',    color: 'pink'   },
  medical_device: { label: '의료기기',       color: 'cyan'   },
  conference:     { label: '학회/행사',      color: 'amber'  },
  sns_event:      { label: 'SNS 이벤트',     color: 'rose'   },
  ai_case:        { label: 'AI 활용',        color: 'indigo' },
  press_release:  { label: '보도자료',       color: 'green'  },
  finance:        { label: '재무 상태',      color: 'orange' },
}

export const INDUSTRY_COMPANIES = [
  { key: '솔타메디칼', label: '솔타메디칼', product: '써마지' },
  { key: '멀츠',       label: '멀츠',       product: '울쎄라' },
  { key: '제이시스메디칼', label: '제이시스메디칼', product: '덴서티' },
  { key: '루트로닉',   label: '루트로닉',   product: '세르프' },
  { key: '클래시스',   label: '클래시스',   product: 'HIFU/RF' },
] as const

export type AiSource = 'openai' | 'gemini' | 'claude'

export interface IndustryAnalysisRun {
  id: string
  status: 'running' | 'completed' | 'failed'
  region: IndustryRegion
  ai_sources: AiSource[]
  items_count: number
  market_summary: string | null
  key_insights: string[] | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_by: string | null
}

export interface IndustryAnalysisItem {
  id: string
  run_id: string | null
  title: string
  summary: string | null
  content: string | null
  category: IndustryCategory
  region: IndustryRegion
  company_tags: string[]
  source_url: string | null
  source_name: string | null
  thumbnail_url: string | null
  published_at: string | null
  is_featured: boolean
  ai_source: AiSource | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface IndustryAnalysisSubscriber {
  id: string
  email: string
  name: string | null
  frequency: 'daily' | 'weekly'
  is_active: boolean
  created_at: string
}

// ── 썸콘텐츠: 소셜 빅데이터 인사이트 ─────────────────────────────────
export type ScChannel =
  | 'naver_blog' | 'naver_cafe' | 'naver_news'
  | 'instagram' | 'youtube' | 'twitter' | 'facebook'
  | 'dcinside' | 'ppomppu' | 'gangnam_unnie' | 'babitalk'

export type ScKeywordCategory = 'brand' | 'product' | 'competitor' | 'general'

export interface ScKeyword {
  id: string
  keyword: string
  category: ScKeywordCategory
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface ScMention {
  id: string
  keyword_id: string
  channel: ScChannel
  mention_date: string
  count: number
  synced_at: string
}

export interface ScPost {
  id: string
  keyword_id: string | null
  channel: ScChannel
  title: string | null
  content: string | null
  url: string | null
  author: string | null
  sentiment: 'positive' | 'negative' | 'neutral' | null
  published_at: string | null
  fetched_at: string
}

export interface ScMentionSummary {
  keyword_id: string
  keyword: string
  total: number
  by_channel: Partial<Record<ScChannel, number>>
  last_synced: string | null
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
