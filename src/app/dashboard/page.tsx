import Link from 'next/link'
import { createServerClient, getUserRole } from '@/utils/supabase/server'
import { Plus, LayoutDashboard } from 'lucide-react'
import ProjectList from '@/components/dashboard/ProjectList'
import UserMenu from '@/components/dashboard/UserMenu'

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: projects, error }, role] = await Promise.all([
    supabase
      .from('projects')
      .select(`id, title, slug, banner_url, created_at, is_published, form_fields (count)`)
      .order('created_at', { ascending: false }),
    user ? getUserRole(user.id) : Promise.resolve('editor' as const),
  ])

  const normalized = (projects ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    banner_url: p.banner_url ?? null,
    created_at: p.created_at,
    is_published: p.is_published ?? true,
    fieldCount:
      Array.isArray(p.form_fields) && p.form_fields.length > 0
        ? (p.form_fields[0] as { count: number }).count
        : 0,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2 text-gray-900">
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-lg font-semibold">프로젝트 목록</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/new"
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              <Plus className="h-4 w-4" />
              새 프로젝트
            </Link>
            <UserMenu email={user?.email ?? ''} role={role} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            데이터를 불러오는 중 오류가 발생했습니다: {error.message}
          </div>
        )}
        <ProjectList projects={normalized} />
      </main>
    </div>
  )
}
