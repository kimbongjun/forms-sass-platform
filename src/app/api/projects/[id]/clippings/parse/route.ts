import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import { parseClippingUrl } from '@/features/clippings/parser'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  void (await params)

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json() as { url?: string }
  if (!url?.trim()) {
    return NextResponse.json({ error: 'URL이 필요합니다.' }, { status: 400 })
  }

  return NextResponse.json(await parseClippingUrl(url))
}
