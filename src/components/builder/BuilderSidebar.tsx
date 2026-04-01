'use client'

import { FIELD_TYPE_META } from './FieldCard'
import { INPUT_TYPES, CONTENT_TYPES } from '@/constants/builder'
import type { FieldType } from '@/types/database'

interface BuilderSidebarProps {
  onAddField: (type: FieldType) => void
}

export default function BuilderSidebar({ onAddField }: BuilderSidebarProps) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-5 overflow-y-auto">
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">입력</p>
      <div className="grid grid-cols-2 gap-1 mb-4">
        {INPUT_TYPES.map((type) => {
          const meta = FIELD_TYPE_META[type]
          return (
            <button
              key={type}
              type="button"
              onClick={() => onAddField(type)}
              className="flex flex-col items-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 active:scale-95"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.color}`}>
                {meta.icon}
              </span>
              <span className="leading-tight text-center">{meta.label}</span>
            </button>
          )
        })}
      </div>

      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">콘텐츠</p>
      <div className="grid grid-cols-2 gap-1 mb-4">
        {CONTENT_TYPES.map((type) => {
          const meta = FIELD_TYPE_META[type]
          return (
            <button
              key={type}
              type="button"
              onClick={() => onAddField(type)}
              className="flex flex-col items-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 active:scale-95"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.color}`}>
                {meta.icon}
              </span>
              <span className="leading-tight text-center">{meta.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-auto rounded-xl border border-dashed border-gray-200 p-3 text-center text-xs leading-relaxed text-gray-400">
        클릭하면 캔버스에<br />필드가 추가됩니다
      </div>
    </aside>
  )
}
