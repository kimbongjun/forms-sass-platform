import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/utils/supabase/admin'
import { checkUrl } from '@/lib/monitoring/check-url'
import type { MonitorStatus } from '@/types/database'

const resend = new Resend(process.env.RESEND_API_KEY)

// ── Vercel Cron 인증 ─────────────────────────────────────────────
// Vercel이 cron 호출 시 Authorization: Bearer {CRON_SECRET} 헤더를 자동 주입
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false  // CRON_SECRET 미설정 시 모든 요청 거부
  return auth === `Bearer ${secret}`
}

// ── 다운 알림 이메일 ─────────────────────────────────────────────
async function sendDownAlert(opts: {
  to: string
  siteName: string
  siteUrl: string
  status: MonitorStatus
  statusCode: number | null
  errorMessage: string | null
  checkedAt: string
}) {
  const { to, siteName, siteUrl, status, statusCode, errorMessage, checkedAt } = opts
  const statusLabel = status === 'down' ? '오프라인' : status === 'slow' ? '응답 지연' : '오류'
  const color = status === 'slow' ? '#d97706' : '#dc2626'

  await resend.emails.send({
    from: 'Monitor Alert <noreply@blueberry.marketing>',
    to,
    subject: `[모니터링 경보] ${siteName} — ${statusLabel} 감지`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#111;padding:20px 24px;border-radius:12px 12px 0 0">
          <p style="margin:0;color:#fff;font-size:16px;font-weight:700">웹 모니터링 경보</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <div style="display:inline-block;background:${color}15;color:${color};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">
            ⚠ ${statusLabel}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr>
              <td style="padding:8px 0;color:#6b7280;width:100px">사이트</td>
              <td style="padding:8px 0;font-weight:600;color:#111">${siteName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280">URL</td>
              <td style="padding:8px 0"><a href="${siteUrl}" style="color:#2563eb">${siteUrl}</a></td>
            </tr>
            ${statusCode ? `<tr><td style="padding:8px 0;color:#6b7280">HTTP 코드</td><td style="padding:8px 0;font-family:monospace">${statusCode}</td></tr>` : ''}
            ${errorMessage ? `<tr><td style="padding:8px 0;color:#6b7280">오류 내용</td><td style="padding:8px 0;color:#dc2626">${errorMessage}</td></tr>` : ''}
            <tr>
              <td style="padding:8px 0;color:#6b7280">감지 시각</td>
              <td style="padding:8px 0">${new Date(checkedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
            </tr>
          </table>
          <p style="margin-top:20px;font-size:12px;color:#9ca3af">
            이 알림은 <strong>${siteName}</strong>의 모니터링 설정에 따라 자동 발송되었습니다.
          </p>
        </div>
      </div>`,
  })
}

// ── 회복 알림 이메일 ─────────────────────────────────────────────
async function sendRecoveryAlert(opts: {
  to: string
  siteName: string
  siteUrl: string
  checkedAt: string
}) {
  const { to, siteName, siteUrl, checkedAt } = opts
  await resend.emails.send({
    from: 'Monitor Alert <noreply@blueberry.marketing>',
    to,
    subject: `[모니터링] ${siteName} — 정상 회복`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#111;padding:20px 24px;border-radius:12px 12px 0 0">
          <p style="margin:0;color:#fff;font-size:16px;font-weight:700">웹 모니터링 — 정상 회복</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <div style="display:inline-block;background:#d1fae5;color:#059669;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">
            ✓ 정상 회복
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr>
              <td style="padding:8px 0;color:#6b7280;width:100px">사이트</td>
              <td style="padding:8px 0;font-weight:600;color:#111">${siteName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280">URL</td>
              <td style="padding:8px 0"><a href="${siteUrl}" style="color:#2563eb">${siteUrl}</a></td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280">회복 시각</td>
              <td style="padding:8px 0">${new Date(checkedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
            </tr>
          </table>
        </div>
      </div>`,
  })
}

// ── 개별 사이트 체크 + DB 저장 + 알림 ────────────────────────────
async function processSite(site: {
  id: string
  url: string
  name: string
  notify_email: string | null
  last_status: string | null
}) {
  const supabase = createAdminClient()
  const result = await checkUrl(site.url)
  const now = new Date().toISOString()

  // DB 업데이트
  await supabase
    .from('monitor_sites')
    .update({
      last_checked_at: now,
      last_status: result.status,
      last_response_time: result.response_time,
      last_ttfb: result.ttfb,
      last_status_code: result.status_code,
      last_error: result.error_message,
      updated_at: now,
    })
    .eq('id', site.id)

  await supabase.from('monitor_checks').insert({
    site_id: site.id,
    checked_at: now,
    status: result.status,
    response_time: result.response_time,
    ttfb: result.ttfb,
    status_code: result.status_code,
    error_message: result.error_message,
  })

  // 이메일 알림 — 상태 변화 감지
  if (site.notify_email) {
    const prev = site.last_status as MonitorStatus | null
    const cur = result.status

    const wasOk = !prev || prev === 'up' || prev === 'unknown'
    const isDown = cur === 'down' || cur === 'error' || cur === 'slow'
    const isUp = cur === 'up'

    // 정상 → 이상 : 다운 알림
    if (wasOk && isDown) {
      await sendDownAlert({
        to: site.notify_email,
        siteName: site.name,
        siteUrl: site.url,
        status: cur,
        statusCode: result.status_code,
        errorMessage: result.error_message,
        checkedAt: now,
      }).catch(err => console.error('[Monitor/Cron] 알림 이메일 실패:', err))
    }

    // 이상 → 정상 : 회복 알림
    if (!wasOk && isUp) {
      await sendRecoveryAlert({
        to: site.notify_email,
        siteName: site.name,
        siteUrl: site.url,
        checkedAt: now,
      }).catch(err => console.error('[Monitor/Cron] 회복 이메일 실패:', err))
    }
  }

  return { id: site.id, status: result.status }
}

// ── GET: Vercel Cron 엔드포인트 ──────────────────────────────────
// vercel.json cron 트리거는 GET 메서드 사용
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // 점검이 필요한 활성 사이트 조회
  // last_checked_at IS NULL (한 번도 체크 안 된 사이트)
  // 또는 last_checked_at + check_interval(분) <= now
  const { data: sites, error } = await supabase
    .from('monitor_sites')
    .select('id, url, name, notify_email, last_status, last_checked_at, check_interval')
    .eq('is_active', true)

  if (error) {
    console.error('[Monitor/Cron] DB 조회 실패:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // check_interval(분) 기준으로 다음 체크 시각 계산 — 이미 지난 사이트만 처리
  const due = (sites ?? []).filter(site => {
    if (!site.last_checked_at) return true  // 미체크 사이트
    const nextAt = new Date(site.last_checked_at).getTime() + site.check_interval * 60_000
    return now.getTime() >= nextAt
  })

  if (due.length === 0) {
    return NextResponse.json({ checked: 0, message: '점검 대상 없음' })
  }

  // 동시 체크 (최대 10개 병렬, 나머지는 순차)
  const CONCURRENCY = 10
  const results: { id: string; status: string }[] = []

  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const batch = due.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.allSettled(batch.map(s => processSite(s)))
    batchResults.forEach(r => {
      if (r.status === 'fulfilled') results.push(r.value)
    })
  }

  console.log(`[Monitor/Cron] ${results.length}/${due.length} 사이트 체크 완료`)
  return NextResponse.json({ checked: results.length, results })
}
