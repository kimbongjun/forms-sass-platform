import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

interface RelatedKeyword {
  keyword: string
  pc: number
  mobile: number
  total: number
}

const CACHE = new Map<string, { data: RelatedKeyword[]; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000

function parseQc(v: number | string | undefined | null): number {
  if (!v) return 0
  if (typeof v === 'number') return Math.round(v)
  const s = String(v).trim()
  if (s.startsWith('<')) return 0
  return parseInt(s.replace(/,/g, ''), 10) || 0
}

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword')?.trim()
  if (!keyword) return NextResponse.json({ error: 'keyword 필요' }, { status: 400 })

  const cached = CACHE.get(keyword)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  const customerId = process.env.NAVER_AD_CUSTOMER_ID?.trim()
  const accessLicense = process.env.NAVER_AD_ACCESS_LICENSE?.trim()
  const secretKey = process.env.NAVER_AD_SECRET_KEY?.trim()

  if (!customerId || !accessLicense || !secretKey) {
    return NextResponse.json(
      { error: 'NAVER_AD_CUSTOMER_ID / NAVER_AD_ACCESS_LICENSE / NAVER_AD_SECRET_KEY 환경변수가 설정되지 않았습니다.' },
      { status: 503 },
    )
  }

  const timestamp = Date.now()
  const path = '/keywordstool'
  const message = `${timestamp}.GET.${path}`
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
      console.error('[SomeContent/related] Naver Ad API error:', res.status, body)
      return NextResponse.json({ error: `Naver API 오류: ${res.status}` }, { status: 502 })
    }

    const json = await res.json() as {
      keywordList?: {
        relKeyword: string
        monthlyPcQcCnt: number | string
        monthlyMobileQcCnt: number | string
      }[]
    }

    const related: RelatedKeyword[] = (json.keywordList ?? [])
      .filter(k => k.relKeyword.trim() !== keyword)
      .map(k => ({
        keyword: k.relKeyword,
        pc: parseQc(k.monthlyPcQcCnt),
        mobile: parseQc(k.monthlyMobileQcCnt),
        total: parseQc(k.monthlyPcQcCnt) + parseQc(k.monthlyMobileQcCnt),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)

    CACHE.set(keyword, { data: related, ts: Date.now() })
    return NextResponse.json(related)
  } catch (e) {
    console.error('[SomeContent/related] exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
