'use client'

import { AlignLeft } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import FieldCard from './FieldCard'
import { INPUT_CLASS } from '@/constants/builder'
import type { FormField } from '@/types/database'

interface BuilderCanvasProps {
  title: string
  onTitleChange: (value: string) => void
  fields: FormField[]
  onUpdateField: (id: string, patch: Partial<FormField>) => void
  onRemoveField: (id: string) => void
  onDragEnd: (event: DragEndEvent) => void
  titlePlaceholder?: string
}

export default function BuilderCanvas({
  title,
  onTitleChange,
  fields,
  onUpdateField,
  onRemoveField,
  onDragEnd,
  titlePlaceholder = '예: 2024 고객 만족도 설문',
}: BuilderCanvasProps) {
  const sensors = useSensors(useSensor(PointerSensor))

  return (
    <main className="flex-1 overflow-y-auto px-8 py-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <section className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              프로젝트 제목 <span className="text-red-400">*</span>
            </p>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={titlePlaceholder}
              className={INPUT_CLASS}
            />
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            폼 필드{' '}
            <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 font-normal text-gray-600">
              {fields.length}
            </span>
          </p>
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
              <AlignLeft className="mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-400">아직 필드가 없어요</p>
              <p className="mt-1 text-xs text-gray-400">왼쪽 사이드바에서 필드 유형을 클릭하세요.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <FieldCard
                      key={field.id}
                      field={field}
                      onUpdate={(patch) => onUpdateField(field.id, patch)}
                      onRemove={() => onRemoveField(field.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </div>
    </main>
  )
}
