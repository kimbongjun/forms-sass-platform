import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient, getUserRole } from '@/utils/supabase/server'
import AccountForm from '@/components/dashboard/AccountForm'
import UserMenu from '@/components/dashboard/UserMenu'

export default async function AccountPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) notFound()

  const role = await getUserRole(user.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-base font-semibold text-gray-900">계정 설정</h1>
          </div>
          <UserMenu email={user.email ?? ''} role={role} />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <AccountForm email={user.email ?? ''} />
      </main>
    </div>
  )
}
