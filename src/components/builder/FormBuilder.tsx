'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { useFormFields } from '@/hooks/useFormFields'
import { useFormSettings } from '@/hooks/useFormSettings'
import BuilderTabBar, { type BuilderTab } from './BuilderTabBar'
import BuilderSidebar from './BuilderSidebar'
import BuilderCanvas from './BuilderCanvas'
import SettingsPanel from './SettingsPanel'
import SaveButton from './SaveButton'

export default function FormBuilder() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<BuilderTab>('edit')
  const [error, setError] = useState('')

  const fieldState = useFormFields()
  const settings = useFormSettings()

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
          <span className="text-base font-semibold text-gray-900">새 프로젝트 만들기</span>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="max-w-xs truncate text-xs text-red-600">{error}</span>}
          <SaveButton
            title={settings.title}
            customSlug={settings.customSlug}
            fields={fieldState.fields}
            onError={setError}
            {...settings.toApiPayload()}
          />
        </div>
      </header>

      <BuilderTabBar activeTab={activeTab} onChange={setActiveTab} />

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
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <SettingsPanel settings={settings} />
      )}
    </div>
  )
}
