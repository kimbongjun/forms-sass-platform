export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, Download, MessageSquareText } from 'lucide-react'
import { createServerClient } from '@/utils/supabase/server'

interface LiveResponsesPageProps {
  params: Promise<{ id: string }>
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
}

export default async function LiveResponsesPage({ params }: LiveResponsesPageProps) {
  const { id: workspaceId } = await params
  const supabase = await createServerClient()

  const { error: workspaceError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', workspaceId)
    .single()

  if (workspaceError) notFound()

  const { data: forms } = await supabase
    .from('projects')
    .select('id, title, created_at')
    .eq('workspace_project_id', workspaceId)
    .order('created_at', { ascending: false })

  const formIds = (forms ?? []).map((form) => form.id)

  const [{ data: submissions }, { count: totalResponses }] = await Promise.all([
    formIds.length > 0
      ? supabase
        .from('submissions')
        .select('id, project_id, created_at')
        .in('project_id', formIds)
        .order('created_at', { ascending: false })
        .limit(20)
      : Promise.resolve({ data: [] as { id: string; project_id: string; created_at: string }[] }),
    formIds.length > 0
      ? supabase.from('submissions').select('*', { count: 'exact', head: true }).in('project_id', formIds)
      : Promise.resolve({ count: 0 }),
  ])

  const responseCountByForm: Record<string, number> = {}
  if (formIds.length > 0) {
    const { data: submissionRows } = await supabase
      .from('submissions')
      .select('project_id')
      .in('project_id', formIds)

    for (const row of submissionRows ?? []) {
      responseCountByForm[row.project_id] = (responseCountByForm[row.project_id] ?? 0) + 1
    }
  }

  const formMap = new Map((forms ?? []).map((form) => [form.id, form]))

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">Execution</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900">라이브 응답 허브</h2>
        <p className="mt-2 text-sm text-gray-500">
          프로젝트에 연결된 폼의 최근 응답 흐름과 폼별 응답 규모를 빠르게 확인합니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Forms</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{forms?.length ?? 0}</p>
          <p className="mt-1 text-sm text-gray-500">응답 수집 대상 폼</p>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Responses</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{totalResponses ?? 0}</p>
          <p className="mt-1 text-sm text-gray-500">누적 응답 수</p>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Recent Feed</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900">{submissions?.length ?? 0}</p>
          <p className="mt-1 text-sm text-gray-500">현재 표시 중인 최근 응답</p>
        </div>
      </section>

      {!forms || forms.length === 0 ? (
        <div className="rounded-[28px] border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-gray-200" />
          <p className="mt-4 text-sm font-medium text-gray-500">응답을 수집할 폼이 아직 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">먼저 폼을 만들고 프로젝트 참여자에게 공유해 보세요.</p>
          <Link
            href={`/projects/${workspaceId}/execution/forms/new`}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            폼 만들기
          </Link>
        </div>
      ) : (
        <>
          <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">폼별 응답 현황</h3>
                <p className="mt-1 text-sm text-gray-500">응답이 많이 들어오는 폼과 바로 확인해야 할 폼을 구분할 수 있습니다.</p>
              </div>
              <Link
                href={`/projects/${workspaceId}/execution/forms`}
                className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
              >
                폼 관리로 이동
              </Link>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {forms.map((form) => (
                <div key={form.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{form.title}</p>
                      <p className="mt-1 text-xs text-gray-400">생성일 {formatDateTime(form.created_at)}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600">
                      {responseCountByForm[form.id] ?? 0}건
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/projects/${workspaceId}/execution/forms/${form.id}?tab=responses`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      <MessageSquareText className="h-3.5 w-3.5" />
                      응답 보기
                    </Link>
                    <a
                      href={`/projects/${workspaceId}/execution/forms/${form.id}/export`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV 내보내기
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">최근 응답 피드</h3>
            <p className="mt-1 text-sm text-gray-500">최신 수집 응답 기준으로 어떤 폼이 움직이고 있는지 빠르게 확인합니다.</p>

            <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  <tr>
                    <th className="px-4 py-3">폼</th>
                    <th className="px-4 py-3">수집 시각</th>
                    <th className="px-4 py-3">이동</th>
                  </tr>
                </thead>
                <tbody>
                  {(submissions ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">
                        아직 수집된 응답이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    (submissions ?? []).map((submission) => {
                      const form = formMap.get(submission.project_id)

                      return (
                        <tr key={submission.id} className="border-t border-gray-100">
                          <td className="px-4 py-4 font-medium text-gray-900">{form?.title ?? '알 수 없는 폼'}</td>
                          <td className="px-4 py-4 text-gray-500">{formatDateTime(submission.created_at)}</td>
                          <td className="px-4 py-4">
                            <Link
                              href={`/projects/${workspaceId}/execution/forms/${submission.project_id}?tab=responses`}
                              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                            >
                              신청 현황 열기
                            </Link>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
