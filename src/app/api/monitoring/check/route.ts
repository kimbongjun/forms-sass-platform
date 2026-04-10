import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import { checkUrl } from '@/lib/monitoring/check-url'

// ── POST: 수동 체크 or 스케줄 트리거 ────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { siteId } = await req.json() as { siteId: string }
  if (!siteId) return NextResponse.json({ error: 'siteId가 필요합니다.' }, { status: 400 })

  const { data: site, error: siteErr } = await supabase
    .from('monitor_sites')
    .select('id, url, notify_email, name')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single()

  if (siteErr || !site) {
    return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 })
  }

  const result = await checkUrl(site.url)
  const now = new Date().toISOString()

  await supabase
    .from('monitor_sites')
    .update({
      last_checked_at: now,
      last_status: result.status,
      last_response_time: result.response_time,
      last_ttfb: result.ttfb,
      last_status_code: result.status_code,
      last_error: result.error_message,
      updated_at: now,
    })
    .eq('id', siteId)

  await supabase.from('monitor_checks').insert({
    site_id: siteId,
    checked_at: now,
    status: result.status,
    response_time: result.response_time,
    ttfb: result.ttfb,
    status_code: result.status_code,
    error_message: result.error_message,
  })

  return NextResponse.json({ siteId, ...result, checked_at: now })
}
