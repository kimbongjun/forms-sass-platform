import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServerClient } from '@/utils/supabase/server'

// ── 서버사이드 1시간 캐시 ────────────────────────────────────────
const CACHE = new Map<string, { data: NaverKeywordResult; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000

export interface NaverKeywordResult {
  /** 검색광고 API 실측 월간 검색량 (null = 광고 API 미설정) */
  monthlyPcQcCnt: number | null
  monthlyMobileQcCnt: number | null
  /** 채널별 총 콘텐츠 수 (네이버 검색 API 스냅샷) */
  contentByPlatform: {
    blog: number
    cafe: number
    news: number
    kin: number
    shop: number
  }
  fetchedAt: string
}

// ── Naver 검색광고 API — 실제 월간 오가닉 검색량 ─────────────────
async function fetchAdSearchVolume(
  keyword: string,
  customerId: string,
  accessLicense: string,
  secretKey: string,
): Promise<{ pc: number; mobile: number } | null> {
  const timestamp = Date.now()
  const method = 'GET'
  const path = '/keywordstool'
  const message = `${timestamp}.${method}.${path}`
  const signature = createHmac('sha256', secretKey).update(message).digest('base64')

  try {
    const res = await fetch(
      `https://api.naver.com${path}?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`,
      {
        headers: {
          'X-Timestamp': String(timestamp),
          'X-API-KEY': accessLicense,
          'X-Customer': customerId,
          'X-Signature': signature,
        },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) {
      console.error(`[Blueberry/Naver] AdAPI error: ${res.status}`)
      return null
    }
    const json = await res.json() as {
      keywordList?: {
        relKeyword: string
        monthlyPcQcCnt: number | string
        monthlyMobileQcCnt: number | string
      }[]
    }
    const row = json.keywordList?.find(
      (k) => k.relKeyword === keyword,
    ) ?? json.keywordList?.[0]
    if (!row) return null

    const pc = typeof row.monthlyPcQcCnt === 'number' ? row.monthlyPcQcCnt : 0
    const mobile = typeof row.monthlyMobileQcCnt === 'number' ? row.monthlyMobileQcCnt : 0
    return { pc, mobile }
  } catch (e) {
    console.error('[Blueberry/Naver] AdAPI exception:', e)
    return null
  }
}

// ── Naver 검색 API (채널별 총 결과 수) ───────────────────────────
async function fetchSearchTotal(
  keyword: string,
  type: 'blog' | 'cafearticle' | 'news' | 'kin' | 'shop',
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

// ── Route Handler ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.' },
      { status: 503 },
    )
  }

  const { keyword } = await req.json() as { keyword?: string }
  if (!keyword?.trim()) {
    return NextResponse.json({ error: 'keyword 파라미터가 필요합니다.' }, { status: 400 })
  }

  const cacheKey = keyword.trim()
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, fromCache: true })
  }

  const adCustomerId = process.env.NAVER_AD_CUSTOMER_ID
  const adAccessLicense = process.env.NAVER_AD_ACCESS_LICENSE
  const adSecretKey = process.env.NAVER_AD_SECRET_KEY
  const hasAdApi = !!(adCustomerId && adAccessLicense && adSecretKey)

  try {
    const [adVolume, blog, cafe, news, kin, shop] = await Promise.all([
      hasAdApi
        ? fetchAdSearchVolume(cacheKey, adCustomerId!, adAccessLicense!, adSecretKey!)
        : Promise.resolve(null),
      fetchSearchTotal(keyword, 'blog', clientId, clientSecret),
      fetchSearchTotal(keyword, 'cafearticle', clientId, clientSecret),
      fetchSearchTotal(keyword, 'news', clientId, clientSecret),
      fetchSearchTotal(keyword, 'kin', clientId, clientSecret),
      fetchSearchTotal(keyword, 'shop', clientId, clientSecret),
    ])

    const result: NaverKeywordResult = {
      monthlyPcQcCnt: adVolume?.pc ?? null,
      monthlyMobileQcCnt: adVolume?.mobile ?? null,
      contentByPlatform: { blog, cafe, news, kin, shop },
      fetchedAt: new Date().toISOString(),
    }

    CACHE.set(cacheKey, { data: result, ts: Date.now() })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[Blueberry/Naver] API Error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
