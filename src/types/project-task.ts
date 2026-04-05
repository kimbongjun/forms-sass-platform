export type ProjectTaskStatus = 'todo' | 'in_progress' | 'done' | 'hold'

export interface ProjectTask {
  id: string
  project_id: string
  title: string
  assignee: string | null
  start_date: string | null
  due_date: string | null
  status: ProjectTaskStatus
  progress: number
  order_index: number
}
