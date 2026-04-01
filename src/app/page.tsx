import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/utils/supabase/server'

export default async function Home() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 shadow-sm text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">CLASSYS Form & Survey Builder</h1>
          <p className="text-gray-500 text-sm">
            폼과 배너를 직접 구성해 고유 링크를 생성하고 공유하세요.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            시작하기
          </Link>
        </div>
        <p className="text-sm text-gray-400">문의 : 김봉준 책임</p>
      </div>
    </div>
  )
}
