import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import { checkQuota, consume, BUDGET } from '../_lib/groq-quota'

const CACHE = new Map<string, { data: SentimentResult; ts: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000
const EST_TOKENS = 2_200  // estimated tokens per Groq call (input + output)

export interface SentimentWord { word: string; weight: number }
export interface SentimentResult {
  keyword: string
  positive: SentimentWord[]
  negative: SentimentWord[]
  neutral: SentimentWord[]
  total_posts: number
  summary: string
  warning?: string
}

export async function GET(req: NextRequest) {
  const keyword_id = req.nextUrl.searchParams.get('keyword_id')?.trim()
  const keyword_text = req.nextUrl.searchParams.get('keyword')?.trim()

  if (!keyword_id && !keyword_text) {
    return NextResponse.json({ error: 'keyword_id 또는 keyword 필요' }, { status: 400 })
  }

  const cacheKey = keyword_id ?? keyword_text!
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data)

  const groqKey = process.env.GROQ_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY
  const aiKey = groqKey || openaiKey
  if (!aiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY 또는 OPENAI_API_KEY 미설정' }, { status: 503 })
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

  const supabase = await createServerClient()

  let kwId = keyword_id
  let kwText = keyword_text

  if (kwId && !kwText) {
    const { data } = await supabase.from('sc_keywords').select('keyword').eq('id', kwId).single()
    kwText = data?.keyword ?? '키워드'
  } else if (!kwId && kwText) {
    const { data } = await supabase.from('sc_keywords').select('id').eq('keyword', kwText).maybeSingle()
    kwId = data?.id
  }

  let postsQuery = supabase
    .from('sc_posts')
    .select('title, content, channel')
    .order('fetched_at', { ascending: false })
    .limit(50)

  if (kwId) postsQuery = postsQuery.eq('keyword_id', kwId)

  const { data: posts } = await postsQuery

  if (!posts || posts.length === 0) {
    const empty: SentimentResult = {
      keyword: kwText ?? '',
      positive: [],
      negative: [],
      neutral: [],
      total_posts: 0,
      summary: '수집된 게시글이 없습니다. 새로고침 버튼으로 데이터를 수집하세요.',
    }
    return NextResponse.json(empty)
  }

  const postText = posts.slice(0, 30).map((p, i) =>
    `[${i + 1}] ${(p.title ?? '').slice(0, 80)} ${(p.content ?? '').slice(0, 120)}`
  ).join('\n')

  const isGroq = !!groqKey
  const apiUrl = isGroq
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions'
  const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: '당신은 한국 소셜 미디어 콘텐츠 감성 분석 전문가입니다. 항상 유효한 JSON으로만 응답하세요.',
          },
          {
            role: 'user',
            content: `다음은 "${kwText}"에 관한 소셜 미디어 게시글 ${posts.length}건입니다.\n\n${postText}\n\n위 게시글을 분석하여 긍정/부정/중립 맥락에서 반복되는 핵심 단어·표현을 추출하세요.\n\n아래 JSON 형식으로 응답하세요:\n{"positive":[{"word":"단어","weight":1~10}],"negative":[{"word":"단어","weight":1~10}],"neutral":[{"word":"단어","weight":1~10}],"summary":"전반적인 감성 분석 요약 2~3문장 (한국어)"}\n\n각 카테고리 8~15개, weight는 중요도 1(낮음)~10(높음).`,
          },
        ],
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `AI API 오류: ${err}` }, { status: 502 })
    }

    const json = await res.json() as { choices: { message: { content: string } }[] }
    const content = json.choices[0]?.message?.content ?? '{}'

    let parsed: { positive?: SentimentWord[]; negative?: SentimentWord[]; neutral?: SentimentWord[]; summary?: string }
    try {
      parsed = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })
    }

    consume(EST_TOKENS)
    const afterQuota = checkQuota()

    const result: SentimentResult = {
      keyword: kwText ?? '',
      positive: parsed.positive ?? [],
      negative: parsed.negative ?? [],
      neutral: parsed.neutral ?? [],
      total_posts: posts.length,
      summary: parsed.summary ?? '',
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
