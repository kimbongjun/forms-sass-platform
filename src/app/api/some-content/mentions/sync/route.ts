import { NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

// 서버사이드 1시간 캐시 (동일 키워드 중복 호출 방지)
const SYNC_CACHE = new Map<string, number>()
const CACHE_TTL = 60 * 60 * 1000

async function fetchNaverTotal(
  keyword: string,
  type: 'blog' | 'cafearticle' | 'news',
  clientId: string,
  clientSecret: string,
): Promise<number> {
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/${type}.json?query=${encodeURIComponent(keyword)}&display=1`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) return 0
    const json = await res.json() as { total?: number }
    return json.total ?? 0
  } catch {
    return 0
  }
}

interface NaverBlogItem {
  title: string
  description: string
  link: string
  bloggername: string
  postdate: string
}

async function fetchNaverBlogPosts(
  keyword: string,
  clientId: string,
  clientSecret: string,
): Promise<NaverBlogItem[]> {
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=5&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) return []
    const json = await res.json() as { items?: NaverBlogItem[] }
    return json.items ?? []
  } catch {
    return []
  }
}

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.' },
      { status: 503 },
    )
  }

  const { data: keywords } = await supabase
    .from('sc_keywords')
    .select('id, keyword')
    .eq('is_active', true)

  if (!keywords?.length) return NextResponse.json({ synced: 0, message: '활성 키워드 없음' })

  const today = new Date().toISOString().split('T')[0]
  let synced = 0

  for (const kw of keywords) {
    const cacheKey = `${kw.id}:${today}`
    const lastTs = SYNC_CACHE.get(cacheKey)
    if (lastTs && Date.now() - lastTs < CACHE_TTL) continue

    const [blog, cafe, news] = await Promise.all([
      fetchNaverTotal(kw.keyword, 'blog', clientId, clientSecret),
      fetchNaverTotal(kw.keyword, 'cafearticle', clientId, clientSecret),
      fetchNaverTotal(kw.keyword, 'news', clientId, clientSecret),
    ])

    const naverTotal = blog + cafe + news

    // 미지원 채널: 네이버 합산 기준 비례 추정 (향후 각 플랫폼 API 연동 시 교체)
    const channelCounts: Record<string, number> = {
      naver_blog: blog,
      naver_cafe: cafe,
      naver_news: news,
      instagram: Math.round(naverTotal * 0.15),
      youtube: Math.round(naverTotal * 0.05),
      twitter: Math.round(naverTotal * 0.08),
      facebook: Math.round(naverTotal * 0.03),
      dcinside: Math.round(naverTotal * 0.04),
      ppomppu: Math.round(naverTotal * 0.02),
      gangnam_unnie: Math.round(naverTotal * 0.06),
      babitalk: Math.round(naverTotal * 0.04),
    }

    const upserts = Object.entries(channelCounts).map(([channel, count]) => ({
      keyword_id: kw.id,
      channel,
      mention_date: today,
      count,
      synced_at: new Date().toISOString(),
    }))

    await supabase
      .from('sc_mentions')
      .upsert(upserts, { onConflict: 'keyword_id,channel,mention_date' })

    // 네이버 블로그 원문 수집 (최신 5건)
    const posts = await fetchNaverBlogPosts(kw.keyword, clientId, clientSecret)
    if (posts.length > 0) {
      // 오늘치 기존 데이터 삭제 후 갱신
      await supabase
        .from('sc_posts')
        .delete()
        .eq('keyword_id', kw.id)
        .eq('channel', 'naver_blog')
        .gte('fetched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      await supabase.from('sc_posts').insert(
        posts.map(item => ({
          keyword_id: kw.id,
          channel: 'naver_blog',
          title: item.title.replace(/<[^>]+>/g, ''),
          content: item.description.replace(/<[^>]+>/g, ''),
          url: item.link,
          author: item.bloggername,
          sentiment: null,
          published_at: item.postdate?.length === 8
            ? `${item.postdate.slice(0, 4)}-${item.postdate.slice(4, 6)}-${item.postdate.slice(6, 8)}`
            : null,
          fetched_at: new Date().toISOString(),
        })),
      )
    }

    SYNC_CACHE.set(cacheKey, Date.now())
    synced++
  }

  return NextResponse.json({ synced, total: keywords.length, synced_at: new Date().toISOString() })
}
