import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

interface DatalabRequestBody {
  startDate: string
  endDate: string
  timeUnit: 'date' | 'week' | 'month'
  keywordGroups: { groupName: string; keywords: string[] }[]
  device?: string
  gender?: string
  ages?: string[]
}

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

  const body: DatalabRequestBody = await req.json()

  // Naver Datalab API에 보낼 body 구성
  const naverBody: Record<string, unknown> = {
    startDate: body.startDate,
    endDate: body.endDate,
    timeUnit: body.timeUnit,
    keywordGroups: body.keywordGroups,
  }
  if (body.device) naverBody.device = body.device
  if (body.gender) naverBody.gender = body.gender
  if (body.ages && body.ages.length > 0) naverBody.ages = body.ages

  try {
    const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
        'Content-Type': 'application/json; charset=UTF-8',
        Accept: 'application/json',
      },
      body: JSON.stringify(naverBody),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('[Datalab] Naver API error:', res.status, detail)

      let message = `Naver Datalab API 오류 (${res.status})`
      if (res.status === 401) {
        message = 'API 인증 실패 (401) — CLIENT_ID / CLIENT_SECRET을 확인해주세요.'
      } else if (res.status === 403) {
        message = 'API 권한 없음 (403) — Naver 개발자 센터에서 해당 앱에 "데이터랩 검색어 트렌드" 권한이 등록되어 있는지 확인해주세요.'
      } else if (res.status === 400) {
        message = '잘못된 요청 (400) — 날짜 형식 또는 요청 파라미터를 확인해주세요.'
      }

      return NextResponse.json(
        { error: message, detail, status: res.status },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error('[Datalab] fetch error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
