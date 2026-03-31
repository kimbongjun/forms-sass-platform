import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'
import { createServerClient, getUserRole } from '@/utils/supabase/server'
import AdminUserList from '@/components/dashboard/AdminUserList'
import UserMenu from '@/components/dashboard/UserMenu'

export default async function AdminUsersPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = await getUserRole(user.id)
  if (role !== 'administrator') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-500" />
              <h1 className="text-base font-semibold text-gray-900">회원 관리</h1>
            </div>
          </div>
          <UserMenu email={user.email ?? ''} role="administrator" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <AdminUserList />
      </main>
    </div>
  )
}
