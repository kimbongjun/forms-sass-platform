import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subscriberId: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscriberId } = await params
  const body = await req.json()

  const { data, error } = await supabase
    .from('industry_analysis_subscribers')
    .update({ is_active: body.is_active })
    .eq('id', subscriberId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ subscriberId: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscriberId } = await params

  const { error } = await supabase
    .from('industry_analysis_subscribers')
    .delete()
    .eq('id', subscriberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
