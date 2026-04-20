import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('industry_analysis_subscribers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, name, frequency } = await req.json()

  if (!email?.trim()) {
    return NextResponse.json({ error: '이메일은 필수입니다.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('industry_analysis_subscribers')
    .upsert(
      {
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        frequency: frequency ?? 'weekly',
        is_active: true,
      },
      { onConflict: 'email' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
