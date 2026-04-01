'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, CheckCircle2, ExternalLink } from 'lucide-react'

import { useFormFields } from '@/hooks/useFormFields'
import { useFormSettings } from '@/hooks/useFormSettings'
import BuilderTabBar, { type BuilderTab } from './BuilderTabBar'
import BuilderSidebar from './BuilderSidebar'
import BuilderCanvas from './BuilderCanvas'
import SettingsPanel from './SettingsPanel'
import ResponsesTab from './ResponsesTab'
import { createClient } from '@/utils/supabase/client'
import type { FormField, Project } from '@/types/database'

interface EditFormBuilderProps {
  project: Project & { id: string }
  initialFields: FormField[]
  initialDeadline: string
}

export default function EditFormBuilder({ project, initialFields, initialDeadline }: EditFormBuilderProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<BuilderTab>('edit')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const fieldState = useFormFields(initialFields)
  const settings = useFormSettings({
    ...project,
    initialDeadline,
  })

  async function handleUpdate() {
    if (!settings.title.trim()) { setError('프로젝트 제목을 입력해주세요.'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()

    try {
      const { error: updateErr } = await supabase
        .from('projects')
        .update({ title: settings.title.trim(), ...settings.toUpdatePayload() })
        .eq('id', project.id)
      if (updateErr) throw new Error(`프로젝트 수정 실패: ${updateErr.message}`)

      await supabase.from('form_fields').delete().eq('project_id', project.id)

      if (fieldState.fields.length > 0) {
        const rows = fieldState.fields.map((f) => ({
          id: f.id,
          project_id: project.id,
          label: f.label.trim() || '(제목 없음)',
          description: f.description ?? null,
          type: f.type,
          required: f.required,
          order_index: f.order_index,
          options: f.options ?? null,
          content: f.content ?? null,
        }))
        const { error: insertErr } = await supabase.from('form_fields').insert(rows)
        if (insertErr) throw new Error(`필드 저장 실패: ${insertErr.message}`)
      }

      setSaved(true)
      setTimeout(() => router.push('/dashboard'), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (saved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 text-green-600">
        <CheckCircle2 className="h-14 w-14" />
        <p className="text-lg font-semibold">수정 완료!</p>
        <p className="text-sm text-gray-500">목록으로 돌아가는 중...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <span className="text-base font-semibold text-gray-900">프로젝트 편집</span>
            <span className="ml-2 text-xs text-gray-400">{project.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="max-w-xs truncate text-xs text-red-600">{error}</span>}
          <a
            href={`/${project.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" />
            페이지 보기
          </a>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? '저장 중...' : '변경 저장'}
          </button>
        </div>
      </header>

      <BuilderTabBar activeTab={activeTab} onChange={setActiveTab} showResponses />

      {activeTab === 'edit' && (
        <div className="flex flex-1 overflow-hidden">
          <BuilderSidebar onAddField={fieldState.addField} />
          <BuilderCanvas
            title={settings.title}
            onTitleChange={(v) => { settings.setTitle(v); setError('') }}
            fields={fieldState.fields}
            onUpdateField={fieldState.updateField}
            onRemoveField={fieldState.removeField}
            onDragEnd={fieldState.handleDragEnd}
            titlePlaceholder=""
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <SettingsPanel settings={settings} slug={project.slug} />
      )}

      {activeTab === 'responses' && (
        <ResponsesTab
          projectId={project.id}
          projectSlug={project.slug}
          fields={fieldState.fields}
        />
      )}
    </div>
  )
}
