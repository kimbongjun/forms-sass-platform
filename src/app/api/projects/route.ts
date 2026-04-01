import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import type { FormField, LocaleSettings } from '@/types/database'

interface CreateProjectBody {
  title?: string
  slug?: string
  notificationEmail?: string | null
  themeColor?: string | null
  isPublished?: boolean
  deadline?: string | null
  maxSubmissions?: number | null
  webhookUrl?: string | null
  submissionMessage?: string | null
  adminEmailTemplate?: string | null
  userEmailTemplate?: string | null
  thumbnailUrl?: string | null
  localeSettings?: LocaleSettings | null
  fields?: FormField[]
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateProjectBody
    const title = body.title?.trim()
    const slug = body.slug?.trim()

    if (!title) return NextResponse.json({ error: '프로젝트 제목을 입력해주세요.' }, { status: 400 })
    if (!slug) return NextResponse.json({ error: '슬러그가 필요합니다.' }, { status: 400 })

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .insert({
        title,
        slug,
        notification_email: body.notificationEmail?.trim() || null,
        theme_color: body.themeColor || '#111827',
        is_published: body.isPublished ?? true,
        deadline: body.deadline || null,
        max_submissions: body.maxSubmissions ?? null,
        webhook_url: body.webhookUrl?.trim() || null,
        submission_message: body.submissionMessage?.trim() || null,
        admin_email_template: body.adminEmailTemplate ?? null,
        user_email_template: body.userEmailTemplate ?? null,
        thumbnail_url: body.thumbnailUrl ?? null,
        locale_settings: body.localeSettings ?? null,
        user_id: user.id,
      })
      .select('id')
      .single()

    if (projectErr || !project) {
      return NextResponse.json(
        { error: `프로젝트 저장 실패: ${projectErr?.message ?? '데이터 반환 없음'}` },
        { status: projectErr?.code === '23505' ? 409 : 500 }
      )
    }

    const fields = Array.isArray(body.fields) ? body.fields : []
    if (fields.length > 0) {
      const rows = fields.map((f, index) => ({
        project_id: project.id,
        label: f.label.trim() || '(제목 없음)',
        type: f.type,
        required: f.required,
        order_index: f.order_index ?? index,
        options: f.options ?? null,
        content: f.content ?? null,
      }))

      const { error: fieldsErr } = await supabase.from('form_fields').insert(rows)
      if (fieldsErr) {
        await supabase.from('projects').delete().eq('id', project.id)
        return NextResponse.json({ error: `필드 저장 실패: ${fieldsErr.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ id: project.id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
