import { createServerClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import DuplicateButton from './_components/DuplicateButton'

const CATEGORY_COLORS: Record<string, string> = {
  'PR': 'bg-blue-100 text-blue-700',
  '디지털 마케팅': 'bg-violet-100 text-violet-700',
  '바이럴': 'bg-pink-100 text-pink-700',
  'HCP 마케팅': 'bg-emerald-100 text-emerald-700',
  'B2B 마케팅': 'bg-amber-100 text-amber-700',
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso))
}

export default async function EngagementTemplatesPage() {
  const supabase = await createServerClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, category, created_at')
    .is('workspace_project_id', null)
    .order('created_at', { ascending: false })

  // 각 프로젝트의 폼 수 조회
  const projectIds = (projects ?? []).map((p) => p.id)
  const { data: formRows } = projectIds.length > 0
    ? await supabase.from('projects').select('workspace_project_id').in('workspace_project_id', projectIds)
    : { data: [] as { workspace_project_id: string }[] }

  const formCount: Record<string, number> = {}
  for (const f of formRows ?? []) {
    if (f.workspace_project_id) {
      formCount[f.workspace_project_id] = (formCount[f.workspace_project_id] ?? 0) + 1
    }
  }

  // 카테고리별 그룹
  const grouped: Record<string, typeof projects> = {}
  for (const p of projects ?? []) {
    const key = p.category ?? '미분류'
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(p)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Engagement / Templates</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">템플릿 라이브러리</h1>
        <p className="mt-1 text-sm text-gray-500">
          기존 프로젝트를 복제해 새 프로젝트의 시작점으로 활용하세요.
        </p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-400">아직 프로젝트가 없습니다.</p>
          <Link href="/projects/new" className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            새 프로젝트 만들기
          </Link>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-600'}`}>
                {category}
              </span>
              <span className="text-xs text-gray-400">{items?.length}개</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(items ?? []).map((p) => (
                <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">{p.title}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDate(p.created_at)} · 폼 {formCount[p.id] ?? 0}개</p>
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-center text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      열기
                    </Link>
                    <DuplicateButton projectId={p.id} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
