'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  CalendarRange,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { DateRangePickerInput } from '@/components/common/DatePickerInput'
import { SkeletonBlock } from '@/components/common/LoadingSkeleton'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { createClient } from '@/utils/supabase/client'
import { ProjectTask, ProjectTaskStatus } from '@/types/project-task'

const COLUMNS: { id: ProjectTaskStatus; label: string; surface: string; badge: string }[] = [
  { id: 'todo', label: '예정', surface: 'bg-gray-50 dark:bg-white/[0.03]', badge: 'theme-status-badge-todo' },
  { id: 'in_progress', label: '진행 중', surface: 'bg-blue-50 dark:bg-blue-500/10', badge: 'theme-status-badge-progress' },
  { id: 'done', label: '완료', surface: 'bg-emerald-50 dark:bg-emerald-500/10', badge: 'theme-status-badge-done' },
  { id: 'hold', label: '보류', surface: 'bg-amber-50 dark:bg-amber-500/10', badge: 'theme-status-badge-hold' },
]

const statusMeta = Object.fromEntries(COLUMNS.map((column) => [column.id, column])) as Record<ProjectTaskStatus, (typeof COLUMNS)[number]>

interface EditingTask {
  id: string | null
  title: string
  assignee: string
  start_date: string
  due_date: string
  status: ProjectTaskStatus
  progress: string
}

interface KanbanBoardProps {
  projectId: string
  initialTasks?: ProjectTask[]
  onTasksChange?: (tasks: ProjectTask[]) => void
  embedded?: boolean
}

function emptyEditing(status: ProjectTaskStatus = 'todo'): EditingTask {
  return {
    id: null,
    title: '',
    assignee: '',
    start_date: '',
    due_date: '',
    status,
    progress: '0',
  }
}

function normalizeTask(task: Partial<ProjectTask> & Pick<ProjectTask, 'id' | 'project_id' | 'title' | 'status' | 'order_index'>): ProjectTask {
  return {
    id: task.id,
    project_id: task.project_id,
    title: task.title,
    assignee: task.assignee ?? null,
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    status: task.status,
    progress: task.progress ?? 0,
    order_index: task.order_index,
  }
}

function formatPeriod(task: Pick<ProjectTask, 'start_date' | 'due_date'>) {
  if (task.start_date && task.due_date) return `${task.start_date} - ${task.due_date}`
  return task.start_date ?? task.due_date ?? '기간 미정'
}

function DraggableCard({
  task,
  onDelete,
  onEdit,
}: {
  task: ProjectTask
  onDelete: (id: string) => void
  onEdit: (task: ProjectTask) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const dragAttributes = { ...attributes }
  delete (dragAttributes as { role?: string }).role
  delete (dragAttributes as { tabIndex?: number }).tabIndex

  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined
  const meta = statusMeta[task.status]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'theme-panel group rounded-2xl border p-3 shadow-sm transition-all select-none',
        isDragging ? 'opacity-40 shadow-lg' : 'hover:-translate-y-0.5 hover:shadow-md',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <div
          {...dragAttributes}
          {...listeners}
          className="theme-btn-icon mt-0.5 shrink-0 cursor-grab touch-none rounded-lg p-1 active:cursor-grabbing"
          aria-label="태스크 순서 이동"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onEdit(task)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onEdit(task)
            }
          }}
          className="min-w-0 flex-1 cursor-pointer text-left"
          aria-label={`${task.title} 편집`}
        >
          <p className="theme-title text-sm font-semibold leading-snug">{task.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
              {meta.label}
            </span>
            <span className="theme-muted inline-flex items-center gap-1 text-[11px]">
              <CalendarRange className="h-3 w-3" />
              {formatPeriod(task)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="theme-progress-track h-1.5 flex-1 overflow-hidden rounded-full">
              <div className="theme-progress-fill h-full rounded-full" style={{ width: `${task.progress ?? 0}%` }} />
            </div>
            <span className="theme-muted text-[11px] font-medium">{task.progress ?? 0}%</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="theme-muted inline-flex items-center gap-1 text-[11px]">
              <UserRound className="h-3 w-3" />
              {task.assignee ?? '담당자 미정'}
            </span>
            <span className="theme-muted inline-flex items-center gap-1 text-[11px]">
              <Target className="h-3 w-3" />
              Gantt 연동
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="theme-btn-icon rounded-lg p-1"
            aria-label="태스크 편집"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="theme-btn-danger rounded-lg p-1"
            aria-label="태스크 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function DroppableColumn({
  column,
  tasks,
  onAdd,
  onDelete,
  onEdit,
}: {
  column: (typeof COLUMNS)[number]
  tasks: ProjectTask[]
  onAdd: (columnId: ProjectTaskStatus, title: string) => Promise<void>
  onDelete: (id: string) => void
  onEdit: (task: ProjectTask) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [adding, setAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  async function handleAdd() {
    const title = inputValue.trim()
    if (!title) {
      setAdding(false)
      return
    }
    setSaving(true)
    await onAdd(column.id, title)
    setInputValue('')
    setSaving(false)
    setAdding(false)
  }

  return (
    <div className="flex min-w-[280px] flex-1 flex-col rounded-[24px] border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${column.badge}`}>{column.label}</span>
          <span className="theme-muted text-xs font-medium">{tasks.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="theme-btn-icon rounded-lg p-1"
          title="태스크 추가"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={[
          'flex flex-1 flex-col gap-2 overflow-y-auto p-3 transition-colors',
          isOver ? column.surface : '',
        ].join(' ')}
        style={{ minHeight: 220 }}
      >
        {tasks.map((task) => (
          <DraggableCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />
        ))}

        {adding && (
          <div className="theme-panel rounded-2xl border p-3 shadow-sm">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') {
                  setAdding(false)
                  setInputValue('')
                }
              }}
              placeholder="태스크 제목"
              className="theme-input w-full rounded-xl px-3 py-2 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving}
                className="theme-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                추가
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setInputValue('')
                }}
                className="theme-btn-secondary rounded-xl px-3 py-1.5 text-xs font-medium"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TaskEditSheet({
  editing,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  editing: EditingTask
  saving: boolean
  onChange: (next: EditingTask) => void
  onClose: () => void
  onSave: () => void
}) {
  const set = (key: keyof EditingTask, value: string) => onChange({ ...editing, [key]: value })

  useEscapeKey(true, onClose)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0e1525]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <div>
            <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Task Planner</p>
            <h3 className="theme-title mt-1 text-lg font-semibold">
              {editing.id ? '태스크 상세 편집' : '새 태스크 만들기'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="theme-btn-icon rounded-xl p-2"
            aria-label="편집 패널 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <section className="space-y-2">
            <label className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">Title</label>
            <input
              autoFocus
              value={editing.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="예: 행사장 운영 동선 확정"
              className="theme-input w-full rounded-2xl px-4 py-3 text-sm"
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">Owner</label>
              <input
                value={editing.assignee}
                onChange={(e) => set('assignee', e.target.value)}
                placeholder="담당자"
                className="theme-input w-full rounded-2xl px-4 py-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">Status</label>
              <select
                value={editing.status}
                onChange={(e) => set('status', e.target.value as ProjectTaskStatus)}
                className="theme-input w-full rounded-2xl px-4 py-3 text-sm"
              >
                {COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">Period</label>
              <span className="theme-muted text-xs">칸반에서 입력한 기간이 Gantt에 반영됩니다.</span>
            </div>
            <DateRangePickerInput
              from={editing.start_date}
              to={editing.due_date}
              onChange={({ from, to }) => onChange({ ...editing, start_date: from, due_date: to })}
              placeholder="시작일과 종료일 선택"
            />
          </section>

          <section className="space-y-3 rounded-[24px] border border-gray-200 bg-gray-50 px-4 py-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <label className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">Progress</label>
              <span className="theme-title text-sm font-semibold">{editing.progress || '0'}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={editing.progress}
              onChange={(e) => set('progress', e.target.value)}
              className="w-full accent-gray-900 dark:accent-white"
            />
            <div className="theme-progress-track h-2 overflow-hidden rounded-full">
              <div className="theme-progress-fill h-full rounded-full" style={{ width: `${editing.progress || '0'}%` }} />
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="theme-btn-secondary rounded-2xl px-4 py-2 text-sm font-medium"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="theme-btn-primary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KanbanBoard({
  projectId,
  initialTasks,
  onTasksChange,
  embedded = false,
}: KanbanBoardProps) {
  const controlled = initialTasks !== undefined
  const [localTasks, setLocalTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(!controlled)
  const [error, setError] = useState('')
  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null)
  const [editing, setEditing] = useState<EditingTask | null>(null)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const tasks = useMemo(() => (controlled ? (initialTasks ?? []) : localTasks), [controlled, initialTasks, localTasks])

  function updateTasks(next: ProjectTask[] | ((prev: ProjectTask[]) => ProjectTask[])) {
    const resolved = typeof next === 'function' ? next(tasks) : next
    if (!controlled) setLocalTasks(resolved)
    if (onTasksChange) onTasksChange(resolved)
  }

  useEffect(() => {
    if (controlled) return

    async function load() {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('project_tasks')
        .select('id, project_id, title, assignee, start_date, due_date, status, progress, order_index')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true })

      if (err) {
        setError(err.message)
      } else {
        setLocalTasks((data ?? []).map(normalizeTask))
      }
      setLoading(false)
    }

    load()
  }, [controlled, projectId])

  const taskSummary = useMemo(() => {
    const total = tasks.length
    const planned = tasks.filter((task) => task.start_date || task.due_date).length
    const inFlight = tasks.filter((task) => task.status === 'in_progress').length
    const completed = tasks.filter((task) => task.status === 'done').length
    return { total, planned, inFlight, completed }
  }, [tasks])

  function openNewTask(status: ProjectTaskStatus = 'todo') {
    setEditing(emptyEditing(status))
  }

  function openEditTask(task: ProjectTask) {
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

  async function handleSaveEditing() {
    if (!editing) return
    const title = editing.title.trim()
    if (!title) {
      setError('태스크 제목을 입력해 주세요.')
      return
    }

    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = {
      title,
      assignee: editing.assignee.trim() || null,
      start_date: editing.start_date || null,
      due_date: editing.due_date || null,
      status: editing.status,
      progress: Math.min(100, Math.max(0, parseInt(editing.progress, 10) || 0)),
    }

    if (editing.id) {
      const { data, error: err } = await supabase
        .from('project_tasks')
        .update(payload)
        .eq('id', editing.id)
        .select('id, project_id, title, assignee, start_date, due_date, status, progress, order_index')
        .single()

      if (err) {
        setError(err.message)
      } else if (data) {
        updateTasks((prev) => prev.map((task) => (task.id === data.id ? normalizeTask(data) : task)))
        setEditing(null)
      }
    } else {
      const maxIndex = tasks.filter((task) => task.status === editing.status).length
      const { data, error: err } = await supabase
        .from('project_tasks')
        .insert({ ...payload, project_id: projectId, order_index: maxIndex })
        .select('id, project_id, title, assignee, start_date, due_date, status, progress, order_index')
        .single()

      if (err) {
        setError(err.message)
      } else if (data) {
        updateTasks((prev) => [...prev, normalizeTask(data)])
        setEditing(null)
      }
    }

    setSaving(false)
  }

  async function handleAdd(columnId: ProjectTaskStatus, title: string) {
    const supabase = createClient()
    const maxIndex = tasks.filter((task) => task.status === columnId).length
    const { data, error: err } = await supabase
      .from('project_tasks')
      .insert({ project_id: projectId, title, status: columnId, progress: 0, order_index: maxIndex })
      .select('id, project_id, title, assignee, start_date, due_date, status, progress, order_index')
      .single()

    if (err) {
      setError(err.message)
      return
    }

    updateTasks((prev) => [...prev, normalizeTask(data)])
  }

  async function handleDelete(id: string) {
    const previous = tasks
    updateTasks((prev) => prev.filter((task) => task.id !== id))

    const supabase = createClient()
    const { error: err } = await supabase.from('project_tasks').delete().eq('id', id)

    if (err) {
      updateTasks(previous)
      setError(err.message)
    }

    if (editing?.id === id) setEditing(null)
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((item) => item.id === event.active.id)
    setActiveTask(task ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const draggedTask = tasks.find((task) => task.id === active.id)
    if (!draggedTask) return

    const newStatus = over.id as ProjectTaskStatus
    if (!COLUMNS.some((column) => column.id === newStatus) || draggedTask.status === newStatus) return

    const previous = tasks
    updateTasks((prev) =>
      prev.map((task) => (task.id === draggedTask.id ? { ...task, status: newStatus } : task))
    )

    const supabase = createClient()
    const { error: err } = await supabase
      .from('project_tasks')
      .update({ status: newStatus })
      .eq('id', draggedTask.id)

    if (err) {
      updateTasks(previous)
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="min-w-[280px] flex-1 rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-5 w-24 rounded-full" />
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
            </div>
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <div key={cardIndex} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <SkeletonBlock className="h-4 w-4/5" />
                  <SkeletonBlock className="mt-2 h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!embedded && (
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard label="전체 태스크" value={taskSummary.total} />
          <SummaryCard label="일정 입력 완료" value={taskSummary.planned} />
          <SummaryCard label="진행 중" value={taskSummary.inFlight} />
          <SummaryCard label="완료" value={taskSummary.completed} />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="theme-muted text-xs font-semibold uppercase tracking-[0.24em]">Kanban</p>
          <h3 className="theme-title mt-1 text-lg font-semibold">태스크를 칸반으로 먼저 구성하세요</h3>
          <p className="theme-muted mt-1 text-sm">카드에 기간과 진행률을 입력하면 아래 Gantt 차트에 바로 이어집니다.</p>
        </div>
        <button
          type="button"
          onClick={() => openNewTask()}
          className="theme-btn-primary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          새 태스크
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              tasks={tasks.filter((task) => task.status === column.id)}
              onAdd={handleAdd}
              onDelete={handleDelete}
              onEdit={openEditTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="theme-panel rounded-2xl border p-3 shadow-2xl opacity-95">
              <p className="theme-title text-sm font-semibold">{activeTask.title}</p>
              <p className="theme-muted mt-1 text-xs">{formatPeriod(activeTask)}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editing ? (
        <TaskEditSheet
          editing={editing}
          saving={saving}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEditing}
        />
      ) : null}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="theme-panel rounded-[24px] border px-4 py-4 shadow-sm">
      <p className="theme-muted text-xs font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="theme-title mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
