export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createServerClient } from '@/utils/supabase/server'
import EditFormBuilder from '@/components/builder/EditFormBuilder'

interface EditProjectFormsPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProjectFormsPage({ params }: EditProjectFormsPageProps) {
  const { id } = await params
  const supabase = await createServerClient()

  const [{ data: project, error: projectError }, { data: fields }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('form_fields').select('*').eq('project_id', id).order('order_index', { ascending: true }),
  ])

  if (projectError || !project) notFound()

  const initialDeadline = project.deadline
    ? new Intl.DateTimeFormat('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul',
      }).format(new Date(project.deadline)).replace(' ', 'T')
    : ''

  return <EditFormBuilder project={project} initialFields={fields ?? []} initialDeadline={initialDeadline} embedded />
}
