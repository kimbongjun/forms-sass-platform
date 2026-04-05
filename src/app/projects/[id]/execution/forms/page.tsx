export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/utils/supabase/server'
import { Eye, FileText, MessageSquareText, Plus, SquarePen } from 'lucide-react'
import DeleteFormButton from '@/app/projects/[id]/execution/forms/_components/DeleteFormButton'

interface FormsPageProps {
  params: Promise<{ id: string }>
}

function formatDate(d: string | null | undefined) {
  if (!d) return null
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(d))
}

export default async function FormsPage({ params }: FormsPageProps) {
  const { id } = await params
  const supabase = await createServerClient()

  const { error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', id)
    .single()

  if (projectError) notFound()

  // 이 workspace project에 속한 폼(child projects) 목록
  const { data: forms } = await supabase
    .from('projects')
    .select('id, title, slug, is_published, deadline, created_at')
    .eq('workspace_project_id', id)
    .order('created_at', { ascending: false })

  // 각 폼의 응답 수
  const formIds = (forms ?? []).map((f) => f.id)
  const submissionCounts: Record<string, number> = {}
  if (formIds.length > 0) {
    const { data: counts } = await supabase
      .from('submissions')
      .select('project_id')
      .in('project_id', formIds)

    for (const row of counts ?? []) {
      submissionCounts[row.project_id] = (submissionCounts[row.project_id] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">Execution</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">폼/서베이 관리</h2>
            <p className="mt-2 text-sm text-gray-500">
              프로젝트에서 사용할 신청폼 및 설문을 생성하고 관리합니다.
            </p>
          </div>
          <Link
            href={`/projects/${id}/execution/forms/new`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 sm:w-auto sm:shrink-0"
          >
            <Plus className="h-4 w-4" />
            새 폼 만들기
          </Link>
        </div>
      </section>

      {/* 폼 목록 */}
      {!forms || forms.length === 0 ? (
        <div className="rounded-[28px] border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-200" />
          <p className="mt-4 text-sm font-medium text-gray-500">등록된 폼이 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">새 폼 만들기 버튼으로 첫 번째 폼을 생성하세요.</p>
          <Link
            href={`/projects/${id}/execution/forms/new`}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            새 폼 만들기
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.map((form) => (
            <div key={form.id} className="rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${form.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {form.is_published ? '공개' : '비공개'}
                    </span>
                    {form.deadline && new Date(form.deadline) < new Date() && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                        마감
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-base font-semibold text-gray-900">{form.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span>생성 {formatDate(form.created_at)}</span>
                    {form.deadline && (
                      <span>마감 {formatDate(form.deadline)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MessageSquareText className="h-3.5 w-3.5 text-gray-400" />
                  <span>{submissionCounts[form.id] ?? 0}개 응답</span>
                </div>
                <div className="hidden flex-1 sm:block" />
                <a
                  href={`/${form.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 sm:flex-none"
                >
                  <Eye className="h-3.5 w-3.5" />
                  보기
                </a>
                <Link
                  href={`/projects/${id}/execution/forms/${form.id}?tab=responses`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 sm:flex-none"
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                  응답현황
                </Link>
                <Link
                  href={`/projects/${id}/execution/forms/${form.id}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 sm:flex-none"
                >
                  <SquarePen className="h-3.5 w-3.5" />
                  편집
                </Link>
                <DeleteFormButton
                  formId={form.id}
                  title={form.title}
                  responseCount={submissionCounts[form.id] ?? 0}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
