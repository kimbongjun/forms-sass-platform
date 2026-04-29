'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Monitor, Plus, RefreshCw, Trash2, Edit2, X,
  AlertCircle, Clock, Wifi, WifiOff, ChevronDown, ChevronUp,
  Mail, Globe, Activity, CheckCircle, XCircle, Gauge, Zap,
  BarChart2, TrendingUp, Info, GripVertical,
  ShieldCheck, ShieldAlert, ShieldOff, Map, ExternalLink,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import type { DraggableAttributes } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type {
  MonitorSite, MonitorStatus, MonitorInterval, MonitorCheck,
  MonitorSitemapRun, SitemapPageResult, SitemapPageStatus,
} from '@/types/database'
import { VITALS_THRESHOLDS } from '@/types/database'

// ── 체크 주기 옵션 ────────────────────────────────────────────────
const INTERVAL_OPTIONS: { value: MonitorInterval; label: string }[] = [
  { value: 5,    label: '5분'    },
  { value: 10,   label: '10분'   },
  { value: 15,   label: '15분'   },
  { value: 30,   label: '30분'   },
  { value: 60,   label: '1시간'  },
  { value: 360,  label: '6시간'  },
  { value: 720,  label: '12시간' },
  { value: 1440, label: '1일'    },
]

// ── SSL ───────────────────────────────────────────────────────────
export interface SslResult {
  days_remaining: number | null
  valid_until: string | null
  valid_from: string | null
  issued_by: string | null
  subject_cn: string | null
  error: string | null
}

function sslMeta(ssl: SslResult | null): {
  label: string; color: string; bg: string; Icon: React.ElementType; days: number | null
} {
  if (!ssl || ssl.error) {
    return { label: ssl?.error === 'HTTPS 미사용' ? 'HTTP' : 'SSL 오류', color: 'text-gray-400', bg: 'bg-gray-50', Icon: ShieldOff, days: null }
  }
  const d = ssl.days_remaining
  if (d === null) return { label: '확인 불가', color: 'text-gray-400', bg: 'bg-gray-50', Icon: ShieldOff, days: null }
  if (d <= 0)  return { label: '만료됨', color: 'text-red-600', bg: 'bg-red-50', Icon: ShieldOff, days: d }
  if (d < 14)  return { label: `${d}일 남음`, color: 'text-red-600', bg: 'bg-red-50', Icon: ShieldAlert, days: d }
  if (d < 30)  return { label: `${d}일 남음`, color: 'text-amber-600', bg: 'bg-amber-50', Icon: ShieldAlert, days: d }
  return { label: `${d}일 남음`, color: 'text-emerald-600', bg: 'bg-emerald-50', Icon: ShieldCheck, days: d }
}

// ── 상태 UI 헬퍼 ─────────────────────────────────────────────────
function statusMeta(s: MonitorStatus | null) {
  switch (s) {
    case 'up':    return { label: '정상',     color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500', Icon: CheckCircle }
    case 'down':  return { label: '오프라인', color: 'text-red-600',     bg: 'bg-red-50',     dot: 'bg-red-500',     Icon: XCircle     }
    case 'slow':  return { label: '응답 지연',color: 'text-amber-600',  bg: 'bg-amber-50',   dot: 'bg-amber-500',   Icon: Gauge       }
    case 'error': return { label: '오류',     color: 'text-red-500',    bg: 'bg-red-50',     dot: 'bg-red-400',     Icon: AlertCircle }
    default:      return { label: '미확인',   color: 'text-gray-400',   bg: 'bg-gray-50',    dot: 'bg-gray-300',    Icon: Activity    }
  }
}

function fmtMs(ms: number | null) {
  if (ms === null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`
}

function fmtRelTime(iso: string | null) {
  if (!iso) return '확인 전'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`
}

// ── Web Vitals 등급 헬퍼 ─────────────────────────────────────────
type VitalKey = 'lcp' | 'inp' | 'cls' | 'ttfb'

function vitalGrade(key: VitalKey, value: number | null): 'good' | 'needs' | 'poor' | 'unknown' {
  if (value === null) return 'unknown'
  const t = VITALS_THRESHOLDS[key]
  if (value <= t.good) return 'good'
  if (value <= t.needsImprovement) return 'needs'
  return 'poor'
}

const GRADE_STYLE = {
  good:    { color: 'text-emerald-600', bg: 'bg-emerald-50',  label: 'Good'  },
  needs:   { color: 'text-amber-600',   bg: 'bg-amber-50',    label: '개선 필요' },
  poor:    { color: 'text-red-600',     bg: 'bg-red-50',      label: 'Poor'  },
  unknown: { color: 'text-gray-400',    bg: 'bg-gray-50',     label: '—'     },
}

// ── 업타임 % 계산 ─────────────────────────────────────────────────
function calcUptime(checks: MonitorCheck[]): number | null {
  if (checks.length === 0) return null
  const up = checks.filter(c => c.status === 'up' || c.status === 'slow').length
  return Math.round((up / checks.length) * 1000) / 10  // 소수 1자리
}

function calcErrorRate(checks: MonitorCheck[]): number | null {
  if (checks.length === 0) return null
  const err = checks.filter(c => c.status === 'down' || c.status === 'error').length
  return Math.round((err / checks.length) * 1000) / 10
}

function avgTtfb(checks: MonitorCheck[]): number | null {
  const vals = checks.filter(c => c.ttfb !== null).map(c => c.ttfb!)
  if (!vals.length) return null
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
}

// ── HTTP 상태 코드 분포 집계 ─────────────────────────────────────
function groupStatusCodes(checks: MonitorCheck[]): { code: string; count: number; pct: number }[] {
  const map: Record<string, number> = {}
  checks.forEach(c => {
    if (c.status_code) {
      const grp = `${Math.floor(c.status_code / 100)}xx (${c.status_code})`
      map[grp] = (map[grp] ?? 0) + 1
    } else {
      map['연결 실패'] = (map['연결 실패'] ?? 0) + 1
    }
  })
  const total = checks.length || 1
  return Object.entries(map)
    .map(([code, count]) => ({ code, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count)
}

// ── 업타임 바 ────────────────────────────────────────────────────
function UptimeBar({ checks }: { checks: MonitorCheck[] }) {
  const MAX = 30
  const slots = Array.from({ length: MAX }, (_, i) => checks[MAX - 1 - i] ?? null)
  return (
    <div className="flex items-end gap-[2px]">
      {slots.map((c, i) => {
        const meta = c ? statusMeta(c.status) : null
        return (
          <div
            key={i}
            title={c
              ? `${new Date(c.checked_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — ${statusMeta(c.status).label}`
              : '데이터 없음'}
            className={['h-5 w-[7px] rounded-sm cursor-pointer transition-opacity hover:opacity-70', meta ? meta.dot : 'bg-gray-200'].join(' ')}
          />
        )
      })}
    </div>
  )
}

// ── Web Vitals 측정 결과 ─────────────────────────────────────────
interface VitalsData {
  lcp: number | null
  inp: number | null
  cls: number | null
  ttfb: number | null
  perf_score: number | null
  checked_at?: string | null
  error?: string | null
}

function VitalsPanel({ siteId, initial }: { siteId: string; initial: VitalsData }) {
  const [data, setData] = useState<VitalsData>(initial)
  const [measuring, setMeasuring] = useState(false)
  const [err, setErr] = useState('')

  async function measure() {
    setMeasuring(true)
    setErr('')
    try {
      const res = await fetch(`/api/monitoring/vitals/${siteId}`, { method: 'POST' })
      const json = await res.json() as VitalsData & { error?: string }
      if (!res.ok || json.error) {
        setErr(json.error ?? `서버 오류 (HTTP ${res.status})`)
        return
      }
      setData(json)
    } catch {
      setErr('측정 중 네트워크 오류가 발생했습니다.')
    } finally {
      setMeasuring(false)
    }
  }

  const vitals: { key: VitalKey; label: string; unit: string; value: number | null; desc: string }[] = [
    { key: 'lcp',  label: 'LCP',  unit: 'ms',  value: data.lcp,  desc: 'Largest Contentful Paint — 최대 콘텐츠 렌더링 시간' },
    { key: 'inp',  label: 'INP',  unit: 'ms',  value: data.inp,  desc: 'Interaction to Next Paint — 상호작용 응답 시간' },
    { key: 'cls',  label: 'CLS',  unit: '',    value: data.cls,  desc: 'Cumulative Layout Shift — 레이아웃 이동 점수' },
    { key: 'ttfb', label: 'TTFB', unit: 'ms',  value: data.ttfb, desc: 'Time to First Byte — 서버 첫 응답 시간' },
  ]

  const hasData = data.lcp !== null || data.inp !== null || data.cls !== null

  return (
    <div className="space-y-4">
      {/* 성능 점수 + 측정 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {data.perf_score !== null ? (
            <div className={[
              'flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold',
              data.perf_score >= 90 ? 'bg-emerald-100 text-emerald-700'
              : data.perf_score >= 50 ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700',
            ].join(' ')}>
              {data.perf_score}
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400 text-xs font-medium">
              —
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800">Lighthouse 성능 점수</p>
            {data.checked_at
              ? <p className="text-[11px] text-gray-400">측정: {fmtRelTime(data.checked_at)}</p>
              : <p className="text-[11px] text-gray-400">아직 측정되지 않았습니다</p>
            }
          </div>
        </div>
        <button
          onClick={measure}
          disabled={measuring}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
        >
          <Zap className={['h-3.5 w-3.5', measuring ? 'animate-pulse' : ''].join(' ')} />
          {measuring ? '측정 중…' : '지금 측정'}
        </button>
      </div>

      {measuring && (
        <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-3 text-xs text-violet-700">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Google PageSpeed Insights로 측정 중입니다 (최대 60초 소요)…
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {err}
        </div>
      )}

      {/* Vitals 카드 4개 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {vitals.map(({ key, label, value, desc }) => {
          const grade = vitalGrade(key, value)
          const style = GRADE_STYLE[grade]
          const display = value === null
            ? '—'
            : key === 'cls'
            ? value.toFixed(3)
            : fmtMs(value)
          return (
            <div
              key={key}
              title={desc}
              className={['rounded-xl border px-3 py-3 cursor-help transition-colors hover:shadow-sm', style.bg, 'border-transparent'].join(' ')}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              <p className={['mt-1 text-xl font-bold', style.color].join(' ')}>{display}</p>
              <p className={['text-[10px] font-medium mt-0.5', style.color].join(' ')}>
                {grade === 'unknown' ? '미측정' : style.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* 임계값 참고 */}
      {hasData && (
        <div className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold text-gray-500 flex items-center gap-1">
            <Info className="h-3 w-3" /> Google Core Web Vitals 기준
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500">
            <span><span className="text-emerald-600 font-medium">Good</span> LCP ≤ 2.5s / INP ≤ 200ms</span>
            <span><span className="text-emerald-600 font-medium">Good</span> CLS ≤ 0.1 / TTFB ≤ 800ms</span>
          </div>
        </div>
      )}

      {/* JS 에러 / 서버 리소스 — 안내 */}
      <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3">
        <p className="text-[11px] font-semibold text-gray-400 mb-1">추가 모니터링 (준비 중)</p>
        <p className="text-[11px] text-gray-400">
          JavaScript 에러 추적 · CPU/메모리 리소스 모니터링은 대상 서버에 경량 에이전트 설치가 필요합니다.
        </p>
      </div>
    </div>
  )
}

// ── 사이트 추가/수정 모달 ─────────────────────────────────────────
interface SiteFormProps {
  initial?: Partial<MonitorSite>
  onSave: (d: { name: string; url: string; check_interval: MonitorInterval; notify_email: string }) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function SiteForm({ initial, onSave, onCancel, saving }: SiteFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [interval, setInterval] = useState<MonitorInterval>(initial?.check_interval ?? 60)
  const [email, setEmail] = useState(initial?.notify_email ?? '')
  const [urlError, setUrlError] = useState('')

  function validateUrl(v: string) {
    try { new URL(v); setUrlError(''); return true }
    catch { setUrlError('올바른 URL을 입력하세요 (예: https://example.com)'); return false }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateUrl(url)) return
    await onSave({ name, url, check_interval: interval, notify_email: email })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {initial?.id ? '사이트 수정' : '사이트 추가'}
          </h2>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">URL <span className="text-red-500">*</span></label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="url" value={url} placeholder="https://example.com" required
                onChange={e => { setUrl(e.target.value); setUrlError('') }}
                onBlur={() => url && validateUrl(url)}
                className={['w-full rounded-xl border py-2.5 pl-9 pr-4 text-sm outline-none transition-colors',
                  urlError ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-blue-400'].join(' ')}
              />
            </div>
            {urlError && <p className="mt-1 text-xs text-red-500">{urlError}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">사이트 이름 (선택)</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="URL에서 자동 추출"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">점검 주기</label>
            <select value={interval} onChange={e => setInterval(Number(e.target.value) as MonitorInterval)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}마다</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">알림 이메일 (선택)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="alert@example.com"
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400" />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">오류 감지 시 이메일 알림을 발송합니다.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {initial?.id ? '저장' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 사이트맵 패널 ─────────────────────────────────────────────────
type SitemapFilter = 'all' | 'ok' | 'not_found' | 'error' | 'wp_debug' | 'layout_issue'

function sitemapStatusMeta(status: SitemapPageStatus) {
  switch (status) {
    case 'ok':           return { label: '정상',          color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' }
    case 'not_found':    return { label: '404',            color: 'text-red-700',     bg: 'bg-red-50',     dot: 'bg-red-500'     }
    case 'wp_debug':     return { label: 'WP 디버그',      color: 'text-amber-700',   bg: 'bg-amber-50',   dot: 'bg-amber-500'   }
    case 'layout_issue': return { label: '레이아웃 이상',  color: 'text-violet-700',  bg: 'bg-violet-50',  dot: 'bg-violet-500'  }
    default:             return { label: '오류',           color: 'text-red-700',     bg: 'bg-red-50',     dot: 'bg-red-400'     }
  }
}

function fmtMs2(ms: number | null) {
  if (ms === null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function SitemapPanel({ siteId }: { siteId: string }) {
  const [run, setRun] = useState<MonitorSitemapRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [filter, setFilter] = useState<SitemapFilter>('all')
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null)

  const loadRun = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/monitoring/sitemap/${siteId}`)
      const data = await res.json() as { run: MonitorSitemapRun | null }
      setRun(data.run ?? null)
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => { loadRun() }, [loadRun])

  async function triggerCheck() {
    setChecking(true)
    setFilter('all')
    try {
      const res = await fetch(`/api/monitoring/sitemap/${siteId}`, { method: 'POST' })
      const data = await res.json() as { run: MonitorSitemapRun | null; result?: { sitemap_found: boolean; tried_urls: string[]; pages: SitemapPageResult[] } }
      // DB 저장 실패해도 result가 있으면 임시 표시
      if (data.run) {
        setRun(data.run)
      } else if (data.result) {
        const r = data.result
        setRun({
          id: '', site_id: siteId, checked_at: new Date().toISOString(),
          sitemap_url: null, sitemap_found: r.sitemap_found, tried_urls: r.tried_urls,
          total_urls: r.pages.length,
          ok_count:    r.pages.filter((p: SitemapPageResult) => p.status === 'ok').length,
          error_count: r.pages.filter((p: SitemapPageResult) => p.status === 'error' || p.status === 'not_found').length,
          issue_count: r.pages.filter((p: SitemapPageResult) => p.status === 'wp_debug' || p.status === 'layout_issue').length,
          pages: r.pages,
        })
      }
    } finally {
      setChecking(false)
    }
  }

  const pages: SitemapPageResult[] = run?.pages ?? []
  const filterCounts = {
    all:          pages.length,
    ok:           pages.filter(p => p.status === 'ok').length,
    not_found:    pages.filter(p => p.status === 'not_found').length,
    error:        pages.filter(p => p.status === 'error').length,
    wp_debug:     pages.filter(p => p.status === 'wp_debug').length,
    layout_issue: pages.filter(p => p.status === 'layout_issue').length,
  }
  const displayPages = filter === 'all' ? pages : pages.filter(p => p.status === filter)
  const okPct = run && run.total_urls > 0 ? Math.round(run.ok_count / run.total_urls * 100) : 0

  // ── 로딩 중 ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-gray-400">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />이전 체크 결과 불러오는 중…
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── 헤더 바 ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          {run ? (
            <span>
              마지막 체크: {new Date(run.checked_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span>아직 체크한 기록이 없습니다.</span>
          )}
        </div>
        <button onClick={triggerCheck} disabled={checking}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
          <RefreshCw className={['h-3.5 w-3.5', checking ? 'animate-spin' : ''].join(' ')} />
          {checking ? '크롤링 중…' : '지금 체크'}
        </button>
      </div>

      {/* ── 체크 중 오버레이 ────────────────────────────────────── */}
      {checking && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-700">sitemap.xml 크롤링 중…</p>
            <p className="text-[11px] text-blue-500 mt-0.5">최대 50개 URL을 순차 점검합니다. 잠시 기다려 주세요.</p>
          </div>
        </div>
      )}

      {/* ── 최초 안내 (결과 없음) ───────────────────────────────── */}
      {!run && !checking && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 px-6 py-8 text-center">
          <Map className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-semibold text-gray-500">사이트맵 체크를 시작하세요</p>
          <p className="mt-1 text-xs text-gray-400">
            등록된 URL의 sitemap.xml을 크롤링해<br />404, WP 디버그 오류, 레이아웃 이상 등을 점검합니다.
          </p>
        </div>
      )}

      {/* ── 결과 영역 ────────────────────────────────────────────── */}
      {run && !checking && (
        <>
          {/* sitemap 경로 표시 */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {run.sitemap_found && run.sitemap_url ? (
              <a href={run.sitemap_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700 hover:underline font-medium">
                <Map className="h-3 w-3" />
                {run.sitemap_url}
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            ) : (
              <div className="space-y-1 w-full">
                <span className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-red-600 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  sitemap.xml을 찾을 수 없습니다
                </span>
                {(run.tried_urls ?? []).length > 0 && (
                  <p className="text-[10px] text-gray-400 pl-1">
                    시도한 경로: {(run.tried_urls ?? []).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* KPI 카드 4개 */}
          {run.total_urls > 0 ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '전체 URL', value: run.total_urls, color: 'text-gray-900',     sub: '' },
                  { label: '정상',      value: run.ok_count,    color: 'text-emerald-600', sub: `${okPct}%` },
                  { label: '404 / 오류', value: run.error_count, color: run.error_count > 0 ? 'text-red-600' : 'text-gray-400', sub: '' },
                  { label: '이슈',       value: run.issue_count, color: run.issue_count > 0 ? 'text-amber-600' : 'text-gray-400', sub: '' },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} className="rounded-xl border border-gray-100 bg-white px-3 py-3 text-center">
                    <p className={['text-xl font-bold', color].join(' ')}>{value}</p>
                    {sub && <p className="text-[10px] font-medium text-gray-400">{sub}</p>}
                    <p className="mt-0.5 text-[10px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* 정상률 프로그레스 바 */}
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
                  <span>정상률</span>
                  <span className={okPct >= 90 ? 'text-emerald-600 font-semibold' : okPct >= 70 ? 'text-amber-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {okPct}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={['h-full rounded-full transition-all duration-700', okPct >= 90 ? 'bg-emerald-500' : okPct >= 70 ? 'bg-amber-500' : 'bg-red-500'].join(' ')}
                    style={{ width: `${okPct}%` }}
                  />
                </div>
              </div>

              {/* 상태 범례 (상태가 2종 이상일 때) */}
              {(run.error_count > 0 || run.issue_count > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { status: 'ok'           as SitemapPageStatus, cnt: run.ok_count    },
                      { status: 'not_found'    as SitemapPageStatus, cnt: pages.filter(p=>p.status==='not_found').length    },
                      { status: 'error'        as SitemapPageStatus, cnt: pages.filter(p=>p.status==='error').length        },
                      { status: 'wp_debug'     as SitemapPageStatus, cnt: run.issue_count > 0 ? pages.filter(p=>p.status==='wp_debug').length : 0 },
                      { status: 'layout_issue' as SitemapPageStatus, cnt: pages.filter(p=>p.status==='layout_issue').length },
                    ] as { status: SitemapPageStatus; cnt: number }[]
                  ).filter(({ cnt }) => cnt > 0).map(({ status, cnt }) => {
                    const sm = sitemapStatusMeta(status)
                    return (
                      <span key={status} className="flex items-center gap-1 text-[11px] text-gray-500">
                        <span className={['h-2 w-2 rounded-full shrink-0', sm.dot].join(' ')} />
                        {sm.label} {cnt}건
                      </span>
                    )
                  })}
                </div>
              )}

              {/* 필터 탭 */}
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { key: 'all'          as SitemapFilter, label: `전체 ${filterCounts.all}` },
                    { key: 'ok'           as SitemapFilter, label: `정상 ${filterCounts.ok}` },
                    filterCounts.not_found    > 0 && { key: 'not_found'    as SitemapFilter, label: `404 ${filterCounts.not_found}` },
                    filterCounts.error        > 0 && { key: 'error'        as SitemapFilter, label: `오류 ${filterCounts.error}` },
                    filterCounts.wp_debug     > 0 && { key: 'wp_debug'     as SitemapFilter, label: `WP디버그 ${filterCounts.wp_debug}` },
                    filterCounts.layout_issue > 0 && { key: 'layout_issue' as SitemapFilter, label: `레이아웃 ${filterCounts.layout_issue}` },
                  ] as ({ key: SitemapFilter; label: string } | false)[]
                ).filter(Boolean).map((f) => {
                  const { key, label } = f as { key: SitemapFilter; label: string }
                  const isActive = filter === key
                  const isIssue  = key !== 'all' && key !== 'ok'
                  return (
                    <button key={key} onClick={() => setFilter(key)}
                      className={[
                        'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
                        isActive
                          ? isIssue ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
                          : isIssue ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      ].join(' ')}>
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* URL 목록 테이블 */}
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                {/* 컬럼 헤더 */}
                <div className="grid grid-cols-[1fr_80px_60px_80px] items-center border-b border-gray-100 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  <span>URL</span>
                  <span className="text-right">상태</span>
                  <span className="text-right">코드</span>
                  <span className="text-right">응답</span>
                </div>

                {/* 목록 */}
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {displayPages.length === 0 ? (
                    <p className="py-6 text-center text-xs text-emerald-600 font-medium">
                      이 필터에 해당하는 페이지가 없습니다 ✓
                    </p>
                  ) : (
                    displayPages.map(p => {
                      const sm = sitemapStatusMeta(p.status)
                      const isExpanded = expandedUrl === p.url
                      return (
                        <div key={p.url}>
                          <button
                            type="button"
                            onClick={() => setExpandedUrl(isExpanded ? null : p.url)}
                            className="grid w-full grid-cols-[1fr_80px_60px_80px] items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={['h-1.5 w-1.5 rounded-full shrink-0', sm.dot].join(' ')} />
                              <span className="truncate text-[11px] text-gray-700" title={p.url}>
                                {p.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                              </span>
                            </div>
                            <span className={['text-right text-[10px] font-semibold', sm.color].join(' ')}>
                              {sm.label}
                            </span>
                            <span className={[
                              'text-right font-mono text-[10px]',
                              p.status_code && p.status_code < 400 ? 'text-emerald-600' : 'text-red-600',
                            ].join(' ')}>
                              {p.status_code ?? '—'}
                            </span>
                            <span className="text-right text-[10px] text-gray-400">
                              {fmtMs2(p.response_time_ms)}
                            </span>
                          </button>

                          {/* 확장: URL 전체 + 이슈 목록 */}
                          {isExpanded && (
                            <div className="border-t border-gray-50 bg-gray-50 px-3 py-2.5 space-y-1.5">
                              <a href={p.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline break-all">
                                {p.url}
                                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              </a>
                              {p.issues.length > 0 && (
                                <ul className="space-y-0.5">
                                  {p.issues.map(issue => (
                                    <li key={issue} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                      {issue}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* 하단 요약 */}
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-[10px] text-gray-400 flex items-center justify-between">
                  <span>{displayPages.length}개 URL 표시 중</span>
                  {run.total_urls >= 50 && (
                    <span className="text-amber-600">최대 50개 URL 체크 (sitemap 전체가 더 클 수 있음)</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* sitemap은 찾았지만 URL 없음 */
            run.sitemap_found && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                sitemap.xml은 발견했지만 파싱 가능한 페이지 URL이 없습니다.
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

// ── 사이트 카드 ───────────────────────────────────────────────────
type DetailTab = 'history' | 'vitals' | 'codes' | 'ssl' | 'sitemap'

interface SiteCardProps {
  site: MonitorSite
  onCheck: (id: string) => Promise<void>
  onEdit: (s: MonitorSite) => void
  onDelete: (id: string) => void
  checking: boolean
  ssl: SslResult | null
  sslLoading: boolean
  onSslRefresh: () => void
  dragHandleProps?: {
    ref: (el: HTMLElement | null) => void
    listeners: SyntheticListenerMap | undefined
    attributes: DraggableAttributes
    isDragging: boolean
  }
}

// Sortable wrapper — dnd-kit 훅을 SiteCard 밖에서 호출
function SortableSiteCard(props: Omit<SiteCardProps, 'dragHandleProps'>) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: props.site.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : 1,
      }}
    >
      <SiteCard
        {...props}
        dragHandleProps={{
          ref: () => {},
          listeners,
          attributes,
          isDragging,
        }}
      />
    </div>
  )
}

// ── SSL 상세 패널 ─────────────────────────────────────────────────
function SslPanel({ ssl, loading, onRefresh }: { ssl: SslResult | null; loading: boolean; onRefresh: () => void }) {
  const meta = sslMeta(ssl)

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    })
  }

  return (
    <div className="space-y-4">
      {/* 주요 수치 + 갱신 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={['flex h-14 w-14 items-center justify-center rounded-xl', meta.bg].join(' ')}>
            <meta.Icon className={['h-7 w-7', meta.color].join(' ')} />
          </div>
          <div>
            <p className={['text-2xl font-bold leading-none', meta.color].join(' ')}>
              {meta.days !== null ? `${meta.days}일` : '—'}
            </p>
            <p className="mt-1 text-xs text-gray-500">만료까지 잔여일</p>
            {ssl && !ssl.error && ssl.days_remaining !== null && ssl.days_remaining < 30 && (
              <p className={['text-[11px] font-medium mt-0.5', meta.color].join(' ')}>
                {ssl.days_remaining <= 0 ? '인증서가 만료되었습니다!' : '갱신이 필요합니다'}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={['h-3.5 w-3.5', loading ? 'animate-spin' : ''].join(' ')} />
          갱신
        </button>
      </div>

      {/* 오류 표시 */}
      {ssl?.error && ssl.error !== 'HTTPS 미사용' && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {ssl.error}
        </div>
      )}
      {ssl?.error === 'HTTPS 미사용' && (
        <div className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-xs text-gray-500">
          <ShieldOff className="h-3.5 w-3.5 shrink-0" />
          이 사이트는 HTTP를 사용하므로 SSL 인증서가 없습니다.
        </div>
      )}

      {/* 인증서 상세 */}
      {ssl && !ssl.error && (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          {[
            { label: '만료일',   value: fmtDate(ssl.valid_until) },
            { label: '발급일',   value: fmtDate(ssl.valid_from) },
            { label: '발급기관', value: ssl.issued_by ?? '—' },
            { label: '도메인',   value: ssl.subject_cn ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center border-b border-gray-50 last:border-0 px-4 py-2.5 text-xs">
              <span className="w-20 shrink-0 font-medium text-gray-400">{label}</span>
              <span className="text-gray-700 font-mono">{value}</span>
            </div>
          ))}
        </div>
      )}

      {loading && !ssl && (
        <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          SSL 인증서 조회 중…
        </div>
      )}
    </div>
  )
}

function SiteCard({ site, onCheck, onEdit, onDelete, checking, ssl, sslLoading, onSslRefresh, dragHandleProps }: SiteCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<DetailTab>('history')
  const [history, setHistory] = useState<MonitorCheck[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const meta = statusMeta(site.last_status)
  const interval = INTERVAL_OPTIONS.find(o => o.value === site.check_interval)?.label ?? `${site.check_interval}분`

  async function loadHistory() {
    if (history.length > 0 && expanded) { setExpanded(false); return }
    setExpanded(true)
    if (history.length > 0) return
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/monitoring/history/${site.id}`)
      setHistory(Array.isArray(await res.clone().json()) ? await res.json() as MonitorCheck[] : [])
    } finally {
      setLoadingHistory(false)
    }
  }

  async function handleCheck() {
    await onCheck(site.id)
    // 체크 후 이력 갱신
    const res = await fetch(`/api/monitoring/history/${site.id}`)
    const data = await res.json() as MonitorCheck[]
    if (Array.isArray(data)) setHistory(data)
  }

  const uptime = calcUptime(history)
  const errRate = calcErrorRate(history)
  const avgT = avgTtfb(history)
  const codeDist = groupStatusCodes(history)

  const initialVitals: VitalsData = {
    lcp: site.vitals_lcp ?? null,
    inp: site.vitals_inp ?? null,
    cls: site.vitals_cls ?? null,
    ttfb: site.vitals_ttfb ?? null,
    perf_score: site.vitals_perf_score ?? null,
    checked_at: site.vitals_checked_at ?? null,
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* 카드 헤더 */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          {dragHandleProps && (
            <button
              {...dragHandleProps.attributes}
              {...dragHandleProps.listeners}
              title="드래그하여 순서 변경"
              className={[
                'mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-gray-300 transition-colors hover:text-gray-500 active:cursor-grabbing',
                dragHandleProps.isDragging ? 'cursor-grabbing text-gray-500' : '',
              ].join(' ')}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          {/* 상태 점 (live pulse) */}
          <div className="relative mt-1 shrink-0">
            <span className={['h-3 w-3 rounded-full inline-block', meta.dot].join(' ')} />
            {site.last_status === 'up' && (
              <span className={['absolute inset-0 rounded-full animate-ping opacity-50', meta.dot].join(' ')} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{site.name}</h3>
              <span className={['rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.bg, meta.color].join(' ')}>
                {meta.label}
              </span>
              {!site.is_active && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">일시정지</span>
              )}
            </div>
            <a href={site.url} target="_blank" rel="noopener noreferrer"
              className="mt-0.5 block truncate text-xs text-blue-500 hover:underline">{site.url}</a>

            {/* 핵심 지표 요약 */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
              <span className="flex items-center gap-1" title="TTFB (Time to First Byte)">
                <Zap className="h-3 w-3" />
                TTFB {fmtMs(site.last_ttfb)}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                응답 {fmtMs(site.last_response_time)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {fmtRelTime(site.last_checked_at)}
              </span>
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {interval}마다
              </span>
              {site.last_status_code && (
                <span className={[
                  'font-mono rounded-full px-1.5 py-0.5',
                  site.last_status_code < 400 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
                ].join(' ')}>
                  HTTP {site.last_status_code}
                </span>
              )}
              {site.vitals_perf_score !== null && (
                <span className={[
                  'flex items-center gap-0.5 font-medium rounded-full px-1.5 py-0.5',
                  site.vitals_perf_score >= 90 ? 'bg-emerald-50 text-emerald-700'
                  : site.vitals_perf_score >= 50 ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-600',
                ].join(' ')} title="Lighthouse 성능 점수">
                  <BarChart2 className="h-2.5 w-2.5" /> {site.vitals_perf_score}
                </span>
              )}
              {/* SSL 배지 */}
              {site.url.startsWith('https://') && (() => {
                if (sslLoading && !ssl) return (
                  <span className="flex items-center gap-0.5 rounded-full bg-gray-50 px-1.5 py-0.5 text-gray-300">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                    <span className="text-[10px]">SSL</span>
                  </span>
                )
                if (!ssl) return null
                const sm = sslMeta(ssl)
                return (
                  <span
                    className={['flex items-center gap-0.5 font-medium rounded-full px-1.5 py-0.5', sm.bg, sm.color].join(' ')}
                    title={`SSL 인증서: ${sm.label}${ssl.issued_by ? ` · ${ssl.issued_by}` : ''}`}
                  >
                    <sm.Icon className="h-2.5 w-2.5" />
                    <span className="text-[10px]">SSL {sm.label}</span>
                  </span>
                )
              })()}
            </div>

            {site.last_error && (
              <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">{site.last_error}</p>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button onClick={handleCheck} disabled={checking} title="지금 체크"
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-40 transition-colors">
              <RefreshCw className={['h-4 w-4', checking ? 'animate-spin' : ''].join(' ')} />
            </button>
            <button onClick={() => onEdit(site)} title="수정"
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <Edit2 className="h-4 w-4" />
            </button>
            <button onClick={() => onDelete(site.id)} title="삭제"
              className="rounded-xl p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={loadHistory} title="상세 보기"
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 확장 상세 패널 */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* 탭 */}
          <div className="flex border-b border-gray-100 bg-gray-50 px-5">
            {([
              { key: 'history', label: '상태 이력',   Icon: Activity    },
              { key: 'vitals',  label: 'Web Vitals',  Icon: Zap         },
              { key: 'codes',   label: 'HTTP 코드',   Icon: BarChart2   },
              { key: 'ssl',     label: 'SSL 인증서',  Icon: ShieldCheck },
              { key: 'sitemap', label: '사이트맵',    Icon: Map         },
            ] as { key: DetailTab; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={[
                  'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
                  tab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600',
                ].join(' ')}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          <div className="bg-gray-50 px-5 py-4">
            {loadingHistory ? (
              <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />이력 불러오는 중…
              </div>
            ) : (
              <>
                {/* ── 상태 이력 탭 ─────────────────────────────── */}
                {tab === 'history' && (
                  <div className="space-y-4">
                    {/* 집계 지표 */}
                    {history.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '가동률 (Uptime)', value: uptime !== null ? `${uptime}%` : '—', ok: (uptime ?? 0) >= 99 },
                          { label: '평균 TTFB', value: fmtMs(avgT), ok: avgT !== null && avgT < 800 },
                          { label: '에러율', value: errRate !== null ? `${errRate}%` : '—', ok: (errRate ?? 0) < 1 },
                        ].map(({ label, value, ok }) => (
                          <div key={label} className="rounded-xl bg-white border border-gray-100 px-3 py-2.5 text-center">
                            <p className={['text-lg font-bold', ok ? 'text-emerald-600' : 'text-amber-600'].join(' ')}>{value}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {history.length === 0 ? (
                      <p className="py-2 text-center text-xs text-gray-400">이력이 없습니다. 체크를 실행해 데이터를 쌓으세요.</p>
                    ) : (
                      <>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <p className="text-[11px] font-medium text-gray-500">최근 {Math.min(history.length, 30)}회 상태</p>
                            <div className="flex items-center gap-3 text-[10px] text-gray-400">
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500 inline-block" />정상</span>
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500 inline-block" />지연</span>
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500 inline-block" />오프라인</span>
                              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-200 inline-block" />없음</span>
                            </div>
                          </div>
                          <UptimeBar checks={history.slice(0, 30)} />
                        </div>

                        {/* 최근 5건 상세 */}
                        <div className="space-y-1">
                          {history.slice(0, 6).map(c => {
                            const cm = statusMeta(c.status)
                            return (
                              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 px-3 py-2 text-xs">
                                <cm.Icon className={['h-3.5 w-3.5 shrink-0', cm.color].join(' ')} />
                                <span className={['font-medium w-16 shrink-0', cm.color].join(' ')}>{cm.label}</span>
                                <span className="text-gray-400 shrink-0 w-14">TTFB {fmtMs(c.ttfb)}</span>
                                <span className="text-gray-400 shrink-0 w-14">응답 {fmtMs(c.response_time)}</span>
                                {c.status_code && <span className="font-mono text-gray-400 shrink-0">HTTP {c.status_code}</span>}
                                {c.error_message && <span className="truncate text-gray-400">{c.error_message}</span>}
                                <span className="ml-auto shrink-0 text-gray-400">
                                  {new Date(c.checked_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Web Vitals 탭 ────────────────────────────── */}
                {tab === 'vitals' && (
                  <VitalsPanel siteId={site.id} initial={initialVitals} />
                )}

                {/* ── SSL 인증서 탭 ─────────────────────────────── */}
                {tab === 'ssl' && (
                  <SslPanel ssl={ssl} loading={sslLoading} onRefresh={onSslRefresh} />
                )}

                {/* ── 사이트맵 탭 ──────────────────────────────── */}
                {tab === 'sitemap' && (
                  <SitemapPanel siteId={site.id} />
                )}

                {/* ── HTTP 코드 분포 탭 ────────────────────────── */}
                {tab === 'codes' && (
                  <div className="space-y-3">
                    {history.length === 0 ? (
                      <p className="py-2 text-center text-xs text-gray-400">이력이 없습니다.</p>
                    ) : (
                      <>
                        <p className="text-[11px] font-medium text-gray-500">
                          최근 {history.length}회 체크 기준 HTTP 응답 코드 분포
                        </p>
                        <div className="space-y-2">
                          {codeDist.map(({ code, count, pct }) => {
                            const is2xx = code.startsWith('2')
                            const is4xx = code.startsWith('4')
                            const is5xx = code.startsWith('5')
                            const barColor = is2xx ? 'bg-emerald-400' : is4xx || is5xx ? 'bg-red-400' : 'bg-gray-400'
                            return (
                              <div key={code}>
                                <div className="mb-1 flex items-center justify-between text-xs">
                                  <span className={[
                                    'font-mono font-medium',
                                    is2xx ? 'text-emerald-700' : is4xx || is5xx ? 'text-red-600' : 'text-gray-600',
                                  ].join(' ')}>{code}</span>
                                  <span className="text-gray-400">{count}회 ({pct}%)</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                  <div className={['h-full rounded-full transition-all', barColor].join(' ')} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="rounded-xl bg-white border border-gray-100 px-4 py-3">
                          <div className="grid grid-cols-3 gap-3 text-center text-xs">
                            <div>
                              <p className="font-bold text-emerald-600 text-sm">
                                {history.filter(c => c.status_code && c.status_code < 300).length}
                              </p>
                              <p className="text-gray-400">2xx 성공</p>
                            </div>
                            <div>
                              <p className="font-bold text-amber-600 text-sm">
                                {history.filter(c => c.status_code && c.status_code >= 300 && c.status_code < 400).length}
                              </p>
                              <p className="text-gray-400">3xx 리다이렉트</p>
                            </div>
                            <div>
                              <p className="font-bold text-red-600 text-sm">
                                {history.filter(c => !c.status_code || c.status_code >= 400).length}
                              </p>
                              <p className="text-gray-400">4xx/5xx/오류</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 통계 카드 ─────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className={['flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', color].join(' ')}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function MonitoringClient() {
  const [sites, setSites] = useState<MonitorSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<MonitorSite | null>(null)
  const [saving, setSaving] = useState(false)
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set())
  const [checkingAll, setCheckingAll] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filter, setFilter] = useState<MonitorStatus | 'all'>('all')
  const [pageError, setPageError] = useState('')
  const [sslMap, setSslMap] = useState<Record<string, SslResult>>({})
  const [sslLoadingSet, setSslLoadingSet] = useState<Set<string>>(new Set())
  const sslFetchedRef = useRef<Set<string>>(new Set())

  const fetchSslForSite = useCallback(async (siteId: string, fresh = false) => {
    setSslLoadingSet(prev => new Set(prev).add(siteId))
    try {
      const res = await fetch(`/api/monitoring/ssl?siteId=${siteId}${fresh ? '&fresh=1' : ''}`)
      if (res.ok) {
        const data = await res.json() as SslResult
        setSslMap(prev => ({ ...prev, [siteId]: data }))
      }
    } finally {
      setSslLoadingSet(prev => { const n = new Set(prev); n.delete(siteId); return n })
    }
  }, [])

  // dnd-kit 센서
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/sites')
      const data = await res.json() as MonitorSite[]
      setSites(Array.isArray(data) ? data : [])
    } catch {
      setPageError('사이트 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSites() }, [fetchSites])

  // 사이트 목록 로드 후 SSL 일괄 조회 (신규 사이트만)
  useEffect(() => {
    for (const site of sites) {
      if (!sslFetchedRef.current.has(site.id)) {
        sslFetchedRef.current.add(site.id)
        fetchSslForSite(site.id)
      }
    }
  }, [sites, fetchSslForSite])

  // ── CRUD ─────────────────────────────────────────────────────
  async function handleSave(formData: { name: string; url: string; check_interval: MonitorInterval; notify_email: string }) {
    setSaving(true)
    try {
      if (editTarget) {
        const res = await fetch(`/api/monitoring/sites/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        const updated = await res.json() as MonitorSite
        setSites(prev => prev.map(s => s.id === updated.id ? updated : s))
      } else {
        const res = await fetch('/api/monitoring/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        const created = await res.json() as MonitorSite
        setSites(prev => [created, ...prev])
        sslFetchedRef.current.add(created.id)
        fetchSslForSite(created.id)
      }
      setShowForm(false)
      setEditTarget(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/monitoring/sites/${id}`, { method: 'DELETE' })
    setSites(prev => prev.filter(s => s.id !== id))
    setDeleteConfirm(null)
  }

  // ── 체크 ─────────────────────────────────────────────────────
  async function checkSite(id: string) {
    setCheckingIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch('/api/monitoring/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: id }),
      })
      const result = await res.json() as Partial<MonitorSite & { checked_at: string }>
      setSites(prev => prev.map(s => s.id === id ? {
        ...s,
        last_status:        result.last_status        ?? s.last_status,
        last_response_time: result.last_response_time ?? s.last_response_time,
        last_ttfb:          result.last_ttfb          ?? s.last_ttfb,
        last_status_code:   result.last_status_code   ?? s.last_status_code,
        last_error:         result.last_error         ?? s.last_error,
        last_checked_at:    result.checked_at         ?? new Date().toISOString(),
      } : s))
      // 사이트 체크 시 SSL도 함께 갱신
      fetchSslForSite(id, true)
    } finally {
      setCheckingIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  async function checkAll() {
    setCheckingAll(true)
    await Promise.allSettled(sites.map(s => checkSite(s.id)))
    setCheckingAll(false)
  }

  // ── Drag & Drop ───────────────────────────────────────────────
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setSites(prev => {
      const oldIdx = prev.findIndex(s => s.id === active.id)
      const newIdx = prev.findIndex(s => s.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return prev
      const reordered = arrayMove(prev, oldIdx, newIdx)
      // 서버에 새 순서 저장 (fire-and-forget)
      fetch('/api/monitoring/sites/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: reordered.map(s => s.id) }),
      }).catch(() => {})
      return reordered
    })
  }

  // ── 파생 통계 ─────────────────────────────────────────────────
  const stats = {
    total: sites.length,
    up:    sites.filter(s => s.last_status === 'up').length,
    down:  sites.filter(s => s.last_status === 'down' || s.last_status === 'error').length,
    slow:  sites.filter(s => s.last_status === 'slow').length,
  }

  const filtered = filter === 'all'
    ? sites
    : sites.filter(s => filter === 'down'
      ? s.last_status === 'down' || s.last_status === 'error'
      : s.last_status === filter)

  return (
    <div className="min-h-full bg-gray-50">
      {/* 페이지 헤더 */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Monitor className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">웹 모니터링</h1>
              <p className="text-xs text-gray-500">가용성 · 응답 코드 · Web Vitals (LCP/INP/CLS/TTFB) · 에러율</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={checkAll} disabled={checkingAll || sites.length === 0}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <RefreshCw className={['h-4 w-4', checkingAll ? 'animate-spin' : ''].join(' ')} />
              전체 체크
            </button>
            <button onClick={() => { setEditTarget(null); setShowForm(true) }}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              <Plus className="h-4 w-4" />사이트 추가
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {pageError && (
          <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />{pageError}
          </div>
        )}

        {/* 통계 카드 */}
        {sites.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="전체 사이트" value={stats.total} icon={Globe} color="bg-blue-50 text-blue-600" />
            <StatCard label="정상" value={stats.up} icon={Wifi} color="bg-emerald-50 text-emerald-600" />
            <StatCard label="오프라인 / 오류" value={stats.down} icon={WifiOff} color="bg-red-50 text-red-600" />
            <StatCard label="응답 지연" value={stats.slow} icon={TrendingUp} color="bg-amber-50 text-amber-600" />
          </div>
        )}

        {/* 필터 탭 */}
        {sites.length > 0 && (
          <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 w-fit">
            {([
              { key: 'all',     label: '전체' },
              { key: 'up',      label: '정상' },
              { key: 'down',    label: '오프라인' },
              { key: 'slow',    label: '지연' },
              { key: 'unknown', label: '미확인' },
            ] as { key: MonitorStatus | 'all'; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={['rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 로딩 스켈레톤 */}
        {loading && (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-28 rounded-2xl bg-white border border-gray-200 animate-pulse" />)}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && sites.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
              <Monitor className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-700">모니터링할 사이트가 없습니다</h3>
            <p className="mt-1.5 max-w-xs text-sm text-gray-400">
              URL을 추가하면 가용성, 응답 속도, Web Vitals를 자동으로 점검합니다.
            </p>
            <button onClick={() => { setEditTarget(null); setShowForm(true) }}
              className="mt-6 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" />첫 번째 사이트 추가
            </button>
          </div>
        )}

        {!loading && sites.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl bg-white border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-400">해당 상태의 사이트가 없습니다.</p>
          </div>
        )}

        {/* 사이트 목록 */}
        {!loading && filtered.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filtered.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {filtered.map(site => (
                  <SortableSiteCard
                    key={site.id}
                    site={site}
                    onCheck={checkSite}
                    onEdit={s => { setEditTarget(s); setShowForm(true) }}
                    onDelete={id => setDeleteConfirm(id)}
                    checking={checkingIds.has(site.id)}
                    ssl={sslMap[site.id] ?? null}
                    sslLoading={sslLoadingSet.has(site.id)}
                    onSslRefresh={() => fetchSslForSite(site.id, true)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* 안내 배너 */}
        {!loading && sites.length > 0 && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              <div className="text-xs text-blue-700 space-y-0.5">
                <p className="font-medium">자동 점검 · Web Vitals 측정 안내</p>
                <p className="text-blue-600">
                  자동 점검은 Vercel Cron에 의해 <strong>1시간마다</strong> 실행되며, 설정한 주기(check_interval)가 도래한 사이트만 체크합니다.
                  상태 변화(정상↔다운) 시 알림 이메일이 자동 발송됩니다.
                  Web Vitals(LCP/INP/CLS/TTFB)는 카드를 펼친 후 <strong>지금 측정</strong>으로 즉시 측정할 수 있습니다 (Google PageSpeed Insights 기반, 모바일 기준).
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 모달 */}
      {showForm && (
        <SiteForm
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null) }}
          saving={saving}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900">사이트 삭제</h3>
            <p className="mt-2 text-sm text-gray-500">이 사이트와 모든 체크 이력이 삭제됩니다.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
