import type { AiAnalysisResult, AiAnalysisItem } from './prompts'
import type { IndustryRegion } from '@/types/database'

// ── 카테고리별 검색 쿼리 ──────────────────────────────────────────
const SEARCH_QUERIES: Record<string, { domestic: string[]; global: string[] }> = {
  trend: {
    domestic: ['피부 미용 의료기기 시장 동향', '써마지 울쎄라 슈링크 업계 경쟁'],
    global:   ['aesthetic medical device market trends 2025', 'beauty device industry analysis'],
  },
  advertising: {
    domestic: ['피부 미용기기 온라인 광고 마케팅 캠페인'],
    global:   ['Thermage Ultherapy advertising campaign 2025'],
  },
  celebrity: {
    domestic: ['피부과 미용기기 연예인 광고 모델 앰배서더'],
    global:   ['aesthetic device celebrity ambassador brand'],
  },
  medical_device: {
    domestic: ['써마지 울쎄라 슈링크 덴서티 신제품 식약처 승인'],
    global:   ['Thermage Ultherapy Shurink new device FDA approval 2025'],
  },
  conference: {
    domestic: ['피부과 학회 미용 의료기기 행사 전시'],
    global:   ['IMCAS AMWC aesthetic conference 2025 medical device'],
  },
  sns_event: {
    domestic: ['써마지 울쎄라 슈링크 인스타그램 마케팅 인플루언서', '피부과 미용기기 인스타그램 SNS 캠페인'],
    global:   ['Thermage Ultherapy Shurink Instagram influencer marketing', 'aesthetic device instagram social media campaign'],
  },
  ai_case: {
    domestic: ['피부과 AI 인공지능 진단 미용 의료기기'],
    global:   ['AI artificial intelligence aesthetic device skin diagnosis'],
  },
  press_release: {
    domestic: ['클래시스 루트로닉 제이시스메디칼 보도자료 공시'],
    global:   ['Classys Lutronic Solta Medical press release 2025'],
  },
  finance: {
    domestic: ['클래시스 루트로닉 주가 실적 매출 영업이익'],
    global:   ['Classys Lutronic Solta Merz financial results earnings'],
  },
}

// ── 회사 키워드 → 태그 매핑 ──────────────────────────────────────
const COMPANY_KEYWORDS: Record<string, string[]> = {
  '솔타메디칼': ['솔타', 'solta', 'thermage', '써마지', '리스타일렌'],
  '멀츠':       ['멀츠', 'merz', 'ultherapy', '울쎄라', 'ulthera'],
  '제이시스메디칼': ['제이시스', 'jeisys', '덴서티', 'densiti', '인트라셀'],
  '루트로닉':   ['루트로닉', 'lutronic', '세르프', 'cerfs', 'accupulse'],
  '클래시스':   ['클래시스', 'classys', '슈링크', 'shurink', '볼뉴머', 'volnewmer'],
}

/** 텍스트에서 관련 회사 태그 추출 */
function extractCompanyTags(text: string): string[] {
  const lower = text.toLowerCase()
  return Object.entries(COMPANY_KEYWORDS)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw.toLowerCase())))
    .map(([company]) => company)
}

/** HTML meta 태그에서 content 추출 */
function extractMeta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const byProp =
    html.match(new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']{10,500})["']`, 'i')) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']{10,500})["'][^>]+property=["']${escaped}["']`, 'i'))
  if (byProp?.[1]) return byProp[1].trim()
  const byName =
    html.match(new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']{10,500})["']`, 'i')) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']{10,500})["'][^>]+name=["']${escaped}["']`, 'i'))
  return byName?.[1]?.trim() ?? null
}

/** 기사 URL에서 og:description / meta description 추출 */
async function fetchArticleDescription(url: string): Promise<string | null> {
  if (!url || url.includes('news.google.com')) return null
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return (
      extractMeta(html, 'og:description') ??
      extractMeta(html, 'twitter:description') ??
      extractMeta(html, 'description')
    )
  } catch {
    return null
  }
}

/** CDATA 및 HTML 태그 제거 */
function cleanText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim()
}

/** RSS pubDate → YYYY-MM-DD */
function parsePubDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** Google News RSS에서 <item> 블록 파싱 */
function parseRssItems(xml: string): Array<{
  title: string; link: string; pubDate: string; source: string; description: string
}> {
  const items: Array<{ title: string; link: string; pubDate: string; source: string; description: string }> = []
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1]
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
      return m ? cleanText(m[1]) : ''
    }
    const linkM = block.match(/<link>([^<]+)<\/link>/i) ??
                  block.match(/href="([^"]+)"/i)
    const sourceM = block.match(/<source[^>]*>([^<]+)<\/source>/i)

    items.push({
      title:       get('title').replace(/\s*-\s*[^-]+$/, '').trim(), // " - 출처명" 제거
      link:        linkM?.[1]?.trim() ?? '',
      pubDate:     get('pubDate'),
      source:      sourceM?.[1]?.trim() ?? get('source') ?? '구글뉴스',
      description: get('description').slice(0, 300),
    })
  }
  return items.filter(i => i.title.length > 5)
}

/** Google News RSS fetch */
async function fetchGoogleNewsRss(query: string, lang: 'ko' | 'en'): Promise<string> {
  const params = lang === 'ko'
    ? 'hl=ko&gl=KR&ceid=KR:ko'
    : 'hl=en&gl=US&ceid=US:en'
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${params}&num=5`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; industry-analysis-bot/1.0)' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`)
  return res.text()
}

/** 뉴스 아이템 → IndustryAnalysisItem 변환 */
function rssItemToAnalysisItem(
  item: { title: string; link: string; pubDate: string; source: string; description: string },
  category: string,
  region: IndustryRegion,
): AiAnalysisItem {
  const combined = `${item.title} ${item.description}`
  const companyTags = extractCompanyTags(combined)

  return {
    title: item.title || '제목 없음',
    summary: item.description || item.title,
    content: item.description,
    category,
    region,
    company_tags: companyTags,
    source_name: item.source,
    source_url: item.link || null,
    published_at: parsePubDate(item.pubDate),
    is_featured: false,
    ai_source: undefined, // Google Search 수집은 AI 소스 없음
  }
}

/** 전체 카테고리에 대해 Google News RSS 수집 */
export async function runGoogleSearchFallback(region: IndustryRegion): Promise<AiAnalysisResult> {
  const lang = region === 'domestic' ? 'ko' : 'en'
  const allItems: AiAnalysisItem[] = []
  const errors: string[] = []

  const categories = Object.keys(SEARCH_QUERIES)

  // 순차 실행 (RSS rate limit 방지)
  for (const category of categories) {
    const queries = SEARCH_QUERIES[category][region === 'domestic' ? 'domestic' : 'global']

    for (const query of queries.slice(0, 1)) { // 카테고리당 1개 쿼리
      try {
        const xml = await fetchGoogleNewsRss(query, lang)
        const rssItems = parseRssItems(xml)

        const items = rssItems.slice(0, 2).map(rssItem =>
          rssItemToAnalysisItem(rssItem, category, region)
        )
        allItems.push(...items)

        // 과도한 요청 방지 (약 300ms 간격)
        await new Promise(r => setTimeout(r, 300))
        break // 첫 번째 쿼리 성공 시 다음 카테고리로
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${category}(${query}): ${msg}`)
        console.warn('[GoogleSearch] fallback error:', msg)
      }
    }
  }

  if (allItems.length === 0) {
    throw new Error(`Google News RSS 수집 실패. Errors: ${errors.slice(0, 3).join(' | ')}`)
  }

  // 기사 본문 설명 스크래핑 (병렬, 5초 제한)
  const scraped = await Promise.allSettled(
    allItems.map(async item => {
      if (!item.source_url) return item
      const desc = await fetchArticleDescription(item.source_url)
      if (desc && desc.length > (item.summary?.length ?? 0)) {
        item.summary = desc.slice(0, 300)
        item.content = desc.slice(0, 500)
      }
      return item
    })
  )
  scraped.forEach((r, i) => {
    if (r.status === 'fulfilled') allItems[i] = r.value
  })

  // 주요 아이템: company_tags가 있는 항목 우선
  const withCompany = allItems.filter(i => i.company_tags.length > 0)
  if (withCompany.length >= 3) {
    withCompany.slice(0, 3).forEach(i => { i.is_featured = true })
  } else {
    allItems.slice(0, 3).forEach(i => { i.is_featured = true })
  }

  const regionLabel = region === 'domestic' ? '국내' : '글로벌'
  const market_summary = `Google News 검색을 통해 ${regionLabel} 피부 미용 의료기기 업계 최신 뉴스 ${allItems.length}건을 수집했습니다. AI 분석 서비스가 일시적으로 제한될 때 Google 통합 검색으로 자동 수집된 자료입니다.`

  const topCompanies = [...new Set(allItems.flatMap(i => i.company_tags))].slice(0, 5)
  const key_insights = [
    `Google 검색 기반으로 총 ${allItems.length}건의 업계 동향 수집 완료`,
    topCompanies.length > 0 ? `주요 언급 기업: ${topCompanies.join(', ')}` : '다양한 업계 뉴스 수집',
    `${categories.filter(c => allItems.some(i => i.category === c)).length}개 카테고리에서 자료 확보`,
    'AI 분석 복구 후 더 정확한 인사이트를 확인하세요',
  ]

  return {
    items: allItems,
    market_summary,
    key_insights,
    ai_source: 'gemini', // 폴백이지만 타입 호환을 위해 임시값 (DB에는 null 저장)
    generated_at: new Date().toISOString(),
  }
}
