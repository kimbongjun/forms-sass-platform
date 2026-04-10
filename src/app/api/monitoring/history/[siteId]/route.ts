import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

// ── GET: 특정 사이트의 최근 체크 이력 ───────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { siteId } = await params

  // 소유권 확인
  const { data: site } = await supabase
    .from('monitor_sites')
    .select('id')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single()

  if (!site) return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 })

  const { data, error } = await supabase
    .from('monitor_checks')
    .select('*')
    .eq('site_id', siteId)
    .order('checked_at', { ascending: false })
    .limit(48)   // 최근 48개 (30분 간격 기준 1일치)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
