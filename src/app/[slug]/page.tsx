import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createServerClient } from '@/utils/supabase/server'
import PublicForm from '@/components/form/PublicForm'

interface SlugPageProps {
  params: Promise<{ slug: string }>
}

export default async function SlugPage({ params }: SlugPageProps) {
  const { slug } = await params
  const supabase = await createServerClient()

  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .single()

  if (projectErr && projectErr.code !== 'PGRST116') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 p-8 text-center">
        <p className="text-lg font-semibold text-red-600">폼을 불러올 수 없습니다</p>
        <p className="text-sm text-gray-500">{projectErr.message}</p>
      </div>
    )
  }

  if (!project) notFound()

  // ── 비공개 폼 ──────────────────────────────────────────────────────────────
  if (project.is_published === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 p-8 text-center">
        <p className="text-2xl font-bold text-gray-700">비공개 폼</p>
        <p className="text-sm text-gray-400">이 폼은 현재 비공개 상태입니다.</p>
      </div>
    )
  }

  // ── 마감일 초과 ────────────────────────────────────────────────────────────
  if (project.deadline && new Date(project.deadline) < new Date()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 p-8 text-center">
        <p className="text-2xl font-bold text-gray-700">제출 마감</p>
        <p className="text-sm text-gray-400">이 폼의 제출 기간이 종료되었습니다.</p>
      </div>
    )
  }

  // ── 최대 응답 수 초과 ──────────────────────────────────────────────────────
  if (project.max_submissions) {
    const { count } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
    if ((count ?? 0) >= project.max_submissions) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 p-8 text-center">
          <p className="text-2xl font-bold text-gray-700">응답 마감</p>
          <p className="text-sm text-gray-400">최대 응답 수에 도달했습니다.</p>
        </div>
      )
    }
  }

  const { data: fields } = await supabase
    .from('form_fields')
    .select('*')
    .eq('project_id', project.id)
    .order('order_index', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      {project.banner_url && (
        <div className="relative h-48 w-full overflow-hidden sm:h-64">
          <Image
            src={project.banner_url}
            alt="배너 이미지"
            fill
            className="object-cover"
            priority
          />
        </div>
      )}
      <div className="mx-auto w-full max-w-xl px-4 py-10">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">{project.title}</h1>
        <PublicForm
          projectId={project.id}
          fields={fields ?? []}
          themeColor={project.theme_color ?? '#111827'}
        />
      </div>
    </div>
  )
}
