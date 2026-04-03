import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import classysLogo from '@/imgs/classys_logo.svg'
import { createServerClient } from '@/utils/supabase/server'
import { getGlobalSiteSettings, getResolvedSiteTitle } from '@/utils/site-settings'

export default async function Home() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  const siteTitle = getResolvedSiteTitle(await getGlobalSiteSettings())

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="space-y-4">
          <div className="flex justify-center">
            <Image src={classysLogo} alt={siteTitle} width={180} height={40} priority className="h-10 w-auto" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">{siteTitle}</h1>
            <p className="text-sm text-gray-500">
              프로젝트 생성부터 실행, 응답 수집, 인사이트 확인까지 한 흐름으로 관리합니다.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            로그인
          </Link>
        </div>
      </div>
    </div>
  )
}
