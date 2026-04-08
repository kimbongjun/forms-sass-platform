import { createServerClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ExternalLink, Mail, Users } from 'lucide-react'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(iso))
}

export default async function EngagementLeadsPage() {
  const supabase = await createServerClient()

  const { data: rootProjects } = await supabase
    .from('projects')
    .select('id, title')
    .is('workspace_project_id', null)
    .order('created_at', { ascending: false })

  const rootProjectIds = (rootProjects ?? []).map((p) => p.id)

  const { data: formProjects } = rootProjectIds.length > 0
    ? await supabase.from('projects').select('id, title, workspace_project_id').in('workspace_project_id', rootProjectIds)
    : { data: [] as { id: string; title: string; workspace_project_id: string }[] }

  const formIds = (formProjects ?? []).map((f) => f.id)

  const [{ data: submissions }, { count: totalCount }] = await Promise.all([
    formIds.length > 0
      ? supabase
          .from('submissions')
          .select('id, project_id, answers, created_at')
          .in('project_id', formIds)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as { id: string; project_id: string; answers: Record<string, unknown>; created_at: string }[] }),
    formIds.length > 0
      ? supabase.from('submissions').select('*', { count: 'exact', head: true }).in('project_id', formIds)
      : Promise.resolve({ count: 0 }),
  ])

  const formMap = new Map((formProjects ?? []).map((f) => [f.id, f]))
  const projectMap = new Map((rootProjects ?? []).map((p) => [p.id, p]))

  const groupedByForm: Record<string, { form: { id: string; title: string; workspace_project_id: string }; count: number; recent: string }> = {}
  for (const sub of submissions ?? []) {
    if (!groupedByForm[sub.project_id]) {
      const form = formMap.get(sub.project_id)
      if (!form) continue
      groupedByForm[sub.project_id] = { form, count: 0, recent: sub.created_at }
    }
    groupedByForm[sub.project_id].count++
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Engagement / Leads</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">통합 리드 DB</h1>
        <p className="mt-1 text-sm text-gray-500">프로젝트별 폼 응답을 리드로 통합 관리합니다.</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total Leads</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{(totalCount ?? 0).toLocaleString('ko-KR')}</p>
          <p className="mt-0.5 text-xs text-gray-400">전체 수집 응답</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Projects</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{rootProjects?.length ?? 0}</p>
          <p className="mt-0.5 text-xs text-gray-400">연결된 워크스페이스</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Forms</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{formProjects?.length ?? 0}</p>
          <p className="mt-0.5 text-xs text-gray-400">응답 수집 중인 폼</p>
        </div>
      </div>

      {/* 폼별 응답 현황 */}
      {Object.values(groupedByForm).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-400">아직 수집된 리드가 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">프로젝트에서 폼을 만들고 응답을 수집하면 여기에 집계됩니다.</p>
          <Link href="/projects" className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            프로젝트 목록
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              <tr>
                <th className="px-5 py-3">폼명</th>
                <th className="px-5 py-3">워크스페이스</th>
                <th className="px-5 py-3 text-right">응답 수</th>
                <th className="px-5 py-3">최근 수집</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {Object.values(groupedByForm)
                .sort((a, b) => b.count - a.count)
                .map(({ form, count, recent }) => {
                  const workspace = projectMap.get(form.workspace_project_id)
                  return (
                    <tr key={form.id} className="border-t border-gray-100">
                      <td className="px-5 py-4 font-medium text-gray-900">{form.title}</td>
                      <td className="px-5 py-4 text-gray-500">{workspace?.title ?? '-'}</td>
                      <td className="px-5 py-4 text-right">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{count}</span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400">{formatDate(recent)}</td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/projects/${form.workspace_project_id}/execution/forms/${form.id}?tab=responses`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          응답 보기
                        </Link>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-700">향후 확장</p>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          CRM 태그·담당자 지정·후속 액션 관리 등은 실제 운영 규칙이 정리되면 이 화면에 붙일 수 있습니다.
        </p>
      </div>
    </div>
  )
}
