import { useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import type { FieldType, FormField } from '@/types/database'
import { generateId } from '@/constants/builder'

export function useFormFields(initialFields: FormField[] = []) {
  const [fields, setFields] = useState<FormField[]>(initialFields)

  function addField(type: FieldType) {
    const needsOptions = ['select', 'radio', 'checkbox_group'].includes(type)
    const needsContent = ['html', 'map', 'youtube', 'text_block', 'image', 'divider'].includes(type)
    setFields((prev) => [
      ...prev,
      {
        id: generateId(),
        label: '',
        type,
        required: false,
        order_index: prev.length,
        options: needsOptions ? [''] : undefined,
        content: type === 'table'
          ? JSON.stringify({ headers: ['컬럼 1', '컬럼 2'], rows: [['', '']] })
          : needsContent ? '' : undefined,
      },
    ])
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, order_index: i })))
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id)
      const newIndex = prev.findIndex((f) => f.id === over.id)
      return arrayMove(prev, oldIndex, newIndex).map((f, i) => ({ ...f, order_index: i }))
    })
  }

  return { fields, addField, removeField, updateField, handleDragEnd }
}
