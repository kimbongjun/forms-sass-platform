import { NextResponse } from 'next/server'
import { createServerClient, getUserRole } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

    const role = await getUserRole(user.id)
    if (role !== 'administrator') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

    const admin = createAdminClient()

    // 사용자 목록 조회
    const { data: { users }, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (usersErr) throw usersErr

    // 프로필(role) 조회
    const { data: profiles } = await admin.from('profiles').select('id, role')
    const roleMap: Record<string, string> = {}
    for (const p of profiles ?? []) roleMap[p.id] = p.role

    const result = users.map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: (roleMap[u.id] ?? 'editor') as 'administrator' | 'editor',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))

    return NextResponse.json({ users: result })
  } catch (err) {
    console.error('[/api/admin/users] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
