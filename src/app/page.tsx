import { redirect } from 'next/navigation'
import { createServerClient } from '@/utils/supabase/server'
import SiteLogo from '@/components/common/SiteLogo'
import AuthForm from '@/components/auth/AuthForm'
import { getGlobalSiteSettings, getResolvedSiteTitle } from '@/utils/site-settings'

export default async function Home() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  const siteSettings = await getGlobalSiteSettings()
  const siteTitle = getResolvedSiteTitle(siteSettings)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <SiteLogo settings={siteSettings} alt={siteTitle} className="h-10 w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{siteTitle}</h1>
        <p className="mt-1.5 text-sm text-gray-500">프로젝트 생성과 운영 현황을 통합 관리하는 업무 시스템입니다.</p>
      </div>
      <AuthForm />
    </div>
  )
}
