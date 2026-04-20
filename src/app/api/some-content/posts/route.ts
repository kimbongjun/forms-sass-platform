import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { searchParams } = req.nextUrl
  const channel = searchParams.get('channel')
  const keyword_id = searchParams.get('keyword_id')

  let query = supabase
    .from('sc_posts')
    .select('*, sc_keywords(keyword)')
    .order('fetched_at', { ascending: false })
    .limit(100)

  if (channel && channel !== 'all') query = query.eq('channel', channel)
  if (keyword_id && keyword_id !== 'all') query = query.eq('keyword_id', keyword_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const posts = (data ?? []).map(p => ({
    ...p,
    keyword: (p.sc_keywords as { keyword: string } | null)?.keyword ?? '',
    sc_keywords: undefined,
  }))

  return NextResponse.json(posts)
}
