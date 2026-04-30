'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  Bell,
  FolderKanban,
  Grape,
  LayoutDashboard,
  Lock,
  Megaphone,
  Monitor,
  Settings,
  Share2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import ThemeToggle from '@/components/common/ThemeToggle'
import { WORKSPACE_HUBS } from '@/constants/ia'

const GUEST_RESTRICTED = new Set(['dashboard', 'projects'])

const HUB_ICONS = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  engagement: BarChart3,
  shared: Share2,
  blueberry: Grape,
  monitoring: Monitor,
  'some-content': TrendingUp,
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
  isGuest?: boolean
}

export default function WorkspaceSidebar({ role = 'editor', isGuest = false }: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r theme-divider theme-panel">
      {/* 권한 없음 토스트 */}
      {toast && (
        <div className="absolute left-4 top-4 z-50 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-md">
          <Lock className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm font-medium text-red-700">권한이 없습니다. 로그인 후 이용해주세요.</p>
          <button onClick={() => setToast(false)} className="ml-1 text-red-400 hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {WORKSPACE_HUBS.map((hub) => {
          const Icon = HUB_ICONS[hub.key]
          const active = isActive(pathname, hub.key)
          const restricted = isGuest && GUEST_RESTRICTED.has(hub.key)

          if (restricted) {
            return (
              <button
                key={hub.key}
                type="button"
                onClick={() => setToast(true)}
                className="flex w-full items-start gap-3 rounded-xl px-3.5 py-2.5 text-left text-gray-400 transition-colors hover:bg-gray-50"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{hub.label}</p>
                    <Lock className="h-3 w-3 text-gray-300" />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-300">{hub.description}</p>
                </div>
              </button>
            )
          }

          return (
            <Link
              key={hub.key}
              href={hub.href}
              className={[
                'flex items-start gap-3 rounded-xl px-3.5 py-2.5 transition-colors',
                active
                  ? 'brand-active'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">{hub.label}</p>
                <p className={['mt-0.5 text-xs leading-relaxed', active ? 'opacity-70' : 'text-gray-400'].join(' ')}>
                  {hub.description}
                </p>
              </div>
            </Link>
          )
        })}

        {role === 'administrator' && (
          <div className="pt-3">
            <div className="border-t theme-divider pt-3">
              <p className="px-3.5 pb-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-500">Admin</p>
              {ADMIN_LINKS.map(({ href, label, Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={[
                      'flex items-center gap-3 rounded-xl px-3.5 py-2 transition-colors',
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

      <div className="border-t theme-divider px-4 py-4">
        <div className="mt-2 space-y-0.5 text-sm">
          {!isGuest && (
            <Link href="/dashboard/account" className={[
              'flex items-center gap-2 rounded-lg px-3 py-2 transition-colors',
              pathname === '/dashboard/account'
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
            ].join(' ')}>
              <Settings className="h-3.5 w-3.5 shrink-0" />
              계정 설정
            </Link>
          )}
          <Link href="/announcements" className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
            <Megaphone className="h-3.5 w-3.5 shrink-0" />
            공지사항
          </Link>
          <Link href="/release-notes" className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
            <Bell className="h-3.5 w-3.5 shrink-0" />
            릴리즈노트
          </Link>
        </div>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
