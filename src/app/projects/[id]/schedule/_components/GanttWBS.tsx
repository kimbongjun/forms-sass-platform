'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Check, X } from 'lucide-react'
import { DateRangePickerInput } from '@/components/common/DatePickerInput'
import { ProjectTask, ProjectTaskStatus } from '@/types/project-task'

interface GanttWBSProps {
  projectId: string
  initialTasks: ProjectTask[]
  onTasksChange?: (tasks: ProjectTask[]) => void
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const STATUS_OPTIONS: { value: ProjectTaskStatus; label: string; bar: string; badge: string }[] = [
  { value: 'todo',        label: '예정',    bar: 'bg-slate-500',   badge: 'theme-status-badge-todo' },
  { value: 'in_progress', label: '진행 중', bar: 'bg-blue-600',    badge: 'theme-status-badge-progress' },
  { value: 'done',        label: '완료',    bar: 'bg-emerald-600', badge: 'theme-status-badge-done' },
  { value: 'hold',        label: '보류',    bar: 'bg-amber-600',   badge: 'theme-status-badge-hold' },
]

const statusMeta = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s])) as Record<ProjectTaskStatus, typeof STATUS_OPTIONS[number]>

// ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → { year, month(0-based), weekIndex(0-3) } */
function dateToCell(dateStr: string): { month: number; week: number } {
  const [, m, d] = dateStr.split('-').map(Number)
  const day = d
  const week = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3
  return { month: m - 1, week }
}

// 48 컬럼 = 12개월 × 4주
const TOTAL_COLS = 48

function colIndex(month: number, week: number) {
  return month * 4 + week
}

// ── 인라인 편집 폼 ────────────────────────────────────────────────────────────

interface EditingTask {
  id: string | null  // null = 신규
  title: string
  assignee: string
  start_date: string
  due_date: string
  status: ProjectTaskStatus
  progress: string
}

function emptyEditing(): EditingTask {
  return { id: null, title: '', assignee: '', start_date: '', due_date: '', status: 'todo', progress: '0' }
}

const inputCls = 'theme-input rounded-lg px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900'

// ── GanttWBS 컴포넌트 ─────────────────────────────────────────────────────────

export default function GanttWBS({ projectId, initialTasks, onTasksChange }: GanttWBSProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>(initialTasks)
  const [year, setYear] = useState(new Date().getFullYear())
  const [editing, setEditing] = useState<EditingTask | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  useEffect(() => {
    if (onTasksChange) onTasksChange(tasks)
  }, [tasks, onTasksChange])

  const today = new Date()
  const todayMonth = today.getMonth()
  const todayDay = today.getDate()
  const todayWeek = todayDay <= 7 ? 0 : todayDay <= 14 ? 1 : todayDay <= 21 ? 2 : 3
  const todayYear = today.getFullYear()
  const todayCol = year === todayYear ? colIndex(todayMonth, todayWeek) : -1

  // 현재 월 컬럼으로 자동 스크롤
  useEffect(() => {
    if (todayCol >= 0 && scrollRef.current) {
      const cellWidth = 32
      const leftColWidth = 320
      scrollRef.current.scrollLeft = Math.max(0, todayCol * cellWidth - leftColWidth / 2)
    }
  }, [todayCol])

  // ── Gantt 바 계산 ──────────────────────────────────────────────────────────

  function getBar(task: ProjectTask): { start: number; end: number } | null {
    if (!task.start_date && !task.due_date) return null
    const s = task.start_date ? dateToCell(task.start_date) : dateToCell(task.due_date!)
    const e = task.due_date ? dateToCell(task.due_date) : dateToCell(task.start_date!)

    const startTaskYear = task.start_date?.slice(0, 4) ? parseInt(task.start_date.slice(0, 4)) : year
    const endTaskYear = task.due_date?.slice(0, 4) ? parseInt(task.due_date.slice(0, 4)) : year

    // 현재 연도 범위 클램프
    let startCol = startTaskYear === year ? colIndex(s.month, s.week) : startTaskYear < year ? 0 : TOTAL_COLS
    let endCol = endTaskYear === year ? colIndex(e.month, e.week) : endTaskYear > year ? TOTAL_COLS - 1 : -1

    if (endCol < 0 || startCol >= TOTAL_COLS) return null
    startCol = Math.max(0, startCol)
    endCol = Math.min(TOTAL_COLS - 1, endCol)

    return { start: startCol, end: endCol }
  }

  // ── 저장 ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!editing) return
    const title = editing.title.trim()
    if (!title) return

    setSaving(true)
    const supabase = createClient()

    const payload = {
      title,
      assignee: editing.assignee.trim() || null,
      start_date: editing.start_date || null,
      due_date: editing.due_date || null,
      status: editing.status,
      progress: Math.min(100, Math.max(0, parseInt(editing.progress) || 0)),
    }

    if (editing.id) {
      // 수정
      const { data, error } = await supabase
        .from('project_tasks')
        .update(payload)
        .eq('id', editing.id)
        .select()
        .single()

      if (!error && data) {
        setTasks((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...data } : t)))
      }
    } else {
      // 신규
      const { data, error } = await supabase
        .from('project_tasks')
        .insert({ ...payload, project_id: projectId, order_index: tasks.length })
        .select()
        .single()

      if (!error && data) {
        setTasks((prev) => [...prev, data])
      }
    }

    setSaving(false)
    setEditing(null)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('project_tasks').delete().eq('id', id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setDeletingId(null)
  }

  function startEdit(task: ProjectTask) {
    setEditing({
      id: task.id,
      title: task.title,
      assignee: task.assignee ?? '',
      start_date: task.start_date ?? '',
      due_date: task.due_date ?? '',
      status: task.status,
      progress: String(task.progress ?? 0),
    })
  }

  function startNew() {
    setEditing(emptyEditing())
  }

  const CELL_W = 32 // px per week cell
  const LEFT_W = 320 // px for left info columns

  return (
    <div className="space-y-3">
      {/* 연도 네비 + 추가 버튼 */}
      <div className="flex items-center justify-between">
        <div className="theme-panel flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm">
          <button type="button" onClick={() => setYear((y) => y - 1)} className="theme-btn-icon rounded-lg p-1">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="theme-title min-w-[60px] text-center text-sm font-semibold">{year}년</span>
          <button type="button" onClick={() => setYear((y) => y + 1)} className="theme-btn-icon rounded-lg p-1">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="theme-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          태스크 추가
        </button>
      </div>

      {/* 테이블 래퍼 */}
      <div className="theme-panel overflow-hidden rounded-[24px] border shadow-sm">
        <div ref={scrollRef} className="overflow-x-auto">
          <div style={{ minWidth: LEFT_W + TOTAL_COLS * CELL_W }}>

            {/* ── 헤더: 월 ── */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {/* 왼쪽 고정 헤더 영역 */}
              <div className="sticky left-0 z-10 flex shrink-0 bg-gray-50" style={{ width: LEFT_W }}>
                <div className="flex w-full items-center border-r border-gray-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Task
                </div>
              </div>
              {/* 월 헤더 */}
              {MONTHS.map((m) => (
                <div
                  key={m}
                  style={{ width: CELL_W * 4 }}
                  className="shrink-0 border-r border-gray-200 py-2.5 text-center text-xs font-semibold text-gray-500 last:border-r-0"
                >
                  {m}
                </div>
              ))}
            </div>

            {/* ── 헤더: 주차 ── */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <div className="sticky left-0 z-10 flex shrink-0 bg-gray-50" style={{ width: LEFT_W }}>
                <div className="grid w-full border-r border-gray-200" style={{ gridTemplateColumns: '1fr 80px 60px 52px' }}>
                  {['담당자', '진행률', '상태'].map((h) => (
                    <div key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 last:text-center" />
                  ))}
                </div>
              </div>
              {MONTHS.map((_, mi) =>
                ['W1', 'W2', 'W3', 'W4'].map((w, wi) => {
                  const col = colIndex(mi, wi)
                  const isToday = col === todayCol
                  return (
                    <div
                      key={`${mi}-${wi}`}
                      style={{ width: CELL_W }}
                      className={[
                        'shrink-0 py-2 text-center text-[10px] font-medium border-r border-gray-100 last:border-r-0',
                        isToday ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-400',
                        wi === 3 ? 'border-r-gray-200' : '',
                      ].join(' ')}
                    >
                      {w}
                    </div>
                  )
                })
              )}
            </div>

            {/* ── 신규 추가 폼 행 ── */}
            {editing && editing.id === null && (
              <EditRow
                editing={editing}
                onChange={setEditing}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
                saving={saving}
                leftWidth={LEFT_W}
              />
            )}

            {/* ── 태스크 행 ── */}
            {tasks.length === 0 && !editing && (
              <div className="flex" style={{ minHeight: 120 }}>
                <div className="sticky left-0 z-10 flex shrink-0 items-center justify-center bg-white" style={{ width: LEFT_W }}>
                  <p className="theme-muted text-sm">태스크를 추가해 보세요.</p>
                </div>
                <div className="flex-1" />
              </div>
            )}

            {tasks.map((task) => {
              const bar = getBar(task)
              const meta = statusMeta[task.status]
              const isEditingThis = editing?.id === task.id

              return (
                <div
                  key={task.id}
                  className={[
                    'group flex border-b border-gray-100 transition-colors last:border-b-0',
                    isEditingThis ? 'bg-gray-50' : 'hover:bg-gray-50/60',
                  ].join(' ')}
                >
                  {/* 왼쪽 정보 영역 */}
                  <div className="sticky left-0 z-10 flex shrink-0 border-r border-gray-100 bg-inherit" style={{ width: LEFT_W }}>
                    {isEditingThis && editing ? (
                      <InlineEditLeft
                        editing={editing}
                        onChange={setEditing}
                        onSave={handleSave}
                        onCancel={() => setEditing(null)}
                        saving={saving}
                      />
                    ) : (
                      <div className="grid w-full items-center" style={{ gridTemplateColumns: '1fr 80px 60px 52px' }}>
                        {/* 제목 */}
                        <button
                          type="button"
                          onClick={() => startEdit(task)}
                          className="flex min-w-0 items-center gap-2 px-3 py-3 text-left"
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${meta.bar}`} />
                          <span className="truncate text-xs font-medium text-gray-800 group-hover:text-gray-900">
                            {task.title}
                          </span>
                        </button>
                        {/* 담당자 */}
                        <button
                          type="button"
                          onClick={() => startEdit(task)}
                          className="theme-muted truncate px-2 py-3 text-left text-xs"
                        >
                          {task.assignee ?? '—'}
                        </button>
                        {/* 진행률 */}
                        <button
                          type="button"
                          onClick={() => startEdit(task)}
                          className="px-2 py-3 text-left"
                        >
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 w-10 overflow-hidden rounded-full bg-gray-100">
                              <div className={`h-full ${meta.bar}`} style={{ width: `${task.progress ?? 0}%` }} />
                            </div>
                            <span className="theme-muted text-[10px]">{task.progress ?? 0}%</span>
                          </div>
                        </button>
                        {/* 상태 + 삭제 */}
                        <div className="flex items-center justify-center gap-1 px-2 py-3">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
                            {meta.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            disabled={deletingId === task.id}
                            className="shrink-0 rounded p-0.5 text-gray-200 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400 disabled:opacity-30"
                          >
                            {deletingId === task.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Trash2 className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 수정 중 우측 날짜 입력 */}
                  {isEditingThis && editing && (
                    <div className="flex items-center gap-3 px-4 py-2">
                      <div className="min-w-[320px]">
                        <DateRangePickerInput
                          from={editing.start_date}
                          to={editing.due_date}
                          onChange={({ from, to }) => setEditing({ ...editing, start_date: from, due_date: to })}
                          placeholder="태스크 기간 선택"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="theme-muted text-[10px]">상태</span>
                        <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ProjectTaskStatus })} className={`${inputCls} w-24`}>
                          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Gantt 바 영역 */}
                  {!isEditingThis && (
                    <div className="relative flex" style={{ width: TOTAL_COLS * CELL_W }}>
                      {/* 오늘 강조 컬럼 */}
                      {todayCol >= 0 && (
                        <div
                          className="absolute top-0 h-full w-[32px] bg-blue-50/60"
                          style={{ left: todayCol * CELL_W }}
                        />
                      )}
                      {/* 월 구분선 */}
                      {MONTHS.map((_, mi) => (
                        <div
                          key={mi}
                          className="absolute top-0 h-full border-r border-gray-100"
                          style={{ left: (mi + 1) * 4 * CELL_W }}
                        />
                      ))}
                      {/* 바 */}
                      {bar && (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full opacity-90 cursor-pointer hover:opacity-100 transition-opacity ${meta.bar}`}
                          style={{
                            left: bar.start * CELL_W + 2,
                            width: Math.max(CELL_W - 4, (bar.end - bar.start + 1) * CELL_W - 4),
                          }}
                          onClick={() => startEdit(task)}
                          title={`${task.title} (${task.start_date ?? '?'} ~ ${task.due_date ?? '?'})`}
                        >
                          {/* 진행률 오버레이 */}
                          <div
                            className="h-full rounded-full bg-black/20"
                            style={{ width: `${task.progress ?? 0}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        {STATUS_OPTIONS.map((s) => (
          <div key={s.value} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-5 rounded-full ${s.bar}`} />
            <span className="theme-muted text-xs">{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-black/20 border border-gray-200" />
          <span className="theme-muted text-xs">진행률</span>
        </div>
      </div>
    </div>
  )
}

// ── InlineEditLeft (기존 태스크 수정 — 왼쪽 열만) ──────────────────────────

interface InlineEditLeftProps {
  editing: EditingTask
  onChange: (v: EditingTask) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}

function InlineEditLeft({ editing, onChange, onSave, onCancel, saving }: InlineEditLeftProps) {
  const set = (k: keyof EditingTask, v: string) => onChange({ ...editing, [k]: v })
  return (
    <div className="grid w-full items-center gap-1 px-3 py-2" style={{ gridTemplateColumns: '1fr 80px 60px 52px' }}>
      <input
        autoFocus
        value={editing.title}
        onChange={(e) => set('title', e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
        placeholder="태스크 제목"
        className={`${inputCls} w-full`}
      />
      <input
        value={editing.assignee}
        onChange={(e) => set('assignee', e.target.value)}
        placeholder="담당자"
        className={`${inputCls} w-full`}
      />
      <input
        type="number"
        value={editing.progress}
        onChange={(e) => set('progress', e.target.value)}
        min={0} max={100}
        placeholder="0"
        className={`${inputCls} w-full`}
      />
      <div className="flex items-center justify-center gap-1">
        <button type="button" onClick={onSave} disabled={saving} className="theme-btn-primary rounded-lg p-1.5 disabled:opacity-50">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </button>
        <button type="button" onClick={onCancel} className="theme-btn-secondary rounded-lg p-1.5">
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ── NewTaskRow (신규 추가 — 전체 행) ──────────────────────────────────────────

interface NewTaskRowProps {
  editing: EditingTask
  onChange: (v: EditingTask) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  leftWidth: number
}

function EditRow({ editing, onChange, onSave, onCancel, saving, leftWidth }: NewTaskRowProps) {
  const set = (k: keyof EditingTask, v: string) => onChange({ ...editing, [k]: v })
  return (
    <div className="flex border-b border-blue-100 bg-blue-50/40">
      <div className="sticky left-0 z-10 flex shrink-0 border-r border-gray-100 bg-blue-50/40" style={{ width: leftWidth }}>
        <div className="grid w-full items-center gap-1 px-3 py-2" style={{ gridTemplateColumns: '1fr 80px 60px 52px' }}>
          <input
            autoFocus
            value={editing.title}
            onChange={(e) => set('title', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
            placeholder="태스크 제목"
            className={`${inputCls} w-full`}
          />
          <input value={editing.assignee} onChange={(e) => set('assignee', e.target.value)} placeholder="담당자" className={`${inputCls} w-full`} />
          <input type="number" value={editing.progress} onChange={(e) => set('progress', e.target.value)} min={0} max={100} placeholder="0" className={`${inputCls} w-full`} />
          <div className="flex items-center justify-center gap-1">
            <button type="button" onClick={onSave} disabled={saving} className="theme-btn-primary rounded-lg p-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </button>
            <button type="button" onClick={onCancel} className="theme-btn-secondary rounded-lg p-1.5">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="min-w-[320px]">
          <DateRangePickerInput
            from={editing.start_date}
            to={editing.due_date}
            onChange={({ from, to }) => onChange({ ...editing, start_date: from, due_date: to })}
            placeholder="태스크 기간 선택"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="theme-muted text-[10px]">상태</span>
          <select value={editing.status} onChange={(e) => set('status', e.target.value as ProjectTaskStatus)} className={`${inputCls} w-24`}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
