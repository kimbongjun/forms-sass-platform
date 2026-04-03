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

/** POST /api/admin/release-notes — 릴리즈노트 수동 생성 */
export async function POST(req: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  try {
    const body = await req.json()
    const { version, title, content } = body
    if (!version?.trim()) return NextResponse.json({ error: '버전을 입력해주세요.' }, { status: 400 })
    if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })

    const { data, error: dbErr } = await supabase!
      .from('release_notes')
      .insert({ version: version.trim(), title: title.trim(), content: content ?? '' })
      .select('id')
      .single()

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
