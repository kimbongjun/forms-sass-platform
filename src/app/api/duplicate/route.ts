import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    const supabase = await createServerClient()

    const { data: { user } } = await supabase.auth.getUser()

    // 원본 프로젝트 + 필드 조회
    const [{ data: original }, { data: fields }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('form_fields').select('*').eq('project_id', projectId).order('order_index', { ascending: true }),
    ])

    if (!original) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })

    // 슬러그 생성 (복사본)
    const rand = Math.random().toString(36).slice(2, 8)
    const newSlug = `copy-${rand}`

    // 새 프로젝트 삽입
    const { data: newProject, error: insertErr } = await supabase
      .from('projects')
      .insert({
        title: `${original.title} (복사본)`,
        slug: newSlug,
        banner_url: original.banner_url,
        notification_email: original.notification_email,
        theme_color: original.theme_color,
        is_published: false, // 복사본은 기본 비공개
        deadline: null,
        max_submissions: null,
        webhook_url: original.webhook_url,
        user_id: user?.id,
      })
      .select('id')
      .single()

    if (insertErr || !newProject) {
      return NextResponse.json({ error: `복제 실패: ${insertErr?.message}` }, { status: 500 })
    }

    // 필드 복제
    if (fields && fields.length > 0) {
      const newFields = fields.map((f) => ({
        project_id: newProject.id,
        label: f.label,
        type: f.type,
        required: f.required,
        order_index: f.order_index,
        options: f.options ?? null,
        content: f.content ?? null,
      }))
      await supabase.from('form_fields').insert(newFields)
    }

    return NextResponse.json({ ok: true, id: newProject.id })
  } catch (err) {
    console.error('[/api/duplicate] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
