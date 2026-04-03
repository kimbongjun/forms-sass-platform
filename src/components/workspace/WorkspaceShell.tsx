import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import classysLogo from '@/imgs/classys_logo.svg'
import { createServerClient, getUserRole } from '@/utils/supabase/server'
import { getGlobalSiteSettings, getResolvedSiteTitle } from '@/utils/site-settings'
import UserMenu from '@/components/dashboard/UserMenu'
import WorkspaceSidebar from './WorkspaceSidebar'

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
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <Link href="/dashboard" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image src={classysLogo} alt={siteTitle} width={118} height={26} priority className="h-7 w-auto" />
          <span className="text-sm font-semibold text-gray-900">{siteTitle}</span>
        </Link>
        <UserMenu email={user.email ?? ''} role={role} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <WorkspaceSidebar role={role} />
        <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
      </div>

      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-gray-200 bg-white px-6 text-xs text-gray-400">
        <div className="flex items-center gap-4">
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
        <p>{footerText}</p>
        <div />
      </footer>
    </div>
  )
}
