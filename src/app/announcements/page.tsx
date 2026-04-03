import { createServerClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Megaphone, ChevronRight } from 'lucide-react'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
}

export default async function AnnouncementsPage() {
  const supabase = await createServerClient()
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, created_at, is_pinned')
    .eq('is_published', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-gray-500" />
        <h1 className="text-xl font-bold text-gray-900">공지사항</h1>
      </div>
      {(!announcements || announcements.length === 0) ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <p className="text-sm text-gray-400">등록된 공지사항이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {announcements.map((a, i) => (
            <Link
              key={a.id}
              href={`/announcements/${a.id}`}
              className={[
                'flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50',
                i > 0 ? 'border-t border-gray-100' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 min-w-0">
                {a.is_pinned && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">공지</span>
                )}
                <span className="truncate text-sm font-medium text-gray-900">{a.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3 ml-4">
                <span className="text-xs text-gray-400">{formatDate(a.created_at)}</span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
