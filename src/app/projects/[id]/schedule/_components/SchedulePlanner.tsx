'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Loader2, Plus, Trash2, X } from 'lucide-react'
import KanbanBoard from '@/components/workspace/KanbanBoard'
import GanttWBS from './GanttWBS'
import { ProjectTask } from '@/types/project-task'

interface Milestone {
  id: string
  project_id: string
  title: string
  description: string
  start_date: string
  end_date: string
  progress: number
  status: 'not_started' | 'in_progress' | 'completed'
}

const STATUS_META: Record<Milestone['status'], { label: string; color: string }> = {
  not_started: { label: '시작 전', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: '진행 중', color: 'bg-amber-100 text-amber-700' },
  completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
}

const EMPTY_FORM = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  progress: 0,
  status: 'not_started' as Milestone['status'],
}

interface SchedulePlannerProps {
  projectId: string
  initialTasks: ProjectTask[]
}

export default function SchedulePlanner({ projectId, initialTasks }: SchedulePlannerProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>(initialTasks)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [milestoneLoading, setMilestoneLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const summary = useMemo(() => {
    const dated = tasks.filter((task) => task.start_date || task.due_date).length
    const completed = tasks.filter((task) => task.status === 'done').length
    const active = tasks.filter((task) => task.status === 'in_progress').length
    return { total: tasks.length, dated, completed, active }
  }, [tasks])

  const loadMilestones = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`)
      if (res.ok) setMilestones(await res.json())
    } finally {
      setMilestoneLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadMilestones() }, [loadMilestones])

  function startEdit(m: Milestone) {
    setEditingId(m.id)
    setForm({
      title: m.title,
      description: m.description,
      start_date: m.start_date,
      end_date: m.end_date,
      progress: m.progress,
      status: m.status,
    })
    setShowForm(true)
  }

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.start_date || !form.end_date) return
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/projects/${projectId}/milestones`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ milestoneId: editingId, ...form }),
        })
        const data = await res.json()
        setMilestones((prev) => prev.map((m) => (m.id === editingId ? data : m)))
      } else {
        const res = await fetch(`/api/projects/${projectId}/milestones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        setMilestones((prev) => [...prev, data])
      }
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 마일스톤을 삭제할까요?')) return
    await fetch(`/api/projects/${projectId}/milestones`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneId: id }),
    })
    setMilestones((prev) => prev.filter((m) => m.id !== id))
  }

  function formatDateRange(start: string, end: string) {
    const fmt = (d: string) =>
      new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(d))
    return `${fmt(start)} — ${fmt(end)}`
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100'

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

      {/* 마일스톤 섹션 */}
      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Milestones</p>
            <h3 className="theme-title mt-1 text-lg font-semibold">마일스톤</h3>
            <p className="theme-muted mt-1 text-sm">주요 단계별 목표와 진행 상태를 관리합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            <Plus className="h-4 w-4" />
            마일스톤 추가
          </button>
        </div>

        {showForm && (
          <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <p className="mb-4 text-sm font-semibold text-gray-900">{editingId ? '마일스톤 수정' : '새 마일스톤'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-600">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="마일스톤 제목"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">시작일 *</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">종료일 *</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">상태</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Milestone['status'] }))}
                  className={inputCls}
                >
                  <option value="not_started">시작 전</option>
                  <option value="in_progress">진행 중</option>
                  <option value="completed">완료</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">진행률 ({form.progress}%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.progress}
                  onChange={(e) => setForm((f) => ({ ...f, progress: Number(e.target.value) }))}
                  className="w-full accent-gray-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-600">설명</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="마일스톤 설명 (선택)"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.start_date || !form.end_date}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                저장
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                취소
              </button>
            </div>
          </div>
        )}

        {milestoneLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : milestones.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm font-medium text-gray-400">등록된 마일스톤이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map((m) => (
              <div key={m.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[m.status].color}`}>
                        {STATUS_META[m.status].label}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDateRange(m.start_date, m.end_date)}
                    </p>
                    {m.description && (
                      <p className="mt-1.5 text-xs text-gray-500">{m.description}</p>
                    )}
                    <div className="mt-2.5">
                      <div className="mb-1 flex justify-between text-xs text-gray-400">
                        <span>진행률</span>
                        <span>{m.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full ${m.status === 'completed' ? 'bg-emerald-500' : 'bg-gray-700'}`}
                          style={{ width: `${m.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
