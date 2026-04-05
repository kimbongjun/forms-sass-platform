export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/utils/supabase/server'
import TabNavigation from './_components/TabNavigation'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, title, slug, category, is_published')
    .eq('id', id)
    .single()

  if (error || !project) notFound()

  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      {/* 프로젝트 헤더 */}
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <Link
          href="/projects"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          프로젝트 목록
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold text-gray-900 sm:text-xl">{project.title}</h1>
              {project.category && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  {project.category}
                </span>
              )}
              <span
                className={[
                  'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  project.is_published
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500',
                ].join(' ')}
              >
                {project.is_published ? '공개' : '비공개'}
              </span>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 - 별도 행으로 분리 */}
        <div className="mt-3 -mx-1 overflow-x-auto">
          <TabNavigation projectId={project.id} />
        </div>
      </div>

      {/* 콘텐츠 */}
      <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
