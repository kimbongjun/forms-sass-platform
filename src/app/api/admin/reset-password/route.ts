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

    const { userId, newPassword } = await req.json()
    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'userId와 newPassword가 필요합니다.' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/admin/reset-password] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
