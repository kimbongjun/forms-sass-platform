import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import { crawlAllCommunity, fetchYouTubePosts } from '@/lib/some-content/crawlers'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { keyword_id?: string }
  const ytKey = process.env.YOUTUBE_API_KEY

  let kwQuery = supabase.from('sc_keywords').select('id, keyword').eq('is_active', true)
  if (body.keyword_id) kwQuery = kwQuery.eq('id', body.keyword_id)

  const { data: keywords } = await kwQuery
  if (!keywords?.length) return NextResponse.json({ total_saved: 0, results: [] })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const results: { keyword: string; saved: number; channels: string[] }[] = []
  let totalSaved = 0

  for (const kw of keywords.slice(0, 5)) {
    const [communityPosts, ytPosts] = await Promise.all([
      crawlAllCommunity(kw.keyword),
      ytKey ? fetchYouTubePosts(kw.keyword, ytKey) : Promise.resolve([]),
    ])

    const allPosts = [...communityPosts, ...ytPosts]
    if (!allPosts.length) {
      results.push({ keyword: kw.keyword, saved: 0, channels: [] })
      continue
    }

    const channels = [...new Set(allPosts.map(p => p.channel))]

    // 오늘 수집분 교체
    for (const ch of channels) {
      await supabase.from('sc_posts')
        .delete()
        .eq('keyword_id', kw.id)
        .eq('channel', ch)
        .gte('fetched_at', today.toISOString())
    }

    const { error } = await supabase.from('sc_posts').insert(
      allPosts.map(p => ({
        keyword_id: kw.id,
        channel: p.channel,
        title: p.title,
        content: p.content,
        url: p.url,
        author: p.author,
        sentiment: null,
        published_at: p.published_at,
        fetched_at: new Date().toISOString(),
      })),
    )

    if (!error) {
      totalSaved += allPosts.length
      const today_str = today.toISOString().split('T')[0]
      for (const ch of channels) {
        const count = allPosts.filter(p => p.channel === ch).length
        await supabase.from('sc_mentions').upsert(
          { keyword_id: kw.id, channel: ch, mention_date: today_str, count, synced_at: new Date().toISOString() },
          { onConflict: 'keyword_id,channel,mention_date' },
        )
      }
    }

    results.push({ keyword: kw.keyword, saved: allPosts.length, channels })
  }

  return NextResponse.json({ total_saved: totalSaved, results })
}
