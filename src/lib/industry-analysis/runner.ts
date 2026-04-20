import { runOpenAIAgent } from './openai'
import { runGeminiAgent } from './gemini'
import { runClaudeAgent } from './claude'
import { runGoogleSearchFallback } from './google-search'
import type { AiAnalysisResult, AiAnalysisItem } from './prompts'
import type { IndustryRegion } from '@/types/database'

export interface RunOptions {
  region: IndustryRegion
  useOpenAI?: boolean
  useGemini?: boolean
  useClaude?: boolean
}

export type AgentKey = 'openai' | 'gemini' | 'google_search' | 'claude'

export interface AgentStatus {
  source: AgentKey
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  itemCount?: number
  error?: string
}

export interface RunnerResult {
  results: AiAnalysisResult[]
  mergedItems: AiAnalysisItem[]
  agentStatuses: AgentStatus[]
  market_summary: string
  key_insights: string[]
  used_fallback: boolean
}

function deduplicateItems(items: AiAnalysisItem[]): AiAnalysisItem[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = item.title.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 30)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergeInsights(results: AiAnalysisResult[]): string[] {
  const seen = new Set<string>()
  return results
    .flatMap(r => r.key_insights)
    .filter(insight => {
      const key = insight.trim().slice(0, 40)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 8)
}

export async function runAllAgents(options: RunOptions): Promise<RunnerResult> {
  const { region, useOpenAI = true, useGemini = true } = options
  const { useClaude = true } = options

  const agentDefs: {
    key: 'openai' | 'gemini' | 'claude'
    enabled: boolean
    fn: () => Promise<AiAnalysisResult>
  }[] = [
    {
      key: 'openai',
      enabled: useOpenAI && Boolean(process.env.OPENAI_API_KEY),
      fn: () => runOpenAIAgent(region),
    },
    {
      key: 'gemini',
      enabled: useGemini && Boolean(process.env.GOOGLE_AI_API_KEY),
      fn: () => runGeminiAgent(region),
    },
    {
      key: 'claude',
      enabled: useClaude && Boolean(process.env.ANTHROPIC_API_KEY),
      fn: () => runClaudeAgent(region),
    },
  ]

  const activeAgents = agentDefs.filter(a => a.enabled)

  // 초기 상태
  const agentStatuses: AgentStatus[] = agentDefs.map(a => ({
    source: a.key,
    status: a.enabled ? 'running' : 'skipped',
  }))

  const results: AiAnalysisResult[] = []

  if (activeAgents.length > 0) {
    // 병렬 실행 (index 기반 상태 매핑)
    const settled = await Promise.allSettled(
      agentDefs.map(agent => {
        if (!agent.enabled) return Promise.resolve(null)
        return agent.fn()
      })
    )

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]
      const agent = agentDefs[i]
      if (!agent.enabled) continue

      if (outcome.status === 'fulfilled' && outcome.value !== null) {
        const result = outcome.value as AiAnalysisResult
        agentStatuses[i] = { source: agent.key, status: 'done', itemCount: result.items.length }
        results.push(result)
        console.log(`[Runner] ${agent.key}: ${result.items.length}개 수집`)
      } else if (outcome.status === 'rejected') {
        const errMsg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
        agentStatuses[i] = { source: agent.key, status: 'error', error: errMsg }
        console.error(`[Runner] ${agent.key} 실패:`, errMsg)
      }
    }
  }

  // ── AI 에이전트가 모두 실패하면 Google Search 폴백 ───────────────
  let used_fallback = false
  if (results.length === 0) {
    console.log('[Runner] 모든 AI 실패 → Google News RSS 폴백 시작')
    agentStatuses.push({ source: 'google_search', status: 'running' })
    const gsIdx = agentStatuses.length - 1

    try {
      const fallbackResult = await runGoogleSearchFallback(region)
      fallbackResult.items.forEach(item => { item.ai_source = undefined })
      agentStatuses[gsIdx] = {
        source: 'google_search',
        status: 'done',
        itemCount: fallbackResult.items.length,
      }
      results.push(fallbackResult)
      used_fallback = true
      console.log(`[Runner] Google Search 폴백 성공: ${fallbackResult.items.length}개 수집`)
    } catch (fallbackErr) {
      const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
      agentStatuses[gsIdx] = { source: 'google_search', status: 'error', error: msg }
      console.error('[Runner] Google Search 폴백도 실패:', msg)

      // 모든 에러 메시지 수집
      const allErrors = agentStatuses
        .filter(s => s.status === 'error')
        .map(s => `${s.source}: ${s.error}`)
        .join('; ')
      throw new Error(`AI 분석 및 Google 검색 모두 실패 — ${allErrors}`)
    }
  }

  // 아이템 병합 & 중복 제거
  const allItems = results.flatMap(r => r.items)
  const featured = allItems.filter(i => i.is_featured)
  const normal   = allItems.filter(i => !i.is_featured)
  const mergedItems = deduplicateItems([...featured, ...normal])

  // 시장 요약: Claude > Gemini > OpenAI > Google Search 우선순위
  const summarySource =
    results.find(r => r.ai_source === 'claude') ??
    results.find(r => r.ai_source === 'gemini') ??
    results.find(r => r.ai_source === 'openai') ??
    results[0]

  return {
    results,
    mergedItems,
    agentStatuses,
    market_summary: summarySource.market_summary,
    key_insights: mergeInsights(results),
    used_fallback,
  }
}

export function getConfiguredAIs(): { openai: boolean; gemini: boolean } {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    gemini: Boolean(process.env.GOOGLE_AI_API_KEY),
  }
}
