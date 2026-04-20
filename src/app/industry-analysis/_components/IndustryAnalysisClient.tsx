'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Microscope, RefreshCw, Mail, Globe, Home,
  ExternalLink, Trash2, Edit2, Star, X, Calendar,
  List, LayoutGrid, ChevronRight, Search, Building2,
  Sparkles, Bot, AlertCircle, CheckCircle2, Clock,
  TrendingUp, Newspaper, Play, Loader2, Settings2,
  Info, Filter,
} from 'lucide-react'
import type {
  IndustryAnalysisItem,
  IndustryAnalysisRun,
  IndustryCategory,
  IndustryRegion,
  AiSource,
} from '@/types/database'
import {
  INDUSTRY_CATEGORY_META,
  INDUSTRY_COMPANIES,
} from '@/types/database'
import { WeeklyCalendar, MonthlyCalendar } from './CalendarViews'

// ── 상수 & 헬퍼 ─────────────────────────────────────────────────
type ViewMode = 'list' | 'weekly' | 'monthly'
type ColorKey = 'blue' | 'purple' | 'pink' | 'cyan' | 'amber' | 'rose' | 'indigo' | 'green' | 'orange'

const COLOR_CLASSES: Record<ColorKey, { badge: string; dot: string }> = {
  blue:   { badge: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-500'   },
  purple: { badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  pink:   { badge: 'bg-pink-50 text-pink-700 border-pink-200',     dot: 'bg-pink-500'   },
  cyan:   { badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',     dot: 'bg-cyan-500'   },
  amber:  { badge: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-500'  },
  rose:   { badge: 'bg-rose-50 text-rose-700 border-rose-200',     dot: 'bg-rose-500'   },
  indigo: { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  green:  { badge: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500'  },
  orange: { badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
}

const AI_META: Record<AiSource, { label: string; color: string; bg: string; logo: string }> = {
  openai: { label: 'GPT-4o',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', logo: '🟢' },
  gemini: { label: 'Gemini',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   logo: '🔵' },
  claude: { label: 'Claude',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', logo: '🟠' },
}

const GOOGLE_SEARCH_META = {
  label: 'Google 검색',
  color: 'text-amber-700',
  bg: 'bg-amber-50 border-amber-200',
  logo: '🔍',
}

const ALL_CATEGORIES = Object.entries(INDUSTRY_CATEGORY_META) as [IndustryCategory, { label: string; color: string }][]

function catColor(cat: IndustryCategory): ColorKey {
  return (INDUSTRY_CATEGORY_META[cat]?.color ?? 'blue') as ColorKey
}
function fmtRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

// ── AI 소스 뱃지 ──────────────────────────────────────────────────
function AiBadge({ source }: { source: AiSource | null | undefined }) {
  if (!source) {
    // ai_source 없음 = Google Search 폴백으로 수집된 항목
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${GOOGLE_SEARCH_META.bg} ${GOOGLE_SEARCH_META.color}`}>
        <span>{GOOGLE_SEARCH_META.logo}</span>{GOOGLE_SEARCH_META.label}
      </span>
    )
  }
  const meta = AI_META[source]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.bg} ${meta.color}`}>
      <span>{meta.logo}</span>{meta.label}
    </span>
  )
}

// ── 카테고리 배지 ──────────────────────────────────────────────────
function CategoryBadge({ category }: { category: IndustryCategory }) {
  const meta = INDUSTRY_CATEGORY_META[category]
  const cls = COLOR_CLASSES[catColor(category)]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
      {meta.label}
    </span>
  )
}

// ── 아이템 카드 ───────────────────────────────────────────────────
function ItemCard({
  item,
  onDelete,
}: {
  item: IndustryAnalysisItem
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`group relative rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${item.is_featured ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'}`}>
      {item.is_featured && (
        <span className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2.5 py-0.5 text-xs font-bold text-white shadow">
          <Star className="h-3 w-3" /> 주요
        </span>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <CategoryBadge category={item.category} />
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${item.region === 'domestic' ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
            {item.region === 'domestic' ? <Home className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {item.region === 'domestic' ? '국내' : '글로벌'}
          </span>
          <AiBadge source={item.ai_source} />
        </div>
        <button onClick={() => onDelete(item.id)} className="shrink-0 rounded-lg p-1 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <h3 className="mb-2 text-sm font-semibold leading-snug text-gray-900">{item.title}</h3>

      {item.summary && (
        <p className="mb-2 text-xs leading-relaxed text-gray-500 line-clamp-3">{item.summary}</p>
      )}

      {item.content && (
        <>
          {expanded && (
            <div className="mb-3 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
              {item.content}
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mb-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            {expanded ? '접기' : '상세 보기'}
          </button>
        </>
      )}

      {item.company_tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {item.company_tags.map(tag => {
            const co = INDUSTRY_COMPANIES.find(c => c.key === tag)
            return (
              <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                <Building2 className="h-3 w-3" />
                {co ? `${co.label} (${co.product})` : tag}
              </span>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{item.published_at ? new Date(item.published_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '—'}</span>
        <div className="flex items-center gap-2">
          {item.source_name && <span>{item.source_name}</span>}
          {item.source_url && (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-blue-500 hover:text-blue-700">
              <ExternalLink className="h-3 w-3" /> 원문
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 회사 상세 취합 뷰 ─────────────────────────────────────────────
function CompanyDetailView({
  company,
  items,
  onDelete,
  onClose,
}: {
  company: typeof INDUSTRY_COMPANIES[number]
  items: IndustryAnalysisItem[]
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const featuredItems = items.filter(i => i.is_featured)
  const categoryGroups = ALL_CATEGORIES.reduce<Record<string, IndustryAnalysisItem[]>>((acc, [key]) => {
    const list = items.filter(i => i.category === key)
    if (list.length > 0) acc[key] = list
    return acc
  }, {})
  const categoryCoverage = Object.keys(categoryGroups).length
  const latestDate = items
    .map(i => i.published_at)
    .filter(Boolean)
    .sort()
    .reverse()[0]

  return (
    <div>
      {/* 회사 헤더 */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">{company.label}</h2>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {company.product}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Newspaper className="h-3 w-3" />수집 자료 {items.length}건</span>
                {featuredItems.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-600"><Star className="h-3 w-3" />주요 {featuredItems.length}건</span>
                )}
                <span className="flex items-center gap-1"><Filter className="h-3 w-3" />{categoryCoverage}개 카테고리</span>
                {latestDate && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />최신 {latestDate}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-xl p-1.5 text-gray-400 hover:bg-white/80 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-400">이 회사와 관련된 수집 자료가 없습니다.</div>
      ) : (
        <>
          {/* 주요 자료 */}
          {featuredItems.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900">주요 자료</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{featuredItems.length}건</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredItems.map(item => <ItemCard key={item.id} item={item} onDelete={onDelete} />)}
              </div>
            </section>
          )}

          {/* 카테고리별 취합 */}
          {Object.entries(categoryGroups).map(([catKey, catItems]) => {
            const meta = INDUSTRY_CATEGORY_META[catKey as IndustryCategory]
            const cls = COLOR_CLASSES[(meta.color as ColorKey)]
            return (
              <section key={catKey} className="mb-8">
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${cls.dot}`} />
                  <h3 className="text-sm font-bold text-gray-900">{meta.label}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${cls.badge}`}>{catItems.length}건</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {catItems.map(item => <ItemCard key={item.id} item={item} onDelete={onDelete} />)}
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

// ── AI 실행 패널 ───────────────────────────────────────────────────
function AiRunPanel({
  configuredAIs,
  latestRun,
  region,
  onRun,
  running,
  runProgress,
}: {
  configuredAIs: Partial<Record<AiSource, boolean>>
  latestRun: IndustryAnalysisRun | null
  region: IndustryRegion
  onRun: (opts: Partial<Record<AiSource, boolean>>) => void
  running: boolean
  runProgress: string
}) {
  const [useAIs, setUseAIs] = useState<Partial<Record<AiSource, boolean>>>({ openai: true, gemini: true })
  const [showConfig, setShowConfig] = useState(false)

  const anyActive = Object.entries(useAIs).some(([k, v]) => v && configuredAIs[k as AiSource])

  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <p className="text-sm font-bold text-gray-900">AI 자동 분석</p>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            AI 에이전트가 {region === 'domestic' ? '국내' : '글로벌'} 피부 미용 의료기기 업계를 자동으로 수집·분석합니다.
          </p>
        </div>
        <button onClick={() => setShowConfig(!showConfig)} className="rounded-xl p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-600">
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {/* AI 선택 */}
      <div className="mb-4 flex gap-2">
        {(['openai', 'gemini'] as AiSource[]).map(ai => {
          const meta = AI_META[ai]
          const hasKey = configuredAIs[ai]
          const active = useAIs[ai] && hasKey
          return (
            <button
              key={ai}
              onClick={() => hasKey && setUseAIs(p => ({ ...p, [ai]: !p[ai] }))}
              disabled={!hasKey}
              className={`flex flex-1 flex-col items-center rounded-xl border p-3 transition-all ${
                active
                  ? `${meta.bg} ${meta.color} border-current shadow-sm`
                  : hasKey
                  ? 'border-gray-200 bg-white/60 text-gray-400 hover:border-gray-300'
                  : 'border-dashed border-gray-200 bg-white/40 text-gray-300 cursor-not-allowed'
              }`}
            >
              <span className="text-lg">{meta.logo}</span>
              <span className="mt-1 text-xs font-semibold">{meta.label}</span>
              {!hasKey && <span className="mt-0.5 text-xs opacity-60">미설정</span>}
              {hasKey && active && <span className="mt-0.5 text-xs opacity-70">활성</span>}
            </button>
          )
        })}
      </div>

      {/* env 설정 안내 (접기/펼치기) */}
      {showConfig && (
        <div className="mb-4 rounded-xl bg-white/70 p-3 text-xs text-gray-600">
          <p className="mb-2 font-semibold text-gray-700">환경변수 설정 (.env.local)</p>
          <div className="space-y-1 font-mono">
            <div className={configuredAIs.openai ? 'text-green-600' : 'text-red-400'}>
              {configuredAIs.openai ? '✓' : '✗'} OPENAI_API_KEY=sk-proj-...
            </div>
            <div className={configuredAIs.gemini ? 'text-green-600' : 'text-red-400'}>
              {configuredAIs.gemini ? '✓' : '✗'} GOOGLE_AI_API_KEY=AIza...
            </div>
          </div>
          <p className="mt-2 text-gray-400">최소 1개 이상의 키를 설정해야 분석이 실행됩니다.</p>
          <p className="mt-1 text-gray-400">AI 오류 시 🔍 Google 뉴스 검색으로 자동 우회됩니다.</p>
        </div>
      )}

      {/* 마지막 실행 정보 */}
      {latestRun && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-xs text-gray-600">
          <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>마지막 분석: {fmtRelTime(latestRun.started_at)}</span>
          {latestRun.status === 'completed' && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-green-600">✓ {latestRun.items_count}건 수집</span>
              {latestRun.ai_sources.length > 0 && (
                <span className="text-gray-400">via {latestRun.ai_sources.join(', ')}</span>
              )}
            </>
          )}
          {latestRun.status === 'failed' && (
            <span className="text-red-500">분석 중 오류가 발생했습니다</span>
          )}
        </div>
      )}

      {/* 실행 중 상태 */}
      {running && (
        <div className="mb-4 rounded-xl bg-white/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            AI 분석 실행 중…
          </div>
          <p className="text-xs text-gray-500">{runProgress}</p>
          <div className="mt-2 overflow-hidden rounded-full bg-indigo-100">
            <div className="h-1 animate-pulse rounded-full bg-indigo-400" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      <button
        onClick={() => onRun(useAIs)}
        disabled={running || !anyActive}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-sm font-semibold text-white shadow hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:shadow-none transition-all"
      >
        {running ? (
          <><Loader2 className="h-4 w-4 animate-spin" />분석 실행 중…</>
        ) : (
          <><Play className="h-4 w-4" />AI 분석 실행</>
        )}
      </button>
    </div>
  )
}

// ── 인사이트 패널 ─────────────────────────────────────────────────
function InsightsPanel({ run }: { run: IndustryAnalysisRun | null }) {
  if (!run || !run.key_insights?.length) return null
  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-indigo-600" />
        <p className="text-sm font-bold text-indigo-900">핵심 인사이트</p>
        <span className="rounded-full bg-indigo-200 px-2 py-0.5 text-xs text-indigo-700">{run.ai_sources.join(' + ')}</span>
      </div>
      {run.market_summary && (
        <p className="mb-3 text-xs leading-relaxed text-indigo-800">{run.market_summary}</p>
      )}
      <ul className="space-y-2">
        {run.key_insights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-indigo-700">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-indigo-800 font-bold">{i + 1}</span>
            {insight}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── 뉴스레터 모달 (간략화) ────────────────────────────────────────
function NewsletterModal({ onClose, region }: { onClose: () => void; region: IndustryRegion }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [freq, setFreq] = useState<'daily' | 'weekly'>('weekly')
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  async function addSubscriber() {
    if (!email.trim()) return
    setAdding(true)
    const res = await fetch('/api/industry-analysis/newsletter/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), name: name.trim() || null, frequency: freq }),
    })
    setAdding(false)
    if (res.ok) setDone(true)
  }

  async function sendNow(frequency: 'daily' | 'weekly') {
    setSending(true)
    setSendResult(null)
    const res = await fetch('/api/industry-analysis/newsletter/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frequency, region }),
    })
    const data = await res.json()
    setSendResult(res.ok ? `${data.sent}명에게 발송 완료` : `오류: ${data.error}`)
    setSending(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">업계분석 뉴스레터</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          {/* 구독자 추가 */}
          <div className="rounded-xl border border-dashed border-gray-300 p-4">
            <p className="mb-3 text-xs font-semibold text-gray-700">구독자 추가</p>
            {done ? (
              <div className="flex items-center gap-2 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" /> 구독 완료!</div>
            ) : (
              <div className="space-y-2">
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일 *" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <div className="flex gap-2">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="이름 (선택)" className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                  <select value={freq} onChange={e => setFreq(e.target.value as 'daily' | 'weekly')} className="rounded-xl border border-gray-200 px-2 py-2 text-sm">
                    <option value="daily">일간</option>
                    <option value="weekly">주간</option>
                  </select>
                </div>
                <button onClick={addSubscriber} disabled={adding || !email.trim()} className="w-full rounded-xl bg-gray-900 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
                  {adding ? '추가 중…' : '구독 추가'}
                </button>
              </div>
            )}
          </div>

          {/* 즉시 발송 */}
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">즉시 발송</p>
            {sendResult && (
              <div className={`mb-2 rounded-xl p-2 text-xs ${sendResult.includes('완료') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{sendResult}</div>
            )}
            <div className="flex gap-2">
              <button onClick={() => sendNow('daily')} disabled={sending} className="flex-1 rounded-xl bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                {sending ? '발송 중…' : '일간 발송'}
              </button>
              <button onClick={() => sendNow('weekly')} disabled={sending} className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {sending ? '발송 중…' : '주간 발송'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function IndustryAnalysisClient() {
  const [items, setItems] = useState<IndustryAnalysisItem[]>([])
  const [runs, setRuns] = useState<IndustryAnalysisRun[]>([])
  const [configuredAIs, setConfiguredAIs] = useState<Partial<Record<AiSource, boolean>>>({ openai: false, gemini: false })
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runProgress, setRunProgress] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // 뷰 & 필터
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [region, setRegion] = useState<IndustryRegion>('domestic')
  const [activeCategory, setActiveCategory] = useState<IndustryCategory | 'all'>('all')
  const [activeCompany, setActiveCompany] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [showNewsletter, setShowNewsletter] = useState(false)
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [itemsRes, runsRes, configRes] = await Promise.all([
      fetch(`/api/industry-analysis/items?region=${region}`),
      fetch('/api/industry-analysis/runs'),
      fetch('/api/industry-analysis/run'),
    ])
    if (itemsRes.ok) setItems(await itemsRes.json())
    if (runsRes.ok) setRuns(await runsRes.json())
    if (configRes.ok) setConfiguredAIs(await configRes.json())
    setLastUpdated(new Date())
    setLoading(false)
  }, [region])

  useEffect(() => {
    setActiveCategory('all')
    setActiveCompany('all')
    fetchAll()
  }, [fetchAll])

  async function handleRun(opts: Partial<Record<AiSource, boolean>>) {
    setRunning(true)
    setRunProgress('AI 에이전트 초기화 중…')

    const activeList = (['openai', 'gemini'] as AiSource[])
      .filter(k => opts[k] && configuredAIs[k])
    setRunProgress(`${activeList.join(', ')} 분석 실행 중 (30~60초 소요)…`)

    try {
      const res = await fetch('/api/industry-analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, ...opts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const msg = data.used_fallback
        ? `Google 검색 폴백으로 ${data.items_count}건 수집 완료`
        : `AI 분석 완료! ${data.items_count}건 수집 (${(data.ai_sources as string[]).join(' + ')})`
      setRunProgress(msg)
      await fetchAll()
    } catch (err) {
      setRunProgress(`오류: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTimeout(() => {
        setRunning(false)
        setRunProgress('')
      }, 2000)
    }
  }

  async function handleDeleteItem(id: string) {
    if (!confirm('이 아이템을 삭제하시겠습니까?')) return
    await fetch(`/api/industry-analysis/items/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // 필터링
  const filteredItems = items.filter(item => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false
    if (activeCompany !== 'all' && !item.company_tags.includes(activeCompany)) return false
    if (showFeaturedOnly && !item.is_featured) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        item.title.toLowerCase().includes(q) ||
        (item.summary ?? '').toLowerCase().includes(q) ||
        (item.source_name ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const latestRun = runs[0] ?? null
  const catCounts = ALL_CATEGORIES.reduce<Record<string, number>>((acc, [key]) => {
    acc[key] = items.filter(i => i.category === key).length
    return acc
  }, {})

  // 카테고리별 그룹 (리스트 뷰)
  const grouped = ALL_CATEGORIES.reduce<Record<string, IndustryAnalysisItem[]>>((acc, [key]) => {
    const list = filteredItems.filter(i => i.category === key)
    if (list.length > 0) acc[key] = list
    return acc
  }, {})

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* ── 상단 헤더 ── */}
      <header className="flex-none border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-100 p-2">
              <Microscope className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">업계분석</h1>
              <p className="text-xs text-gray-400">피부 미용 의료기기 산업 — AI 자동 수집·분석</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden text-xs text-gray-400 sm:block">
                업데이트: {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={fetchAll} disabled={loading} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button onClick={() => setShowNewsletter(true)} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
              <Mail className="h-3.5 w-3.5" />뉴스레터
            </button>
          </div>
        </div>

        {/* 지역 탭 + 뷰 모드 토글 */}
        <div className="mt-3 flex items-center justify-between gap-4">
          {/* 지역 탭 */}
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {([['domestic', '국내', Home], ['global', '글로벌', Globe]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setRegion(key)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${region === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Icon className="h-3.5 w-3.5" />{label}
                <span className={`rounded-full px-1.5 text-xs ${region === key ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'}`}>
                  {items.filter(i => i.region === key).length}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* 검색 */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="검색…"
                className="w-48 rounded-xl border border-gray-200 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>

            {/* 뷰 모드 */}
            <div className="flex gap-0.5 rounded-xl border border-gray-200 bg-white p-1">
              {([
                ['list', List, '리스트'],
                ['weekly', Calendar, '주간'],
                ['monthly', LayoutGrid, '월간'],
              ] as [ViewMode, React.ElementType, string][]).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={label}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === mode ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── 바디 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── 왼쪽 사이드바 ── */}
        <aside className="flex w-1/6 shrink-0 flex-col gap-3 overflow-y-auto border-r border-gray-200 bg-white p-4">
          {/* AI 실행 패널 */}
          <AiRunPanel
            configuredAIs={configuredAIs}
            latestRun={latestRun}
            region={region}
            onRun={handleRun}
            running={running}
            runProgress={runProgress}
          />

          {/* 인사이트 패널 */}
          <InsightsPanel run={latestRun} />

          {/* 카테고리 필터 */}
          <div className="rounded-2xl border border-gray-100 bg-white p-3">
            <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-gray-400">카테고리</p>
            <button
              onClick={() => setActiveCategory('all')}
              className={`mb-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${activeCategory === 'all' ? 'bg-gray-900 text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <span className="flex items-center gap-2"><Filter className="h-3.5 w-3.5" />전체</span>
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${activeCategory === 'all' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-500'}`}>{items.length}</span>
            </button>

            <button
              onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
              className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${showFeaturedOnly ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Star className="h-3.5 w-3.5" />주요만
            </button>

            {ALL_CATEGORIES.map(([key, meta]) => {
              const cnt = catCounts[key] ?? 0
              const cls = COLOR_CLASSES[(meta.color as ColorKey)]
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`mb-0.5 flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-sm transition-colors ${activeCategory === key ? `${cls.badge} font-semibold border` : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cls.dot}`} />{meta.label}
                  </span>
                  {cnt > 0 && <span className={`rounded-full px-1.5 py-0.5 text-xs ${activeCategory === key ? 'bg-white/50' : 'bg-gray-100 text-gray-500'}`}>{cnt}</span>}
                </button>
              )
            })}
          </div>

          {/* 회사 필터 */}
          <div className="rounded-2xl border border-gray-100 bg-white p-3">
            <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-gray-400">회사/브랜드</p>
            <button
              onClick={() => setActiveCompany('all')}
              className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${activeCompany === 'all' ? 'bg-gray-900 text-white font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Building2 className="h-3.5 w-3.5" />전체
            </button>
            {INDUSTRY_COMPANIES.map(c => {
              const count = items.filter(i => i.company_tags.includes(c.key)).length
              const isActive = activeCompany === c.key
              return (
                <button
                  key={c.key}
                  onClick={() => setActiveCompany(isActive ? 'all' : c.key)}
                  className={`group mb-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold ${isActive ? 'text-blue-800' : 'text-gray-700'}`}>
                        {c.label}
                      </span>
                      {count > 0 && (
                        <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                          isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}>{count}</span>
                      )}
                    </div>
                    <span className={`text-xs ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>{c.product}</span>
                  </div>
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                    isActive ? 'rotate-90 text-blue-400' : 'text-gray-300 group-hover:text-gray-400'
                  }`} />
                </button>
              )
            })}
          </div>

          {/* 실행 이력 */}
          {runs.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-3">
              <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-gray-400">분석 이력</p>
              <div className="space-y-2">
                {runs.slice(0, 5).map(run => (
                  <div key={run.id} className="flex items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-gray-50">
                    <div className="mt-0.5">
                      {run.status === 'completed'
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        : run.status === 'failed'
                        ? <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                        : <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-700">{fmtRelTime(run.started_at)}</p>
                      <p className="text-xs text-gray-400">
                        {run.status === 'completed'
                          ? `${run.items_count}건 · ${run.ai_sources.length > 0 ? run.ai_sources.join('+') : '🔍 Google검색'}`
                          : '오류 발생'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── 메인 콘텐츠 ── */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : items.length === 0 ? (
            /* 첫 실행 유도 */
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="mb-6 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 p-8">
                <Bot className="h-16 w-16 text-indigo-400" />
              </div>
              <p className="text-xl font-bold text-gray-800">아직 수집된 데이터가 없습니다</p>
              <p className="mt-2 text-sm text-gray-500">왼쪽 패널에서 <strong>AI 분석 실행</strong>을 눌러 업계 동향을 자동 수집하세요.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                {(['openai', 'gemini'] as AiSource[]).filter(k => configuredAIs[k]).map(k => (
                  <span key={k} className={`flex items-center gap-1 rounded-full border px-3 py-1 ${AI_META[k].bg} ${AI_META[k].color}`}>
                    {AI_META[k].logo} {AI_META[k].label} 연결됨
                  </span>
                ))}
              </div>
            </div>
          ) : viewMode === 'list' ? (
            /* 리스트 뷰 — 회사 선택 시 CompanyDetailView, 아니면 카테고리별 그룹 */
            activeCompany !== 'all' ? (
              <CompanyDetailView
                company={INDUSTRY_COMPANIES.find(c => c.key === activeCompany)!}
                items={filteredItems}
                onDelete={handleDeleteItem}
                onClose={() => setActiveCompany('all')}
              />
            ) : (
              <div className="space-y-8">
                {filteredItems.length === 0 ? (
                  <div className="py-16 text-center text-sm text-gray-400">필터 조건에 맞는 아이템이 없습니다.</div>
                ) : (
                  Object.entries(grouped).map(([catKey, catItems]) => {
                    const meta = INDUSTRY_CATEGORY_META[catKey as IndustryCategory]
                    const cls = COLOR_CLASSES[(meta.color as ColorKey)]
                    return (
                      <section key={catKey}>
                        <div className="mb-3 flex items-center gap-2">
                          <span className={`h-3 w-3 rounded-full ${cls.dot}`} />
                          <h2 className="text-sm font-bold text-gray-900">{meta.label}</h2>
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${cls.badge}`}>{catItems.length}</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {catItems.map(item => (
                            <ItemCard key={item.id} item={item} onDelete={handleDeleteItem} />
                          ))}
                        </div>
                      </section>
                    )
                  })
                )}
              </div>
            )
          ) : viewMode === 'weekly' ? (
            /* 주간 캘린더 */
            <WeeklyCalendar items={filteredItems} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
          ) : (
            /* 월간 캘린더 */
            <MonthlyCalendar items={filteredItems} monthOffset={monthOffset} setMonthOffset={setMonthOffset} />
          )}
        </main>
      </div>

      {/* 뉴스레터 모달 */}
      {showNewsletter && <NewsletterModal onClose={() => setShowNewsletter(false)} region={region} />}
    </div>
  )
}
