import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleTrends = require('google-trends-api')

// ── 서버사이드 1시간 캐시 ────────────────────────────────────────
const CACHE = new Map<string, { data: GoogleTrendsResult; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000

export interface GoogleTrendsResult {
  /** 최근 12개월 월별 관심도 (0-100 상대 스케일) */
  interestOverTime: { month: string; value: number }[]
  /** 연관 검색어 */
  relatedQueries: { query: string; value: number }[]
  fetchedAt: string
}

// ── Route Handler ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { keyword } = await req.json() as { keyword?: string }
  if (!keyword?.trim()) {
    return NextResponse.json({ error: 'keyword 파라미터가 필요합니다.' }, { status: 400 })
  }

  const cacheKey = keyword.trim()
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, fromCache: true })
  }

  try {
    const startTime = new Date()
    startTime.setFullYear(startTime.getFullYear() - 5) // 최대 5년

    const [trendRes, relatedRes] = await Promise.allSettled([
      googleTrends.interestOverTime({
        keyword: cacheKey,
        startTime,
        hl: 'ko',
        geo: 'KR',
      }) as Promise<string>,
      googleTrends.relatedQueries({
        keyword: cacheKey,
        startTime,
        hl: 'ko',
        geo: 'KR',
      }) as Promise<string>,
    ])

    // 주간 데이터 → 월별 평균으로 집계
    let interestOverTime: { month: string; value: number }[] = []
    if (trendRes.status === 'fulfilled') {
      try {
        const parsed = JSON.parse(trendRes.value) as {
          default: { timelineData: { time: string; value: number[] }[] }
        }
        const monthlyMap = new Map<string, number[]>()
        for (const point of parsed.default.timelineData) {
          const date = new Date(parseInt(point.time) * 1000)
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          if (!monthlyMap.has(key)) monthlyMap.set(key, [])
          monthlyMap.get(key)!.push(point.value[0] ?? 0)
        }
        interestOverTime = Array.from(monthlyMap.entries())
          .map(([month, values]) => ({
            month,
            value: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
          }))
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12)
      } catch (e) {
        console.warn('[Blueberry/Google] interestOverTime parse error:', e)
      }
    } else {
      console.warn('[Blueberry/Google] interestOverTime failed:', trendRes.reason)
    }

    // 연관 검색어
    let relatedQueries: { query: string; value: number }[] = []
    if (relatedRes.status === 'fulfilled') {
      try {
        const parsed = JSON.parse(relatedRes.value) as {
          default: {
            rankedList: { rankedKeyword: { query: string; value: number }[] }[]
          }
        }
        relatedQueries = parsed.default.rankedList[0]?.rankedKeyword?.slice(0, 8) ?? []
      } catch (e) {
        console.warn('[Blueberry/Google] relatedQueries parse error:', e)
      }
    } else {
      console.warn('[Blueberry/Google] relatedQueries failed:', relatedRes.reason)
    }

    const result: GoogleTrendsResult = {
      interestOverTime,
      relatedQueries,
      fetchedAt: new Date().toISOString(),
    }

    CACHE.set(cacheKey, { data: result, ts: Date.now() })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[Blueberry/Google] Trends API error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
