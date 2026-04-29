import type { ParsedDeliverable } from '@/features/deliverables/types'

const REQUEST_TIMEOUT_MS = 8000

function getTimeoutSignal() {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  }
  return undefined
}

async function fetchWithTimeout(input: string | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    signal: init?.signal ?? getTimeoutSignal(),
  })
}

function detectPlatform(url: string): ParsedDeliverable['platform'] {
  try {
    const { hostname } = new URL(url)
    const host = hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'youtu.be') return 'youtube'
    if (host === 'instagram.com') return 'instagram'
    if (host === 'tiktok.com') return 'tiktok'
    if (host === 'facebook.com' || host === 'fb.com' || host === 'fb.watch') return 'facebook'
    if (host === 'twitter.com' || host === 'x.com') return 'twitter'
  } catch {
    return 'other'
  }

  return 'other'
}

function extractYouTubeId(url: string): string | null {
  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.hostname === 'youtu.be') return parsedUrl.pathname.slice(1).split('/')[0]

    const videoId = parsedUrl.searchParams.get('v')
    if (videoId) return videoId

    const match = parsedUrl.pathname.match(/\/(shorts|embed|v)\/([a-zA-Z0-9_-]+)/)
    if (match) return match[2]
  } catch {
    return null
  }

  return null
}

async function parseYouTube(url: string): Promise<ParsedDeliverable> {
  const videoId = extractYouTubeId(url)
  const base: ParsedDeliverable = {
    platform: 'youtube',
    url,
    title: '',
    thumbnail_url: null,
    published_at: null,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    parsed_fields: { title: false, thumbnail: false, stats: false, published_at: false },
    notice: null,
  }

  if (!videoId) {
    return { ...base, notice: 'YouTube 영상 ID를 추출할 수 없습니다. URL을 확인해주세요.' }
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return {
      ...base,
      notice: 'YOUTUBE_API_KEY가 설정되지 않았습니다. 환경변수를 추가해주세요.',
    }
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${apiKey}`
    const res = await fetchWithTimeout(apiUrl, { next: { revalidate: 0 } })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return {
        ...base,
        notice: `YouTube API 오류: ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`,
      }
    }

    const data = await res.json() as {
      items?: {
        snippet: {
          title: string
          publishedAt: string
          thumbnails: { maxres?: { url: string }; high?: { url: string }; default?: { url: string } }
        }
        statistics: {
          viewCount?: string
          likeCount?: string
          commentCount?: string
        }
      }[]
    }

    const item = data.items?.[0]
    if (!item) {
      return { ...base, notice: '해당 YouTube 영상을 찾을 수 없습니다. (비공개 또는 삭제된 영상)' }
    }

    const { snippet, statistics } = item
    const thumb =
      snippet.thumbnails.maxres?.url ??
      snippet.thumbnails.high?.url ??
      snippet.thumbnails.default?.url ??
      null

    return {
      platform: 'youtube',
      url,
      title: snippet.title,
      thumbnail_url: thumb,
      published_at: snippet.publishedAt ? snippet.publishedAt.slice(0, 10) : null,
      views: parseInt(statistics.viewCount ?? '0', 10),
      likes: parseInt(statistics.likeCount ?? '0', 10),
      comments: parseInt(statistics.commentCount ?? '0', 10),
      shares: 0,
      parsed_fields: {
        title: true,
        thumbnail: !!thumb,
        stats: true,
        published_at: !!snippet.publishedAt,
      },
      notice: '공유 수는 YouTube API에서 제공되지 않아 0으로 설정됩니다.',
    }
  } catch (error) {
    return {
      ...base,
      notice: `YouTube 정보를 불러오지 못했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

async function parseInstagram(url: string): Promise<ParsedDeliverable> {
  const base: ParsedDeliverable = {
    platform: 'instagram',
    url,
    title: '',
    thumbnail_url: null,
    published_at: null,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    parsed_fields: { title: false, thumbnail: false, stats: false, published_at: false },
    notice: null,
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  if (accessToken) {
    try {
      const oembedUrl = `https://graph.facebook.com/v23.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${accessToken}&fields=thumbnail_url,title,author_name`
      const res = await fetchWithTimeout(oembedUrl, { next: { revalidate: 0 } })
      if (res.ok) {
        const data = await res.json() as { thumbnail_url?: string; title?: string; author_name?: string }
        const title = data.title ?? data.author_name ?? ''
        return {
          ...base,
          title,
          thumbnail_url: data.thumbnail_url ?? null,
          parsed_fields: { title: !!title, thumbnail: !!data.thumbnail_url, stats: false, published_at: false },
          notice: '인게이지먼트 통계(좋아요/댓글)는 Instagram Business API 권한이 필요합니다. 수동으로 입력해주세요.',
        }
      }
    } catch {
      // fallthrough
    }
  }

  try {
    const oembedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`
    const res = await fetchWithTimeout(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const data = await res.json() as { thumbnail_url?: string; title?: string; author_name?: string }
      const title = data.title ?? data.author_name ?? ''
      return {
        ...base,
        title,
        thumbnail_url: data.thumbnail_url ?? null,
        parsed_fields: { title: !!title, thumbnail: !!data.thumbnail_url, stats: false, published_at: false },
        notice: '인게이지먼트 통계는 Instagram Business API 토큰이 필요합니다. 수동으로 입력해주세요.',
      }
    }
  } catch {
    // fallthrough
  }

  return {
    ...base,
    notice: 'Instagram 메타데이터를 가져오지 못했습니다. INSTAGRAM_ACCESS_TOKEN을 설정하거나 수동으로 입력해주세요.',
  }
}

async function parseTikTok(url: string): Promise<ParsedDeliverable> {
  const base: ParsedDeliverable = {
    platform: 'tiktok',
    url,
    title: '',
    thumbnail_url: null,
    published_at: null,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    parsed_fields: { title: false, thumbnail: false, stats: false, published_at: false },
    notice: null,
  }

  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    const res = await fetchWithTimeout(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const data = await res.json() as { title?: string; thumbnail_url?: string; author_name?: string }
      const title = data.title ?? data.author_name ?? ''
      return {
        ...base,
        title,
        thumbnail_url: data.thumbnail_url ?? null,
        parsed_fields: { title: !!title, thumbnail: !!data.thumbnail_url, stats: false, published_at: false },
        notice: 'TikTok은 공식 API를 통한 통계 조회를 지원하지 않습니다. 지표는 수동으로 입력해주세요.',
      }
    }
  } catch {
    // fallthrough
  }

  return {
    ...base,
    notice: 'TikTok 메타데이터를 가져오지 못했습니다. 수동으로 입력해주세요.',
  }
}

async function parseOpenGraph(url: string, platform: ParsedDeliverable['platform']): Promise<ParsedDeliverable> {
  const base: ParsedDeliverable = {
    platform,
    url,
    title: '',
    thumbnail_url: null,
    published_at: null,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    parsed_fields: { title: false, thumbnail: false, stats: false, published_at: false },
    notice: null,
  }

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const html = await res.text()
    const getMeta = (property: string) => {
      const match =
        html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')) ??
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'))
      return match?.[1] ?? null
    }

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null
    const title = getMeta('og:title') ?? getMeta('twitter:title') ?? titleTag ?? ''
    const thumbnail = getMeta('og:image') ?? getMeta('twitter:image') ?? null
    const publishedAt =
      getMeta('article:published_time')?.slice(0, 10) ??
      getMeta('og:article:published_time')?.slice(0, 10) ??
      null

    const platformNotice: Record<string, string> = {
      twitter: 'Twitter/X는 유료 API(Basic 이상)가 필요합니다. 지표는 수동으로 입력해주세요.',
      facebook: 'Facebook은 Graph API 토큰이 필요합니다. 지표는 수동으로 입력해주세요.',
      other: '이 플랫폼은 자동 지표 파싱을 지원하지 않습니다. 수동으로 입력해주세요.',
    }

    return {
      ...base,
      title,
      thumbnail_url: thumbnail,
      published_at: publishedAt,
      parsed_fields: {
        title: !!title,
        thumbnail: !!thumbnail,
        stats: false,
        published_at: !!publishedAt,
      },
      notice: platformNotice[platform] ?? null,
    }
  } catch (error) {
    return {
      ...base,
      notice: `페이지를 불러오지 못했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export async function parseDeliverableUrl(url: string) {
  const normalizedUrl = url.trim()
  const platform = detectPlatform(normalizedUrl)

  switch (platform) {
    case 'youtube':
      return parseYouTube(normalizedUrl)
    case 'instagram':
      return parseInstagram(normalizedUrl)
    case 'tiktok':
      return parseTikTok(normalizedUrl)
    case 'twitter':
    case 'facebook':
    case 'other':
    default:
      return parseOpenGraph(normalizedUrl, platform)
  }
}
