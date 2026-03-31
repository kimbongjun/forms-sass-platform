import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { createServerClient } from '@/utils/supabase/server'
import ResponsesTable from '@/components/dashboard/ResponsesTable'
import type { FormField } from '@/types/database'

interface ResponsesPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}

const INPUT_TYPES = ['text', 'email', 'textarea', 'checkbox', 'select', 'radio', 'checkbox_group']
const PAGE_SIZE = 20

export default async function ResponsesPage({ params, searchParams }: ResponsesPageProps) {
  const [{ id }, { page: pageParam }] = await Promise.all([params, searchParams])
  const supabase = await createServerClient()

  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const start = (page - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE - 1

  const [
    { data: project, error: projectErr },
    { data: fields },
    { count: totalCount },
    { data: submissions },
  ] = await Promise.all([
    supabase.from('projects').select('id, title, slug').eq('id', id).single(),
    supabase.from('form_fields').select('*').eq('project_id', id).order('order_index', { ascending: true }),
    supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('project_id', id),
    supabase.from('submissions').select('*').eq('project_id', id)
      .order('created_at', { ascending: false }).range(start, end),
  ])

  if (projectErr || !project) notFound()

  const inputFields: FormField[] = (fields ?? []).filter((f: FormField) => INPUT_TYPES.includes(f.type))
  const total = totalCount ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ── 통계 계산 (select / radio / checkbox_group) ──────────────────────────────
  const statFields = inputFields.filter((f) => ['select', 'radio', 'checkbox_group'].includes(f.type))
  let allAnswers: { answers: Record<string, unknown> }[] = []
  if (statFields.length > 0) {
    const { data } = await supabase.from('submissions').select('answers').eq('project_id', id)
    allAnswers = data ?? []
  }

  const stats: Record<string, Record<string, number>> = {}
  for (const f of statFields) {
    stats[f.id] = {}
    for (const row of allAnswers) {
      const val = row.answers?.[f.id]
      if (Array.isArray(val)) {
        val.forEach((v) => { if (v) stats[f.id][v] = (stats[f.id][v] || 0) + 1 })
      } else if (typeof val === 'string' && val) {
        stats[f.id][val] = (stats[f.id][val] || 0) + 1
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-gray-900">{project.title}</h1>
              <p className="text-xs text-gray-400">응답 목록 — 총 {total}건</p>
            </div>
          </div>
          {total > 0 && (
            <Link href={`/dashboard/${id}/responses/export`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Download className="h-4 w-4" />
              CSV 내보내기
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">

        {/* 통계 카드 */}
        {statFields.length > 0 && total > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">필드별 응답 통계</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {statFields.map((f) => {
                const fieldStats = stats[f.id] ?? {}
                const entries = Object.entries(fieldStats).sort((a, b) => b[1] - a[1])
                const maxCount = entries[0]?.[1] ?? 1
                return (
                  <div key={f.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="mb-3 text-sm font-semibold text-gray-800">{f.label || '(제목 없음)'}</p>
                    <div className="space-y-2">
                      {entries.length === 0 ? (
                        <p className="text-xs text-gray-400">응답 없음</p>
                      ) : entries.map(([opt, count]) => (
                        <div key={opt}>
                          <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                            <span className="truncate max-w-[180px]">{opt}</span>
                            <span className="ml-2 shrink-0 font-medium">{count}건 ({Math.round(count / total * 100)}%)</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-gray-900 transition-all"
                              style={{ width: `${Math.round(count / maxCount * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 응답 테이블 */}
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 text-center">
            <p className="text-base font-medium text-gray-500">아직 응답이 없습니다</p>
            <p className="mt-1 text-sm text-gray-400">
              <Link href={`/${project.slug}`} target="_blank" className="text-blue-500 hover:underline">폼 링크</Link>를 공유하여 응답을 받아보세요.
            </p>
          </div>
        ) : inputFields.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">입력 필드가 없는 폼입니다.</div>
        ) : (
          <ResponsesTable
            submissions={submissions ?? []}
            inputFields={inputFields}
            page={page}
            totalPages={totalPages}
          />
        )}
      </div>
    </div>
  )
}
