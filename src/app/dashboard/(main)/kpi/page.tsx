import { createServerClient } from '@/utils/supabase/server'
import WorkspacePage from '@/components/workspace/WorkspacePage'
import KpiCharts from './_components/KpiCharts'

export default async function DashboardKpiPage() {
  const supabase = await createServerClient()

  const { data: rootProjects } = await supabase
    .from('projects')
    .select('id, created_at')
    .is('workspace_project_id', null)
    .order('created_at', { ascending: true })

  const rootProjectIds = (rootProjects ?? []).map((project) => project.id)
  const { data: formProjects } = rootProjectIds.length > 0
    ? await supabase.from('projects').select('id').in('workspace_project_id', rootProjectIds)
    : { data: [] as { id: string }[] }

  const metricProjectIds = [...new Set([
    ...rootProjectIds,
    ...(formProjects ?? []).map((project) => project.id),
  ])]

  const [
    { count: totalProjects },
    { count: publishedProjects },
    { count: totalFields },
    { count: totalSubmissions },
    { data: submissions },
  ] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).is('workspace_project_id', null),
    supabase.from('projects').select('*', { count: 'exact', head: true }).is('workspace_project_id', null).eq('is_published', true),
    metricProjectIds.length > 0
      ? supabase.from('form_fields').select('*', { count: 'exact', head: true }).in('project_id', metricProjectIds)
      : Promise.resolve({ count: 0 }),
    metricProjectIds.length > 0
      ? supabase.from('submissions').select('*', { count: 'exact', head: true }).in('project_id', metricProjectIds)
      : Promise.resolve({ count: 0 }),
    // 최근 6개월 응답 데이터
    metricProjectIds.length > 0
      ? supabase
          .from('submissions')
          .select('created_at')
          .in('project_id', metricProjectIds)
          .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as { created_at: string }[] }),
  ])

  const projectCount = totalProjects ?? 0
  const publishedCount = publishedProjects ?? 0
  const fieldCount = totalFields ?? 0
  const submissionCount = totalSubmissions ?? 0
  const publishRate = projectCount > 0 ? `${Math.round((publishedCount / projectCount) * 100)}%` : '0%'
  const avgFields = projectCount > 0 ? (fieldCount / projectCount).toFixed(1) : '0.0'
  const avgResponses = projectCount > 0 ? (submissionCount / projectCount).toFixed(1) : '0.0'

  // 월별 응답 수 집계 (최근 6개월)
  const monthlyMap: Record<string, number> = {}
  for (const sub of submissions ?? []) {
    const d = new Date(sub.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = (monthlyMap[key] ?? 0) + 1
  }

  // 최근 6개월 키 목록 생성
  const monthlyData: { month: string; label: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyData.push({
      month: key,
      label: new Intl.DateTimeFormat('ko-KR', { month: 'short' }).format(d),
      count: monthlyMap[key] ?? 0,
    })
  }

  // 월별 프로젝트 생성 수
  const projectMonthlyMap: Record<string, number> = {}
  for (const p of rootProjects ?? []) {
    const d = new Date(p.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    projectMonthlyMap[key] = (projectMonthlyMap[key] ?? 0) + 1
  }
  const projectMonthlyData = monthlyData.map((m) => ({
    ...m,
    projectCount: projectMonthlyMap[m.month] ?? 0,
  }))

  return (
    <WorkspacePage
      eyebrow="Dashboard / KPI"
      title="KPI 현황"
      description="현재 운영 중인 전체 프로젝트의 핵심 지표를 한눈에 확인합니다."
      actions={[
        { href: '/projects', label: '프로젝트 열기' },
        { href: '/dashboard/realtime', label: '실시간 보드', variant: 'secondary' },
      ]}
      stats={[
        { label: 'Total Projects', value: String(projectCount), helper: '운영 중인 전체 프로젝트' },
        { label: 'Publish Rate', value: publishRate, helper: '공개 상태 비중' },
        { label: 'Avg. Fields', value: avgFields, helper: '프로젝트당 평균 필드 수' },
        { label: 'Avg. Responses', value: avgResponses, helper: '프로젝트당 평균 응답 수' },
      ]}
    >
      <KpiCharts monthlyData={projectMonthlyData} />
    </WorkspacePage>
  )
}
