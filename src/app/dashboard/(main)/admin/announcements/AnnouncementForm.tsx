'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'

const RichTextEditor = dynamic(() => import('@/components/builder/RichTextEditor'), { ssr: false })

interface Props {
  initialData?: {
    id: string
    title: string
    content: string
    is_published: boolean
    is_pinned: boolean
  }
}

export default function AnnouncementForm({ initialData }: Props) {
  const router = useRouter()
  const isEdit = !!initialData
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [isPublished, setIsPublished] = useState(initialData?.is_published ?? true)
  const [isPinned, setIsPinned] = useState(initialData?.is_pinned ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900'

  async function handleSave() {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      const url = isEdit
        ? `/api/admin/announcements/${initialData!.id}`
        : '/api/admin/announcements'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content, is_published: isPublished, is_pinned: isPinned }),
      })
      const contentType = res.headers.get('content-type') ?? ''
      const json = contentType.includes('application/json') ? await res.json() : null
      if (!res.ok) throw new Error(json?.error ?? `저장 실패 (${res.status})`)
      router.push('/dashboard/admin/announcements')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/announcements" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-base font-semibold text-gray-900">{isEdit ? '공지 수정' : '새 공지 작성'}</h1>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">제목 <span className="text-red-400">*</span></label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목을 입력하세요" className={inputClass} />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm text-gray-700">공개</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm text-gray-700">상단 고정</span>
          </label>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500">내용</label>
          <RichTextEditor content={content} onChange={setContent} height="400px" />
        </div>
      </div>
    </div>
  )
}
