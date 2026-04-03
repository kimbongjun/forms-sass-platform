import { createServerClient, getUserRole } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import DeleteReleaseNoteButton from './DeleteReleaseNoteButton'
import GenerateReleaseNoteButton from './GenerateReleaseNoteButton'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

export default async function AdminReleaseNotesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const role = await getUserRole(user.id)
  if (role !== 'administrator') redirect('/dashboard')

  const { data: notes } = await supabase
    .from('release_notes')
    .select('id, version, title, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">릴리즈노트 관리</h1>
          <p className="text-xs text-gray-400">총 {notes?.length ?? 0}건</p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReleaseNoteButton />
          <Link
            href="/dashboard/admin/release-notes/new"
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            새 릴리즈
          </Link>
        </div>
      </div>

      {(!notes || notes.length === 0) ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <p className="text-sm text-gray-400">등록된 릴리즈노트가 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {notes.map((n, i) => (
            <div key={n.id} className={['flex items-center gap-4 px-5 py-4', i > 0 ? 'border-t border-gray-100' : ''].join(' ')}>
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className="shrink-0 rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-mono font-semibold text-white">{n.version}</span>
                <span className="truncate text-sm font-medium text-gray-900">{n.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-gray-400">{formatDate(n.created_at)}</span>
                <Link
                  href={`/dashboard/admin/release-notes/${n.id}/edit`}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                  편집
                </Link>
                <DeleteReleaseNoteButton id={n.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
