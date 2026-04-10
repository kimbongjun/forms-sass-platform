'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import WorkspaceSidebar from './WorkspaceSidebar'

interface WorkspaceLayoutProps {
  children: React.ReactNode
  role?: 'administrator' | 'editor'
  isGuest?: boolean
  header: React.ReactNode
  headerRight?: React.ReactNode
  footer: React.ReactNode
}

export default function WorkspaceLayout({
  children,
  role,
  isGuest,
  header,
  headerRight,
  footer,
}: WorkspaceLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50">
      {/* 헤더 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 sm:h-16 sm:px-6">
        <div className="flex items-center gap-3">
          {/* 모바일 햄버거 */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 lg:hidden"
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </button>
          {header}
        </div>
        {headerRight && <div>{headerRight}</div>}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 모바일 오버레이 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 사이드바 */}
        <div
          className={[
            'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:relative lg:inset-auto lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          {/* 모바일 닫기 버튼 */}
          <div className="flex h-14 shrink-0 items-center justify-end border-b border-gray-100 px-4 sm:h-16 lg:hidden">
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <WorkspaceSidebar role={role} isGuest={isGuest} />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
      </div>

      {footer}
    </div>
  )
}
