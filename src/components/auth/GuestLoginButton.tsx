'use client'

import Link from 'next/link'
import { LogIn } from 'lucide-react'

export default function GuestLoginButton() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
    >
      <LogIn className="h-3.5 w-3.5 text-gray-400" />
      로그인
    </Link>
  )
}
