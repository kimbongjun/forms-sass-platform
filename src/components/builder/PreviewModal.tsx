'use client'

import { X } from 'lucide-react'
import PublicForm from '@/components/form/PublicForm'
import type { FormField } from '@/types/database'

interface PreviewModalProps {
  fields: FormField[]
  themeColor: string
  onClose: () => void
}

export default function PreviewModal({ fields, themeColor, onClose }: PreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-gray-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-gray-200 bg-white px-5 py-3.5">
          <p className="text-xs font-medium text-gray-500">미리보기 — 실제 제출되지 않습니다</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form content */}
        <div className="px-6 py-8">
          {fields.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">아직 추가된 필드가 없습니다.</p>
          ) : (
            <PublicForm
              projectId="preview"
              fields={fields}
              themeColor={themeColor}
              previewMode
            />
          )}
        </div>
      </div>
    </div>
  )
}
