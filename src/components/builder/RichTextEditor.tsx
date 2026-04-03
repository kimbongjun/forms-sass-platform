'use client'

import { useRef } from 'react'
import { Editor } from '@tinymce/tinymce-react'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  height?: string
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = '내용을 입력하세요...',
  height = '300px',
}: RichTextEditorProps) {
  const editorRef = useRef<Parameters<NonNullable<React.ComponentProps<typeof Editor>['onInit']>>[1] | null>(null)

  const numericHeight = parseInt(height, 10) || 300

  return (
    <Editor
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      onInit={(_evt, editor) => { editorRef.current = editor }}
      initialValue={content}
      onEditorChange={(newContent) => onChange(newContent)}
      init={{
        height: numericHeight,
        menubar: false,
        license_key: 'gpl',
        plugins: [
          'lists', 'link', 'image', 'code', 'table',
          'wordcount', 'autolink', 'charmap', 'searchreplace',
        ],
        toolbar:
          'undo redo | blocks | bold italic underline strikethrough | ' +
          'forecolor backcolor | alignleft aligncenter alignright | ' +
          'bullist numlist | link image table | code | removeformat',
        placeholder,
        content_style:
          'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; color: #111827; }',
        skin: 'oxide',
        content_css: 'default',
        statusbar: false,
        branding: false,
        promotion: false,
        images_upload_handler: undefined,
      }}
    />
  )
}
