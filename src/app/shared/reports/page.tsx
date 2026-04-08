import { createServerClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { BarChart3, ExternalLink, TrendingUp } from 'lucide-react'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))
}

export default async function SharedReportsPage() {
  const supabase = await createServerClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, category, start_date, end_date, created_at')
    .is('workspace_project_id', null)
    .order('created_at', { ascending: false })
    .limit(20)

  // 각 프로젝트의 산출물·클리핑 수
  const projectIds = (projects ?? []).map((p) => p.id)
  const [{ data: deliverableRows }, { data: clippingRows }] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('project_deliverables').select('project_id').in('project_id', projectIds)
      : Promise.resolve({ data: [] as { project_id: string }[] }),
    projectIds.length > 0
      ? supabase.from('project_clippings').select('project_id').in('project_id', projectIds)
      : Promise.resolve({ data: [] as { project_id: string }[] }),
  ])

  const deliverableCount: Record<string, number> = {}
  for (const d of deliverableRows ?? []) {
    deliverableCount[d.project_id] = (deliverableCount[d.project_id] ?? 0) + 1
  }
  const clippingCount: Record<string, number> = {}
  for (const c of clippingRows ?? []) {
    clippingCount[c.project_id] = (clippingCount[c.project_id] ?? 0) + 1
  }

  const withData = (projects ?? []).filter((p) => deliverableCount[p.id] || clippingCount[p.id])
  const withoutData = (projects ?? []).filter((p) => !deliverableCount[p.id] && !clippingCount[p.id])

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Shared Center / Reports</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">리포트 공유 관리</h1>
        <p className="mt-1 text-sm text-gray-500">프로젝트별 운영 결과를 인사이트 대시보드로 바로 확인하거나 공유할 수 있습니다.</p>
      </div>

      {withData.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">데이터 있는 프로젝트</h2>
          <div className="space-y-2">
            {withData.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    {p.start_date && <span>{formatDate(p.start_date)}</span>}
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3.5 w-3.5" />
                      산출물 {deliverableCount[p.id] ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      클리핑 {clippingCount[p.id] ?? 0}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/projects/${p.id}/insights`}
                  className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  인사이트 보기
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {withoutData.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-500">데이터 미입력 프로젝트</h2>
          <div className="space-y-2">
            {withoutData.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-dashed border-gray-200 px-5 py-4">
                <p className="text-sm text-gray-500">{p.title}</p>
                <Link
                  href={`/projects/${p.id}/outputs/deliverables`}
                  className="text-xs font-medium text-gray-400 hover:text-gray-700"
                >
                  산출물 등록하기 →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {(projects ?? []).length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-400">아직 프로젝트가 없습니다.</p>
          <Link href="/projects/new" className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            새 프로젝트 만들기
          </Link>
        </div>
      )}
    </div>
  )
}
