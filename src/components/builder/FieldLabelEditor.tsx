'use client'

import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Palette, Underline } from 'lucide-react'
import { normalizeRichTextHtml, stripHtml } from '@/utils/rich-text'

interface FieldLabelEditorProps {
  value: string
  placeholder: string
  onChange: (value: string) => void
}

function exec(command: string, value?: string) {
  document.execCommand(command, false, value)
}

export default function FieldLabelEditor({ value, placeholder, onChange }: FieldLabelEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!editorRef.current) return
    const next = value || ''
    if (editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next
    }
  }, [value])

  function commitValue() {
    if (!editorRef.current) return
    const next = normalizeRichTextHtml(editorRef.current.innerHTML)
    onChange(next)
  }

  function handleToolbarAction(action: () => void) {
    action()
    commitValue()
    editorRef.current?.focus()
  }

  return (
    <div className="relative flex-1">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={commitValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        data-placeholder={placeholder}
        className="field-label-editor min-h-9 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 pr-30 text-sm text-gray-900 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      <div
        className={[
          'absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full border border-gray-200 bg-white/95 px-1.5 py-1 shadow-sm transition-all',
          focused ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        <button
          type="button"
          title="굵게"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleToolbarAction(() => exec('bold'))}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="기울임"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleToolbarAction(() => exec('italic'))}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="밑줄"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleToolbarAction(() => exec('underline'))}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="글자색"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => colorInputRef.current?.click()}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          defaultValue="#111827"
          onChange={(event) => handleToolbarAction(() => exec('foreColor', event.target.value))}
          className="hidden"
        />
      </div>

      {!stripHtml(value) && !focused && (
        <p className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
          {placeholder}
        </p>
      )}
    </div>
  )
}
