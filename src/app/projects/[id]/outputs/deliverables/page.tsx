'use client'

import { useEffect, useState, useCallback, useTransition, useRef } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  ExternalLink,
  Filter,
  Eye,
  Heart,
  Info,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { DatePickerInput } from '@/components/common/DatePickerInput'
import { HeaderSkeleton, SkeletonBlock } from '@/components/common/LoadingSkeleton'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type {
  DeliverableSearchPlatform,
  DeliverableSearchResult,
  ParsedDeliverable,
} from '@/features/deliverables/types'

type Platform = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'twitter' | 'other'

interface Deliverable {
  id: string
  project_id: string
  platform: Platform
  url: string
  title: string
  thumbnail_url: string | null
  published_at: string | null
  views: number
  likes: number
  comments: number
  shares: number
  last_synced_at: string | null
  memo: string | null
  created_at: string
}

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  other: '기타',
}

const SEARCHABLE_PLATFORMS: DeliverableSearchPlatform[] = ['youtube', 'instagram']

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  youtube: 'bg-red-100 text-red-700',
  tiktok: 'bg-gray-900 text-white',
  facebook: 'bg-blue-100 text-blue-700',
  twitter: 'bg-sky-100 text-sky-700',
  other: 'bg-gray-100 text-gray-600',
}

const PLATFORM_CARD_STYLES: Record<Platform, { glow: string; chip: string }> = {
  instagram: {
    glow: 'from-pink-500/30 via-fuchsia-500/12 to-transparent',
    chip: 'from-pink-500 to-orange-400',
  },
  youtube: {
    glow: 'from-red-500/28 via-rose-500/12 to-transparent',
    chip: 'from-red-500 to-rose-500',
  },
  tiktok: {
    glow: 'from-cyan-400/20 via-slate-400/10 to-transparent',
    chip: 'from-slate-900 to-slate-700',
  },
  facebook: {
    glow: 'from-blue-500/28 via-sky-500/10 to-transparent',
    chip: 'from-blue-600 to-sky-500',
  },
  twitter: {
    glow: 'from-sky-500/28 via-cyan-500/10 to-transparent',
    chip: 'from-sky-500 to-cyan-500',
  },
  other: {
    glow: 'from-gray-400/20 via-slate-300/10 to-transparent',
    chip: 'from-gray-600 to-gray-500',
  },
}

function resolvePlatform(value: string): Platform {
  return value in PLATFORM_LABELS ? (value as Platform) : 'other'
}

const CACHE_TTL_MS = 60 * 60 * 1000

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('ko-KR')
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d))
}

function formatSyncTime(d: string | null) {
  if (!d) return '미동기화'
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

function getHostnameLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function getMediaTypeLabel(item: DeliverableSearchResult) {
  if (item.platform !== 'instagram') return null

  switch ((item.media_type ?? '').toUpperCase()) {
    case 'REEL':
      return 'Reel'
    case 'VIDEO':
      return 'Video'
    case 'CAROUSEL_ALBUM':
      return 'Carousel'
    case 'IMAGE':
    case 'POST':
      return 'Post'
    default:
      return 'Instagram'
  }
}

type ModalStep = 'select_method' | 'keyword_search' | 'url_input' | 'parsing' | 'form' | 'manual_form'

interface FormState {
  platform: Platform
  url: string
  title: string
  thumbnail_url: string
  published_at: string
  views: number
  likes: number
  comments: number
  shares: number
  memo: string
}

const EMPTY_FORM: FormState = {
  platform: 'instagram',
  url: '',
  title: '',
  thumbnail_url: '',
  published_at: '',
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  memo: '',
}

function buildFormState(data: ParsedDeliverable | Deliverable): FormState {
  return {
    platform: data.platform,
    url: data.url,
    title: data.title,
    thumbnail_url: data.thumbnail_url ?? '',
    published_at: data.published_at ?? '',
    views: data.views,
    likes: data.likes,
    comments: data.comments,
    shares: data.shares,
    memo: 'memo' in data ? (data.memo ?? '') : '',
  }
}

export default function DeliverablesPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const [items, setItems] = useState<Deliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastFetchedAt = useRef<number | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<ModalStep>('select_method')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<DeliverableSearchPlatform[]>(['youtube', 'instagram'])
  const [keywordResults, setKeywordResults] = useState<DeliverableSearchResult[]>([])
  const [selectedKeywordKeys, setSelectedKeywordKeys] = useState<Set<string>>(new Set())
  const [keywordNotices, setKeywordNotices] = useState<string[]>([])
  const [keywordLoading, setKeywordLoading] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<'all' | DeliverableSearchPlatform>('all')
  const [showRegistered, setShowRegistered] = useState(true)
  const [sortMode, setSortMode] = useState<'recommended' | 'latest'>('recommended')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [parseNotice, setParseNotice] = useState<{ type: 'info' | 'warn'; message: string } | null>(null)
  const [parsedFields, setParsedFields] = useState<ParsedDeliverable['parsed_fields'] | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const fetchData = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && lastFetchedAt.current && now - lastFetchedAt.current < CACHE_TTL_MS) return
    if (force) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/deliverables`)
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.')
      const data = await res.json()
      setItems(data)
      lastFetchedAt.current = Date.now()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), CACHE_TTL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  function resetCreateState() {
    setUrlInput('')
    setKeywordInput('')
    setKeywordResults([])
    setSelectedKeywordKeys(new Set())
    setKeywordNotices([])
    setPlatformFilter('all')
    setShowRegistered(true)
    setSortMode('recommended')
    setParseNotice(null)
    setParsedFields(null)
    setForm(EMPTY_FORM)
    setModalStep('select_method')
  }

  function openCreate() {
    setEditingId(null)
    resetCreateState()
    setModalOpen(true)
  }

  function openEdit(item: Deliverable) {
    setEditingId(item.id)
    setUrlInput(item.url)
    setKeywordInput('')
    setKeywordResults([])
    setSelectedKeywordKeys(new Set())
    setKeywordNotices([])
    setPlatformFilter('all')
    setShowRegistered(true)
    setSortMode('recommended')
    setParseNotice(null)
    setParsedFields(null)
    setForm(buildFormState(item))
    setModalStep('form')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  useEscapeKey(modalOpen, closeModal)

  function switchToManual() {
    setForm({ ...EMPTY_FORM, url: urlInput.trim() })
    setParsedFields(null)
    setParseNotice(null)
    setModalStep('manual_form')
  }

  function togglePlatform(platform: DeliverableSearchPlatform) {
    setSelectedPlatforms((prev) => (
      prev.includes(platform) ? prev.filter((item) => item !== platform) : [...prev, platform]
    ))
  }

  function toggleKeywordSelection(key: string) {
    setSelectedKeywordKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAllKeywordResults() {
    setSelectedKeywordKeys(new Set(visibleKeywordResults.filter((item) => !item.is_registered).map((item) => item.key)))
  }

  function clearKeywordSelection() {
    setSelectedKeywordKeys(new Set())
  }

  async function handleKeywordSearch() {
    const keyword = keywordInput.trim()
    if (!keyword || selectedPlatforms.length === 0) return

    setKeywordLoading(true)
    setKeywordNotices([])
    setPlatformFilter('all')
    setShowRegistered(true)
    setSortMode('recommended')
    setKeywordResults([])
    setSelectedKeywordKeys(new Set())
    try {
      const res = await fetch(`/api/projects/${projectId}/deliverables/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, platforms: selectedPlatforms }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '검색에 실패했습니다.')
      setKeywordResults(data.results ?? [])
      setKeywordNotices(data.notices ?? [])
    } catch (searchError) {
      setKeywordNotices([searchError instanceof Error ? searchError.message : '검색에 실패했습니다.'])
    } finally {
      setKeywordLoading(false)
    }
  }

  async function applyKeywordResults() {
    const selectedItems = visibleKeywordResults.filter((item) => selectedKeywordKeys.has(item.key) && !item.is_registered)
    if (selectedItems.length === 0) return

    setBulkSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/deliverables/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            platform: item.platform,
            url: item.url,
            title: item.title,
            thumbnail_url: item.thumbnail_url,
            published_at: item.published_at,
            views: item.views,
            likes: item.likes,
            comments: item.comments,
            shares: item.shares,
            memo: `키워드 조회 등록: ${keywordInput.trim()}`,
            last_synced_at: new Date().toISOString(),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '일괄 등록에 실패했습니다.')
      setItems((prev) => [...data, ...prev])
      closeModal()
    } catch (saveError) {
      setKeywordNotices([saveError instanceof Error ? saveError.message : '일괄 등록에 실패했습니다.'])
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleParse() {
    const trimmed = urlInput.trim()
    if (!trimmed) return

    setModalStep('parsing')
    setParseNotice(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/deliverables/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data: ParsedDeliverable = await res.json()

      setForm(buildFormState(data))
      setParsedFields(data.parsed_fields)
      if (data.notice) {
        setParseNotice({
          type: data.parsed_fields.stats ? 'info' : 'warn',
          message: data.notice,
        })
      }
      setModalStep('form')
    } catch (e) {
      setParseNotice({ type: 'warn', message: `파싱 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}` })
      setModalStep('url_input')
    }
  }

  async function handleSave() {
    if (!form.url.trim() || !form.title.trim()) {
      alert('URL과 제목은 필수입니다.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        thumbnail_url: form.thumbnail_url || null,
        published_at: form.published_at || null,
        memo: form.memo || null,
        last_synced_at: new Date().toISOString(),
      }
      if (editingId) {
        const res = await fetch(`/api/projects/${projectId}/deliverables/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const updated = await res.json()
        setItems((prev) => prev.map((d) => (d.id === editingId ? updated : d)))
      } else {
        const res = await fetch(`/api/projects/${projectId}/deliverables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const created = await res.json()
        setItems((prev) => [created, ...prev])
      }
      closeModal()
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('산출물을 삭제할까요?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/projects/${projectId}/deliverables/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      startTransition(() => setItems((prev) => prev.filter((d) => d.id !== id)))
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeletingId(null)
    }
  }

  const grouped = items.reduce<Record<string, Deliverable[]>>((acc, d) => {
    acc[d.platform] = [...(acc[d.platform] ?? []), d]
    return acc
  }, {})
  const groupedEntries = Object.entries(grouped)
    .map(([platform, list]) => [
      platform,
      [...list].sort((a, b) => {
        if (a.published_at && b.published_at) return b.published_at.localeCompare(a.published_at)
        if (a.published_at) return -1
        if (b.published_at) return 1
        return b.created_at.localeCompare(a.created_at)
      }),
    ] as const)
    .sort((a, b) => b[1].length - a[1].length)

  const isFormStep = modalStep === 'form' || modalStep === 'manual_form'
  const selectedKeywordCount = selectedKeywordKeys.size
  const existingKeywordCount = keywordResults.filter((item) => item.is_registered).length
  const newKeywordCount = keywordResults.length - existingKeywordCount
  const totalViews = items.reduce((sum, item) => sum + item.views, 0)
  const totalEngagement = items.reduce((sum, item) => sum + item.likes + item.comments + item.shares, 0)
  const visibleKeywordResults = keywordResults.filter((item) => {
    if (platformFilter !== 'all' && item.platform !== platformFilter) return false
    if (!showRegistered && item.is_registered) return false
    return true
  }).sort((a, b) => {
    if (a.is_registered !== b.is_registered) return Number(a.is_registered) - Number(b.is_registered)
    if (sortMode === 'latest') {
      if (a.published_at && b.published_at) return b.published_at.localeCompare(a.published_at)
      if (a.published_at) return -1
      if (b.published_at) return 1
    }
    if (a.published_at && b.published_at) return b.published_at.localeCompare(a.published_at)
    if (a.published_at) return -1
    if (b.published_at) return 1
    return a.title.localeCompare(b.title, 'ko')
  })

  const modalTitle =
    editingId
      ? '산출물 수정'
      : modalStep === 'select_method'
        ? '산출물 등록 방식 선택'
        : modalStep === 'keyword_search'
          ? '키워드 조회'
          : modalStep === 'url_input' || modalStep === 'parsing'
            ? 'URL 조회'
            : modalStep === 'manual_form'
              ? '수동 등록'
              : '산출물 정보 확인 및 저장'

  const loadingSkeleton = (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <section key={index} className="theme-panel rounded-[28px] border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-6 w-24 rounded-full" />
              <SkeletonBlock className="h-4 w-14" />
            </div>
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <div key={cardIndex} className="theme-panel-soft overflow-hidden rounded-[24px] border">
                  <SkeletonBlock className="aspect-[4/3] w-full" />
                  <div className="space-y-3 p-4">
                    <SkeletonBlock className="h-4 w-20 rounded-full" />
                    <SkeletonBlock className="h-5 w-4/5" />
                    <SkeletonBlock className="h-4 w-3/5" />
                    <div className="grid grid-cols-2 gap-2">
                      <SkeletonBlock className="h-12 rounded-2xl" />
                      <SkeletonBlock className="h-12 rounded-2xl" />
                      <SkeletonBlock className="h-12 rounded-2xl" />
                      <SkeletonBlock className="h-12 rounded-2xl" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="theme-title text-lg font-semibold">산출물 관리</h2>
          <p className="theme-subtle mt-0.5 text-sm">
            키워드 조회, URL 조회, 수동 등록으로 SNS 산출물을 관리합니다.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="theme-panel theme-body theme-hover-surface flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors disabled:opacity-40"
          >
            <RefreshCw className={['h-4 w-4', refreshing ? 'animate-spin' : ''].join(' ')} />
            새로고침
          </button>
          <button
            type="button"
            onClick={async () => {
              setSyncing(true)
              setSyncNote(null)
              try {
                const res = await fetch(`/api/projects/${projectId}/deliverables/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
                const json = await res.json()
                if (json.note) setSyncNote(json.note)
                await fetchData(true)
              } finally {
                setSyncing(false)
              }
            }}
            disabled={syncing || items.length === 0}
            className="theme-panel theme-body theme-hover-surface flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors disabled:opacity-40"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            지표 동기화
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            산출물 등록
          </button>
        </div>
      </div>

      {syncNote && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {syncNote}
        </div>
      )}

      {!loading && items.length > 0 && (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="theme-panel rounded-[28px] border p-5 shadow-sm">
            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">Buzzs</p>
            <p className="theme-title mt-3 text-3xl font-semibold tracking-tight">{items.length}</p>
            <p className="theme-muted mt-2 text-sm">산출물의 Buzz량입니다.</p>
          </div>
          <div className="theme-panel rounded-[28px] border p-5 shadow-sm">
            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">Views</p>
            <p className="theme-title mt-3 text-3xl font-semibold tracking-tight">{formatNum(totalViews)}</p>
            <p className="theme-muted mt-2 text-sm">전체 산출물의 누적 조회 규모입니다.</p>
          </div>
          <div className="theme-panel rounded-[28px] border p-5 shadow-sm">
            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">Engagement</p>
            <p className="theme-title mt-3 text-3xl font-semibold tracking-tight">{formatNum(totalEngagement)}</p>
            <p className="theme-muted mt-2 text-sm">좋아요, 댓글, 공유를 합산한 전체 반응량입니다.</p>
          </div>
        </section>
      )}

      {loading && loadingSkeleton}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && items.length === 0 && (
        <div className="theme-panel flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-12 text-center sm:py-24">
          <Share2 className="mb-4 h-12 w-12 text-gray-300" />
          <p className="theme-muted text-base font-medium">등록된 산출물이 없습니다.</p>
          <p className="theme-subtle mt-1 text-sm">키워드 조회나 URL 조회로 첫 산출물을 등록해보세요.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            <Plus className="h-4 w-4" />
            첫 산출물 등록
          </button>
        </div>
      )}

      {!loading && groupedEntries.map(([platform, list]) => {
        const resolvedPlatform = resolvePlatform(platform)
        const platformCardStyle = PLATFORM_CARD_STYLES[resolvedPlatform]

        return (
          <section key={platform} className="theme-panel overflow-hidden rounded-[30px] border shadow-sm">
            <div className={`h-1.5 w-full bg-gradient-to-r ${platformCardStyle.chip}`} />
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PLATFORM_COLORS[resolvedPlatform]}`}>
                  {PLATFORM_LABELS[resolvedPlatform]}
                </span>
                <span className="theme-subtle text-sm">{list.length}개</span>
              </div>
              <p className="theme-muted text-xs">최신 등록순 3열 카드 갤러리</p>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((d) => (
                <article
                  key={d.id}
                  className="theme-panel-soft group relative overflow-hidden rounded-[26px] border shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-xl"
                >
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${platformCardStyle.glow}`} />

                  <div className="relative aspect-[4/3] overflow-hidden">
                    {d.thumbnail_url ? (
                      <Image
                        src={d.thumbnail_url}
                        alt={d.title}
                        fill
                        sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw"
                        unoptimized
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="theme-panel flex h-full w-full items-center justify-center">
                        <Share2 className="h-10 w-10 text-gray-300" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <span className={`inline-flex rounded-full bg-gradient-to-r px-3 py-1 text-[11px] font-semibold text-white shadow-sm ${platformCardStyle.chip}`}>
                          {PLATFORM_LABELS[resolvedPlatform]}
                        </span>
                        <p className="mt-2 truncate text-xs text-white/80">{getHostnameLabel(d.url)}</p>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-black/35 p-1 text-white backdrop-blur-sm">
                        <button
                          type="button"
                          onClick={() => openEdit(d)}
                          className="rounded-full p-2 hover:bg-white/15"
                          title="수정"
                          aria-label="산출물 수정"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          disabled={deletingId === d.id}
                          className="rounded-full p-2 hover:bg-white/15 disabled:opacity-40"
                          title="삭제"
                          aria-label="산출물 삭제"
                        >
                          {deletingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="theme-muted text-xs">{formatDate(d.published_at)}</span>
                        <span className="theme-subtle text-[11px]">Sync {formatSyncTime(d.last_synced_at)}</span>
                      </div>
                      <h3 className="theme-title mt-2 line-clamp-2 text-base font-semibold leading-snug">{d.title}</h3>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="theme-muted mt-2 inline-flex max-w-full items-center gap-1 text-xs hover:text-gray-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{d.url}</span>
                      </a>
                      {d.memo && <p className="theme-subtle mt-2 line-clamp-2 text-xs">{d.memo}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'views', icon: Eye, label: '조회수', value: formatNum(d.views) },
                        { id: 'likes', icon: Heart, label: '좋아요', value: formatNum(d.likes) },
                        { id: 'comments', icon: MessageCircle, label: '댓글', value: formatNum(d.comments) },
                        { id: 'shares', icon: Share2, label: '공유', value: formatNum(d.shares) },
                      ].map(({ id, icon: Icon, label, value }) => (
                        <div key={id} className="theme-panel rounded-2xl border px-3 py-2.5">
                          <div className="theme-muted flex items-center gap-1.5 text-[11px] font-medium">
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </div>
                          <p className="theme-title mt-1 text-sm font-semibold">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="theme-panel flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl">
            <div className="theme-divider flex items-center justify-between border-b px-6 py-4">
              <h3 className="theme-title text-base font-semibold">{modalTitle}</h3>
              <button type="button" onClick={closeModal} className="theme-subtle theme-hover-surface rounded-lg p-1.5">
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalStep === 'select_method' && (
              <div className="overflow-y-auto px-6 py-6">
                <p className="theme-muted text-sm">등록 방식을 선택하면 그에 맞는 입력 흐름으로 이동합니다.</p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setModalStep('keyword_search')}
                    className="theme-panel theme-hover-surface rounded-2xl border p-5 text-left transition-colors hover:border-gray-300"
                  >
                    <Search className="theme-title h-5 w-5" />
                    <p className="theme-title mt-4 text-sm font-semibold">키워드 조회</p>
                    <p className="theme-muted mt-1 text-xs leading-5">키워드로 채널별 게시물을 검색하고, 선택한 결과를 일괄 등록합니다.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStep('url_input')}
                    className="theme-panel theme-hover-surface rounded-2xl border p-5 text-left transition-colors hover:border-gray-300"
                  >
                    <LinkIcon className="theme-title h-5 w-5" />
                    <p className="theme-title mt-4 text-sm font-semibold">URL 조회</p>
                    <p className="theme-muted mt-1 text-xs leading-5">기존처럼 URL 하나를 붙여넣어 메타데이터와 지표를 자동 파싱합니다.</p>
                  </button>
                  <button
                    type="button"
                    onClick={switchToManual}
                    className="theme-panel theme-hover-surface rounded-2xl border p-5 text-left transition-colors hover:border-gray-300"
                  >
                    <PencilLine className="theme-title h-5 w-5" />
                    <p className="theme-title mt-4 text-sm font-semibold">수동 등록</p>
                    <p className="theme-muted mt-1 text-xs leading-5">URL 없이 제목, 썸네일, 지표를 직접 입력해서 바로 등록합니다.</p>
                  </button>
                </div>
              </div>
            )}

            {modalStep === 'keyword_search' && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm text-gray-500">키워드를 입력하고 YouTube 또는 Instagram을 선택하면 관련 게시물 후보를 검색합니다. Instagram은 일반 키워드는 웹 검색, `#해시태그`는 공식 API를 우선 사용합니다.</p>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={keywordInput}
                          onChange={(event) => setKeywordInput(event.target.value)}
                          onKeyDown={(event) => event.key === 'Enter' && handleKeywordSearch()}
                          placeholder="예) 클래시스 신제품 캠페인 또는 #클래시스"
                          className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleKeywordSearch}
                        disabled={!keywordInput.trim() || selectedPlatforms.length === 0 || keywordLoading}
                        className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
                      >
                        {keywordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        검색
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {SEARCHABLE_PLATFORMS.map((platform) => {
                        const active = selectedPlatforms.includes(platform)
                        return (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => togglePlatform(platform)}
                            className={[
                              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                              active ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                            ].join(' ')}
                          >
                            {PLATFORM_LABELS[platform]}
                          </button>
                        )
                      })}
                    </div>

                    {keywordNotices.length > 0 && (
                      <div className="space-y-2">
                        {keywordNotices.map((notice) => (
                          <div key={notice} className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            {notice}
                          </div>
                        ))}
                      </div>
                    )}

                    {keywordResults.length > 0 && (
                      <>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="rounded-full bg-white px-3 py-1 font-medium text-gray-700">전체 {keywordResults.length}건</span>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">신규 {newKeywordCount}건</span>
                            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">기등록 {existingKeywordCount}건</span>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                              <Filter className="h-3.5 w-3.5" />
                              플랫폼
                              <select
                                value={platformFilter}
                                onChange={(event) => setPlatformFilter(event.target.value as 'all' | DeliverableSearchPlatform)}
                                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
                              >
                                <option value="all">전체</option>
                                {SEARCHABLE_PLATFORMS.map((platform) => (
                                  <option key={platform} value={platform}>{PLATFORM_LABELS[platform]}</option>
                                ))}
                              </select>
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={showRegistered}
                                onChange={(event) => setShowRegistered(event.target.checked)}
                                className="h-4 w-4 rounded accent-gray-900"
                              />
                              이미 등록된 결과도 보기
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                              정렬
                              <select
                                value={sortMode}
                                onChange={(event) => setSortMode(event.target.value as 'recommended' | 'latest')}
                                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
                              >
                                <option value="recommended">추천순</option>
                                <option value="latest">최신순</option>
                              </select>
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700">표시 결과 {visibleKeywordResults.length}건</p>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={selectAllKeywordResults} className="text-xs text-gray-400 hover:text-gray-600">
                              신규만 전체 선택
                            </button>
                            <button type="button" onClick={clearKeywordSelection} className="text-xs text-gray-400 hover:text-gray-600">
                              선택 해제
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2">
                          {visibleKeywordResults.map((item) => {
                            const checked = selectedKeywordKeys.has(item.key)
                            return (
                              <label
                                key={item.key}
                                className={[
                                  'flex cursor-pointer gap-4 rounded-2xl border p-4 transition-colors',
                                  item.is_registered
                                    ? 'border-amber-200 bg-amber-50/60'
                                    : checked
                                      ? 'border-gray-900 bg-gray-50'
                                      : 'border-gray-200 bg-white hover:border-gray-300',
                                ].join(' ')}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleKeywordSelection(item.key)}
                                  disabled={item.is_registered}
                                  className="mt-1 h-4 w-4 rounded accent-gray-900"
                                />
                                {item.thumbnail_url ? (
                                  <Image
                                    src={item.thumbnail_url}
                                    alt={item.title}
                                    width={96}
                                    height={64}
                                    unoptimized
                                    className="h-16 w-24 shrink-0 rounded-xl object-cover"
                                  />
                                ) : (
                                  <div className="h-16 w-24 shrink-0 rounded-xl bg-gray-100" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLATFORM_COLORS[item.platform]}`}>
                                      {PLATFORM_LABELS[item.platform]}
                                    </span>
                                    {item.is_registered && (
                                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                                        이미 등록됨
                                      </span>
                                    )}
                                    {getMediaTypeLabel(item) && (
                                      <span className="rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-semibold text-pink-700">
                                        {getMediaTypeLabel(item)}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-400">{formatDate(item.published_at)}</span>
                                  </div>
                                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">{item.title}</p>
                                  <p className="mt-1 truncate text-xs text-gray-400">{item.url}</p>
                                  {item.channel_name && (
                                    <p className="mt-1 text-xs text-gray-500">채널 {item.channel_name}</p>
                                  )}
                                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                    <span>조회 {formatNum(item.views)}</span>
                                    <span>좋아요 {formatNum(item.likes)}</span>
                                    <span>댓글 {formatNum(item.comments)}</span>
                                    <span>공유 {formatNum(item.shares)}</span>
                                  </div>
                                  {item.notice && (
                                    <p className="mt-2 text-xs text-amber-600">{item.notice}</p>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </>
                    )}

                    {keywordResults.length > 0 && visibleKeywordResults.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        현재 필터 조건에 맞는 결과가 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setModalStep('select_method')}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={applyKeywordResults}
                    disabled={selectedKeywordCount === 0 || bulkSaving}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {bulkSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    선택 결과 {selectedKeywordCount}건 적용
                  </button>
                </div>
              </>
            )}

            {(modalStep === 'url_input' || modalStep === 'parsing') && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                  <p className="text-sm text-gray-500">
                    게시물 URL을 붙여넣으면 SNS API와 메타데이터를 통해 제목, 썸네일, 지표를 자동으로 가져옵니다.
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    {[
                      { label: 'YouTube', color: 'bg-red-50 text-red-600', stats: '완전 자동' },
                      { label: 'Instagram', color: 'bg-pink-50 text-pink-600', stats: '기본 파싱' },
                      { label: 'TikTok', color: 'bg-gray-100 text-gray-600', stats: '기본 파싱' },
                      { label: 'Facebook', color: 'bg-blue-50 text-blue-600', stats: 'OG 파싱' },
                      { label: 'Twitter/X', color: 'bg-sky-50 text-sky-600', stats: 'OG 파싱' },
                      { label: '기타 URL', color: 'bg-gray-50 text-gray-500', stats: 'OG 파싱' },
                    ].map((platform) => (
                      <div key={platform.label} className={`rounded-xl px-3 py-2 ${platform.color}`}>
                        <p className="font-semibold">{platform.label}</p>
                        <p className="mt-0.5 opacity-70">{platform.stats}</p>
                      </div>
                    ))}
                  </div>

                  <div className="relative">
                    <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(event) => setUrlInput(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleParse()}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                      autoFocus
                      disabled={modalStep === 'parsing'}
                    />
                  </div>

                  {parseNotice && (
                    <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${parseNotice.type === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {parseNotice.message}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModalStep('select_method')}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      이전
                    </button>
                    <button
                      type="button"
                      onClick={switchToManual}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                      수동 등록
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleParse}
                    disabled={!urlInput.trim() || modalStep === 'parsing'}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
                  >
                    {modalStep === 'parsing' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        파싱 중...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        URL 조회
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {isFormStep && (
              <>
                {parsedFields && !editingId && (
                  <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="font-semibold text-gray-500">자동 파싱 결과</span>
                      {[
                        { label: '제목', ok: parsedFields.title },
                        { label: '썸네일', ok: parsedFields.thumbnail },
                        { label: '지표', ok: parsedFields.stats },
                        { label: '날짜', ok: parsedFields.published_at },
                      ].map((field) => (
                        <span key={field.label} className={`flex items-center gap-1 ${field.ok ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {field.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          {field.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {parseNotice && (
                  <div className={`flex items-start gap-2 border-b border-gray-100 px-6 py-3 text-xs ${parseNotice.type === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {parseNotice.message}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">플랫폼</label>
                    <select
                      value={form.platform}
                      onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value as Platform }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                    >
                      {Object.entries(PLATFORM_LABELS).map(([key, value]) => (
                        <option key={key} value={key}>{value}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">URL *</label>
                    <input
                      type="url"
                      value={form.url}
                      onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                      제목 *
                      {parsedFields?.title && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="게시물 제목"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                      썸네일 URL
                      {parsedFields?.thumbnail && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </label>
                    <div className="flex gap-3">
                      {form.thumbnail_url && (
                        <Image
                          src={form.thumbnail_url}
                          alt="thumbnail"
                          width={80}
                          height={56}
                          unoptimized
                          className="h-14 w-20 shrink-0 rounded-xl border border-gray-200 object-cover"
                        />
                      )}
                      <input
                        type="url"
                        value={form.thumbnail_url}
                        onChange={(event) => setForm((current) => ({ ...current, thumbnail_url: event.target.value }))}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                      게시일
                      {parsedFields?.published_at && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </label>
                    <DatePickerInput
                      value={form.published_at}
                      onChange={(next) => setForm((current) => ({ ...current, published_at: next }))}
                      placeholder="게시일 선택"
                    />
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      인게이지먼트 지표
                      {parsedFields?.stats && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                      {parsedFields && !parsedFields.stats && (
                        <span className="font-normal normal-case text-amber-500">수동 입력 필요</span>
                      )}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { key: 'views', label: '조회수' },
                        { key: 'likes', label: '좋아요' },
                        { key: 'comments', label: '댓글' },
                        { key: 'shares', label: '공유' },
                      ] as const).map(({ key, label }) => (
                        <div key={key}>
                          <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
                          <input
                            type="number"
                            min={0}
                            value={form[key]}
                            onChange={(event) => setForm((current) => ({ ...current, [key]: Number(event.target.value) }))}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">메모</label>
                    <textarea
                      value={form.memo}
                      onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
                      rows={3}
                      placeholder="특이사항 등 자유 입력"
                      className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between gap-2 border-t border-gray-100 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setModalStep(editingId ? 'form' : 'select_method')}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {editingId ? '취소' : '이전'}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      닫기
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {editingId ? '수정 완료' : '등록'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
