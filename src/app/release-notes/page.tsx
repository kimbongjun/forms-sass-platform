import { createServerClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Tag } from 'lucide-react'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
}

export default async function ReleaseNotesPage() {
  const supabase = await createServerClient()
  const { data: notes } = await supabase
    .from('release_notes')
    .select('id, version, title, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-gray-500" />
          <h1 className="text-xl font-bold text-gray-900">릴리즈노트</h1>
        </div>
        <p className="mt-1 text-sm text-gray-400">업데이트 내역과 변경 사항을 확인합니다.</p>
      </div>
      {(!notes || notes.length === 0) ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <p className="text-sm text-gray-400">등록된 릴리즈노트가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((n) => (
            <Link
              key={n.id}
              href={`/release-notes/${n.id}`}
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-5 py-4 transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-mono font-semibold text-white">{n.version}</span>
                <span className="text-sm font-medium text-gray-900">{n.title}</span>
              </div>
              <span className="shrink-0 text-xs text-gray-400 ml-4">{formatDate(n.created_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
