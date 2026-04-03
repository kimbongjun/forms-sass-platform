import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getUserRole } from '@/utils/supabase/server'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }), supabase: null }
  const role = await getUserRole(user.id)
  if (role !== 'administrator') return { error: NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 }), supabase: null }
  return { error: null, supabase }
}

/** PUT /api/admin/announcements/[id] — 공지 수정 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  try {
    const { id } = await params
    const body = await req.json()
    const { title, content, is_published, is_pinned } = body
    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })

    const { error: dbErr } = await supabase!
      .from('announcements')
      .update({
        title: title.trim(),
        content: content ?? '',
        is_published,
        is_pinned,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}

/** DELETE /api/admin/announcements/[id] — 공지 삭제 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  try {
    const { id } = await params
    const { error: dbErr } = await supabase!.from('announcements').delete().eq('id', id)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
