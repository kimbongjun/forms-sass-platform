import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

type SourceType = 'ad' | 'autocomplete' | 'news' | 'blog'
type Category = 'brand' | 'product' | 'review' | 'price' | 'how_to' | 'trend' | 'event' | 'general'

export interface GraphNode {
  keyword: string
  pc: number
  mobile: number
  total: number
  sources: SourceType[]
  category: Category
}

const CACHE = new Map<string, { data: GraphNode[]; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000
const MAX_NODES = 60

const STOP = new Set([
  '이','가','을','를','의','에','는','은','로','으로','와','과','에서','하는','하고',
  '하여','있는','있어','그런','어떤','그리고','그래서','하지만','그러나','또한','또는',
  '때문','통해','위한','위해','대한','관한','관련','따라','에게','합니다','입니다',
  '됩니다','있습니다','없습니다','이런','저런','같은','이후','이전','이상','이하',
  '경우','방면','부분','것이','것을','것은','것도','것에','것으로',
])

const CATEGORY_RULES: [Category, RegExp][] = [
  ['brand',   /브랜드|회사|공식|정품|제조|원조/],
  ['product', /제품|신제품|출시|모델|버전|시리즈|상품|굿즈/],
  ['review',  /후기|리뷰|평점|사용기|솔직|효과|추천|비교|실사용/],
  ['price',   /가격|할인|세일|쿠폰|프로모|행사가|특가|저렴|무료/],
  ['how_to',  /방법|팁|노하우|사용법|하는법|쓰는법|꿀팁|가이드/],
  ['trend',   /트렌드|인기|유행|핫|요즘|최신|202\d/],
  ['event',   /이벤트|캠페인|행사|기념|체험|모집|신청|응모/],
]

function categorize(kw: string): Category {
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(kw)) return cat
  }
  return 'general'
}

function parseQc(v: number | string | undefined | null): number {
  if (!v) return 0
  if (typeof v === 'number') return Math.round(v)
  const s = String(v).trim()
  if (s.startsWith('<')) return 0
  return parseInt(s.replace(/,/g, ''), 10) || 0
}

async function fetchNaverAd(
  kw: string,
  customerId: string,
  license: string,
  secret: string,
): Promise<GraphNode[]> {
  const ts = Date.now()
  const path = '/keywordstool'
  const sig = createHmac('sha256', secret).update(`${ts}.GET.${path}`).digest('base64')
  const res = await fetch(
    `https://api.naver.com${path}?hintKeywords=${encodeURIComponent(kw)}&showDetail=1`,
    {
      headers: {
        'X-Timestamp': String(ts),
        'X-API-KEY': license,
        'X-Customer': customerId,
        'X-Signature': sig,
      },
      signal: AbortSignal.timeout(8000),
    },
  )
  if (!res.ok) return []
  const json = await res.json() as {
    keywordList?: { relKeyword: string; monthlyPcQcCnt: number | string; monthlyMobileQcCnt: number | string }[]
  }
  return (json.keywordList ?? [])
    .filter(k => k.relKeyword !== kw)
    .map(k => {
      const pc = parseQc(k.monthlyPcQcCnt)
      const mobile = parseQc(k.monthlyMobileQcCnt)
      return { keyword: k.relKeyword, pc, mobile, total: pc + mobile, sources: ['ad' as SourceType], category: categorize(k.relKeyword) }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 30)
}

async function fetchAutocomplete(kw: string): Promise<GraphNode[]> {
  try {
    const res = await fetch(
      `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(kw)}&q_enc=UTF-8&st=100&frm=nv&r_format=json&r_enc=UTF-8`,
      { signal: AbortSignal.timeout(4000) },
    )
    if (!res.ok) return []
    const json = await res.json() as { items?: unknown[] }
    const keywords = (json.items ?? []).flat().filter((v): v is string => typeof v === 'string')
    return keywords
      .filter(k => k.trim() !== kw && k.trim().length >= 2)
      .slice(0, 15)
      .map(k => ({
        keyword: k.trim(),
        pc: 0, mobile: 0, total: 0,
        sources: ['autocomplete' as SourceType],
        category: categorize(k.trim()),
      }))
  } catch { return [] }
}

async function fetchNaverSearch(
  kw: string,
  type: 'news' | 'blog',
  clientId: string,
  secret: string,
): Promise<GraphNode[]> {
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/${type}.json?query=${encodeURIComponent(kw)}&display=20&sort=sim`,
      {
        headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': secret },
        signal: AbortSignal.timeout(6000),
      },
    )
    if (!res.ok) return []
    const json = await res.json() as { items?: { title?: string; description?: string }[] }
    const text = (json.items ?? [])
      .map(i => `${i.title ?? ''} ${i.description ?? ''}`)
      .join(' ')
      .replace(/<[^>]+>/g, ' ')
    const words = text.match(/[가-힣]{2,8}/g) ?? []
    const freq = new Map<string, number>()
    for (const w of words) {
      if (!STOP.has(w) && w !== kw) freq.set(w, (freq.get(w) ?? 0) + 1)
    }
    return Array.from(freq.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword]) => ({
        keyword,
        pc: 0, mobile: 0, total: 0,
        sources: [type as SourceType],
        category: categorize(keyword),
      }))
  } catch { return [] }
}

function mergeNodes(all: GraphNode[][]): GraphNode[] {
  const map = new Map<string, GraphNode>()
  for (const list of all) {
    for (const n of list) {
      const ex = map.get(n.keyword)
      if (ex) {
        ex.pc = Math.max(ex.pc, n.pc)
        ex.mobile = Math.max(ex.mobile, n.mobile)
        ex.total = Math.max(ex.total, n.total)
        for (const s of n.sources) { if (!ex.sources.includes(s)) ex.sources.push(s) }
        if (ex.category === 'general' && n.category !== 'general') ex.category = n.category
      } else {
        map.set(n.keyword, { ...n, sources: [...n.sources] })
      }
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total || b.sources.length - a.sources.length)
    .slice(0, MAX_NODES)
}

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get('keyword')?.trim()
  if (!keyword) return NextResponse.json({ error: 'keyword 필요' }, { status: 400 })

  const cached = CACHE.get(keyword)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data)

  const customerId = process.env.NAVER_AD_CUSTOMER_ID?.trim()
  const accessLicense = process.env.NAVER_AD_ACCESS_LICENSE?.trim()
  const secretKey = process.env.NAVER_AD_SECRET_KEY?.trim()

  if (!customerId || !accessLicense || !secretKey) {
    return NextResponse.json(
      { error: 'NAVER_AD_CUSTOMER_ID / NAVER_AD_ACCESS_LICENSE / NAVER_AD_SECRET_KEY 환경변수가 설정되지 않았습니다.' },
      { status: 503 },
    )
  }

  const naverClientId = process.env.NAVER_CLIENT_ID?.trim()
  const naverSecret = process.env.NAVER_CLIENT_SECRET?.trim()
  const hasNaverSearch = !!(naverClientId && naverSecret)

  try {
    const [ad, ac, news, blog] = await Promise.allSettled([
      fetchNaverAd(keyword, customerId, accessLicense, secretKey),
      fetchAutocomplete(keyword),
      hasNaverSearch
        ? fetchNaverSearch(keyword, 'news', naverClientId!, naverSecret!)
        : Promise.resolve<GraphNode[]>([]),
      hasNaverSearch
        ? fetchNaverSearch(keyword, 'blog', naverClientId!, naverSecret!)
        : Promise.resolve<GraphNode[]>([]),
    ])

    const merged = mergeNodes([
      ad.status === 'fulfilled' ? ad.value : [],
      ac.status === 'fulfilled' ? ac.value : [],
      news.status === 'fulfilled' ? news.value : [],
      blog.status === 'fulfilled' ? blog.value : [],
    ])

    if (merged.length === 0) {
      return NextResponse.json({ error: 'Naver API 오류: 연관어 데이터 없음' }, { status: 502 })
    }

    CACHE.set(keyword, { data: merged, ts: Date.now() })
    return NextResponse.json(merged)
  } catch (e) {
    console.error('[SomeContent/related] exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
