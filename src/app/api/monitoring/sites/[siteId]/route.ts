import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import type { MonitorInterval } from '@/types/database'

// ── PATCH: 사이트 수정 ────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { siteId } = await params
  const body = await req.json() as {
    name?: string
    url?: string
    check_interval?: MonitorInterval
    notify_email?: string | null
    is_active?: boolean
  }

  if (body.url) {
    try { new URL(body.url) } catch {
      return NextResponse.json({ error: '올바른 URL 형식이 아닙니다.' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('monitor_sites')
    .update({
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.url !== undefined && { url: body.url.trim() }),
      ...(body.check_interval !== undefined && { check_interval: body.check_interval }),
      ...(body.notify_email !== undefined && { notify_email: body.notify_email?.trim() || null }),
      ...(body.is_active !== undefined && { is_active: body.is_active }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── DELETE: 사이트 삭제 ───────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { siteId } = await params
  const { error } = await supabase
    .from('monitor_sites')
    .delete()
    .eq('id', siteId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
