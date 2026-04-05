import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import { parseClippingUrl } from '@/features/clippings/parser'
import type { ParsedClipping } from '@/features/clippings/types'

interface SearchCandidate extends ParsedClipping {
  key: string
  domain: string | null
  is_registered: boolean
  matched_query: string
  is_major_media: boolean
  source_priority: number
}

const MAJOR_MEDIA_PRIORITY: Record<string, number> = {
  'chosun.com': 100,
  'joins.com': 98,
  'donga.com': 96,
  'hani.co.kr': 94,
  'khan.co.kr': 93,
  'mk.co.kr': 95,
  'hankyung.com': 95,
  'sedaily.com': 92,
  'mt.co.kr': 91,
  'asiae.co.kr': 90,
  'fnnews.com': 90,
  'edaily.co.kr': 89,
  'newsis.com': 88,
  'yna.co.kr': 99,
  'ytn.co.kr': 87,
  'nocutnews.co.kr': 86,
  'ohmynews.com': 84,
  'etnews.com': 88,
  'zdnet.co.kr': 87,
  'itworld.co.kr': 82,
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

function normalizeDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function getTimeoutSignal() {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(8000)
  }
  return undefined
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

function getDomainPriority(domain: string | null) {
  if (!domain) return 0
  const direct = MAJOR_MEDIA_PRIORITY[domain]
  if (direct) return direct

  const matched = Object.entries(MAJOR_MEDIA_PRIORITY).find(([candidate]) => domain === candidate || domain.endsWith(`.${candidate}`))
  return matched?.[1] ?? 0
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

async function searchNaverNews(query: string, limit: number) {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET

  if (!clientId || !clientSecret) return []

  try {
    const url = new URL('https://openapi.naver.com/v1/search/news.json')
    url.searchParams.set('query', query)
    url.searchParams.set('display', String(Math.min(limit, 100)))
    url.searchParams.set('start', '1')
    url.searchParams.set('sort', 'date')

    const res = await fetch(url.toString(), {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: getTimeoutSignal(),
    })

    if (!res.ok) return []

    const data = await res.json() as {
      items?: Array<{
        title?: string
        originallink?: string
        link?: string
        description?: string
        pubDate?: string
      }>
    }

    return (data.items ?? []).map((item) => ({
      url: item.originallink?.trim() || item.link?.trim() || '',
      title: stripHtml(item.title ?? ''),
      matched_query: query,
      description: stripHtml(item.description ?? ''),
      published_at: normalizeDate(item.pubDate ?? null),
    })).filter((item) => item.url)
  } catch {
    return []
  }
}

function isAllowedNewsUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (
      hostname.includes('youtube.com') ||
      hostname.includes('youtu.be') ||
      hostname.includes('instagram.com') ||
      hostname.includes('tiktok.com') ||
      hostname.includes('facebook.com') ||
      hostname.includes('x.com') ||
      hostname.includes('twitter.com')
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as { keyword?: string }
  const keyword = body.keyword?.trim()

  if (!keyword) {
    return NextResponse.json({ error: '키워드를 입력해주세요.' }, { status: 400 })
  }

  const notices: string[] = []
  const queryVariants = [
    `${keyword} (보도자료 OR 기사 OR 뉴스 OR press release)`,
    `${keyword} 언론보도`,
    `${keyword} press release`,
  ]
  const searchedRows = await Promise.all(
    queryVariants.map(async (query) => {
      const naverRows = await searchNaverNews(query, 10)
      if (naverRows.length > 0) {
        return naverRows.map((row) => ({
          url: row.url,
          title: row.title,
          matched_query: row.matched_query,
          description: row.description,
          published_at: row.published_at,
        }))
      }

      const ddgRows = await searchDuckDuckGo(query, 8)
      return ddgRows.map((row) => ({
        url: row.url,
        title: row.title,
        matched_query: query,
        description: null,
        published_at: null,
      }))
    })
  )

  const { data: existingRows, error: existingError } = await supabase
    .from('project_clippings')
    .select('url')
    .eq('project_id', id)

  if (existingError) {
    notices.push('기존 등록 기사와의 중복 확인에 실패했습니다.')
  }

  const existingUrls = new Set((existingRows ?? []).map((item) => item.url))
  const uniqueUrls = Array.from(
    new Map(
      searchedRows
        .flat()
        .filter((item) => isAllowedNewsUrl(item.url))
        .map((item) => [item.url, item])
    ).values()
  )

  const parsedResults = await Promise.all(
    uniqueUrls.map(async (item, index) => {
      try {
        const parsed = await parseClippingUrl(item.url)
        const domain = getDomain(item.url)
        const sourcePriority = getDomainPriority(domain)
        return {
          ...parsed,
          title: parsed.title || item.title || `${keyword} 관련 기사`,
          source: parsed.source || domain,
          description: parsed.description || item.description || null,
          published_at: parsed.published_at || item.published_at || null,
          domain,
          is_registered: existingUrls.has(item.url),
          matched_query: item.matched_query,
          is_major_media: sourcePriority >= 90,
          source_priority: sourcePriority,
          key: `clipping-${index}`,
        } satisfies SearchCandidate
      } catch {
        notices.push(`${item.url} 메타데이터 파싱에 실패해 기본 정보만 표시합니다.`)
        const domain = getDomain(item.url)
        const sourcePriority = getDomainPriority(domain)
        return {
          title: item.title || `${keyword} 관련 기사`,
          url: item.url,
          source: domain,
          published_at: item.published_at,
          description: item.description,
          thumbnail_url: null,
          domain,
          is_registered: existingUrls.has(item.url),
          matched_query: item.matched_query,
          is_major_media: sourcePriority >= 90,
          source_priority: sourcePriority,
          notice: '원본 메타데이터를 불러오지 못했습니다. 등록 후 수동 보정해주세요.',
          key: `clipping-${index}`,
        } satisfies SearchCandidate
      }
    })
  )

  parsedResults.sort((a, b) => {
    if (a.is_registered !== b.is_registered) return Number(a.is_registered) - Number(b.is_registered)
    if (a.is_major_media !== b.is_major_media) return Number(b.is_major_media) - Number(a.is_major_media)
    if (a.source_priority !== b.source_priority) return b.source_priority - a.source_priority
    if (a.published_at && b.published_at) return b.published_at.localeCompare(a.published_at)
    if (a.published_at) return -1
    if (b.published_at) return 1
    if (a.source && b.source) return a.source.localeCompare(b.source, 'ko')
    return a.title.localeCompare(b.title, 'ko')
  })

  if (parsedResults.length === 0) {
    notices.push('검색 결과가 없거나 검색 엔진 응답이 제한되었습니다. Vercel에서는 NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET 설정을 권장합니다.')
  } else if (parsedResults.some((item) => item.is_registered)) {
    notices.push('이미 등록된 기사도 함께 표시됩니다. 중복 등록이 필요 없다면 신규 결과만 선택하세요.')
  }

  return NextResponse.json({ results: parsedResults, notices })
}
