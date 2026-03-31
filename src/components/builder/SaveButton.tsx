'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { uploadBanner } from '@/utils/supabase/storage'
import type { FormField } from '@/types/database'

interface SaveButtonProps {
  title: string
  notificationEmail: string
  isPublished: boolean
  deadline: string
  maxSubmissions: string
  webhookUrl: string
  customSlug: string
  themeColor: string
  fields: FormField[]
  bannerFile: File | null
  onError: (message: string) => void
}

function generateSlug(title: string, custom: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  if (custom.trim()) {
    return custom
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || `form-${rand}`
  }
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
  return base ? `${base}-${rand}` : `form-${rand}`
}

export default function SaveButton({
  title, notificationEmail, isPublished, deadline, maxSubmissions,
  webhookUrl, customSlug, themeColor, fields, bannerFile, onError,
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
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()

      let bannerUrl: string | null = null
      if (bannerFile) bannerUrl = await uploadBanner(supabase, bannerFile)

      const slug = generateSlug(title, customSlug)
      const { data: project, error: projectErr } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          slug,
          banner_url: bannerUrl,
          notification_email: notificationEmail.trim() || null,
          theme_color: themeColor || '#111827',
          is_published: isPublished,
          deadline: deadline || null,
          max_submissions: maxSubmissions ? parseInt(maxSubmissions, 10) : null,
          webhook_url: webhookUrl.trim() || null,
          user_id: user?.id,
        })
        .select('id')
        .single()

      if (projectErr || !project) {
        throw new Error(`프로젝트 저장 실패: ${projectErr?.message ?? '데이터 반환 없음'}`)
      }

      if (fields.length > 0) {
        const rows = fields.map((f) => ({
          project_id: project.id,
          label: f.label.trim() || '(제목 없음)',
          type: f.type,
          required: f.required,
          order_index: f.order_index,
          options: f.options ?? null,
          content: f.content ?? null,
        }))
        const { error: fieldsErr } = await supabase.from('form_fields').insert(rows)
        if (fieldsErr) throw new Error(`필드 저장 실패: ${fieldsErr.message}`)
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
