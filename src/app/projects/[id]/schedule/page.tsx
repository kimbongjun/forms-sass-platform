import { notFound } from 'next/navigation'
import { createServerClient } from '@/utils/supabase/server'
import SchedulePlanner from './_components/SchedulePlanner'

interface SchedulePageProps {
  params: Promise<{ id: string }>
}

export default async function SchedulePage({ params }: SchedulePageProps) {
  const { id } = await params
  const supabase = await createServerClient()

  const [{ error }, { data: tasks }] = await Promise.all([
    supabase.from('projects').select('id').eq('id', id).single(),
    supabase
      .from('project_tasks')
      .select('id, project_id, title, assignee, start_date, due_date, status, progress, order_index')
      .eq('project_id', id)
      .order('order_index', { ascending: true }),
  ])

  if (error) notFound()

  const normalizedTasks = (tasks ?? []).map((t) => ({
    ...t,
    progress: t.progress ?? 0,
    start_date: t.start_date ?? null,
  }))

  return <SchedulePlanner projectId={id} initialTasks={normalizedTasks} />
}
