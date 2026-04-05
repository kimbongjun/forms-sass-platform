import Link from 'next/link'
import { createServerClient } from '@/utils/supabase/server'
import WorkspacePage from '@/components/workspace/WorkspacePage'

export default async function DashboardCategoryPage() {
  const supabase = await createServerClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, created_at, is_published, category')
    .is('workspace_project_id', null)
    .order('created_at', { ascending: false })

  const projectList = projects ?? []
  const publishedCount = projectList.filter((project) => project.is_published).length
  const uncategorizedCount = projectList.filter((project) => !project.category).length

  const categories = projectList.reduce<Record<string, number>>((acc, project) => {
    const key = project.category?.trim() || '미분류'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const categoryEntries = Object.entries(categories).sort((a, b) => b[1] - a[1])
  const maxCategoryCount = Math.max(...categoryEntries.map(([, count]) => count), 1)

  const { data: recentProjects } = await supabase
    .from('projects')
    .select('id, title, created_at, is_published, category')
    .is('workspace_project_id', null)
    .order('created_at', { ascending: false })
    .limit(6)

  return (
    <WorkspacePage
      eyebrow="Dashboard / Category"
      title="카테고리 분석"
      description="프로젝트 생성 위자드에서 입력한 실제 카테고리 값을 기준으로 운영 포트폴리오를 분류해 보여줍니다."
      actions={[
        { href: '/projects', label: '프로젝트 목록' },
        { href: '/projects/new', label: '새 프로젝트', variant: 'secondary' },
      ]}
      stats={[
        { label: 'Total', value: String(projectList.length), helper: '전체 프로젝트' },
        { label: 'Categories', value: String(categoryEntries.length), helper: '현재 사용 중인 카테고리' },
        { label: 'Published', value: String(publishedCount), helper: '공개 상태' },
        { label: 'Uncategorized', value: String(uncategorizedCount), helper: '카테고리 미입력' },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">카테고리 분포</h2>
          <div className="mt-5 space-y-4">
            {categoryEntries.map(([category, count]) => {
              const width = `${Math.round((count / maxCategoryCount) * 100)}%`

              return (
                <div key={category}>
                  <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                    <span>{category}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gray-900" style={{ width }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">최근 프로젝트</h2>
          <div className="mt-5 space-y-3">
            {(recentProjects ?? []).map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-2xl border border-gray-200 px-4 py-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{project.title}</p>
                  {project.category && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                      {project.category}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {project.is_published ? '공개' : '비공개'} ·{' '}
                  {new Intl.DateTimeFormat('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'Asia/Seoul',
                  }).format(new Date(project.created_at))}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </WorkspacePage>
  )
}
