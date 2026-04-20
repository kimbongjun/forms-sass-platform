import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await params
  const body = await req.json()

  const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }

  const allowed = [
    'title', 'summary', 'content', 'category', 'region',
    'company_tags', 'source_url', 'source_name', 'published_at', 'is_featured',
  ]

  for (const key of allowed) {
    if (key in body) {
      if (typeof body[key] === 'string') {
        updateFields[key] = body[key].trim() || null
      } else {
        updateFields[key] = body[key]
      }
    }
  }

  const { data, error } = await supabase
    .from('industry_analysis_items')
    .update(updateFields)
    .eq('id', itemId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await params

  const { error } = await supabase
    .from('industry_analysis_items')
    .delete()
    .eq('id', itemId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
