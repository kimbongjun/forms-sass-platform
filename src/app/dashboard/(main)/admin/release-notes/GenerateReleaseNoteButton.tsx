'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'

export default function GenerateReleaseNoteButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleGenerate() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/release-notes/generate', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setMessage(json.error ?? '생성 실패')
      } else {
        setMessage(`${json.version} 릴리즈노트가 자동 생성됐습니다. (커밋 ${json.commitCount}건)`)
        router.refresh()
      }
    } catch {
      setMessage('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? '생성 중...' : '자동 생성'}
      </button>
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  )
}
