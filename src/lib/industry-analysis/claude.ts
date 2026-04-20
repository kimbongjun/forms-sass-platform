import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt, buildUserPrompt } from './prompts'
import type { AiAnalysisResult, AiAnalysisItem } from './prompts'
import type { IndustryRegion } from '@/types/database'

// Tool input schema (Claude tool_use → 구조화 JSON 출력)
const ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'submit_analysis',
  description: '피부 미용 의료기기 업계 분석 결과를 구조화된 JSON으로 제출합니다.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: '분석 아이템 목록 (10~15개)',
        items: {
          type: 'object',
          properties: {
            title:        { type: 'string', description: '아이템 제목 (한국어)' },
            summary:      { type: 'string', description: '2~3문장 요약' },
            content:      { type: 'string', description: '3~5문장 상세 내용' },
            category:     { type: 'string', enum: ['trend','advertising','celebrity','medical_device','conference','sns_event','ai_case','press_release','finance'] },
            region:       { type: 'string', enum: ['domestic','global'] },
            company_tags: { type: 'array', items: { type: 'string' } },
            source_name:  { type: 'string', description: '출처 미디어명' },
            source_url:   { type: ['string', 'null'] },
            published_at: { type: 'string', description: 'YYYY-MM-DD' },
            is_featured:  { type: 'boolean' },
          },
          required: ['title', 'summary', 'category', 'region', 'company_tags', 'source_name', 'published_at', 'is_featured'],
        },
      },
      market_summary: { type: 'string', description: '전체 시장 현황 요약 (3~4문장)' },
      key_insights:   { type: 'array', items: { type: 'string' }, description: '핵심 인사이트 5개' },
    },
    required: ['items', 'market_summary', 'key_insights'],
  },
}

export async function runClaudeAgent(region: IndustryRegion): Promise<AiAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(region),
        cache_control: { type: 'ephemeral' }, // 시스템 프롬프트 캐시 — 반복 호출 비용 절감
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(region) }],
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: 'tool', name: 'submit_analysis' }, // 반드시 tool 사용 강제
  })

  // tool_use 블록 추출
  const toolUseBlock = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use')
  if (!toolUseBlock) {
    throw new Error('Claude did not return a tool_use block')
  }

  const parsed = toolUseBlock.input as {
    items?: AiAnalysisItem[]
    market_summary?: string
    key_insights?: string[]
  }

  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error(`Claude tool input missing "items". Keys: ${Object.keys(parsed).join(', ')}`)
  }

  const items: AiAnalysisItem[] = parsed.items.map((item: AiAnalysisItem) => ({
    ...item,
    region,
    company_tags: Array.isArray(item.company_tags) ? item.company_tags : [],
    source_url:   item.source_url ?? null,
    is_featured:  Boolean(item.is_featured),
    ai_source:    'claude' as const,
  }))

  return {
    items,
    market_summary: parsed.market_summary ?? '',
    key_insights:   Array.isArray(parsed.key_insights) ? parsed.key_insights : [],
    ai_source:      'claude',
    generated_at:   new Date().toISOString(),
  }
}
