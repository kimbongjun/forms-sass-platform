'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { FormField, LocaleSettings } from '@/types/database'

interface SaveButtonProps {
  title: string
  customSlug: string
  notificationEmail: string | null
  themeColor: string
  isPublished: boolean
  deadline: string | null
  maxSubmissions: number | null
  webhookUrl: string | null
  submissionMessage: string | null
  adminEmailTemplate: string | null
  userEmailTemplate: string | null
  thumbnailUrl: string | null
  localeSettings: LocaleSettings
  fields: FormField[]
  onError: (message: string) => void
}

function generateSlug(title: string, custom: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  if (custom.trim()) {
    return custom.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || `form-${rand}`
  }
  const base = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 40)
  return base ? `${base}-${rand}` : `form-${rand}`
}

export default function SaveButton({
  title, customSlug, notificationEmail, themeColor, isPublished,
  deadline, maxSubmissions, webhookUrl, submissionMessage,
  adminEmailTemplate, userEmailTemplate, thumbnailUrl, localeSettings,
  fields, onError,
}: SaveButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!title.trim()) {
      onError('프로젝트 제목을 입력해주세요.')
      return
    }

    setLoading(true)
    onError('')

    try {
      const slug = generateSlug(title, customSlug)
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug,
          notificationEmail,
          themeColor,
          isPublished,
          deadline,
          maxSubmissions,
          webhookUrl,
          submissionMessage,
          adminEmailTemplate,
          userEmailTemplate,
          thumbnailUrl,
          localeSettings,
          fields,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? '프로젝트 저장 실패')
      }

      router.push('/dashboard')
    } catch (err) {
      onError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? '저장 중...' : '저장하기'}
    </button>
  )
}
