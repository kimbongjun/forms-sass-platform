import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import type { MonitorInterval } from '@/types/database'

// ── GET: 내 사이트 목록 ───────────────────────────────────────────
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('monitor_sites')
    .select('*')
    .eq('user_id', user.id)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── POST: 사이트 추가 ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    name?: string
    url?: string
    check_interval?: MonitorInterval
    notify_email?: string
  }

  const url = body.url?.trim()
  if (!url) return NextResponse.json({ error: 'URL은 필수입니다.' }, { status: 400 })

  // URL 형식 검증
  try { new URL(url) } catch {
    return NextResponse.json({ error: '올바른 URL 형식이 아닙니다.' }, { status: 400 })
  }

  // 신규 사이트는 목록 맨 마지막에 배치
  const { data: maxRow } = await supabase
    .from('monitor_sites')
    .select('display_order')
    .eq('user_id', user.id)
    .order('display_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()
  const nextOrder = (maxRow?.display_order ?? -1) + 1

  const { data, error } = await supabase
    .from('monitor_sites')
    .insert({
      user_id: user.id,
      name: body.name?.trim() || new URL(url).hostname,
      url,
      check_interval: body.check_interval ?? 60,
      notify_email: body.notify_email?.trim() || null,
      is_active: true,
      last_status: 'unknown',
      display_order: nextOrder,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
