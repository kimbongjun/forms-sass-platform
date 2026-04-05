import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import classysLogo from '@/imgs/classys_logo.svg'
import { createServerClient, getUserRole } from '@/utils/supabase/server'
import { getGlobalSiteSettings, getResolvedSiteTitle } from '@/utils/site-settings'
import UserMenu from '@/components/dashboard/UserMenu'
import WorkspaceLayout from './WorkspaceLayout'

interface WorkspaceShellProps {
  children: React.ReactNode
}

export default async function WorkspaceShell({ children }: WorkspaceShellProps) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [role, siteSettings] = await Promise.all([getUserRole(user.id), getGlobalSiteSettings()])
  const siteTitle = getResolvedSiteTitle(siteSettings)
  const footerText = siteSettings.footer_text || `© ${siteTitle}. All rights reserved.`

  return (
    <WorkspaceLayout
      role={role}
      header={
        <Link href="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image src={classysLogo} alt={siteTitle} width={118} height={26} priority className="h-7 w-auto" />
          <span className="hidden text-sm font-semibold text-gray-900 sm:inline">{siteTitle}</span>
        </Link>
      }
      headerRight={<UserMenu email={user.email ?? ''} role={role} />}
      footer={
        <footer className="border-t border-gray-200 bg-white px-4 py-3 text-xs text-gray-400 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <Link href="/privacy" className="transition-colors hover:text-gray-600">
                개인정보처리방침
              </Link>
              <Link href="/terms" className="transition-colors hover:text-gray-600">
                이용약관
              </Link>
              <Link href="/service" className="transition-colors hover:text-gray-600">
                서비스이용동의
              </Link>
            </div>
            <p className="sm:text-right">{footerText}</p>
          </div>
        </footer>
      }
    >
      {children}
    </WorkspaceLayout>
  )
}
