import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildSystemPrompt, buildUserPrompt } from './prompts'
import type { AiAnalysisResult, AiAnalysisItem } from './prompts'
import type { IndustryRegion } from '@/types/database'

/** JSON 블록을 안전하게 추출 */
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

export async function runGeminiAgent(region: IndustryRegion): Promise<AiAnalysisResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured')

  const genAI = new GoogleGenerativeAI(apiKey)

  // gemini-2.0-flash: 2025년 말 기본 권장 모델 (1.5-flash 대비 속도·품질 개선)
  // googleSearch 그라운딩은 Vertex AI 전용이므로 사용하지 않음
  // responseMimeType: 'application/json' 으로 구조화 출력 강제
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.4,
    },
    systemInstruction: buildSystemPrompt(region),
  })

  const result = await model.generateContent(buildUserPrompt(region))
  const rawText = result.response.text()

  if (!rawText?.trim()) throw new Error('Gemini returned empty response')

  let parsed: { items?: AiAnalysisItem[]; market_summary?: string; key_insights?: string[] }
  try {
    parsed = JSON.parse(rawText)
  } catch {
    parsed = JSON.parse(extractJson(rawText))
  }

  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error(`Gemini response missing "items". Snippet: ${rawText.slice(0, 200)}`)
  }

  const items: AiAnalysisItem[] = parsed.items.map((item: AiAnalysisItem) => ({
    ...item,
    region,
    company_tags: Array.isArray(item.company_tags) ? item.company_tags : [],
    source_url: item.source_url ?? null,
    is_featured: Boolean(item.is_featured),
    ai_source: 'gemini' as const,
  }))

  return {
    items,
    market_summary: parsed.market_summary ?? '',
    key_insights: Array.isArray(parsed.key_insights) ? parsed.key_insights : [],
    ai_source: 'gemini',
    generated_at: new Date().toISOString(),
  }
}
