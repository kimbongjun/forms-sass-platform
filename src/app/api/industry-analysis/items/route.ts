import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') // 'domestic' | 'global' | null (전체)
  const runId = searchParams.get('run_id')

  let query = supabase
    .from('industry_analysis_items')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (region) query = query.eq('region', region)
  if (runId) query = query.eq('run_id', runId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
