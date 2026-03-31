'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, LogOut, Settings, ChevronDown, Shield } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface UserMenuProps {
  email: string
  role?: 'administrator' | 'editor'
}

export default function UserMenu({ email, role = 'editor' }: UserMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
      >
        {role === 'administrator'
          ? <Shield className="h-3.5 w-3.5 text-amber-500" />
          : <User className="h-3.5 w-3.5 text-gray-400" />
        }
        <span className="max-w-40 truncate">{email}</span>
        {role === 'administrator' && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">관리자</span>
        )}
        <ChevronDown className="h-3 w-3 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-100 px-4 py-2.5">
              <p className="truncate text-xs text-gray-400">{email}</p>
              <p className={`mt-0.5 text-xs font-medium ${role === 'administrator' ? 'text-amber-600' : 'text-gray-500'}`}>
                {role === 'administrator' ? '관리자' : '에디터'}
              </p>
            </div>

            {role === 'administrator' && (
              <Link
                href="/dashboard/admin/users"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-600 transition-colors hover:bg-amber-50"
              >
                <Shield className="h-3.5 w-3.5" />
                회원 관리
              </Link>
            )}

            <Link
              href="/dashboard/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Settings className="h-3.5 w-3.5 text-gray-400" />
              계정 설정
            </Link>

            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
