import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/utils/supabase/admin'
import { checkUrl } from '@/lib/monitoring/check-url'
import { runSitemapCheck } from '@/lib/monitoring/check-sitemap'
import type { MonitorStatus, SitemapPageResult } from '@/types/database'

const getResend = () => new Resend(process.env.RESEND_API_KEY)

// ── 인증 ─────────────────────────────────────────────────────────
// GitHub Actions가 호출 시 Authorization: Bearer {CRON_SECRET} 헤더 전달
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false
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

  await getResend().emails.send({
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

// ── 사이트맵 이슈 알림 이메일 ────────────────────────────────────
async function sendSitemapIssueAlert(opts: {
  to: string
  siteName: string
  siteUrl: string
  sitemapUrl: string | null
  errorCount: number
  issueCount: number
  problemPages: SitemapPageResult[]
  checkedAt: string
}) {
  const { to, siteName, siteUrl, sitemapUrl, errorCount, issueCount, problemPages, checkedAt } = opts
  const totalProblems = errorCount + issueCount

  const pageRows = problemPages.slice(0, 20).map(p => {
    const statusLabel =
      p.status === 'not_found'    ? '404 없음' :
      p.status === 'wp_debug'     ? 'WP 디버그 오류' :
      p.status === 'layout_issue' ? '레이아웃 이상' : '접근 오류'
    const statusColor =
      p.status === 'not_found'    ? '#dc2626' :
      p.status === 'wp_debug'     ? '#d97706' :
      p.status === 'layout_issue' ? '#7c3aed' : '#dc2626'
    return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:12px;word-break:break-all">
          <a href="${p.url}" style="color:#2563eb">${p.url}</a>
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:12px;color:${statusColor};white-space:nowrap;font-weight:600">
          ${statusLabel}
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280">
          ${p.issues.slice(0, 2).join(', ')}
        </td>
      </tr>`
  }).join('')

  await getResend().emails.send({
    from: 'Monitor Alert <noreply@blueberry.marketing>',
    to,
    subject: `[모니터링] ${siteName} — 사이트맵 페이지 이상 ${totalProblems}건 감지`,
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <div style="background:#111;padding:20px 24px;border-radius:12px 12px 0 0">
          <p style="margin:0;color:#fff;font-size:16px;font-weight:700">사이트맵 페이지 점검 결과</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <div style="display:inline-block;background:#fef3c715;color:#d97706;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px;border:1px solid #fde68a">
            ⚠ 이상 페이지 ${totalProblems}건
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
            <tr>
              <td style="padding:7px 0;color:#6b7280;width:110px">사이트</td>
              <td style="padding:7px 0;font-weight:600;color:#111">${siteName}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;color:#6b7280">메인 URL</td>
              <td style="padding:7px 0"><a href="${siteUrl}" style="color:#2563eb">${siteUrl}</a></td>
            </tr>
            ${sitemapUrl ? `<tr><td style="padding:7px 0;color:#6b7280">Sitemap</td><td style="padding:7px 0;font-size:12px;color:#6b7280">${sitemapUrl}</td></tr>` : ''}
            <tr>
              <td style="padding:7px 0;color:#6b7280">404 오류</td>
              <td style="padding:7px 0;color:${errorCount > 0 ? '#dc2626' : '#059669'};font-weight:600">${errorCount}건</td>
            </tr>
            <tr>
              <td style="padding:7px 0;color:#6b7280">레이아웃/디버그</td>
              <td style="padding:7px 0;color:${issueCount > 0 ? '#d97706' : '#059669'};font-weight:600">${issueCount}건</td>
            </tr>
            <tr>
              <td style="padding:7px 0;color:#6b7280">감지 시각</td>
              <td style="padding:7px 0">${new Date(checkedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
            </tr>
          </table>

          ${problemPages.length > 0 ? `
          <p style="font-size:13px;font-weight:600;color:#111;margin-bottom:8px">이상 페이지 목록</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">URL</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;white-space:nowrap">상태</th>
                <th style="padding:8px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">상세</th>
              </tr>
            </thead>
            <tbody>${pageRows}</tbody>
          </table>
          ${problemPages.length > 20 ? `<p style="font-size:11px;color:#9ca3af;margin-top:6px">외 ${problemPages.length - 20}건 추가 이상 페이지가 있습니다.</p>` : ''}
          ` : ''}

          <p style="margin-top:20px;font-size:12px;color:#9ca3af">
            이 알림은 <strong>${siteName}</strong>의 사이트맵 페이지 모니터링에 의해 자동 발송되었습니다.
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
  await getResend().emails.send({
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

  // 최근 5개만 유지 — 초과분 삭제
  const { data: allChecks } = await supabase
    .from('monitor_checks')
    .select('id')
    .eq('site_id', site.id)
    .order('checked_at', { ascending: false })

  if (allChecks && allChecks.length > 5) {
    const deleteIds = allChecks.slice(5).map((c) => c.id)
    await supabase.from('monitor_checks').delete().in('id', deleteIds)
  }

  // 상태 변화 감지 시 이메일 알림
  if (site.notify_email) {
    const prev = site.last_status as MonitorStatus | null
    const cur = result.status
    const wasOk = !prev || prev === 'up' || prev === 'unknown'
    const isDown = cur === 'down' || cur === 'error' || cur === 'slow'
    const isUp = cur === 'up'

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

    if (!wasOk && isUp) {
      await sendRecoveryAlert({
        to: site.notify_email,
        siteName: site.name,
        siteUrl: site.url,
        checkedAt: now,
      }).catch(err => console.error('[Monitor/Cron] 회복 이메일 실패:', err))
    }
  }

  // ── 사이트맵 페이지 체크 ────────────────────────────────────────
  // 메인 URL이 정상일 때만 sitemap 체크 실행 (다운 상태면 의미 없음)
  if (result.status === 'up' || result.status === 'slow') {
    try {
      const sitemapResult = await runSitemapCheck(site.url)

      if (sitemapResult.total_urls > 0) {
        await supabase.from('monitor_sitemap_runs').insert({
          site_id:       site.id,
          sitemap_url:   sitemapResult.sitemap_url,
          sitemap_found: sitemapResult.sitemap_found,
          tried_urls:    sitemapResult.tried_urls,
          total_urls:    sitemapResult.total_urls,
          ok_count:      sitemapResult.ok_count,
          error_count:   sitemapResult.error_count,
          issue_count:   sitemapResult.issue_count,
          pages:         sitemapResult.pages,
          checked_at:    now,
        })

        // 최근 3개만 유지
        const { data: oldRuns } = await supabase
          .from('monitor_sitemap_runs')
          .select('id')
          .eq('site_id', site.id)
          .order('checked_at', { ascending: false })
        if (oldRuns && oldRuns.length > 3) {
          await supabase.from('monitor_sitemap_runs').delete().in('id', oldRuns.slice(3).map(r => r.id))
        }

        // 이슈 발생 시 이메일 알림
        const hasProblem = sitemapResult.error_count > 0 || sitemapResult.issue_count > 0
        if (hasProblem && site.notify_email) {
          const problemPages = sitemapResult.pages.filter(p => p.status !== 'ok')
          await sendSitemapIssueAlert({
            to:          site.notify_email,
            siteName:    site.name,
            siteUrl:     site.url,
            sitemapUrl:  sitemapResult.sitemap_url,
            errorCount:  sitemapResult.error_count,
            issueCount:  sitemapResult.issue_count,
            problemPages,
            checkedAt:   now,
          }).catch(err => console.error('[Monitor/Cron] 사이트맵 알림 이메일 실패:', err))
        }
      }
    } catch (err) {
      console.error('[Monitor/Cron] 사이트맵 체크 실패:', err)
    }
  }

  return { id: site.id, status: result.status }
}

// ── GET: GitHub Actions cron 엔드포인트 ─────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: sites, error } = await supabase
    .from('monitor_sites')
    .select('id, url, name, notify_email, last_status')
    .eq('is_active', true)

  if (error) {
    console.error('[Monitor/Cron] DB 조회 실패:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!sites || sites.length === 0) {
    return NextResponse.json({ checked: 0, message: '활성 사이트 없음' })
  }

  // 최대 10개 병렬 처리
  const CONCURRENCY = 10
  const results: { id: string; status: string }[] = []

  for (let i = 0; i < sites.length; i += CONCURRENCY) {
    const batch = sites.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.allSettled(batch.map(s => processSite(s)))
    batchResults.forEach(r => {
      if (r.status === 'fulfilled') results.push(r.value)
    })
  }

  console.log(`[Monitor/Cron] ${results.length}/${sites.length} 사이트 체크 완료`)
  return NextResponse.json({ checked: results.length, results })
}
