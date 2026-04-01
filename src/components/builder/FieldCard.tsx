'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Trash2, Plus, X,
  Type, AtSign, AlignLeft, CheckSquare,
  ChevronDown, CircleDot, LayoutList, Code2,
  MapPin, PlaySquare, AlignJustify, Image as ImageIcon, Minus, Upload, Loader2, Table2,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { uploadFieldImage } from '@/utils/supabase/storage'
import type { FormField, FieldType } from '@/types/database'

// WYSIWYG 에디터는 SSR 제외 (tiptap은 브라우저 전용)
const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false })

// Google Maps Places Autocomplete 에디터 (SSR 제외)
const MapFieldEditor = dynamic(() => import('./MapFieldEditor'), { ssr: false })

// ── Field type metadata ───────────────────────────────────────────────────────

export const FIELD_TYPE_META: Record<
  FieldType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  text:          { label: '텍스트',      icon: <Type className="h-3.5 w-3.5" />,           color: 'bg-blue-100 text-blue-700' },
  email:         { label: '이메일',       icon: <AtSign className="h-3.5 w-3.5" />,          color: 'bg-purple-100 text-purple-700' },
  textarea:      { label: '장문',         icon: <AlignLeft className="h-3.5 w-3.5" />,       color: 'bg-indigo-100 text-indigo-700' },
  checkbox:      { label: '체크박스',     icon: <CheckSquare className="h-3.5 w-3.5" />,     color: 'bg-green-100 text-green-700' },
  select:        { label: '셀렉박스',     icon: <ChevronDown className="h-3.5 w-3.5" />,     color: 'bg-orange-100 text-orange-700' },
  radio:         { label: '라디오',       icon: <CircleDot className="h-3.5 w-3.5" />,       color: 'bg-pink-100 text-pink-700' },
  checkbox_group:{ label: '체크박스 그룹', icon: <LayoutList className="h-3.5 w-3.5" />,      color: 'bg-teal-100 text-teal-700' },
  html:          { label: 'HTML',         icon: <Code2 className="h-3.5 w-3.5" />,            color: 'bg-gray-200 text-gray-700' },
  map:           { label: '지도',         icon: <MapPin className="h-3.5 w-3.5" />,           color: 'bg-emerald-100 text-emerald-700' },
  youtube:       { label: 'YouTube',      icon: <PlaySquare className="h-3.5 w-3.5" />,       color: 'bg-red-100 text-red-700' },
  text_block:    { label: '텍스트 블록',  icon: <AlignJustify className="h-3.5 w-3.5" />,    color: 'bg-violet-100 text-violet-700' },
  image:         { label: '이미지',       icon: <ImageIcon className="h-3.5 w-3.5" />,        color: 'bg-sky-100 text-sky-700' },
  divider:       { label: '구분선',       icon: <Minus className="h-3.5 w-3.5" />,            color: 'bg-gray-100 text-gray-600' },
  table:         { label: '표',           icon: <Table2 className="h-3.5 w-3.5" />,           color: 'bg-cyan-100 text-cyan-700' },
}

const MULTI_OPTION_TYPES: FieldType[] = ['select', 'radio', 'checkbox_group']

// ── ImageSection ──────────────────────────────────────────────────────────────

function ImageSection({ field, onUpdate }: { field: FormField; onUpdate: (patch: Partial<FormField>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const supabase = createClient()
      const url = await uploadFieldImage(supabase, file)
      onUpdate({ content: url })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={field.content ?? ''}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="이미지 URL을 입력하세요 (https://...)"
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? '업로드 중...' : '파일 업로드'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      {field.content && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={field.content}
          alt="preview"
          className="max-h-24 rounded-lg object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
    </div>
  )
}

// ── FieldCard ─────────────────────────────────────────────────────────────────

interface FieldCardProps {
  field: FormField
  onUpdate: (patch: Partial<FormField>) => void
  onRemove: () => void
}

export default function FieldCard({ field, onUpdate, onRemove }: FieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const meta = FIELD_TYPE_META[field.type]
  const isMultiOption = MULTI_OPTION_TYPES.includes(field.type)

  const isInputType = ['text', 'email', 'textarea', 'checkbox', 'select', 'radio', 'checkbox_group'].includes(field.type)
  const isHtml = field.type === 'html'
  const isTextBlock = field.type === 'text_block'
  const isImage = field.type === 'image'
  const isDivider = field.type === 'divider'
  const isMap = field.type === 'map'
  const isYoutube = field.type === 'youtube'
  const isTable = field.type === 'table'
  const showLabel = isInputType
  const showRequired = isInputType

  // ── Table helpers ─────────────────────────────────────────────────────────

  function parseTable(content: string | undefined): { headers: string[]; rows: string[][] } {
    try { return JSON.parse(content ?? '') } catch { return { headers: ['컬럼 1'], rows: [['']] } }
  }

  function commitTable(data: { headers: string[]; rows: string[][] }) {
    onUpdate({ content: JSON.stringify(data) })
  }

  function addTableColumn() {
    const { headers, rows } = parseTable(field.content)
    commitTable({ headers: [...headers, `컬럼 ${headers.length + 1}`], rows: rows.map((r) => [...r, '']) })
  }

  function removeTableColumn(ci: number) {
    const { headers, rows } = parseTable(field.content)
    if (headers.length <= 1) return
    commitTable({ headers: headers.filter((_, i) => i !== ci), rows: rows.map((r) => r.filter((_, i) => i !== ci)) })
  }

  function addTableRow() {
    const { headers, rows } = parseTable(field.content)
    commitTable({ headers, rows: [...rows, Array(headers.length).fill('')] })
  }

  function removeTableRow(ri: number) {
    const { headers, rows } = parseTable(field.content)
    if (rows.length <= 1) return
    commitTable({ headers, rows: rows.filter((_, i) => i !== ri) })
  }

  function updateTableCell(ri: number, ci: number, value: string) {
    const { headers, rows } = parseTable(field.content)
    commitTable({ headers, rows: rows.map((r, rIdx) => rIdx === ri ? r.map((c, cIdx) => cIdx === ci ? value : c) : r) })
  }

  function updateTableHeader(ci: number, value: string) {
    const { headers, rows } = parseTable(field.content)
    commitTable({ headers: headers.map((h, i) => i === ci ? value : h), rows })
  }

  // ── Options helpers ───────────────────────────────────────────────────────

  function addOption() {
    onUpdate({ options: [...(field.options ?? []), ''] })
  }

  function updateOption(i: number, value: string) {
    const next = [...(field.options ?? [])]
    next[i] = value
    onUpdate({ options: next })
  }

  function removeOption(i: number) {
    onUpdate({ options: (field.options ?? []).filter((_, idx) => idx !== i) })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={setNodeRef}
      style={style}
      suppressHydrationWarning
      className={[
        'rounded-xl border bg-white shadow-sm transition-shadow',
        isDragging
          ? 'border-gray-400 shadow-xl opacity-80 z-50'
          : 'border-gray-200 hover:shadow-md',
      ].join(' ')}
    >
      {/* ── Header row ── */}
      <div className="flex items-center gap-2 px-3 py-3">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          suppressHydrationWarning
          className="shrink-0 cursor-grab touch-none rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Type badge */}
        <span className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${meta.color}`}>
          {meta.icon}
          {meta.label}
        </span>

        {/* Label input */}
        {showLabel && (
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="필드 레이블"
            className="flex-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        )}

        {/* Required toggle */}
        {showRequired && (
          <label className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              className="h-3.5 w-3.5 rounded accent-gray-900"
            />
            필수
          </label>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* ── Description input ── */}
      {showLabel && (
        <div className="border-t border-gray-100 px-3 pb-2 pt-2">
          <input
            type="text"
            value={field.description ?? ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="상세 설명 (선택 사항)"
            className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 placeholder-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
      )}

      {/* ── Multi-option section ── */}
      {isMultiOption && (
        <div className="border-t border-gray-100 px-10 pb-3 pt-2 space-y-1.5">
          <p className="mb-1.5 text-xs font-medium text-gray-400">선택지</p>

          {(field.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* 타입별 앞 아이콘 */}
              <span className="shrink-0 text-gray-300">
                {field.type === 'radio' && <CircleDot className="h-3.5 w-3.5" />}
                {field.type === 'checkbox_group' && <CheckSquare className="h-3.5 w-3.5" />}
                {field.type === 'select' && <ChevronDown className="h-3.5 w-3.5" />}
              </span>
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`옵션 ${i + 1}`}
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
          >
            <Plus className="h-3.5 w-3.5" />
            옵션 추가
          </button>
        </div>
      )}

      {/* ── Text block section ── */}
      {isTextBlock && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2">
          <textarea
            value={field.content ?? ''}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="표시할 텍스트를 입력하세요..."
            rows={3}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
          />
        </div>
      )}

      {/* ── Image section ── */}
      {isImage && <ImageSection field={field} onUpdate={onUpdate} />}

      {/* ── Divider section ── */}
      {isDivider && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2">
          <hr className="border-gray-200" />
        </div>
      )}

      {/* ── Map embed URL section ── */}
      {isMap && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2">
          <MapFieldEditor
            content={field.content ?? ''}
            onChange={(url) => onUpdate({ content: url })}
          />
        </div>
      )}

      {/* ── YouTube URL section ── */}
      {isYoutube && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-2">
          <input
            type="text"
            value={field.content ?? ''}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=... 또는 https://youtu.be/..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          {(() => {
            const match = (field.content ?? '').match(
              /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
            )
            const videoId = match?.[1]
            return videoId ? (
              <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ) : (
              <p className="text-xs text-gray-400">YouTube URL을 붙여넣으면 미리보기가 표시됩니다</p>
            )
          })()}
        </div>
      )}

      {/* ── WYSIWYG editor section ── */}
      {isHtml && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2">
          <RichTextEditor
            content={field.content ?? ''}
            onChange={(html) => onUpdate({ content: html })}
            placeholder="HTML 내용을 입력하세요..."
          />
        </div>
      )}

      {/* ── Table section ── */}
      {isTable && (() => {
        const t = parseTable(field.content)
        return (
          <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {t.headers.map((h, ci) => (
                    <th key={ci} className="border border-gray-200 bg-gray-50 p-0">
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={h}
                          onChange={(e) => updateTableHeader(ci, e.target.value)}
                          className="flex-1 bg-transparent px-2 py-1.5 font-semibold text-gray-700 focus:outline-none min-w-0"
                          placeholder={`컬럼 ${ci + 1}`}
                        />
                        {t.headers.length > 1 && (
                          <button type="button" onClick={() => removeTableColumn(ci)}
                            className="px-1 text-gray-300 hover:text-red-400 transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="border border-gray-200 bg-gray-50 w-6">
                    <button type="button" onClick={addTableColumn}
                      className="w-full px-1 py-1.5 text-gray-400 hover:text-gray-700 transition-colors">
                      <Plus className="h-3 w-3 mx-auto" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-gray-200 p-0">
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => updateTableCell(ri, ci, e.target.value)}
                          className="w-full bg-transparent px-2 py-1.5 text-gray-700 focus:outline-none focus:bg-blue-50 min-w-0"
                          placeholder="값"
                        />
                      </td>
                    ))}
                    <td className="border border-gray-200 w-6">
                      {t.rows.length > 1 && (
                        <button type="button" onClick={() => removeTableRow(ri)}
                          className="w-full px-1 py-1.5 text-gray-300 hover:text-red-400 transition-colors">
                          <X className="h-3 w-3 mx-auto" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={addTableRow}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
              <Plus className="h-3.5 w-3.5" />
              행 추가
            </button>
          </div>
        )
      })()}
    </div>
  )
}
