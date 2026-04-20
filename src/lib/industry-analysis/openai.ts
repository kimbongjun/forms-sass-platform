import OpenAI from 'openai'
import { buildSystemPrompt } from './prompts'
import type { AiAnalysisResult, AiAnalysisItem } from './prompts'
import type { IndustryRegion } from '@/types/database'

function extractJson(text: string): string {
  const stripped = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim()
  const start = stripped.indexOf('{')
  if (start === -1) throw new Error('No JSON object found')
  let depth = 0, end = -1
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++
    else if (stripped[i] === '}' && --depth === 0) { end = i; break }
  }
  if (end === -1) throw new Error('Unclosed JSON object')
  return stripped.slice(start, end + 1)
}

// gpt-4o JSON mode는 프롬프트에 영문 "JSON" 필수
function buildOpenAIUserPrompt(region: IndustryRegion): string {
  const today = new Date().toISOString().slice(0, 10)
  const regionLabel = region === 'domestic' ? '국내(한국)' : '글로벌(미국·유럽·아시아)'
  return `Today: ${today} | Region: ${regionLabel}

You are an aesthetic medical device industry analyst. Generate a JSON analysis of the latest trends for these companies: Solta Medical(Thermage/써마지), Merz(Ultherapy/울쎄라), Jeisys Medical(Densiti/덴서티), Lutronic(Cerfs/세르프), Classys(Shurink/슈링크).

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "items": [
    {
      "title": "제목 (Korean)",
      "summary": "2문장 요약 (Korean)",
      "content": "3문장 상세 (Korean)",
      "category": "trend|advertising|celebrity|medical_device|conference|sns_event|ai_case|press_release|finance",
      // sns_event = Instagram-focused: reels, feed posts, influencer campaigns, brand accounts
      "region": "${region}",
      "company_tags": ["회사명"],
      "source_name": "Media name",
      "source_url": null,
      "published_at": "YYYY-MM-DD",
      "is_featured": false
    }
  ],
  "market_summary": "시장 요약 3문장 (Korean)",
  "key_insights": ["인사이트1","인사이트2","인사이트3","인사이트4","인사이트5"]
}

Cover all 9 categories with 1-2 items each (total 10-12). Mark 2-3 important items with is_featured:true.
For sns_event category: focus on Instagram — brand accounts, influencer reels, hashtag campaigns, sponsored posts.`
}

/** gpt-4o 또는 gpt-4o-mini 중 하나로 시도 */
async function callOpenAI(
  client: OpenAI,
  model: string,
  region: IndustryRegion,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    // SDK v5+: max_tokens deprecated → max_completion_tokens 사용
    max_completion_tokens: 3000,
    response_format: { type: 'json_object' },
    temperature: 0.5,
    messages: [
      { role: 'system', content: buildSystemPrompt(region) },
      { role: 'user', content: buildOpenAIUserPrompt(region) },
    ],
  })
  const text = response.choices[0]?.message?.content ?? ''
  if (!text) throw new Error(`${model} returned empty response`)
  return text
}

export async function runOpenAIAgent(region: IndustryRegion): Promise<AiAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const client = new OpenAI({ apiKey })

  let text = ''
  let usedModel = 'gpt-4o'

  // gpt-4o 먼저 시도 → 토큰/rate 에러 시 gpt-4o-mini로 폴백
  try {
    text = await callOpenAI(client, 'gpt-4o', region)
    console.log('[OpenAI] gpt-4o succeeded')
  } catch (err) {
    const msg = String(err)
    // insufficient_quota = account out of credits → gpt-4o-mini is on the same account, won't help
    const isAccountQuotaExhausted = msg.includes('insufficient_quota')
    const isTokenOrRateError =
      !isAccountQuotaExhausted && (
        msg.includes('rate_limit') ||
        msg.includes('quota') ||
        msg.includes('tokens') ||
        msg.includes('429')
      )

    if (isTokenOrRateError) {
      console.warn('[OpenAI] gpt-4o failed with token/rate error, falling back to gpt-4o-mini:', msg)
      text = await callOpenAI(client, 'gpt-4o-mini', region)
      usedModel = 'gpt-4o-mini'
      console.log('[OpenAI] gpt-4o-mini succeeded')
    } else {
      throw err
    }
  }

  let parsed: { items?: AiAnalysisItem[]; market_summary?: string; key_insights?: string[] }
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = JSON.parse(extractJson(text))
  }

  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error(`${usedModel} response missing "items". Snippet: ${text.slice(0, 200)}`)
  }

  const items: AiAnalysisItem[] = parsed.items.map((item: AiAnalysisItem) => ({
    ...item,
    region,
    company_tags: Array.isArray(item.company_tags) ? item.company_tags : [],
    source_url: item.source_url ?? null,
    is_featured: Boolean(item.is_featured),
    ai_source: 'openai' as const,
  }))

  return {
    items,
    market_summary: parsed.market_summary ?? '',
    key_insights: Array.isArray(parsed.key_insights) ? parsed.key_insights : [],
    ai_source: 'openai',
    generated_at: new Date().toISOString(),
  }
}
