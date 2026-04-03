import Link from 'next/link'
import { createServerClient } from '@/utils/supabase/server'

export default async function SiteHeader() {
  let siteName = '클래시스 폼'
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.from('site_settings').select('settings').eq('id', 1).single()
    siteName = data?.settings?.site_title || siteName
  } catch { /* use default */ }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-8">
        <Link href="/" className="text-sm font-bold text-gray-900 hover:text-gray-600 transition-colors">
          {siteName}
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/announcements"
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            공지사항
          </Link>
          <Link
            href="/release-notes"
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            릴리즈노트
          </Link>
        </nav>
      </div>
    </header>
  )
}
