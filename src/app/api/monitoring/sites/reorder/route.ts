import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

// ── PATCH: 사이트 순서 일괄 변경 ────────────────────────────────
// body: { order: string[] }  — 새 순서로 정렬된 siteId 배열
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { order } = await req.json() as { order: string[] }
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: 'order 배열이 필요합니다.' }, { status: 400 })
  }

  // 소유권 일괄 확인 후 display_order 업데이트
  const updates = order.map((id, idx) =>
    supabase
      .from('monitor_sites')
      .update({ display_order: idx, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id),
  )

  await Promise.all(updates)
  return NextResponse.json({ ok: true })
}
