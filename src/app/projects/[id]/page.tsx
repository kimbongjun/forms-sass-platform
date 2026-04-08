import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, CalendarRange, CheckCircle2, DollarSign, Globe, MapPin, Pencil, Target, Users } from 'lucide-react'
import { createServerClient } from '@/utils/supabase/server'
import { resolveCountryFlag, resolveCountryLabel } from '@/constants/countries'
import { formatNumberWithCommas } from '@/utils/money'
import type { ProjectGoalItem, ProjectBudgetItem } from '@/types/database'

interface ProjectOverviewPageProps {
  params: Promise<{ id: string }>
}

const CATEGORY_COLORS: Record<string, string> = {
  'PR': 'bg-blue-100 text-blue-700',
  '디지털 마케팅': 'bg-violet-100 text-violet-700',
  '바이럴': 'bg-pink-100 text-pink-700',
  'HCP 마케팅': 'bg-emerald-100 text-emerald-700',
  'B2B 마케팅': 'bg-amber-100 text-amber-700',
}

const ROLE_LABELS: Record<string, string> = {
  owner: '오너', manager: '매니저', member: '멤버', viewer: '뷰어',
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d))
}

export default async function ProjectOverviewPage({ params }: ProjectOverviewPageProps) {
  const { id } = await params
  const supabase = await createServerClient()

  const [
    { data: project, error: projectError },
    { data: members },
    { count: formCount },
    { data: tasks },
    { data: issues },
    { data: goalPlan },
    { data: budgetPlan },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, slug, is_published, category, start_date, end_date, budget, country, venue_name, venue_map_url, created_at')
      .eq('id', id)
      .single(),
    supabase.from('project_members').select('*').eq('project_id', id).order('created_at', { ascending: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('workspace_project_id', id),
    supabase.from('project_tasks').select('status').eq('project_id', id),
    supabase.from('project_issues').select('status').eq('project_id', id),
    supabase.from('project_goal_plans').select('items').eq('project_id', id).maybeSingle(),
    supabase.from('project_budget_plans').select('items').eq('project_id', id).maybeSingle(),
  ])

  if (projectError || !project) notFound()

  // 진행 현황 집계
  const taskTotal = tasks?.length ?? 0
  const taskDone = tasks?.filter((t: { status: string }) => t.status === 'done').length ?? 0
  const taskRate = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : null
  const openIssues = issues?.filter((i: { status: string }) => i.status !== 'resolved').length ?? 0

  const goalItems = Array.isArray(goalPlan?.items) ? (goalPlan.items as ProjectGoalItem[]) : []
  const goalWithActual = goalItems.filter((g) => g.target && g.actual)
  let avgGoalRate: number | null = null
  if (goalWithActual.length > 0) {
    const rates = goalWithActual.map((g) => {
      const t = Number(g.target.replace(/,/g, ''))
      const a = Number(g.actual.replace(/,/g, ''))
      return t > 0 ? (a / t) * 100 : null
    }).filter((r): r is number => r !== null)
    if (rates.length > 0) avgGoalRate = Math.round(rates.reduce((s, r) => s + r, 0) / rates.length)
  }

  const budgetItems = Array.isArray(budgetPlan?.items) ? (budgetPlan.items as ProjectBudgetItem[]) : []
  const totalPlanned = budgetItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const totalActual = budgetItems.reduce((s, i) => s + (Number(i.actual_amount) || 0), 0)
  const budgetRate = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : null

  const categoryColor = project.category
    ? (CATEGORY_COLORS[project.category] ?? 'bg-gray-100 text-gray-600')
    : null
  const countryLabel = resolveCountryLabel(project.country)
  const countryFlag = resolveCountryFlag(project.country)

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            {project.category && (
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${categoryColor}`}>
                {project.category}
              </span>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-500">
              {(project.start_date || project.end_date) && (
                <div className="flex items-center gap-1.5">
                  <CalendarRange className="h-4 w-4 text-gray-400" />
                  <span>
                    {formatDate(project.start_date) ?? '미정'}
                    {' — '}
                    {formatDate(project.end_date) ?? '미정'}
                  </span>
                </div>
              )}
              {project.budget != null && (
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span>{formatNumberWithCommas(project.budget)}</span>
                </div>
              )}
              {project.country && (
                <div className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <span>{countryFlag}</span>
                  <span>{countryLabel}</span>
                </div>
              )}
            </div>
          </div>

          {/* 퀵 액션 */}
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
            <Link
              href={`/projects/${id}/edit`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 sm:w-auto"
            >
              <Pencil className="h-4 w-4" />
              프로젝트 편집
            </Link>
          </div>
        </div>
      </section>

      {/* 진행 현황 요약 */}
      {(taskTotal > 0 || openIssues > 0 || avgGoalRate !== null || budgetRate !== null) && (
        <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">진행 현황</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {taskTotal > 0 && (
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500">Task 완료율</p>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{taskRate ?? 0}%</p>
                <p className="mt-0.5 text-xs text-gray-400">{taskDone} / {taskTotal}건 완료</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-gray-700" style={{ width: `${taskRate ?? 0}%` }} />
                </div>
              </div>
            )}
            {(openIssues > 0 || (issues && issues.length > 0)) && (
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertCircle className={`h-4 w-4 ${openIssues > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
                  <p className="text-xs font-semibold text-gray-500">미해결 이슈</p>
                </div>
                <p className={`text-2xl font-semibold ${openIssues > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{openIssues}건</p>
                <p className="mt-0.5 text-xs text-gray-400">전체 {issues?.length ?? 0}건 중</p>
              </div>
            )}
            {avgGoalRate !== null && (
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500">KPI 평균 달성률</p>
                </div>
                <p className={`text-2xl font-semibold ${avgGoalRate >= 100 ? 'text-emerald-600' : avgGoalRate >= 70 ? 'text-amber-600' : 'text-gray-900'}`}>{avgGoalRate}%</p>
                <p className="mt-0.5 text-xs text-gray-400">{goalWithActual.length}개 지표 기준</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className={`h-full rounded-full ${avgGoalRate >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(avgGoalRate, 100)}%` }} />
                </div>
              </div>
            )}
            {budgetRate !== null && (
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500">예산 집행률</p>
                </div>
                <p className={`text-2xl font-semibold ${budgetRate > 100 ? 'text-red-600' : 'text-gray-900'}`}>{budgetRate}%</p>
                <p className="mt-0.5 text-xs text-gray-400">집행 {formatNumberWithCommas(totalActual)}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className={`h-full rounded-full ${budgetRate > 100 ? 'bg-red-500' : 'bg-gray-700'}`} style={{ width: `${Math.min(budgetRate, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900">프로젝트 요약</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Team</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{members?.length ?? 0}</p>
              <p className="mt-0.5 text-xs text-gray-400">명</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Forms</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{formCount ?? 0}</p>
              <p className="mt-0.5 text-xs text-gray-400">개 등록</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Status</p>
              <p className="mt-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${project.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {project.is_published ? '공개' : '비공개'}
                </span>
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Country</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">
                {countryLabel ? `${countryFlag} ${countryLabel}` : '미설정'}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">행사장</h2>
          </div>
          {project.venue_name ? (
            <p className="mb-3 text-base font-semibold text-gray-900">{project.venue_name}</p>
          ) : (
            <p className="mb-3 text-sm text-gray-400">행사장명이 아직 등록되지 않았습니다.</p>
          )}
          {project.venue_map_url ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="relative w-full" style={{ paddingBottom: '45%' }}>
                <iframe
                  src={project.venue_map_url}
                  className="absolute inset-0 h-full w-full"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-12 text-center text-sm text-gray-400">
              행사장 지도 정보가 아직 등록되지 않았습니다.
            </div>
          )}
        </article>
      </section>

      {/* 팀 구성 */}
      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">팀 구성 (R&amp;R)</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {members?.length ?? 0}명
          </span>
        </div>

        {!members || members.length === 0 ? (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-10 text-center">
            <p className="text-sm text-gray-400">등록된 팀원이 없습니다.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(members as Array<{ id: string; name: string; role: string; email?: string; title?: string; department?: string; notify?: boolean }>).map((member) => (
              <div key={member.id} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                  {member.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{member.name}</p>
                    <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-500">
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  </div>
                  {member.department && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">{member.department}</p>
                  )}
                  {member.email && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">{member.email}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
