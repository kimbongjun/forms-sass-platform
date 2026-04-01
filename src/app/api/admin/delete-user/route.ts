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

    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 })

    if (userId === user.id) {
      return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/admin/delete-user] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
