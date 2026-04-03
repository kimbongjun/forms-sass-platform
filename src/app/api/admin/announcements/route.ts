import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getUserRole } from '@/utils/supabase/server'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }), supabase: null, user: null }
  const role = await getUserRole(user.id)
  if (role !== 'administrator') return { error: NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 }), supabase: null, user: null }
  return { error: null, supabase, user }
}

/** POST /api/admin/announcements — 공지 생성 */
export async function POST(req: NextRequest) {
  const { error, supabase, user } = await requireAdmin()
  if (error) return error

  try {
    const body = await req.json()
    const { title, content, is_published = true, is_pinned = false } = body
    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })

    const { data, error: dbErr } = await supabase!
      .from('announcements')
      .insert({ title: title.trim(), content: content ?? '', is_published, is_pinned, author_id: user!.id })
      .select('id')
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
