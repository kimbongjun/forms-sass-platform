'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarRange,
  Copy,
  DollarSign,
  FileText,
  Globe,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { resolveCountryFlag, resolveCountryLabel } from '@/constants/countries'
import { COUNTRY_OPTIONS } from '@/constants/countries'
import { formatNumberWithCommas } from '@/utils/money'

interface Project {
  id: string
  title: string
  slug: string
  created_at: string
  is_published: boolean
  category: string | null
  start_date: string | null
  end_date: string | null
  budget: number | null
  country: string | null
  memberCount: number
  formCount: number
  ownerName: string | null
  memberNames: string[]
}

interface ProjectListProps {
  projects: Project[]
}

const CATEGORY_COLORS: Record<string, string> = {
  'PR': 'bg-blue-100 text-blue-700',
  '디지털 마케팅': 'bg-violet-100 text-violet-700',
  '바이럴': 'bg-pink-100 text-pink-700',
  'HCP 마케팅': 'bg-emerald-100 text-emerald-700',
  'B2B 마케팅': 'bg-amber-100 text-amber-700',
}

function formatDateShort(d: string | null) {
  if (!d) return null
  return new Intl.DateTimeFormat('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' }).format(new Date(d))
}

export default function ProjectList({ projects }: ProjectListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  // 필터 상태
  const [filterTitle, setFilterTitle] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterMemberName, setFilterMemberName] = useState('')

  const categoryOptions = useMemo(
    () => Array.from(new Set(projects.map((project) => project.category).filter(Boolean) as string[])).sort(),
    [projects]
  )

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filterTitle && !p.title.toLowerCase().includes(filterTitle.toLowerCase())) return false
      if (filterCategory && p.category !== filterCategory) return false
      if (filterCountry && p.country !== filterCountry) return false
      if (filterDateFrom) {
        if (!p.start_date && !p.end_date) return false
        if (p.end_date && p.end_date < filterDateFrom) return false
      }
      if (filterDateTo) {
        if (!p.start_date && !p.end_date) return false
        if (p.start_date && p.start_date > filterDateTo) return false
      }
      if (filterMemberName) {
        const q = filterMemberName.toLowerCase()
        const match = p.memberNames.some((n) => n.toLowerCase().includes(q))
        if (!match) return false
      }
      return true
    })
  }, [projects, filterTitle, filterCategory, filterCountry, filterDateFrom, filterDateTo, filterMemberName])

  const hasFilter = filterTitle || filterCategory || filterCountry || filterDateFrom || filterDateTo || filterMemberName

  function clearFilters() {
    setFilterTitle('')
    setFilterCategory('')
    setFilterCountry('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterMemberName('')
  }

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))
  const visibleSelectedIds = filtered.filter((project) => selected.has(project.id)).map((project) => project.id)
  const visibleSelectedCount = visibleSelectedIds.length

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((p) => next.delete(p.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((p) => next.add(p.id))
        return next
      })
    }
  }

  async function deleteProjects(ids: string[]) {
    const supabase = createClient()
    setDeletingIds(new Set(ids))
    try {
      const { error } = await supabase.from('projects').delete().in('id', ids)
      if (error) throw error
      setSelected((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
      startTransition(() => router.refresh())
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingIds(new Set())
    }
  }

  async function handleDeleteOne(id: string, title: string) {
    if (!window.confirm(`'${title}' 프로젝트를 삭제하시겠습니까?\n\n연결된 데이터도 함께 삭제됩니다.`)) return
    await deleteProjects([id])
  }

  async function handleBulkDelete() {
    await deleteProjects(visibleSelectedIds)
    setConfirmBulk(false)
  }

  async function handleDuplicate(id: string) {
    setDuplicatingId(id)
    try {
      const res = await fetch('/api/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      startTransition(() => router.refresh())
    } catch (err) {
      alert(err instanceof Error ? err.message : '복제에 실패했습니다.')
    } finally {
      setDuplicatingId(null)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 text-center">
        <FileText className="mb-4 h-12 w-12 text-gray-300" />
        <p className="text-base font-medium text-gray-500">아직 프로젝트가 없습니다.</p>
        <p className="mt-1 text-sm text-gray-400">Project Wizard로 새 프로젝트를 시작해 보세요.</p>
        <Link
          href="/projects/new"
          className="mt-6 flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" />
          첫 프로젝트 만들기
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 검색 필터 패널 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">검색 필터</p>
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
              초기화
            </button>
          )}
        </div>

        {/* Row 1: 프로젝트명 + 카테고리 + 국가 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
              placeholder="프로젝트명"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
          >
            <option value="">카테고리 전체</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
          >
            <option value="">국가 전체</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Row 2: 기간 + 이름 */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* 기간 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
            />
            <span className="shrink-0 text-xs text-gray-400">~</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
            />
          </div>

          {/* 팀원 이름 */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filterMemberName}
              onChange={(e) => setFilterMemberName(e.target.value)}
              placeholder="이름 (팀 구성원)"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 툴바 */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:py-2.5">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-600 select-none">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded accent-gray-900" />
          전체 선택
          {visibleSelectedCount > 0 && (
            <span className="ml-1 rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">{visibleSelectedCount}</span>
          )}
        </label>

        <span className="text-xs text-gray-400">
          {hasFilter ? `${filtered.length} / ${projects.length}개` : `${projects.length}개`}
        </span>

        {visibleSelectedCount > 0 && (
          confirmBulk ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-500">{visibleSelectedCount}개를 삭제할까요?</span>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isPending || deletingIds.size > 0}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {(isPending || deletingIds.size > 0) && <Loader2 className="h-3 w-3 animate-spin" />}
                삭제
              </button>
              <button type="button" onClick={() => setConfirmBulk(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmBulk(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {visibleSelectedCount}개 삭제
            </button>
          )
        )}
      </div>

      {/* 필터 결과 없음 */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <Search className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">검색 결과가 없습니다.</p>
          <button onClick={clearFilters} className="mt-3 text-xs text-gray-400 underline hover:text-gray-600">
            필터 초기화
          </button>
        </div>
      )}

      {/* 3×3 카드 그리드 */}
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const isDeleting = deletingIds.has(project.id)
            const isDuplicating = duplicatingId === project.id
            const isChecked = selected.has(project.id)
            const catColor = project.category ? (CATEGORY_COLORS[project.category] ?? 'bg-gray-100 text-gray-600') : null

            return (
              <div
                key={project.id}
                className={[
                  'group relative flex flex-col rounded-2xl border bg-white shadow-sm transition-all',
                  isChecked ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:shadow-md',
                  isDeleting ? 'pointer-events-none opacity-40' : '',
                ].join(' ')}
              >
                {/* 체크박스 */}
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleOne(project.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-4 top-4 h-4 w-4 rounded accent-gray-900"
                />

                <Link href={`/projects/${project.id}`} className="flex flex-1 flex-col p-5 pl-10">
                  {/* 배지 */}
                  <div className="flex flex-wrap items-center gap-2">
                    {project.category && catColor && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${catColor}`}>
                        {project.category}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${project.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {project.is_published ? '공개' : '비공개'}
                    </span>
                  </div>

                  {/* 제목 */}
                  <p className="mt-3 text-base font-semibold leading-snug text-gray-900 group-hover:text-gray-700">
                    {project.title}
                  </p>

                  {/* 오너 */}
                  {project.ownerName && (
                    <p className="mt-1.5 text-xs text-gray-400">
                      오너 · <span className="font-medium text-gray-600">{project.ownerName}</span>
                    </p>
                  )}

                  {/* 메타 */}
                  <div className="mt-3 flex flex-col gap-1.5">
                    {(project.start_date || project.end_date) && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                        {formatDateShort(project.start_date) ?? '미정'} — {formatDateShort(project.end_date) ?? '미정'}
                      </span>
                    )}
                    {project.budget != null && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <DollarSign className="h-3.5 w-3.5 shrink-0" />
                        {formatNumberWithCommas(project.budget)}
                      </span>
                    )}
                    {project.country && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        {resolveCountryFlag(project.country)} {resolveCountryLabel(project.country)}
                      </span>
                    )}
                  </div>

                  {/* 하단 통계 */}
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                    {project.memberCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        팀원 {project.memberCount}명
                      </span>
                    )}
                    {project.formCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        폼 {project.formCount}개
                      </span>
                    )}
                    <span className="text-xs text-gray-300 sm:ml-auto">
                      {new Intl.DateTimeFormat('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' }).format(new Date(project.created_at))}
                    </span>
                  </div>
                </Link>

                {/* 액션 버튼 */}
                <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleDuplicate(project.id)}
                    disabled={isDuplicating || deletingIds.size > 0}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-30"
                  >
                    {isDuplicating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                    복제
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteOne(project.id, project.title)}
                    disabled={isDeleting || deletingIds.size > 0}
                    className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30 sm:ml-auto"
                    title="삭제"
                  >
                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
