import { NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import type { FormField } from '@/types/database'
import { stripHtml } from '@/utils/rich-text'

const CSV_INPUT_TYPES = new Set(['text', 'email', 'textarea', 'checkbox', 'select', 'radio', 'checkbox_group', 'date', 'rating'])

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function normalizeAnswer(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join(' | ')
  if (typeof value === 'boolean') return value ? '예' : '아니오'
  if (value == null) return ''
  return String(value)
}

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
}

interface RouteContext {
  params: Promise<{ id: string; formId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id: workspaceId, formId } = await params
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: formProject, error: formError } = await supabase
      .from('projects')
      .select('id, title')
      .eq('id', formId)
      .eq('workspace_project_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (formError || !formProject) {
      return NextResponse.json({ error: '내보내기 권한이 없습니다.' }, { status: 403 })
    }

    const [{ data: fields }, { data: submissions, error: submissionsError }] = await Promise.all([
      supabase
        .from('form_fields')
        .select('id, label, type, order_index')
        .eq('project_id', formId)
        .order('order_index', { ascending: true }),
      supabase
        .from('submissions')
        .select('created_at, answers')
        .eq('project_id', formId)
        .order('created_at', { ascending: false }),
    ])

    if (submissionsError) {
      return NextResponse.json({ error: '응답 데이터를 불러오지 못했습니다.' }, { status: 500 })
    }

    const inputFields = ((fields ?? []) as FormField[]).filter((field) => CSV_INPUT_TYPES.has(field.type))
    const headers = ['제출 시각', ...inputFields.map((field) => stripHtml(field.label ?? '') || '(제목 없음)')]

    const rows = (submissions ?? []).map((submission) => {
      const answers = (submission.answers ?? {}) as Record<string, unknown>
      return [
        formatSubmittedAt(submission.created_at),
        ...inputFields.map((field) => normalizeAnswer(answers[field.id])),
      ]
    })

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n')

    const filename = encodeURIComponent(`${formProject.title}_responses.csv`)

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'CSV 내보내기에 실패했습니다.' },
      { status: 500 }
    )
  }
}
