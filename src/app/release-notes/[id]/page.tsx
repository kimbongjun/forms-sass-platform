import { notFound } from 'next/navigation'
import { createServerClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
}

export default async function ReleaseNoteDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data } = await supabase.from('release_notes').select('*').eq('id', id).single()
  if (!data) notFound()

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Link href="/release-notes" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm text-gray-500">릴리즈노트</span>
      </div>

      <article className="rounded-2xl border border-gray-200 bg-white p-8">
        <div className="mb-6 border-b border-gray-100 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-mono font-semibold text-white">{data.version}</span>
            <span className="text-xs text-gray-400">{formatDate(data.created_at)}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{data.title}</h1>
        </div>
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: data.content }} />
      </article>
    </div>
  )
}
