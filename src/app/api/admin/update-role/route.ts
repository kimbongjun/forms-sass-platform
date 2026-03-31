import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getUserRole } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

    const role = await getUserRole(user.id)
    if (role !== 'administrator') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

    const { userId, newRole } = await req.json()
    if (!userId || !['administrator', 'editor'].includes(newRole)) {
      return NextResponse.json({ error: '유효하지 않은 요청입니다.' }, { status: 400 })
    }

    // 자기 자신의 role은 변경 불가
    if (userId === user.id) {
      return NextResponse.json({ error: '본인의 역할은 변경할 수 없습니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/admin/update-role] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
