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
import { HeaderSkeleton, SectionSkeleton, SkeletonBlock } from '@/components/common/LoadingSkeleton'
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

  const isFormStep = modalStep === 'form' || modalStep === 'manual_form'
  const selectedKeywordCount = selectedKeywordKeys.size
  const existingKeywordCount = keywordResults.filter((item) => item.is_registered).length
  const newKeywordCount = keywordResults.length - existingKeywordCount
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
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <SkeletonBlock className="h-5 w-20 rounded-full" />
          <SkeletonBlock className="h-4 w-12" />
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[96px,1.6fr,0.8fr,repeat(5,minmax(56px,0.5fr))] items-center gap-4">
              <SkeletonBlock className="h-12 w-20 rounded-lg" />
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-4/5" />
                <SkeletonBlock className="h-3 w-3/5" />
              </div>
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-4 w-12" />
              <SkeletonBlock className="h-4 w-12" />
              <SkeletonBlock className="h-4 w-12" />
              <SkeletonBlock className="h-4 w-12" />
              <SkeletonBlock className="h-4 w-16" />
            </div>
          ))}
        </div>
      </section>
      <SectionSkeleton titleWidth="w-48" lines={4} />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">산출물 관리</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            키워드 조회, URL 조회, 수동 등록으로 SNS 산출물을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw className={['h-4 w-4', refreshing ? 'animate-spin' : ''].join(' ')} />
            새로고침
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            산출물 등록
          </button>
        </div>
      </div>

      {loading && loadingSkeleton}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 text-center">
          <Share2 className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-base font-medium text-gray-500">등록된 산출물이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-400">키워드 조회나 URL 조회로 첫 산출물을 등록해보세요.</p>
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

      {!loading && Object.entries(grouped).map(([platform, list]) => (
        <section key={platform} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLATFORM_COLORS[platform as Platform]}`}>
              {PLATFORM_LABELS[platform as Platform]}
            </span>
            <span className="text-sm text-gray-400">{list.length}건</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 text-left">썸네일</th>
                  <th className="px-4 py-3 text-left">제목 / URL</th>
                  <th className="px-4 py-3 text-center">게시일</th>
                  <th className="px-4 py-3 text-center"><Eye className="inline h-3.5 w-3.5" /></th>
                  <th className="px-4 py-3 text-center"><Heart className="inline h-3.5 w-3.5" /></th>
                  <th className="px-4 py-3 text-center"><MessageCircle className="inline h-3.5 w-3.5" /></th>
                  <th className="px-4 py-3 text-center"><Share2 className="inline h-3.5 w-3.5" /></th>
                  <th className="px-4 py-3 text-center">동기화</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((d) => (
                  <tr key={d.id} className="group hover:bg-gray-50">
                    <td className="px-5 py-3">
                      {d.thumbnail_url ? (
                        <Image
                          src={d.thumbnail_url}
                          alt={d.title}
                          width={80}
                          height={48}
                          unoptimized
                          className="h-12 w-20 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-20 rounded-lg bg-gray-100" />
                      )}
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate font-medium text-gray-900">{d.title}</p>
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-xs text-gray-400 hover:text-gray-600">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {d.url}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{formatDate(d.published_at)}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">{formatNum(d.views)}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">{formatNum(d.likes)}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">{formatNum(d.comments)}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-700">{formatNum(d.shares)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-xs text-gray-400">{formatSyncTime(d.last_synced_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => openEdit(d)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="수정">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          disabled={deletingId === d.id}
                          className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                          title="삭제"
                        >
                          {deletingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">{modalTitle}</h3>
              <button type="button" onClick={closeModal} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalStep === 'select_method' && (
              <div className="overflow-y-auto px-6 py-6">
                <p className="text-sm text-gray-500">등록 방식을 선택하면 그에 맞는 입력 흐름으로 이동합니다.</p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setModalStep('keyword_search')}
                    className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <Search className="h-5 w-5 text-gray-900" />
                    <p className="mt-4 text-sm font-semibold text-gray-900">키워드 조회</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">키워드로 채널별 게시물을 검색하고, 선택한 결과를 일괄 등록합니다.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStep('url_input')}
                    className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <LinkIcon className="h-5 w-5 text-gray-900" />
                    <p className="mt-4 text-sm font-semibold text-gray-900">URL 조회</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">기존처럼 URL 하나를 붙여넣어 메타데이터와 지표를 자동 파싱합니다.</p>
                  </button>
                  <button
                    type="button"
                    onClick={switchToManual}
                    className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <PencilLine className="h-5 w-5 text-gray-900" />
                    <p className="mt-4 text-sm font-semibold text-gray-900">수동 등록</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">URL 없이 제목, 썸네일, 지표를 직접 입력해서 바로 등록합니다.</p>
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
                    <input
                      type="date"
                      value={form.published_at}
                      onChange={(event) => setForm((current) => ({ ...current, published_at: event.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
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
