'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, Calendar, ChevronRight,
  Trash2, Plus, Loader2, Eye, BarChart2, Copy,
  Globe, EyeOff,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface Project {
  id: string
  title: string
  slug: string
  banner_url: string | null
  created_at: string
  is_published: boolean
  fieldCount: number
}

interface ProjectListProps {
  projects: Project[]
}

export default function ProjectList({ projects }: ProjectListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  const allSelected = projects.length > 0 && selected.size === projects.length

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(projects.map((p) => p.id)))
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
    if (!window.confirm(`'${title}' 프로젝트를 삭제하시겠습니까?\n\n연결된 필드와 제출 데이터도 함께 삭제됩니다.`)) return
    await deleteProjects([id])
  }

  async function handleBulkDelete() {
    await deleteProjects(Array.from(selected))
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

  // ── 빈 상태 ─────────────────────────────────────────────────────────────────

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 text-center">
        <FileText className="mb-4 h-12 w-12 text-gray-300" />
        <p className="text-base font-medium text-gray-500">아직 프로젝트가 없어요</p>
        <p className="mt-1 text-sm text-gray-400">새 프로젝트를 만들어 폼을 구성해보세요.</p>
        <Link
          href="/dashboard/new"
          className="mt-6 flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          첫 프로젝트 만들기
        </Link>
      </div>
    )
  }

  // ── 리스트 ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* 일괄 선택 툴바 */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-600 select-none">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded accent-gray-900" />
          전체 선택
          {selected.size > 0 && (
            <span className="ml-1 rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">{selected.size}</span>
          )}
        </label>

        {selected.size > 0 && (
          confirmBulk ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">{selected.size}개 삭제할까요?</span>
              <button type="button" onClick={handleBulkDelete} disabled={isPending || deletingIds.size > 0}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {(isPending || deletingIds.size > 0) && <Loader2 className="h-3 w-3 animate-spin" />}
                삭제
              </button>
              <button type="button" onClick={() => setConfirmBulk(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                취소
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmBulk(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
              {selected.size}개 삭제
            </button>
          )
        )}
      </div>

      {/* 프로젝트 카드 */}
      {projects.map((project) => {
        const isDeleting = deletingIds.has(project.id)
        const isDuplicating = duplicatingId === project.id
        const isChecked = selected.has(project.id)
        const createdAt = new Date(project.created_at).toLocaleDateString('ko-KR', {
          year: 'numeric', month: 'long', day: 'numeric',
        })

        return (
          <div
            key={project.id}
            className={[
              'group flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all',
              isChecked ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:shadow-md',
              isDeleting ? 'opacity-40 pointer-events-none' : '',
            ].join(' ')}
          >
            {/* 체크박스 */}
            <input type="checkbox" checked={isChecked} onChange={() => toggleOne(project.id)}
              onClick={(e) => e.stopPropagation()} className="h-4 w-4 shrink-0 rounded accent-gray-900" />

            {/* 배너 썸네일 */}
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
              {project.banner_url ? (
                <img src={project.banner_url} alt={project.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <FileText className="h-6 w-6 text-gray-300" />
                </div>
              )}
            </div>

            {/* 프로젝트 정보 */}
            <Link href={`/dashboard/${project.id}/edit`} className="flex flex-1 min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-semibold text-gray-900 group-hover:text-gray-700">
                  {project.title}
                </p>
                {project.is_published ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <Globe className="h-2.5 w-2.5" /> 공개
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    <EyeOff className="h-2.5 w-2.5" /> 비공개
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  필드 {project.fieldCount}개
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {createdAt}
                </span>
              </div>
            </Link>

            {/* 편집 화살표 */}
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />

            {/* 복제 */}
            <button type="button" onClick={(e) => { e.preventDefault(); handleDuplicate(project.id) }}
              disabled={isDuplicating || deletingIds.size > 0}
              className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-yellow-50 hover:text-yellow-600 disabled:opacity-30"
              title="복제">
              {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            </button>

            {/* 응답 보기 */}
            <Link href={`/dashboard/${project.id}/responses`} onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-green-50 hover:text-green-600" title="응답 보기">
              <BarChart2 className="h-4 w-4" />
            </Link>

            {/* 폼 보기 */}
            <Link href={`/${project.slug}`} target="_blank" onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-blue-50 hover:text-blue-500" title="폼 보기">
              <Eye className="h-4 w-4" />
            </Link>

            {/* 단일 삭제 */}
            <button type="button" onClick={(e) => { e.preventDefault(); handleDeleteOne(project.id, project.title) }}
              disabled={isDeleting || deletingIds.size > 0}
              className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
              title="삭제">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        )
      })}
    </div>
  )
}
