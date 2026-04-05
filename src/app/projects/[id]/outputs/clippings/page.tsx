'use client'

import { useEffect, useState, useCallback, useTransition, useRef } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import {
  AlertCircle,
  CheckSquare,
  Edit2,
  ExternalLink,
  Filter,
  Loader2,
  Newspaper,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { HeaderSkeleton, SectionSkeleton, SkeletonBlock } from '@/components/common/LoadingSkeleton'
import type { ParsedClipping } from '@/features/clippings/types'

interface Clipping {
  id: string
  project_id: string
  title: string
  url: string
  source: string | null
  published_at: string | null
  description: string | null
  thumbnail_url: string | null
  created_at: string
}

interface KeywordSearchResult extends ParsedClipping {
  key: string
  domain: string | null
  is_registered: boolean
  matched_query: string
  is_major_media: boolean
  source_priority: number
}

type ModalStep = 'select_method' | 'keyword_search' | 'manual_form'

const CACHE_TTL_MS = 60 * 60 * 1000

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d))
}

const EMPTY_FORM = {
  title: '',
  url: '',
  source: '',
  published_at: '',
  description: '',
  thumbnail_url: '',
}

export default function ClippingsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const [items, setItems] = useState<Clipping[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastFetchedAt = useRef<number | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<ModalStep>('select_method')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [keywordInput, setKeywordInput] = useState('')
  const [keywordResults, setKeywordResults] = useState<KeywordSearchResult[]>([])
  const [selectedKeywordKeys, setSelectedKeywordKeys] = useState<Set<string>>(new Set())
  const [keywordNotices, setKeywordNotices] = useState<string[]>([])
  const [keywordLoading, setKeywordLoading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [showRegistered, setShowRegistered] = useState(true)
  const [majorOnly, setMajorOnly] = useState(false)
  const [dateFromFilter, setDateFromFilter] = useState('')
  const [dateToFilter, setDateToFilter] = useState('')
  const [sortMode, setSortMode] = useState<'recommended' | 'latest'>('recommended')
  const [bulkSaving, setBulkSaving] = useState(false)
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
      const res = await fetch(`/api/projects/${projectId}/clippings`)
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.')
      setItems(await res.json())
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
    setForm(EMPTY_FORM)
    setKeywordInput('')
    setKeywordResults([])
    setSelectedKeywordKeys(new Set())
    setKeywordNotices([])
    setSourceFilter('all')
    setShowRegistered(true)
    setMajorOnly(false)
    setDateFromFilter('')
    setDateToFilter('')
    setSortMode('recommended')
    setModalStep('select_method')
  }

  function openCreate() {
    setEditingId(null)
    resetCreateState()
    setModalOpen(true)
  }

  function openEdit(item: Clipping) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      url: item.url,
      source: item.source ?? '',
      published_at: item.published_at ?? '',
      description: item.description ?? '',
      thumbnail_url: item.thumbnail_url ?? '',
    })
    setKeywordInput('')
    setKeywordResults([])
    setSelectedKeywordKeys(new Set())
    setKeywordNotices([])
    setSourceFilter('all')
    setShowRegistered(true)
    setMajorOnly(false)
    setDateFromFilter('')
    setDateToFilter('')
    setSortMode('recommended')
    setModalStep('manual_form')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
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
    if (!keyword) return

    setKeywordLoading(true)
    setKeywordResults([])
    setSelectedKeywordKeys(new Set())
    setKeywordNotices([])
    setSourceFilter('all')
    setShowRegistered(true)
    setMajorOnly(false)
    setDateFromFilter('')
    setDateToFilter('')
    setSortMode('recommended')
    try {
      const res = await fetch(`/api/projects/${projectId}/clippings/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
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
      const res = await fetch(`/api/projects/${projectId}/clippings/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            title: item.title,
            url: item.url,
            source: item.source,
            published_at: item.published_at,
            description: item.description,
            thumbnail_url: item.thumbnail_url,
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

  async function handleSave() {
    if (!form.url.trim() || !form.title.trim()) {
      alert('URL과 제목은 필수입니다.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        source: form.source || null,
        published_at: form.published_at || null,
        description: form.description || null,
        thumbnail_url: form.thumbnail_url || null,
      }
      if (editingId) {
        const res = await fetch(`/api/projects/${projectId}/clippings/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        const updated = await res.json()
        setItems((prev) => prev.map((c) => (c.id === editingId ? updated : c)))
      } else {
        const res = await fetch(`/api/projects/${projectId}/clippings`, {
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
    if (!window.confirm('클리핑을 삭제할까요?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/projects/${projectId}/clippings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
      startTransition(() => setItems((prev) => prev.filter((c) => c.id !== id)))
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeletingId(null)
    }
  }

  const selectedKeywordCount = selectedKeywordKeys.size
  const sourceOptions = Array.from(
    new Set(
      keywordResults
        .map((item) => item.source || item.domain)
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b, 'ko'))
  const visibleKeywordResults = keywordResults.filter((item) => {
    const sourceValue = item.source || item.domain || ''
    if (sourceFilter !== 'all' && sourceValue !== sourceFilter) return false
    if (!showRegistered && item.is_registered) return false
    if (majorOnly && !item.is_major_media) return false
    if (dateFromFilter && (!item.published_at || item.published_at < dateFromFilter)) return false
    if (dateToFilter && (!item.published_at || item.published_at > dateToFilter)) return false
    return true
  }).sort((a, b) => {
    if (sortMode === 'latest') {
      if (a.published_at && b.published_at) return b.published_at.localeCompare(a.published_at)
      if (a.published_at) return -1
      if (b.published_at) return 1
    }

    if (a.is_registered !== b.is_registered) return Number(a.is_registered) - Number(b.is_registered)
    if (a.is_major_media !== b.is_major_media) return Number(b.is_major_media) - Number(a.is_major_media)
    if (a.source_priority !== b.source_priority) return b.source_priority - a.source_priority
    if (a.published_at && b.published_at) return b.published_at.localeCompare(a.published_at)
    if (a.published_at) return -1
    if (b.published_at) return 1
    return a.title.localeCompare(b.title, 'ko')
  })

  const loadingSkeleton = (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <SkeletonBlock className="mt-1 h-6 w-6 rounded-full" />
              <SkeletonBlock className="h-14 w-20 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <SkeletonBlock className="h-5 w-16 rounded-full" />
                  <SkeletonBlock className="h-4 w-24" />
                </div>
                <SkeletonBlock className="h-5 w-4/5" />
                <SkeletonBlock className="h-4 w-3/5" />
                <SkeletonBlock className="h-4 w-full" />
              </div>
              <div className="flex gap-2">
                <SkeletonBlock className="h-9 w-9 rounded-lg" />
                <SkeletonBlock className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <SectionSkeleton titleWidth="w-44" lines={4} />
    </div>
  )
  const existingKeywordCount = keywordResults.filter((item) => item.is_registered).length
  const newKeywordCount = keywordResults.length - existingKeywordCount
  const majorKeywordCount = keywordResults.filter((item) => item.is_major_media).length
  const modalTitle =
    editingId
      ? '클리핑 수정'
      : modalStep === 'select_method'
        ? '클리핑 등록 방식 선택'
        : modalStep === 'keyword_search'
          ? '키워드로 보도자료 조회'
          : '클리핑 수동 등록'

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">보도자료 클리핑</h2>
          <p className="mt-0.5 text-sm text-gray-400">언론 기사, 외부 리뷰 등 미디어 노출 내역을 아카이빙합니다.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw className={['h-4 w-4', refreshing ? 'animate-spin' : ''].join(' ')} />
            새로고침
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            클리핑 등록
          </button>
        </div>
      </div>

      {loading && loadingSkeleton}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 text-center">
          <Newspaper className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-base font-medium text-gray-500">등록된 클리핑이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-400">키워드 조회로 관련 보도자료를 찾거나 수동 등록으로 아카이빙하세요.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            <Plus className="h-4 w-4" />
            첫 클리핑 등록
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="group flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md sm:flex-row sm:items-start sm:p-5"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                {idx + 1}
              </span>

              <div className="flex min-w-0 flex-1 gap-4">
                {item.thumbnail_url ? (
                  <Image
                    src={item.thumbnail_url}
                    alt={item.title}
                    width={80}
                    height={56}
                    unoptimized
                    className="h-14 w-20 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    <Newspaper className="h-5 w-5 text-gray-300" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.source && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                        {item.source}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(item.published_at)}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-start gap-1.5 font-semibold text-gray-900 hover:text-gray-600"
                  >
                    {item.title}
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  </a>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-400">{item.description}</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 self-end opacity-100 transition-opacity sm:self-auto sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  {deletingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setModalStep('keyword_search')}
                    className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <Search className="h-5 w-5 text-gray-900" />
                    <p className="mt-4 text-sm font-semibold text-gray-900">키워드 조회</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">키워드 기반으로 관련 보도자료를 조회하고, 선택한 기사들을 일괄 등록합니다.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStep('manual_form')}
                    className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <PencilLine className="h-5 w-5 text-gray-900" />
                    <p className="mt-4 text-sm font-semibold text-gray-900">수동 등록</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">기사 URL, 제목, 출처를 직접 입력해서 수동으로 등록합니다.</p>
                  </button>
                </div>
              </div>
            )}

            {modalStep === 'keyword_search' && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="space-y-5">
                    <p className="text-sm text-gray-500">프로젝트나 브랜드 키워드를 입력하면 관련 보도자료 후보를 먼저 조회합니다.</p>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={keywordInput}
                          onChange={(event) => setKeywordInput(event.target.value)}
                          onKeyDown={(event) => event.key === 'Enter' && handleKeywordSearch()}
                          placeholder="예) 클래시스 신제품 캠페인"
                          className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleKeywordSearch}
                        disabled={!keywordInput.trim() || keywordLoading}
                        className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
                      >
                        {keywordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        검색
                      </button>
                    </div>

                    {keywordResults.length > 0 && (
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="rounded-full bg-white px-3 py-1 font-medium text-gray-700">전체 {keywordResults.length}건</span>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">신규 후보 {newKeywordCount}건</span>
                          <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">기등록 {existingKeywordCount}건</span>
                          <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">주요 매체 {majorKeywordCount}건</span>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-[auto,1fr] lg:items-start">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Filter className="h-3.5 w-3.5" />
                            결과 필터
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={showRegistered}
                                onChange={(event) => setShowRegistered(event.target.checked)}
                                className="h-4 w-4 rounded accent-gray-900"
                              />
                              이미 등록된 기사도 보기
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={majorOnly}
                                onChange={(event) => setMajorOnly(event.target.checked)}
                                className="h-4 w-4 rounded accent-gray-900"
                              />
                              주요 매체만 보기
                            </label>
                            <select
                              value={sourceFilter}
                              onChange={(event) => setSourceFilter(event.target.value)}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
                            >
                              <option value="all">언론사/도메인 전체</option>
                              {sourceOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={dateFromFilter}
                              onChange={(event) => setDateFromFilter(event.target.value)}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
                            />
                            <input
                              type="date"
                              value={dateToFilter}
                              onChange={(event) => setDateToFilter(event.target.value)}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
                            />
                            <select
                              value={sortMode}
                              onChange={(event) => setSortMode(event.target.value as 'recommended' | 'latest')}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
                            >
                              <option value="recommended">추천순</option>
                              <option value="latest">최신순</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

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

                    {visibleKeywordResults.length > 0 && (
                      <>
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

                        <div className="grid gap-3">
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
                                <div className="pt-0.5 text-gray-500">
                                  {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleKeywordSelection(item.key)}
                                  disabled={item.is_registered}
                                  className="sr-only"
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
                                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                                    <Newspaper className="h-5 w-5 text-gray-300" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {(item.source || item.domain) && (
                                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                                        {item.source || item.domain}
                                      </span>
                                    )}
                                    {item.is_registered && (
                                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                                        이미 등록됨
                                      </span>
                                    )}
                                    {item.is_major_media && (
                                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                                        주요 매체
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-400">{formatDate(item.published_at)}</span>
                                  </div>
                                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">{item.title}</p>
                                  <p className="mt-1 truncate text-xs text-gray-400">{item.url}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                                    {item.domain && <span>도메인 {item.domain}</span>}
                                    <span>우선순위 {item.source_priority}</span>
                                    <span>검색어 {item.matched_query}</span>
                                  </div>
                                  {item.description && (
                                    <p className="mt-2 line-clamp-2 text-xs text-gray-500">{item.description}</p>
                                  )}
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

            {modalStep === 'manual_form' && (
              <>
                <div className="max-h-[70vh] overflow-y-auto space-y-4 px-6 py-5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">제목 *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="클래시스, 신제품 캠페인 성료"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">URL *</label>
                    <input
                      type="url"
                      value={form.url}
                      onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-500">언론사 / 출처</label>
                      <input
                        type="text"
                        value={form.source}
                        onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                        placeholder="경제신문"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-500">게재일</label>
                      <input
                        type="date"
                        value={form.published_at}
                        onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">썸네일 URL</label>
                    <input
                      type="url"
                      value={form.thumbnail_url}
                      onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">요약 설명</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={3}
                      placeholder="기사 요약 또는 메모"
                      className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between gap-2 border-t border-gray-100 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setModalStep(editingId ? 'manual_form' : 'select_method')}
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
