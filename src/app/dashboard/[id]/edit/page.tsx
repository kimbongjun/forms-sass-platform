import { notFound } from 'next/navigation'
import { createServerClient } from '@/utils/supabase/server'
import EditFormBuilder from '@/components/builder/EditFormBuilder'

interface EditPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPage({ params }: EditPageProps) {
  const { id } = await params
  const supabase = await createServerClient()

  const [{ data: project, error: projectErr }, { data: fields }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase
      .from('form_fields')
      .select('*')
      .eq('project_id', id)
      .order('order_index', { ascending: true }),
  ])

  if (projectErr || !project) notFound()

  return <EditFormBuilder project={project} initialFields={fields ?? []} />
}
