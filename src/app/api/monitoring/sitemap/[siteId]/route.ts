import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { runSitemapCheck } from '@/lib/monitoring/check-sitemap'
import type { MonitorSitemapRun } from '@/types/database'

// ── GET: 최근 사이트맵 체크 결과 조회 ────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: site } = await supabase
    .from('monitor_sites')
    .select('id')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single()
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: run, error } = await supabase
    .from('monitor_sitemap_runs')
    .select('*')
    .eq('site_id', siteId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .single()

  // DB 에러(테이블 미존재 포함) 시 null 반환 — UI에서 마이그레이션 안내
  if (error && error.code !== 'PGRST116') {
    console.error('[Monitor/Sitemap GET]', error.message)
    return NextResponse.json({ run: null, dbError: error.message })
  }

  return NextResponse.json({ run: run ?? null })
}

// ── POST: 수동 사이트맵 체크 실행 ────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { siteId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: site } = await supabase
    .from('monitor_sites')
    .select('id, url')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single()
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await runSitemapCheck(site.url)

  const admin = createAdminClient()
  const { data: run, error } = await admin
    .from('monitor_sitemap_runs')
    .insert({
      site_id:       siteId,
      sitemap_url:   result.sitemap_url,
      sitemap_found: result.sitemap_found,
      tried_urls:    result.tried_urls,
      total_urls:    result.total_urls,
      ok_count:      result.ok_count,
      error_count:   result.error_count,
      issue_count:   result.issue_count,
      pages:         result.pages,
    })
    .select()
    .single()

  if (error) {
    console.error('[Monitor/Sitemap POST]', error.message)
    // DB 저장 실패해도 체크 결과는 반환
    return NextResponse.json({ run: null, result, dbError: error.message })
  }

  // 최근 3개만 유지
  const { data: old } = await admin
    .from('monitor_sitemap_runs')
    .select('id')
    .eq('site_id', siteId)
    .order('checked_at', { ascending: false })
  if (old && old.length > 3) {
    await admin.from('monitor_sitemap_runs').delete().in('id', old.slice(3).map(r => r.id))
  }

  return NextResponse.json({ run: run as MonitorSitemapRun })
}
