import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface YouTubeStatistics {
  viewCount?: string
  likeCount?: string
  commentCount?: string
}

interface YouTubeItem {
  id: string
  statistics: YouTubeStatistics
}

interface YouTubeResponse {
  items?: YouTubeItem[]
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

async function fetchYouTubeStats(videoId: string, apiKey: string) {
  const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=statistics&key=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data: YouTubeResponse = await res.json()
  const item = data.items?.[0]
  if (!item) return null
  return {
    views: parseInt(item.statistics.viewCount ?? '0', 10),
    likes: parseInt(item.statistics.likeCount ?? '0', 10),
    comments: parseInt(item.statistics.commentCount ?? '0', 10),
    shares: 0, // YouTube API doesn't expose share count
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const youtubeApiKey = process.env.YOUTUBE_API_KEY

  // deliverableId 지정 시 단건, 없으면 전체 동기화
  const body = await req.json().catch(() => ({}))
  const singleId: string | undefined = body.deliverableId

  const query = supabase
    .from('project_deliverables')
    .select('id, platform, url')
    .eq('project_id', id)

  if (singleId) query.eq('id', singleId)

  const { data: deliverables, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = { synced: 0, skipped: 0, errors: 0 }

  for (const d of deliverables ?? []) {
    try {
      if (d.platform === 'youtube' && youtubeApiKey) {
        const videoId = extractYouTubeVideoId(d.url)
        if (!videoId) { results.skipped++; continue }

        const stats = await fetchYouTubeStats(videoId, youtubeApiKey)
        if (!stats) { results.skipped++; continue }

        await supabase
          .from('project_deliverables')
          .update({ ...stats, last_synced_at: new Date().toISOString() })
          .eq('id', d.id)

        results.synced++
      } else {
        // Instagram / TikTok 등 — 자동화 API 연동에 액세스 토큰 필요
        // 추후 INSTAGRAM_ACCESS_TOKEN 환경변수 설정 후 구현
        results.skipped++
      }
    } catch {
      results.errors++
    }
  }

  return NextResponse.json({
    ok: true,
    ...results,
    note: !youtubeApiKey ? 'YOUTUBE_API_KEY 환경변수가 설정되지 않아 YouTube 동기화가 건너뛰어졌습니다.' : undefined,
  })
}
