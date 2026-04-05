'use client'

import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { DateRangePickerInput } from '@/components/common/DatePickerInput'

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

interface GanttChartProps {
  projectId: string
  projectStartDate: string | null
  projectEndDate: string | null
  initialMilestones: Milestone[]
}

const STATUS_LABELS = {
  not_started: '미시작',
  in_progress: '진행 중',
  completed: '완료',
}

const STATUS_COLORS = {
  not_started: 'bg-gray-300',
  in_progress: 'bg-blue-500',
  completed: 'bg-emerald-500',
}

function parseDate(d: string) {
  return new Date(d + 'T00:00:00')
}

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function formatShort(d: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(parseDate(d))
}

const EMPTY_FORM: {
  title: string
  description: string
  start_date: string
  end_date: string
  progress: number
  status: Milestone['status']
} = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  progress: 0,
  status: 'not_started',
}

export default function GanttChart({
  projectId,
  projectStartDate,
  projectEndDate,
  initialMilestones,
}: GanttChartProps) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // 타임라인 기준점 계산
  const timelineStart = useMemo(() => {
    const dates = [
      projectStartDate,
      ...milestones.map((m) => m.start_date),
    ].filter(Boolean) as string[]
    if (!dates.length) return new Date()
    return parseDate(dates.sort()[0])
  }, [milestones, projectStartDate])

  const timelineEnd = useMemo(() => {
    const dates = [
      projectEndDate,
      ...milestones.map((m) => m.end_date),
    ].filter(Boolean) as string[]
    if (!dates.length) {
      const d = new Date(timelineStart)
      d.setDate(d.getDate() + 30)
      return d
    }
    return parseDate(dates.sort().at(-1)!)
  }, [milestones, projectEndDate, timelineStart])

  const totalDays = Math.max(1, daysBetween(timelineStart, timelineEnd))

  function getBarStyle(start: string, end: string) {
    const s = parseDate(start)
    const e = parseDate(end)
    const leftDays = daysBetween(timelineStart, s)
    const widthDays = Math.max(1, daysBetween(s, e))
    return {
      left: `${(leftDays / totalDays) * 100}%`,
      width: `${(widthDays / totalDays) * 100}%`,
    }
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

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">프로젝트 일정</h2>
          <p className="mt-0.5 text-sm text-gray-500">마일스톤을 추가하고 간트 차트로 일정을 관리합니다.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" />
          마일스톤 추가
        </button>
      </div>

      {/* 마일스톤 추가/편집 폼 */}
      {showForm && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-gray-900">
            {editingId ? '마일스톤 편집' : '새 마일스톤'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">제목 *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="마일스톤 제목"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">기간 *</label>
              <DateRangePickerInput
                from={form.start_date}
                to={form.end_date}
                onChange={({ from, to }) => setForm((f) => ({ ...f, start_date: from, end_date: to }))}
                placeholder="마일스톤 기간 선택"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">상태</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Milestone['status'] }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              >
                <option value="not_started">미시작</option>
                <option value="in_progress">진행 중</option>
                <option value="completed">완료</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                진행률: {form.progress}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((f) => ({ ...f, progress: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">설명</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="마일스톤 설명 (선택)"
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              취소
            </button>
          </div>
        </div>
      )}

      {milestones.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-sm font-medium text-gray-400">등록된 마일스톤이 없습니다.</p>
          <p className="mt-1 text-xs text-gray-300">위의 &apos;마일스톤 추가&apos; 버튼을 눌러 일정을 추가하세요.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* 간트 차트 */}
          <div className="overflow-x-auto">
            <div className="min-w-150">
              {/* 헤더 레이블 */}
              <div className="flex border-b border-gray-100 bg-gray-50 px-5 py-3">
                <div className="w-48 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  마일스톤
                </div>
                <div className="relative flex-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>
                      {timelineStart.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                    <span>
                      {timelineEnd.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 마일스톤 행 */}
              {milestones.map((m) => (
                <div key={m.id} className="group flex items-center border-b border-gray-100 px-5 py-3 last:border-0 hover:bg-gray-50">
                  {/* 이름 + 메타 */}
                  <div className="w-48 shrink-0 pr-4">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-gray-900">{m.title}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[m.status]}`} />
                      <span className="text-xs text-gray-400">{STATUS_LABELS[m.status]}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{m.progress}%</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatShort(m.start_date)} — {formatShort(m.end_date)}
                    </p>
                  </div>

                  {/* 간트 바 */}
                  <div className="relative flex-1 py-2">
                    <div className="h-2 w-full rounded-full bg-gray-100" />
                    <div
                      className={`absolute top-2 h-2 rounded-full ${STATUS_COLORS[m.status]} transition-all`}
                      style={getBarStyle(m.start_date, m.end_date)}
                    />
                    {/* 진행률 표시 */}
                    <div
                      className="absolute top-2 h-2 rounded-full bg-white/40"
                      style={{
                        ...getBarStyle(m.start_date, m.end_date),
                        width: `calc(${getBarStyle(m.start_date, m.end_date).width} * ${1 - m.progress / 100})`,
                        left: `calc(${getBarStyle(m.start_date, m.end_date).left} + ${getBarStyle(m.start_date, m.end_date).width} * ${m.progress / 100})`,
                      }}
                    />
                  </div>

                  {/* 액션 버튼 */}
                  <div className="ml-3 flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(m)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
