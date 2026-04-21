import { NextRequest, NextResponse } from 'next/server'
import { checkQuota, consume, BUDGET } from '../_lib/groq-quota'

const CACHE = new Map<string, { data: InsightsResult; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000
const EST_TOKENS = 1_300  // estimated tokens per Groq call (input + output)

export interface InsightsResult {
  trend_summary: string
  opportunities: string[]
  risks: string[]
  recommendations: string[]
  warning?: string
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    keyword: string
    metrics?: {
      trend: string; growthRate: number; volatility: number
      avg: number; recent3Avg: number; maxMonth: string; minMonth: string
    }
    sentimentSummary?: string
    positive?: { word: string; weight: number }[]
    negative?: { word: string; weight: number }[]
  }

  const { keyword, metrics, sentimentSummary, positive, negative } = body
  if (!keyword) return NextResponse.json({ error: 'keyword 필요' }, { status: 400 })

  const cacheKey = `${keyword}:${metrics?.trend}:${metrics?.growthRate}`
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data)

  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY 미설정 (console.groq.com에서 발급)' }, { status: 503 })
  }

  // Daily quota check — block before calling Groq
  const quota = checkQuota()
  if (quota.blocked) {
    return NextResponse.json(
      {
        error: 'DAILY_LIMIT_REACHED',
        message: `오늘의 AI 분석 한도(${BUDGET.toLocaleString()} 토큰)에 도달했습니다. 자정(KST)에 초기화됩니다.`,
        remaining: 0,
      },
      { status: 429 },
    )
  }

  const trendDesc = metrics
    ? `검색 트렌드: ${metrics.trend === 'up' ? '상승세' : metrics.trend === 'down' ? '하락세' : '보합세'}, 성장률 ${metrics.growthRate > 0 ? '+' : ''}${metrics.growthRate}%, 변동성 ${metrics.volatility}%, 평균지수 ${metrics.avg}, 최근3개월 평균 ${metrics.recent3Avg}, 최고월 ${metrics.maxMonth}, 최저월 ${metrics.minMonth}`
    : '트렌드 데이터 없음'

  const posWords = positive?.slice(0, 5).map(w => w.word).join(', ') ?? ''
  const negWords = negative?.slice(0, 5).map(w => w.word).join(', ') ?? ''

  const userPrompt = `키워드: "${keyword}"
${trendDesc}
${sentimentSummary ? `감성 요약: ${sentimentSummary}` : ''}
${posWords ? `주요 긍정어: ${posWords}` : ''}
${negWords ? `주요 부정어: ${negWords}` : ''}

위 데이터를 바탕으로 마케터 관점의 종합 인사이트를 JSON으로 작성하세요.
{"trend_summary":"2~3문장 트렌드 해석","opportunities":["기회요인1","기회요인2","기회요인3"],"risks":["리스크1","리스크2"],"recommendations":["실행방안1","실행방안2","실행방안3"]}
모든 내용 한국어로. opportunities/risks/recommendations 각 2~4개.`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.35,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: '당신은 한국 소셜미디어 마케팅 전략 전문가입니다. 데이터 기반으로 구체적이고 실행 가능한 인사이트를 제공합니다. JSON만 응답하세요.',
          },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Groq API 오류: ${err}` }, { status: 502 })
    }

    const json = await res.json() as { choices: { message: { content: string } }[] }
    const content = json.choices[0]?.message?.content ?? '{}'

    let parsed: InsightsResult
    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'Groq 응답 파싱 실패' }, { status: 500 })
    }

    consume(EST_TOKENS)
    const afterQuota = checkQuota()

    const result: InsightsResult = {
      trend_summary: parsed.trend_summary ?? '',
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      warning: afterQuota.warning
        ? `오늘 AI 사용량의 ${Math.round(afterQuota.used / BUDGET * 100)}%를 소진했습니다 (${afterQuota.remaining.toLocaleString()} 토큰 남음). 자정(KST)에 초기화됩니다.`
        : undefined,
    }

    CACHE.set(cacheKey, { data: result, ts: Date.now() })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
