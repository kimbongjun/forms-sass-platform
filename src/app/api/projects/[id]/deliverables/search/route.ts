import { NextRequest, NextResponse } from 'next/server'
import {
  DeliverableSearchPlatform,
  DeliverableSearchResult,
} from '@/features/deliverables/types'
import { parseDeliverableUrl } from '@/features/deliverables/parser'
import { createServerClient } from '@/utils/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

function getTimeoutSignal() {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(8000)
  }
  return undefined
}

function decodeDuckDuckGoUrl(rawUrl: string) {
  try {
    const absolute = rawUrl.startsWith('http') ? rawUrl : `https://duckduckgo.com${rawUrl}`
    const parsed = new URL(absolute)
    const uddg = parsed.searchParams.get('uddg')
    return uddg ? decodeURIComponent(uddg) : rawUrl
  } catch {
    return rawUrl
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
}

function isInstagramCandidateUrl(url: string) {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    if (!hostname.includes('instagram.com')) return false
    return /^\/(p|reel|tv)\//.test(parsed.pathname)
  } catch {
    return false
  }
}

function detectInstagramMediaType(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (pathname.startsWith('/reel/')) return 'REEL'
    if (pathname.startsWith('/tv/')) return 'VIDEO'
    if (pathname.startsWith('/p/')) return 'POST'
  } catch {
    return null
  }
  return null
}

function extractHashtagQuery(keyword: string) {
  const trimmed = keyword.trim()
  if (!trimmed.startsWith('#')) return null
  const normalized = trimmed.replace(/^#+/, '').split(/\s+/)[0]?.replace(/[^0-9A-Za-z_가-힣]/g, '')
  return normalized || null
}

async function searchDuckDuckGo(query: string, limit: number) {
  const endpoints = [
    'https://html.duckduckgo.com/html/',
    'https://duckduckgo.com/html/',
  ]

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
        next: { revalidate: 0 },
        signal: getTimeoutSignal(),
      })

      if (!res.ok) continue

      const html = await res.text()
      const matches = [
        ...html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi),
        ...html.matchAll(/<a[^>]+class="[^"]*result-link[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi),
      ]

      if (matches.length === 0) continue

      return matches.slice(0, limit).map((match) => ({
        url: decodeDuckDuckGoUrl(match[1]),
        title: stripHtml(match[2]),
      }))
    } catch {
      continue
    }
  }

  return []
}

async function searchYouTube(
  keyword: string,
  existingUrls: Set<string>,
  maxResults = 12,
): Promise<{ results: DeliverableSearchResult[]; notices: string[] }> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return {
      results: [],
      notices: ['YOUTUBE_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가해주세요.'],
    }
  }

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('q', keyword)
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('order', 'date')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('maxResults', String(maxResults))
  searchUrl.searchParams.set('relevanceLanguage', 'ko')
  searchUrl.searchParams.set('key', apiKey)

  let searchData: {
    items?: {
      id: { videoId: string }
      snippet: {
        title: string
        publishedAt: string
        channelTitle: string
        thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } }
      }
    }[]
    error?: { message: string; code: number }
  }

  try {
    const res = await fetch(searchUrl.toString(), {
      signal: getTimeoutSignal(),
      next: { revalidate: 0 },
    })
    searchData = await res.json()
    if (!res.ok || searchData.error) {
      return {
        results: [],
        notices: [`YouTube API 오류: ${searchData.error?.message ?? res.statusText}`],
      }
    }
  } catch (error) {
    return {
      results: [],
      notices: [`YouTube 연결 실패: ${error instanceof Error ? error.message : 'timeout'}`],
    }
  }

  const items = searchData.items ?? []
  if (items.length === 0) {
    return { results: [], notices: ['YouTube 검색 결과가 없습니다. 다른 키워드를 시도해보세요.'] }
  }

  const videoIds = items.map((item) => item.id.videoId).join(',')
  const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  statsUrl.searchParams.set('id', videoIds)
  statsUrl.searchParams.set('part', 'statistics')
  statsUrl.searchParams.set('key', apiKey)

  const statsMap: Record<string, { viewCount?: string; likeCount?: string; commentCount?: string }> = {}
  try {
    const statsRes = await fetch(statsUrl.toString(), {
      signal: getTimeoutSignal(),
      next: { revalidate: 0 },
    })
    if (statsRes.ok) {
      const statsData = await statsRes.json() as {
        items?: { id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }[]
      }
      for (const item of statsData.items ?? []) {
        statsMap[item.id] = item.statistics
      }
    }
  } catch {
    // Keep base search results even if statistics lookup fails.
  }

  const results = items.map((item, index) => {
    const videoId = item.id.videoId
    const stats = statsMap[videoId] ?? {}
    const url = `https://www.youtube.com/watch?v=${videoId}`
    const thumbnailUrl =
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.default?.url ??
      null

    return {
      key: `youtube-${videoId}-${index}`,
      platform: 'youtube' as const,
      url,
      title: item.snippet.title,
      thumbnail_url: thumbnailUrl,
      published_at: item.snippet.publishedAt ? item.snippet.publishedAt.slice(0, 10) : null,
      channel_name: item.snippet.channelTitle,
      media_type: 'VIDEO',
      views: parseInt(stats.viewCount ?? '0', 10),
      likes: parseInt(stats.likeCount ?? '0', 10),
      comments: parseInt(stats.commentCount ?? '0', 10),
      shares: 0,
      is_registered: existingUrls.has(url),
      notice: null,
    } satisfies DeliverableSearchResult
  })

  return { results, notices: [] }
}

async function searchInstagram(
  keyword: string,
  existingUrls: Set<string>,
): Promise<{ results: DeliverableSearchResult[]; notices: string[] }> {
  const notices: string[] = []
  const hashtagQuery = extractHashtagQuery(keyword)

  if (hashtagQuery) {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
    const instagramUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

    if (!accessToken || !instagramUserId) {
      notices.push('Instagram 공식 해시태그 검색을 사용하려면 INSTAGRAM_ACCESS_TOKEN과 INSTAGRAM_BUSINESS_ACCOUNT_ID 설정이 필요합니다. 웹 검색 결과로 대체합니다.')
    } else {
      try {
        const hashtagSearchUrl = new URL('https://graph.facebook.com/v23.0/ig_hashtag_search')
        hashtagSearchUrl.searchParams.set('user_id', instagramUserId)
        hashtagSearchUrl.searchParams.set('q', hashtagQuery)
        hashtagSearchUrl.searchParams.set('access_token', accessToken)

        const hashtagSearchRes = await fetch(hashtagSearchUrl.toString(), {
          signal: getTimeoutSignal(),
          next: { revalidate: 0 },
        })

        const hashtagSearchData = await hashtagSearchRes.json() as {
          data?: { id: string }[]
          error?: { message?: string }
        }

        if (hashtagSearchRes.ok && hashtagSearchData.data?.[0]?.id) {
          const hashtagId = hashtagSearchData.data[0].id
          const mediaUrl = new URL(`https://graph.facebook.com/v23.0/${hashtagId}/recent_media`)
          mediaUrl.searchParams.set('user_id', instagramUserId)
          mediaUrl.searchParams.set('fields', 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,thumbnail_url')
          mediaUrl.searchParams.set('access_token', accessToken)

          const mediaRes = await fetch(mediaUrl.toString(), {
            signal: getTimeoutSignal(),
            next: { revalidate: 0 },
          })

          const mediaData = await mediaRes.json() as {
            data?: Array<{
              id: string
              caption?: string
              media_type?: string
              media_url?: string
              permalink?: string
              timestamp?: string
              like_count?: number
              comments_count?: number
              thumbnail_url?: string
            }>
            error?: { message?: string }
          }

          if (mediaRes.ok && Array.isArray(mediaData.data) && mediaData.data.length > 0) {
            const results = mediaData.data
              .filter((item) => Boolean(item.permalink))
              .map((item, index) => ({
                key: `instagram-hashtag-${item.id}-${index}`,
                platform: 'instagram' as const,
                url: item.permalink!,
                title: item.caption?.trim() || `#${hashtagQuery} 관련 Instagram 게시물`,
                thumbnail_url: item.thumbnail_url ?? item.media_url ?? null,
                published_at: item.timestamp ? item.timestamp.slice(0, 10) : null,
                channel_name: null,
                media_type: item.media_type ?? detectInstagramMediaType(item.permalink!),
                views: 0,
                likes: item.like_count ?? 0,
                comments: item.comments_count ?? 0,
                shares: 0,
                is_registered: existingUrls.has(item.permalink!),
                notice: '해시태그 공식 API 결과입니다.',
              }) satisfies DeliverableSearchResult)

            if (results.length > 0) {
              notices.push('Instagram 해시태그 검색은 공식 API 결과를 우선 사용했습니다.')
              return { results, notices }
            }
          }

          notices.push(mediaData.error?.message ?? 'Instagram 공식 해시태그 검색 결과가 없어 웹 검색 결과로 대체합니다.')
        } else {
          notices.push(hashtagSearchData.error?.message ?? 'Instagram 공식 해시태그 조회에 실패해 웹 검색 결과로 대체합니다.')
        }
      } catch (error) {
        notices.push(`Instagram 공식 해시태그 검색 연결에 실패해 웹 검색 결과로 대체합니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  const queryVariants = [
    `site:instagram.com ${keyword}`,
    `site:instagram.com ${keyword} 한국`,
    `site:instagram.com ${keyword} 인스타그램`,
  ]

  const searchedRows = await Promise.all(
    queryVariants.map(async (query) => {
      const rows = await searchDuckDuckGo(query, 8)
      return rows.map((row) => ({ ...row, matchedQuery: query }))
    })
  )

  const uniqueRows = Array.from(
    new Map(
      searchedRows
        .flat()
        .filter((row) => isInstagramCandidateUrl(row.url))
        .map((row) => [row.url, row])
    ).values()
  )

  const results = await Promise.all(
    uniqueRows.map(async (row, index) => {
      try {
        const parsed = await parseDeliverableUrl(row.url)
        return {
          key: `instagram-${index}`,
          platform: 'instagram' as const,
          url: row.url,
          title: parsed.title || row.title || `${keyword} 관련 Instagram 게시물`,
          thumbnail_url: parsed.thumbnail_url,
          published_at: parsed.published_at,
          channel_name: null,
          media_type: detectInstagramMediaType(row.url),
          views: parsed.views,
          likes: parsed.likes,
          comments: parsed.comments,
          shares: 0,
          is_registered: existingUrls.has(row.url),
          notice: parsed.notice,
        } satisfies DeliverableSearchResult
      } catch {
        return {
          key: `instagram-${index}`,
          platform: 'instagram' as const,
          url: row.url,
          title: row.title || `${keyword} 관련 Instagram 게시물`,
          thumbnail_url: null,
          published_at: null,
          channel_name: null,
          media_type: detectInstagramMediaType(row.url),
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          is_registered: existingUrls.has(row.url),
          notice: 'Instagram 메타데이터를 불러오지 못했습니다. 등록 후 수동 보정해주세요.',
        } satisfies DeliverableSearchResult
      }
    })
  )

  if (results.length === 0) {
    notices.push('Instagram 검색 결과가 없거나 외부 검색엔진 응답이 제한되었습니다.')
  }

  return { results, notices }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { keyword?: string; platforms?: DeliverableSearchPlatform[] }
  const keyword = body.keyword?.trim()
  const requestedPlatforms = Array.isArray(body.platforms)
    ? body.platforms.filter((platform): platform is DeliverableSearchPlatform => platform === 'youtube' || platform === 'instagram')
    : []

  if (!keyword) {
    return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 })
  }

  if (requestedPlatforms.length === 0) {
    return NextResponse.json({ error: '검색할 플랫폼을 선택해주세요.' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('project_deliverables')
    .select('url')
    .eq('project_id', id)

  const existingUrls = new Set((existing ?? []).map((row) => row.url))
  const notices: string[] = []
  const resultsByUrl = new Map<string, DeliverableSearchResult>()

  for (const platform of requestedPlatforms) {
    const outcome = platform === 'youtube'
      ? await searchYouTube(keyword, existingUrls)
      : await searchInstagram(keyword, existingUrls)

    notices.push(...outcome.notices)
    for (const result of outcome.results) {
      const current = resultsByUrl.get(result.url)
      if (!current) {
        resultsByUrl.set(result.url, result)
        continue
      }

      if (current.platform === 'instagram' && result.platform === 'youtube') {
        resultsByUrl.set(result.url, result)
      }
    }
  }

  const results = Array.from(resultsByUrl.values()).sort((a, b) => {
    if (a.is_registered !== b.is_registered) return Number(a.is_registered) - Number(b.is_registered)
    if (a.published_at && b.published_at) return b.published_at.localeCompare(a.published_at)
    if (a.published_at) return -1
    if (b.published_at) return 1
    return a.title.localeCompare(b.title, 'ko')
  })

  if (results.length === 0 && notices.length === 0) {
    notices.push('검색 결과가 없습니다. 키워드 또는 플랫폼 조합을 바꿔 다시 시도해주세요.')
  } else if (results.some((result) => result.is_registered)) {
    notices.push('이미 등록된 결과도 함께 표시됩니다. 신규 결과만 선택해서 등록하세요.')
  }

  return NextResponse.json({ results, notices })
}
