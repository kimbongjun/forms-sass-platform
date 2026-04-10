import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/utils/supabase/server'

// ── Google PageSpeed Insights API v5 ─────────────────────────────
// LCP / INP / CLS / TTFB / 성능 점수를 모바일 기준으로 측정
// API Key: GOOGLE_PAGESPEED_API_KEY (없어도 동작, 단 속도 제한 있음)

interface PageSpeedAudit {
  numericValue?: number
  score?: number | null
  displayValue?: string
}

interface PageSpeedResponse {
  lighthouseResult?: {
    audits?: Record<string, PageSpeedAudit>
    categories?: {
      performance?: { score: number }
    }
  }
  error?: { message: string }
}

async function fetchPageSpeed(url: string): Promise<{
  lcp: number | null
  inp: number | null
  cls: number | null
  ttfb: number | null
  perf_score: number | null
  error: string | null
}> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  endpoint.searchParams.set('url', url)
  endpoint.searchParams.set('strategy', 'mobile')
  endpoint.searchParams.set('category', 'performance')
  if (apiKey) endpoint.searchParams.set('key', apiKey)

  try {
    const res = await fetch(endpoint.toString(), {
      signal: AbortSignal.timeout(60_000),  // PageSpeed는 최대 60초 소요
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[Monitor/Vitals] PageSpeed error:', res.status, body.slice(0, 200))
      return { lcp: null, inp: null, cls: null, ttfb: null, perf_score: null, error: `PageSpeed API 오류 (HTTP ${res.status})` }
    }

    const data: PageSpeedResponse = await res.json()

    if (data.error) {
      return { lcp: null, inp: null, cls: null, ttfb: null, perf_score: null, error: data.error.message }
    }

    const audits = data.lighthouseResult?.audits ?? {}
    const perfScore = data.lighthouseResult?.categories?.performance?.score

    // LCP (ms)
    const lcp = audits['largest-contentful-paint']?.numericValue ?? null

    // INP (ms) — Lighthouse 12+ / PSI v5
    const inp = audits['interaction-to-next-paint']?.numericValue
      ?? audits['experimental-interaction-to-next-paint']?.numericValue
      ?? null

    // CLS (score, 소수점)
    const cls = audits['cumulative-layout-shift']?.numericValue ?? null

    // TTFB (ms) — server-response-time audit
    const ttfb = audits['server-response-time']?.numericValue ?? null

    // Performance score (0–100)
    const perf_score = perfScore !== undefined && perfScore !== null
      ? Math.round(perfScore * 100)
      : null

    return {
      lcp: lcp !== null ? Math.round(lcp) : null,
      inp: inp !== null ? Math.round(inp) : null,
      cls: cls !== null ? Math.round(cls * 1000) / 1000 : null,  // 소수 3자리
      ttfb: ttfb !== null ? Math.round(ttfb) : null,
      perf_score,
      error: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { lcp: null, inp: null, cls: null, ttfb: null, perf_score: null, error: msg.slice(0, 200) }
  }
}

// ── POST: Web Vitals 측정 ─────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { siteId } = await params

  // 소유권 확인
  const { data: site } = await supabase
    .from('monitor_sites')
    .select('id, url')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single()

  if (!site) return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 })

  const vitals = await fetchPageSpeed(site.url)
  const now = new Date().toISOString()

  if (!vitals.error) {
    // DB에 최신 vitals 저장
    await supabase
      .from('monitor_sites')
      .update({
        vitals_lcp: vitals.lcp,
        vitals_inp: vitals.inp,
        vitals_cls: vitals.cls,
        vitals_ttfb: vitals.ttfb,
        vitals_perf_score: vitals.perf_score,
        vitals_checked_at: now,
        updated_at: now,
      })
      .eq('id', siteId)
  }

  return NextResponse.json({ ...vitals, checked_at: now })
}

// ── GET: 저장된 vitals 조회 ───────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { siteId } = await params

  const { data } = await supabase
    .from('monitor_sites')
    .select('vitals_lcp, vitals_inp, vitals_cls, vitals_ttfb, vitals_perf_score, vitals_checked_at')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data ?? {})
}
