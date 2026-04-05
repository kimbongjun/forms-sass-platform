'use client'

import { useMemo, useState } from 'react'
import KanbanBoard from '@/components/workspace/KanbanBoard'
import GanttWBS from './GanttWBS'
import { ProjectTask } from '@/types/project-task'

interface SchedulePlannerProps {
  projectId: string
  initialTasks: ProjectTask[]
}

export default function SchedulePlanner({ projectId, initialTasks }: SchedulePlannerProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>(initialTasks)

  const summary = useMemo(() => {
    const dated = tasks.filter((task) => task.start_date || task.due_date).length
    const completed = tasks.filter((task) => task.status === 'done').length
    const active = tasks.filter((task) => task.status === 'in_progress').length
    return { total: tasks.length, dated, completed, active }
  }, [tasks])

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Schedule</p>
        <h2 className="theme-title mt-2 text-2xl font-semibold">칸반 기반 일정 플래너</h2>
        <p className="theme-muted mt-2 text-sm">
          칸반에서 일을 정의하고, 기간과 진행률을 입력하면 같은 데이터가 아래 Gantt에 그대로 반영됩니다.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <StatCard label="전체 태스크" value={summary.total} />
          <StatCard label="기간 입력 완료" value={summary.dated} />
          <StatCard label="진행 중" value={summary.active} />
          <StatCard label="완료" value={summary.completed} />
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <KanbanBoard projectId={projectId} initialTasks={tasks} onTasksChange={setTasks} embedded />
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-4">
          <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Gantt</p>
          <h3 className="theme-title mt-1 text-lg font-semibold">칸반에서 정리한 태스크를 일정으로 펼쳐보기</h3>
          <p className="theme-muted mt-1 text-sm">
            칸반과 Gantt는 같은 태스크를 공유합니다. 어느 쪽에서 수정해도 바로 동기화됩니다.
          </p>
        </div>
        <GanttWBS projectId={projectId} initialTasks={tasks} onTasksChange={setTasks} />
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="theme-panel rounded-2xl border px-4 py-4">
      <p className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="theme-title mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
