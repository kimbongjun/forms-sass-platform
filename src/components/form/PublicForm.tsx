'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Globe } from 'lucide-react'
import type { FormField, LocaleSettings, Locale } from '@/types/database'
import { resolveLocaleStrings, LOCALE_LABELS } from '@/constants/locale'

interface PublicFormProps {
  projectId: string
  fields: FormField[]
  themeColor?: string
  previewMode?: boolean
  submissionMessage?: string | null
  localeSettings?: LocaleSettings | null
}

export default function PublicForm({
  projectId,
  fields,
  themeColor = '#111827',
  previewMode = false,
  submissionMessage,
  localeSettings,
}: PublicFormProps) {
  const multiLocale = localeSettings?.enabled && (localeSettings.available_locales?.length ?? 0) > 1
  const defaultLocale: Locale = localeSettings?.default_locale ?? 'ko'

  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const [answers, setAnswers] = useState<Record<string, string | boolean | string[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const t = resolveLocaleStrings(locale, localeSettings?.overrides)

  function setAnswer(fieldId: string, value: string | boolean | string[]) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  function toggleCheckboxGroup(fieldId: string, option: string) {
    const current = (answers[fieldId] as string[] | undefined) ?? []
    setAnswer(fieldId, current.includes(option) ? current.filter((v) => v !== option) : [...current, option])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (previewMode) {
      setError(t.preview_note)
      return
    }

    for (const field of fields) {
      if (['html', 'map', 'youtube', 'text_block', 'image', 'divider', 'table'].includes(field.type)) continue
      if (!field.required) continue
      const val = answers[field.id]
      if (val === undefined || val === '' || val === false || (Array.isArray(val) && val.length === 0)) {
        setError(t.required_error.replace('{{label}}', field.label || '(제목 없음)'))
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          answers,
          fields: fields.map((f) => ({ id: f.id, label: f.label, type: f.type })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '제출에 실패했습니다.')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    const customMsg = submissionMessage?.trim()
    const [headline, ...rest] = (customMsg || `${t.submitted_title}\n${t.submitted_subtitle}`).split('\n')
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-green-600">
        <CheckCircle2 className="h-14 w-14" />
        <p className="text-lg font-semibold text-green-600">{headline}</p>
        {rest.length > 0 && <p className="text-sm text-gray-500">{rest.join('\n')}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Language switcher */}
      {multiLocale && (
        <div className="flex items-center justify-end gap-1">
          <Globe className="h-3.5 w-3.5 text-gray-400" />
          {localeSettings!.available_locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                locale === loc
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {LOCALE_LABELS[loc]}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={(v) => setAnswer(field.id, v)}
            onToggleCheckbox={(opt) => toggleCheckboxGroup(field.id, opt)}
            themeColor={themeColor}
            t={t}
          />
        ))}

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ backgroundColor: themeColor }}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {previewMode
            ? `${t.submit} (미리보기)`
            : loading
              ? t.submitting
              : t.submit}
        </button>
      </form>
    </div>
  )
}

// ── 개별 필드 렌더러 ──────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField
  value: string | boolean | string[] | undefined
  onChange: (v: string | boolean | string[]) => void
  onToggleCheckbox: (option: string) => void
  themeColor: string
  t: ReturnType<typeof resolveLocaleStrings>
}

function FieldRenderer({ field, value, onChange, onToggleCheckbox, themeColor, t }: FieldRendererProps) {
  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900'

  if (field.type === 'text_block') {
    return (
      <h3 className="whitespace-pre-wrap font-bold leading-relaxed text-gray-700">
        {field.content ?? ''}
      </h3>
    )
  }

  if (field.type === 'image') {
    if (!field.content) return null
    return (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={field.content} alt={field.label} className="w-full rounded-xl object-cover" />        
      </figure>
    )
  }

  if (field.type === 'divider') return <hr className="border-gray-200" />

  if (field.type === 'table') {
    let headers: string[] = []
    let rows: string[][] = []
    try {
      const parsed = JSON.parse(field.content ?? '')
      headers = parsed.headers ?? []
      rows = parsed.rows ?? []
    } catch { return null }
    if (headers.length === 0) return null
    console.log(themeColor);
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full border-collapse text-sm">          
          <thead>
            <tr className="bg-gray-50">
              {headers.map((h, i) => (
                <th key={i} className="bg-gray-300 border-b border-gray-200 px-4 py-2.5 text-left text-xs font-semibold text-gray-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="even:bg-gray-50">
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-gray-200 px-4 py-2 text-gray-700">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (field.type === 'html') {
    return (
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: field.content ?? '' }}
      />
    )
  }

  if (field.type === 'map') {
    const rawSrc = field.content ?? ''
    let src = rawSrc
    if (rawSrc.includes('embed/v1/place')) {
      try {
        const url = new URL(rawSrc)
        const q = url.searchParams.get('q') ?? ''
        const addr = q.startsWith('place_id:') ? q : decodeURIComponent(q)
        src = `https://maps.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`
      } catch { src = rawSrc }
    }
    if (!src) return null
    return (
      <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={src}
          className="absolute inset-0 h-full w-full border-0"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    )
  }

  if (field.type === 'youtube') {
    const match = (field.content ?? '').match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
    )
    const videoId = match?.[1]
    if (!videoId) return null
    return (
      <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-800">
        {field.label || '(제목 없음)'}
        {field.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {field.description && (
        <p className="text-xs text-gray-500">{field.description}</p>
      )}

      {field.type === 'text' && (
        <input type="text" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.required} className={inputClass} />
      )}
      {field.type === 'email' && (
        <input type="email" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.required} className={inputClass} />
      )}
      {field.type === 'textarea' && (
        <textarea rows={4} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.required} className={`${inputClass} resize-y`} />
      )}
      {field.type === 'checkbox' && (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={(value as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
            style={{ accentColor: themeColor }}
            className="h-4 w-4 rounded"
          />
          {t.agree_label}
        </label>
      )}
      {field.type === 'select' && (
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} required={field.required} className={inputClass}>
          <option value="">{t.select_placeholder}</option>
          {(field.options ?? []).filter(Boolean).map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      {field.type === 'radio' && (
        <div className="space-y-2">
          {(field.options ?? []).filter(Boolean).map((opt, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={(value as string) === opt}
                onChange={() => onChange(opt)}
                required={field.required}
                style={{ accentColor: themeColor }}
                className="h-4 w-4"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {field.type === 'checkbox_group' && (
        <div className="space-y-2">
          {(field.options ?? []).filter(Boolean).map((opt, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={((value as string[]) ?? []).includes(opt)}
                onChange={() => onToggleCheckbox(opt)}
                style={{ accentColor: themeColor }}
                className="h-4 w-4 rounded"
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
