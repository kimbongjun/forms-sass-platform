import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

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
// Naver Ad API 응답의 검색량 필드 파싱
// - 정수: 그대로 반환
// - "< 10" 문자열: 0 반환 (10 미만)
// - 숫자 문자열 "8770": 정수로 변환
function parseQcCnt(v: number | string | undefined | null): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Math.round(v)
  const s = String(v).trim()
  if (s.startsWith('<')) return 0
  const n = parseInt(s.replace(/,/g, ''), 10)
  return isNaN(n) ? 0 : n
}

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
      const body = await res.text()
      console.error(`[Blueberry/Naver] AdAPI error: ${res.status}`, body)
      return null
    }
    const json = await res.json() as {
      keywordList?: {
        relKeyword: string
        monthlyPcQcCnt: number | string
        monthlyMobileQcCnt: number | string
      }[]
    }

    // 응답 진단 로그 — 어떤 키워드들이 반환됐는지 확인
    console.log(
      `[Blueberry/Naver] AdAPI response for "${keyword}":`,
      JSON.stringify(json.keywordList?.map(k => ({
        relKeyword: k.relKeyword,
        pc: k.monthlyPcQcCnt,
        mobile: k.monthlyMobileQcCnt,
      })).slice(0, 5)),
    )

    const trimmed = keyword.trim().normalize('NFC')
    const row = json.keywordList?.find(
      (k) => k.relKeyword.trim().normalize('NFC') === trimmed,
    )
    if (!row) {
      console.warn(
        `[Blueberry/Naver] "${keyword}" not found. Available: [${
          json.keywordList?.map(k => k.relKeyword).slice(0, 5).join(', ')
        }]`,
      )
      return null
    }

    const pc = parseQcCnt(row.monthlyPcQcCnt)
    const mobile = parseQcCnt(row.monthlyMobileQcCnt)
    console.log(`[Blueberry/Naver] parsed → pc=${pc}, mobile=${mobile}`)
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

  const cacheKey = keyword.trim().normalize('NFC')
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, fromCache: true })
  }

  // .trim()으로 복사/붙여넣기 시 섞인 공백·줄바꿈 제거
  const adCustomerId = process.env.NAVER_AD_CUSTOMER_ID?.trim()
  const adAccessLicense = process.env.NAVER_AD_ACCESS_LICENSE?.trim()
  const adSecretKey = process.env.NAVER_AD_SECRET_KEY?.trim()
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
