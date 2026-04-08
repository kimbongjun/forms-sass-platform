'use client'

import { Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DuplicateButton({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDuplicate() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? '복제에 실패했습니다.')
        return
      }
      router.push(`/projects/${json.id}`)
    } catch {
      alert('복제 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDuplicate}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      <Copy className="h-3.5 w-3.5" />
      {loading ? '복제 중…' : '복제'}
    </button>
  )
}
