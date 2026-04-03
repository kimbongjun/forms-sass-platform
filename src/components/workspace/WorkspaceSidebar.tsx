'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bell,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  Plus,
  Settings,
  Share2,
  Users,
} from 'lucide-react'
import { WORKSPACE_HUBS } from '@/constants/ia'

const HUB_ICONS = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  engagement: BarChart3,
  shared: Share2,
}

const ADMIN_LINKS = [
  { href: '/dashboard/admin/users', label: '회원 관리', Icon: Users },
  { href: '/dashboard/admin/settings', label: '사이트 설정', Icon: Settings },
  { href: '/dashboard/admin/announcements', label: '공지사항 관리', Icon: Megaphone },
  { href: '/dashboard/admin/release-notes', label: '릴리즈노트 관리', Icon: Bell },
]

function isActive(pathname: string, hubKey: string) {
  return pathname === `/${hubKey}` || pathname.startsWith(`/${hubKey}/`)
}

interface WorkspaceSidebarProps {
  role?: 'administrator' | 'editor'
}

export default function WorkspaceSidebar({ role = 'editor' }: WorkspaceSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">Quick Action</p>
        <Link
          href="/projects/new"
          className="mt-3 flex items-center justify-between rounded-2xl bg-gray-900 px-4 py-4 text-white transition-colors hover:bg-gray-800"
        >
          <div>
            <p className="text-sm font-semibold">신규 프로젝트 생성</p>
          </div>
          <Plus className="h-4 w-4 shrink-0" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {WORKSPACE_HUBS.map((hub) => {
          const Icon = HUB_ICONS[hub.key]
          const active = isActive(pathname, hub.key)

          return (
            <Link
              key={hub.key}
              href={hub.href}
              className={[
                'flex items-start gap-3 rounded-2xl px-4 py-3 transition-colors',
                active
                  ? 'brand-active'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{hub.label}</p>
                <p className={['mt-1 text-xs', active ? 'text-gray-300' : 'text-gray-400'].join(' ')}>
                  {hub.description}
                </p>
              </div>
            </Link>
          )
        })}

        {role === 'administrator' && (
          <div className="pt-3">
            <div className="border-t border-gray-100 pt-3">
              <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">Admin</p>
              {ADMIN_LINKS.map(({ href, label, Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={[
                      'flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors',
                      active
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-amber-600 hover:bg-amber-50 hover:text-amber-700',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-medium">{label}</p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-gray-100 px-4 py-4">
        <div className="mt-3 space-y-1 text-sm">
          <Link href="/dashboard/account" className={[
            'flex items-center gap-2 rounded-xl px-3 py-2 transition-colors',
            pathname === '/dashboard/account'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
          ].join(' ')}>
            <Settings className="h-3.5 w-3.5 shrink-0" />
            계정 설정
          </Link>
          <Link href="/announcements" className="flex items-center gap-2 rounded-xl px-3 py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
            <Megaphone className="h-3.5 w-3.5 shrink-0" />
            공지사항
          </Link>
          <Link href="/release-notes" className="flex items-center gap-2 rounded-xl px-3 py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
            <Bell className="h-3.5 w-3.5 shrink-0" />
            릴리즈노트
          </Link>
        </div>
      </div>
    </aside>
  )
}
