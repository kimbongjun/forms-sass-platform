import { createServerClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))
}

export default async function SharedFeedbackPage() {
  const supabase = await createServerClient()

  // 이슈 트래커 데이터를 피드백의 시작점으로 활용
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title')
    .is('workspace_project_id', null)
    .order('created_at', { ascending: false })

  const projectIds = (projects ?? []).map((p) => p.id)

  const { data: issues } = projectIds.length > 0
    ? await supabase
        .from('project_issues')
        .select('id, project_id, title, type, urgency, status, created_at')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(30)
    : { data: [] as { id: string; project_id: string; title: string; type: string; urgency: string; status: string; created_at: string }[] }

  const projectMap = new Map((projects ?? []).map((p) => [p.id, p]))

  const STATUS_META: Record<string, { label: string; color: string }> = {
    open: { label: '열림', color: 'bg-blue-100 text-blue-700' },
    in_progress: { label: '진행 중', color: 'bg-amber-100 text-amber-700' },
    resolved: { label: '해결됨', color: 'bg-emerald-100 text-emerald-700' },
  }

  const TYPE_LABELS: Record<string, string> = {
    bug: '결함',
    suggestion: '건의사항',
    question: '질문',
  }

  const openCount = (issues ?? []).filter((i) => i.status !== 'resolved').length

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Shared Center / Feedback</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">피드백 관리</h1>
        <p className="mt-1 text-sm text-gray-500">프로젝트 이슈 트래커에 수집된 피드백을 전체 관점에서 확인합니다.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{issues?.length ?? 0}</p>
          <p className="mt-0.5 text-xs text-gray-400">전체 피드백</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Open</p>
          <p className={`mt-2 text-3xl font-semibold ${openCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{openCount}</p>
          <p className="mt-0.5 text-xs text-gray-400">미해결 항목</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Projects</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{projects?.length ?? 0}</p>
          <p className="mt-0.5 text-xs text-gray-400">연결된 프로젝트</p>
        </div>
      </div>

      {(issues ?? []).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-400">아직 피드백이 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">프로젝트 이슈 트래커에서 피드백을 등록하세요.</p>
          <Link href="/projects" className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            프로젝트 목록
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              <tr>
                <th className="px-5 py-3">제목</th>
                <th className="px-5 py-3">프로젝트</th>
                <th className="px-5 py-3">유형</th>
                <th className="px-5 py-3">상태</th>
                <th className="px-5 py-3">등록일</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(issues ?? []).map((issue) => {
                const project = projectMap.get(issue.project_id)
                const statusMeta = STATUS_META[issue.status] ?? { label: issue.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={issue.id} className="border-t border-gray-100">
                    <td className="px-5 py-4 font-medium text-gray-900 max-w-xs truncate">{issue.title}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{project?.title ?? '-'}</td>
                    <td className="px-5 py-4 text-xs text-gray-500">{TYPE_LABELS[issue.type] ?? issue.type}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-400">{formatDate(issue.created_at)}</td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/projects/${issue.project_id}/issues`}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900"
                      >
                        이동
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
