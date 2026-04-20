import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { runAllAgents, getConfiguredAIs } from '@/lib/industry-analysis/runner'
import type { IndustryRegion } from '@/types/database'

// Vercel Pro: 최대 300초, Hobby: 최대 60초
export const maxDuration = 300

/** GET: 어떤 AI API 키가 설정돼 있는지 반환 */
export async function GET() {
  const configured = getConfiguredAIs()
  return NextResponse.json(configured)
}

/** POST: AI 분석 실행 */
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    region?: string
    openai?: boolean
    gemini?: boolean
  }

  const region: IndustryRegion = body.region === 'global' ? 'global' : 'domestic'
  const useOpenAI = body.openai !== false
  const useGemini = body.gemini !== false

  const adminClient = createAdminClient()

  // 실행 레코드 생성
  const { data: runRecord, error: runErr } = await adminClient
    .from('industry_analysis_runs')
    .insert({
      status: 'running',
      region,
      ai_sources: [],
      items_count: 0,
      created_by: user.id,
    })
    .select()
    .single()

  if (runErr || !runRecord) {
    return NextResponse.json({ error: runErr?.message ?? 'run 레코드 생성 실패' }, { status: 500 })
  }

  const runId: string = runRecord.id

  try {
    const runnerResult = await runAllAgents({ region, useOpenAI, useGemini })

    const itemsToInsert = runnerResult.mergedItems.map(item => ({
      run_id: runId,
      title: item.title,
      summary: item.summary || null,
      content: item.content || null,
      category: item.category,
      region: item.region,
      company_tags: item.company_tags,
      source_url: item.source_url || null,
      source_name: item.source_name || null,
      published_at: item.published_at || null,
      is_featured: item.is_featured,
      ai_source: item.ai_source ?? null,
      created_by: user.id,
    }))

    const { error: insertErr } = await adminClient
      .from('industry_analysis_items')
      .insert(itemsToInsert)

    if (insertErr) {
      await adminClient
        .from('industry_analysis_runs')
        .update({ status: 'failed', error_message: insertErr.message, completed_at: new Date().toISOString() })
        .eq('id', runId)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const aiSources = runnerResult.results.map(r => r.ai_source)

    await adminClient
      .from('industry_analysis_runs')
      .update({
        status: 'completed',
        ai_sources: aiSources,
        items_count: itemsToInsert.length,
        market_summary: runnerResult.market_summary,
        key_insights: runnerResult.key_insights,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    return NextResponse.json({
      run_id: runId,
      items_count: itemsToInsert.length,
      ai_sources: aiSources,
      agent_statuses: runnerResult.agentStatuses,
      market_summary: runnerResult.market_summary,
      key_insights: runnerResult.key_insights,
      used_fallback: runnerResult.used_fallback,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/industry-analysis/run] error:', msg)
    await adminClient
      .from('industry_analysis_runs')
      .update({ status: 'failed', error_message: msg, completed_at: new Date().toISOString() })
      .eq('id', runId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
