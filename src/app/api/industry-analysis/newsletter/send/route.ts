import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerClient } from '@/utils/supabase/server'
import { INDUSTRY_CATEGORY_META, INDUSTRY_COMPANIES } from '@/types/database'
import type { IndustryAnalysisItem, IndustryCategory, IndustryRegion } from '@/types/database'

const resend = new Resend(process.env.RESEND_API_KEY)

// ── 카테고리 색상 (이메일용) ──────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  trend: '#3b82f6', advertising: '#a855f7', celebrity: '#ec4899',
  medical_device: '#06b6d4', conference: '#f59e0b', sns_event: '#f43f5e',
  ai_case: '#6366f1', press_release: '#22c55e', finance: '#f97316',
}

function getCompanyLabel(key: string): string {
  const c = INDUSTRY_COMPANIES.find(c => c.key === key)
  return c ? `${c.label}(${c.product})` : key
}

// ── 뉴스레터 HTML 이메일 ─────────────────────────────────────────
function buildNewsletterHtml(
  items: IndustryAnalysisItem[],
  region: IndustryRegion,
  frequency: 'daily' | 'weekly',
  periodLabel: string,
): string {
  const regionLabel = region === 'domestic' ? '국내' : '글로벌'
  const freqLabel = frequency === 'daily' ? '일간' : '주간'
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  // 주요 아이템
  const featured = items.filter(i => i.is_featured)
  // 카테고리별 그룹화
  const grouped: Record<string, IndustryAnalysisItem[]> = {}
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  }

  function itemHtml(item: IndustryAnalysisItem): string {
    const companyTags = item.company_tags.length > 0
      ? `<div style="margin-top:6px">${item.company_tags.map(t => `<span style="display:inline-block;background:#f3f4f6;color:#6b7280;border-radius:4px;padding:2px 7px;font-size:11px;margin-right:4px">${getCompanyLabel(t)}</span>`).join('')}</div>`
      : ''
    const srcLink = item.source_url
      ? `<a href="${item.source_url}" style="color:#3b82f6;text-decoration:none;font-size:12px">원문 보기 →</a>`
      : ''
    const srcName = item.source_name ? `<span style="color:#9ca3af;font-size:12px">${item.source_name}</span>` : ''
    const pubDate = item.published_at
      ? `<span style="color:#9ca3af;font-size:12px">${new Date(item.published_at).toLocaleDateString('ko-KR')}</span>`
      : ''
    const star = item.is_featured ? '⭐ ' : ''

    return `
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;background:#fff">
        <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:6px;line-height:1.4">${star}${item.title}</div>
        ${item.summary ? `<div style="font-size:13px;color:#6b7280;line-height:1.6;margin-bottom:8px">${item.summary}</div>` : ''}
        ${companyTags}
        <div style="margin-top:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          ${pubDate}${srcName ? `<span style="color:#e5e7eb">|</span>${srcName}` : ''}
          ${srcLink}
        </div>
      </div>`
  }

  function sectionHtml(catKey: string, catItems: IndustryAnalysisItem[]): string {
    const meta = INDUSTRY_CATEGORY_META[catKey as IndustryCategory]
    const color = CATEGORY_COLORS[catKey] ?? '#6b7280'
    return `
      <div style="margin-bottom:28px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}"></span>
          <span style="font-size:14px;font-weight:700;color:#111827">${meta.label}</span>
          <span style="background:${color}22;color:${color};border-radius:100px;padding:1px 8px;font-size:11px;font-weight:600">${catItems.length}건</span>
        </div>
        ${catItems.map(itemHtml).join('')}
      </div>`
  }

  const featuredSection = featured.length > 0 ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:16px;padding:20px;margin-bottom:28px">
      <div style="font-size:14px;font-weight:700;color:#92400e;margin-bottom:12px">⭐ 주요 아이템</div>
      ${featured.map(itemHtml).join('')}
    </div>` : ''

  const categorySections = Object.entries(grouped)
    .map(([key, catItems]) => sectionHtml(key, catItems))
    .join('')

  const emptyMessage = items.length === 0
    ? `<div style="text-align:center;padding:40px;color:#9ca3af;font-size:14px">이번 기간에 등록된 아이템이 없습니다.</div>`
    : ''

  return `
  <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:640px;margin:0 auto;background:#f9fafb">
    <!-- 헤더 -->
    <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);padding:32px 28px;border-radius:16px 16px 0 0">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <span style="background:rgba(255,255,255,0.15);border-radius:10px;padding:8px;display:inline-flex">
          <span style="font-size:20px">🔬</span>
        </span>
        <div>
          <div style="color:#a5b4fc;font-size:12px;font-weight:600;letter-spacing:0.1em">피부 미용 의료기기 업계</div>
          <div style="color:#fff;font-size:20px;font-weight:700;margin-top:2px">업계분석 ${freqLabel} 뉴스레터</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
        <span style="background:rgba(255,255,255,0.1);color:#e0e7ff;border-radius:100px;padding:4px 12px;font-size:12px">
          ${regionLabel} 동향
        </span>
        <span style="background:rgba(255,255,255,0.1);color:#e0e7ff;border-radius:100px;padding:4px 12px;font-size:12px">
          ${periodLabel}
        </span>
        <span style="color:#a5b4fc;font-size:12px;margin-left:auto">${today}</span>
      </div>
    </div>

    <!-- 요약 통계 -->
    <div style="background:#fff;padding:20px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;display:flex;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px;text-align:center;padding:16px;background:#f8fafc;border-radius:12px">
        <div style="font-size:24px;font-weight:700;color:#1e1b4b">${items.length}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px">총 아이템</div>
      </div>
      <div style="flex:1;min-width:120px;text-align:center;padding:16px;background:#fffbeb;border-radius:12px">
        <div style="font-size:24px;font-weight:700;color:#d97706">${featured.length}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px">주요 아이템</div>
      </div>
      <div style="flex:1;min-width:120px;text-align:center;padding:16px;background:#f0f9ff;border-radius:12px">
        <div style="font-size:24px;font-weight:700;color:#0369a1">${Object.keys(grouped).length}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px">카테고리</div>
      </div>
    </div>

    <!-- 본문 -->
    <div style="background:#f9fafb;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
      ${emptyMessage}
      ${featuredSection}
      ${categorySections}
    </div>

    <!-- 푸터 -->
    <div style="text-align:center;padding:20px;color:#9ca3af;font-size:11px;line-height:1.6">
      <p style="margin:0">본 뉴스레터는 마케팅 프로젝트 관리 시스템에서 발송되었습니다.</p>
      <p style="margin:4px 0 0">수신 설정 변경은 관리자에게 문의하세요.</p>
    </div>
  </div>`
}

// ── POST /api/industry-analysis/newsletter/send ─────────────────
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { frequency, region } = await req.json() as {
    frequency: 'daily' | 'weekly'
    region: IndustryRegion
  }

  if (!['daily', 'weekly'].includes(frequency)) {
    return NextResponse.json({ error: 'frequency는 daily 또는 weekly여야 합니다.' }, { status: 400 })
  }

  // 기간 계산
  const days = frequency === 'daily' ? 1 : 7
  const since = new Date()
  since.setDate(since.getDate() - days)
  const periodLabel = frequency === 'daily'
    ? `최근 1일 (${since.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~ 오늘)`
    : `최근 7일 (${since.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~ 오늘)`

  // 아이템 조회
  const { data: items, error: itemsErr } = await supabase
    .from('industry_analysis_items')
    .select('*')
    .eq('region', region)
    .gte('created_at', since.toISOString())
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  // 활성 구독자 조회 (해당 frequency)
  const { data: subscribers, error: subErr } = await supabase
    .from('industry_analysis_subscribers')
    .select('email, name')
    .eq('frequency', frequency)
    .eq('is_active', true)

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })
  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ sent: 0, message: '활성 구독자가 없습니다.' })
  }

  const regionLabel = region === 'domestic' ? '국내' : '글로벌'
  const freqLabel = frequency === 'daily' ? '일간' : '주간'
  const subject = `[업계분석] ${regionLabel} ${freqLabel} 뉴스레터 — ${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`

  const html = buildNewsletterHtml(items ?? [], region, frequency, periodLabel)

  // Resend 일괄 발송 (최대 50건씩 배치)
  const emails = subscribers.map(s => s.email)
  const batchSize = 50
  let sent = 0

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize)
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'newsletter@resend.dev',
        to: batch,
        subject,
        html,
      })
      sent += batch.length
    } catch (e) {
      console.error('Resend batch error:', e)
    }
  }

  return NextResponse.json({ sent, total: emails.length })
}
