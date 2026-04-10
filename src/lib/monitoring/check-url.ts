import type { MonitorStatus } from '@/types/database'

const TIMEOUT_MS = 10_000
const SLOW_THRESHOLD_MS = 3_000

export interface CheckResult {
  status: MonitorStatus
  response_time: number | null
  ttfb: number | null
  status_code: number | null
  error_message: string | null
}

// ── URL 상태 체크 (HEAD → GET fallback) ──────────────────────────
// HEAD 요청 완료 시점 ≈ TTFB. 일부 서버는 HEAD 미지원 → GET fallback.
export async function checkUrl(url: string): Promise<CheckResult> {
  const start = Date.now()

  let headOk = false
  let ttfb: number | null = null
  let status_code: number | null = null

  try {
    const headRes = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 MonitorBot/1.0' },
    })
    ttfb = Date.now() - start
    status_code = headRes.status
    headOk = headRes.status < 400
  } catch {
    // HEAD 실패 시 GET fallback
  }

  if (!headOk && ttfb === null) {
    try {
      const getStart = Date.now()
      const getRes = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 MonitorBot/1.0',
          Range: 'bytes=0-4095',
        },
      })
      ttfb = Date.now() - getStart
      status_code = getRes.status >= 200 && getRes.status < 400 ? 200 : getRes.status
      await getRes.body?.cancel()
    } catch (e) {
      const elapsed = Date.now() - start
      const msg = e instanceof Error ? e.message : String(e)
      const isTimeout =
        msg.includes('timeout') || msg.includes('abort') || msg.includes('AbortError')
      return {
        status: isTimeout ? 'slow' : 'down',
        response_time: elapsed,
        ttfb: null,
        status_code: null,
        error_message: isTimeout
          ? `응답 시간 초과 (${TIMEOUT_MS / 1000}s)`
          : msg.slice(0, 200),
      }
    }
  }

  const response_time = Date.now() - start

  if (status_code !== null && status_code >= 400) {
    return {
      status: 'down',
      response_time,
      ttfb,
      status_code,
      error_message: `HTTP ${status_code}`,
    }
  }

  if (ttfb !== null && ttfb > SLOW_THRESHOLD_MS) {
    return { status: 'slow', response_time, ttfb, status_code, error_message: null }
  }

  return { status: 'up', response_time, ttfb, status_code, error_message: null }
}
