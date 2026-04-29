import type { SitemapPageResult, SitemapPageStatus } from '@/types/database'

export type { SitemapPageResult }

export interface SitemapRunResult {
  sitemap_url: string | null
  sitemap_found: boolean
  tried_urls: string[]         // 시도한 경로 목록 (디버그용)
  total_urls: number
  ok_count: number
  error_count: number
  issue_count: number
  pages: SitemapPageResult[]
}

const FETCH_TIMEOUT = 12_000
const MAX_URLS = 50
const CONCURRENCY = 5

// ── <loc> URL 추출 (CDATA · 개행 · 앞뒤 공백 모두 처리) ──────────
function extractUrls(xml: string): string[] {
  // <loc>…</loc> 사이 모든 내용 추출 — CDATA, 개행 포함
  const matches = xml.match(/<loc[^>]*>([\s\S]*?)<\/loc>/gi) ?? []
  return matches
    .map(m => {
      let inner = m.replace(/<\/?loc[^>]*>/gi, '')
      // CDATA 언래핑: <![CDATA[ … ]]>
      inner = inner.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      return inner.trim()
    })
    .filter(url => url.startsWith('http') && !url.endsWith('.xml') && !url.endsWith('.gz'))
    .slice(0, MAX_URLS)
}

// ── sitemap index → 모든 하위 sitemap URL 수집 ───────────────────
async function fetchSubSitemaps(xml: string): Promise<string[]> {
  const subUrls = (xml.match(/<loc[^>]*>([\s\S]*?)<\/loc>/gi) ?? [])
    .map(m => m.replace(/<\/?loc[^>]*>/gi, '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim())
    .filter(url => url.endsWith('.xml') || url.endsWith('.xml.gz'))

  const allUrls: string[] = []
  for (const subUrl of subUrls) {
    if (allUrls.length >= MAX_URLS) break
    try {
      const res = await fetch(subUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
        headers: { 'User-Agent': 'Mozilla/5.0 MonitorBot/1.0' },
      })
      if (!res.ok) continue
      const text = await res.text()
      const urls = extractUrls(text)
      allUrls.push(...urls.slice(0, MAX_URLS - allUrls.length))
    } catch { continue }
  }
  return allUrls
}

// ── sitemap.xml 탐색 (등록 URL 하위 → origin 루트 → index 변형) ──
async function fetchSitemapUrls(baseUrl: string): Promise<{
  urls: string[]
  sitemapUrl: string | null
  found: boolean
  triedUrls: string[]
}> {
  const base   = baseUrl.replace(/\/+$/, '')
  const origin = new URL(baseUrl).origin

  // 탐색 순서: 등록 경로 하위 → origin 루트 → sitemap_index.xml
  const candidates = Array.from(new Set([
    `${base}/sitemap.xml`,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,         // WordPress 기본 sitemap
  ]))

  const triedUrls: string[] = []

  for (const candidate of candidates) {
    triedUrls.push(candidate)
    try {
      const res = await fetch(candidate, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 MonitorBot/1.0' },
      })
      if (!res.ok) continue

      const contentType = res.headers.get('content-type') ?? ''
      // HTML 응답은 실제 sitemap이 아님 (404 커스텀 페이지 등)
      if (contentType.includes('text/html')) continue

      const text = await res.text()
      if (!text.includes('<loc')) continue   // loc 태그 없으면 sitemap 아님

      // sitemap index 처리
      if (text.includes('<sitemapindex')) {
        const urls = await fetchSubSitemaps(text)
        return { urls, sitemapUrl: candidate, found: urls.length > 0, triedUrls }
      }

      const urls = extractUrls(text)
      return { urls, sitemapUrl: candidate, found: true, triedUrls }
    } catch { continue }
  }

  return { urls: [], sitemapUrl: null, found: false, triedUrls }
}

// ── WordPress 디버그 오류 패턴 ───────────────────────────────────
const WP_DEBUG_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /<b>(?:Warning|Notice|Deprecated|Fatal error|Parse error)<\/b>\s*:/i, label: 'PHP 디버그 출력 (WP_DEBUG 활성화)' },
  { pattern: /Fatal error:.*on line \d+/i,                 label: 'PHP Fatal Error' },
  { pattern: /Parse error:.*on line \d+/i,                 label: 'PHP Parse Error' },
  { pattern: /Warning:.*(?:undefined|failed|line \d+)/i,   label: 'PHP Warning' },
  { pattern: /Notice:.*on line \d+/i,                      label: 'PHP Notice' },
  { pattern: /wp-content\/debug\.log/i,                    label: 'WordPress debug.log 경로 노출' },
  { pattern: /class="qm-|id="query-monitor/i,              label: 'Query Monitor 플러그인 노출' },
  { pattern: /<!-- This site is loading slowly because of PHP errors/i, label: 'WordPress 오류 주석 노출' },
]

// ── 레이아웃 이슈 패턴 ──────────────────────────────────────────
const LAYOUT_ISSUE_PATTERNS: { check: (h: string) => boolean; label: string }[] = [
  { check: h => h.trim().length < 300,                                                 label: '페이지 내용 없음 (빈 응답)' },
  { check: h => h.includes('<!DOCTYPE') && !h.includes('</html>'),                     label: 'HTML 태그 미완성 (레이아웃 깨짐)' },
  { check: h => /<body[^>]*>\s*<\/body>/i.test(h),                                     label: 'body 영역이 비어 있음' },
  { check: h => /Error establishing a database connection|database error/i.test(h),    label: 'DB 연결 오류 화면' },
  { check: h => /Briefly unavailable for scheduled maintenance|wp-maintenance/i.test(h), label: 'WordPress 유지보수 모드' },
  { check: h => /This site is temporarily unavailable|coming soon/i.test(h),           label: '임시 접근 불가 페이지' },
]

// ── 단일 페이지 체크 ─────────────────────────────────────────────
async function checkPage(url: string): Promise<SitemapPageResult> {
  const start = Date.now()
  const issues: string[] = []

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 MonitorBot/1.0', Accept: 'text/html,application/xhtml+xml' },
    })
    const response_time_ms = Date.now() - start
    const status_code = res.status

    if (status_code === 404) return { url, status_code, status: 'not_found', issues: ['HTTP 404 페이지 없음'], response_time_ms }
    if (status_code >= 400) return { url, status_code, status: 'error', issues: [`HTTP ${status_code} 오류`], response_time_ms }

    const html = (await res.text()).slice(0, 524288)

    for (const { pattern, label } of WP_DEBUG_PATTERNS) if (pattern.test(html)) issues.push(label)
    for (const { check, label } of LAYOUT_ISSUE_PATTERNS) if (check(html)) issues.push(label)

    if (issues.length > 0) {
      const isWp = issues.some(i => i.startsWith('PHP') || i.includes('WP_DEBUG') || i.includes('Query Monitor') || i.includes('WordPress'))
      const status: SitemapPageStatus = isWp ? 'wp_debug' : 'layout_issue'
      return { url, status_code, status, issues, response_time_ms }
    }
    return { url, status_code, status: 'ok', issues: [], response_time_ms }
  } catch (e) {
    const response_time_ms = Date.now() - start
    const msg = e instanceof Error ? e.message : String(e)
    const isTimeout = msg.includes('timeout') || msg.includes('abort') || msg.includes('AbortError')
    return {
      url, status_code: null, status: 'error', response_time_ms,
      issues: [isTimeout ? `응답 시간 초과 (${FETCH_TIMEOUT / 1000}s)` : `연결 오류: ${msg.slice(0, 120)}`],
    }
  }
}

// ── 전체 사이트맵 체크 ───────────────────────────────────────────
export async function runSitemapCheck(siteUrl: string): Promise<SitemapRunResult> {
  const { urls, sitemapUrl, found, triedUrls } = await fetchSitemapUrls(siteUrl)

  if (urls.length === 0) {
    return { sitemap_url: sitemapUrl, sitemap_found: found, tried_urls: triedUrls, total_urls: 0, ok_count: 0, error_count: 0, issue_count: 0, pages: [] }
  }

  const pages: SitemapPageResult[] = []
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(batch.map(checkPage))
    settled.forEach(r => { if (r.status === 'fulfilled') pages.push(r.value) })
  }

  return {
    sitemap_url: sitemapUrl,
    sitemap_found: found,
    tried_urls: triedUrls,
    total_urls: pages.length,
    ok_count:    pages.filter(p => p.status === 'ok').length,
    error_count: pages.filter(p => p.status === 'error' || p.status === 'not_found').length,
    issue_count: pages.filter(p => p.status === 'wp_debug' || p.status === 'layout_issue').length,
    pages,
  }
}
