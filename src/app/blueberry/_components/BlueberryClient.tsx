'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import {
  Search, TrendingUp, FileText, MessageSquare, RefreshCw, Grape,
  Download, Monitor, Smartphone, Calendar, Plus, X, Info, Wifi, WifiOff, Copy, Check,
  Bookmark, BookmarkCheck, Image as ImageIcon,
} from 'lucide-react'
import { DateRangePickerInput } from '@/components/common/DatePickerInput'
import DatalabForm from './DatalabForm'

// ── Naver API 응답 타입 (route.ts 와 동기화) ────────────────────
interface NaverApiData {
  /** 검색광고 API 실측 월간 검색량 (null = 광고 API 미설정) */
  monthlyPcQcCnt: number | null
  monthlyMobileQcCnt: number | null
  contentByPlatform: { blog: number; cafe: number; news: number; kin: number; shop: number }
  fetchedAt: string
}

// ── Google Trends API 응답 타입 ──────────────────────────────────
interface GoogleTrendsData {
  interestOverTime: { month: string; value: number }[]
  relatedQueries: { query: string; value: number }[]
  fetchedAt: string
}

// ── Naver DataLab 트렌드 타입 ────────────────────────────────────
interface DatalabTrendData {
  /** 'YYYY-MM' → ratio (0-100, 기간 내 상대값) */
  monthlyRatios: Record<string, number>
  /** 기준 키워드 ratio (네이버 전체 검색량 변화 보정용) */
  refRatios?: Record<string, number>
}

// DataLab에 함께 조회할 기준 키워드 (안정적인 대용량 검색어)
// 조건: 월별 절대 검색량이 크고 안정적 → 네이버 전체 검색량 변화를 대리 측정
const DATALAB_REFERENCE_KEYWORD = '유튜브'

// ── 해시 유틸 ────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}
function seededRand(seed: number, idx: number): number {
  const x = Math.sin(seed * 9301 + idx * 49297 + 233) * 233280
  return x - Math.floor(x)
}

// ── 동적 월 라벨 (전월 기준 최근 N개월) ────────────────────────
// 가장 최근 월은 항상 전월(완성된 데이터가 있는 마지막 달)
function getMonthLabels(count: number): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = []
  const now = new Date()
  // i=1 에서 시작하여 당월(i=0)은 제외
  for (let i = count; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('ko-KR', { month: 'short' }).format(d),
    })
  }
  return result
}

const ALL_MONTHS = getMonthLabels(60) // 최근 5년 (전월까지)

// 키워드 비교 기본 팔레트 (브랜드 색이 없을 때 폴백)
const KEYWORD_COLORS = ['#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', '#EF4444']

// 브랜드별 지정 색상 (소문자 정규화 비교)
const BRAND_COLORS: Record<string, string> = {
  '볼뉴머': '#B4221B',
  '써마지': '#59004F',
  '덴서티': '#0C3A47',
  '올리지오': '#7954C0',
  '슈링크': '#182D60',
  '슈링크유니버스': '#182D60',
  '울쎄라': '#E8B02F',
}

function getKeywordColor(kw: string, fallbackIdx: number): string {
  return BRAND_COLORS[kw.trim()] ?? KEYWORD_COLORS[fallbackIdx % KEYWORD_COLORS.length]
}

type Period = '5y' | '3y' | '2y' | '1y' | '3m' | '1m'

interface PlatformItem { name: string; count: number; color: string }
interface RelatedKeyword { keyword: string; volume: number; competition: 'high' | 'mid' | 'low' }
interface KeywordData {
  searchVolume: number[]
  searchVolumePC: number[]
  searchVolumeMobile: number[]
  contentVolume: number[]
  contentByPlatform: PlatformItem[]
  platformMentions: PlatformItem[]
  relatedKeywords: RelatedKeyword[]
}
interface ChartSeries { keyword: string; data: number[]; color: string }
interface TooltipInfo {
  x: number; y: number; label: string
  values: { keyword: string; value: number; color: string }[]
}

// ── 데이터 생성 (keyword 문자열만 seed로 사용 — refresh 시 불변) ─
const DATA_MONTHS = 60 // 5년치 데이터

function generateData(keyword: string, platform: 'naver' | 'google'): KeywordData {
  const seed = hashStr(keyword + platform) // keyword 고정 → 항상 동일 결과

  // 장기 트렌드 방향 (-0.3 ~ +0.5 성장/감소)
  const longTrend = (seededRand(seed, 99) - 0.4) * 0.8

  const baseSearch = platform === 'naver' ? 20000 + (seed % 80000) : 5000 + (seed % 30000)
  const searchVolume = Array.from({ length: DATA_MONTHS }, (_, i) => {
    const seasonal = Math.sin((i / 12) * Math.PI * 2) * 0.25
    const trend = 1 + longTrend * (i / DATA_MONTHS)
    const noise = seededRand(seed, i) * 0.4 - 0.2
    return Math.max(500, Math.round(baseSearch * trend * (1 + seasonal + noise)))
  })

  const pcRatio = 0.38 + seededRand(seed, 20) * 0.24
  const searchVolumePC = searchVolume.map((v, i) => {
    const r = Math.min(0.8, Math.max(0.2, pcRatio + (seededRand(seed + 5, i) - 0.5) * 0.1))
    return Math.round(v * r)
  })
  const searchVolumeMobile = searchVolume.map((v, i) => v - searchVolumePC[i])

  const baseContent = platform === 'naver' ? 1000 + (seed % 8000) : 300 + (seed % 3000)
  const contentVolume = Array.from({ length: DATA_MONTHS }, (_, i) => {
    const trend = 1 + longTrend * (i / DATA_MONTHS)
    const noise = seededRand(seed + 1, i) * 0.5 - 0.2
    return Math.max(50, Math.round(baseContent * trend * (1 + noise)))
  })

  const contentPlatformDefs = platform === 'naver'
    ? [{ name: '블로그', color: '#03C75A' }, { name: '카페', color: '#FF6B00' },
       { name: '쇼핑', color: '#E91E63' }, { name: '지식iN', color: '#FFC107' }]
    : [{ name: '웹사이트', color: '#1A73E8' }, { name: '뉴스', color: '#EA4335' },
       { name: '유튜브', color: '#FF0000' }, { name: '이미지', color: '#34A853' }]

  const latestContent = contentVolume[DATA_MONTHS - 1]
  const rawCP = contentPlatformDefs.map((p, i) => ({
    ...p, count: Math.max(10, Math.round(latestContent * seededRand(seed + 10, i) * 1.5)),
  }))
  const cpTotal = rawCP.reduce((s, c) => s + c.count, 0)
  const contentByPlatform = rawCP
    .map((c) => ({ ...c, count: Math.round((c.count / cpTotal) * latestContent) }))
    .sort((a, b) => b.count - a.count)

  const mentionDefs = platform === 'naver'
    ? [{ name: '블로그', color: '#03C75A' }, { name: '카페', color: '#FF6B00' },
       { name: '뉴스', color: '#1A73E8' }, { name: '지식iN', color: '#FFC107' },
       { name: '쇼핑', color: '#E91E63' }]
    : [{ name: '웹사이트', color: '#1A73E8' }, { name: '뉴스', color: '#EA4335' },
       { name: '유튜브', color: '#FF0000' }, { name: '이미지', color: '#34A853' },
       { name: 'Reddit', color: '#FF4500' }]
  const baseMention = 200 + (seed % 2000)
  const platformMentions = mentionDefs
    .map((p, i) => ({ ...p, count: Math.max(10, Math.round(baseMention * seededRand(seed + 2, i) * 2)) }))
    .sort((a, b) => b.count - a.count)

  // 연관 키워드 — keyword 원본만 사용하므로 refresh 시 불변
  const SUFFIXES_KR = ['후기', '추천', '가격', '방법', '비교', '효능', '부작용', '구매']
  const SUFFIXES_EN = ['review', 'best', 'price', 'how to', 'vs', 'benefits', 'buy', '2025']
  const suffixes = platform === 'naver' ? SUFFIXES_KR : SUFFIXES_EN
  const relatedKeywords: RelatedKeyword[] = [3, 4, 5, 6, 7].map((s, i) => {
    const vol = Math.max(100, Math.round(baseSearch * seededRand(seed + s, i) * 0.8))
    const competition: RelatedKeyword['competition'] = vol > baseSearch * 0.5 ? 'high' : vol > baseSearch * 0.2 ? 'mid' : 'low'
    return { keyword: `${keyword} ${suffixes[i % suffixes.length]}`, volume: vol, competition }
  }).sort((a, b) => b.volume - a.volume)

  return { searchVolume, searchVolumePC, searchVolumeMobile, contentVolume, contentByPlatform, platformMentions, relatedKeywords }
}

function fmt(n: number): string {
  return n.toLocaleString()
}

// ── 목업 → 실측 데이터 병합 (모듈 레벨 순수 함수) ──────────────────
function resolveAdData(
  mock: KeywordData,
  platform: 'naver' | 'google',
  apiData: NaverApiData | null,
): KeywordData & { isReal: boolean; hasAdVolume: boolean } {
  if (platform === 'naver' && apiData) {
    const hasAdVol = apiData.monthlyPcQcCnt !== null && apiData.monthlyMobileQcCnt !== null
    const totalMonthly = hasAdVol ? (apiData.monthlyPcQcCnt! + apiData.monthlyMobileQcCnt!) : null

    // 목업 계절 패턴을 유지하면서 마지막 달 실측값을 앵커로 전체 스케일
    const scaleToMonthlyAvg = (arr: number[], monthlyVal: number) => {
      const lastVal = arr[arr.length - 1] || 1
      const scale = monthlyVal / lastVal
      const scaled = arr.map((v) => Math.max(0, Math.round(v * scale)))
      scaled[scaled.length - 1] = monthlyVal  // 마지막 달은 실측값 고정
      return scaled
    }

    const searchVolume = hasAdVol ? scaleToMonthlyAvg(mock.searchVolume, totalMonthly!) : mock.searchVolume
    const searchVolumePC = hasAdVol ? scaleToMonthlyAvg(mock.searchVolumePC, apiData.monthlyPcQcCnt!) : mock.searchVolumePC
    const searchVolumeMobile = hasAdVol ? scaleToMonthlyAvg(mock.searchVolumeMobile, apiData.monthlyMobileQcCnt!) : mock.searchVolumeMobile

    const mockAvgSearch = mock.searchVolume.reduce((s, v) => s + v, 0) / 12
    const relKeywordScale = hasAdVol && mockAvgSearch > 0 ? totalMonthly! / mockAvgSearch : 1
    const relatedKeywords = mock.relatedKeywords.map((k) => ({
      ...k,
      volume: Math.round(k.volume * relKeywordScale),
    }))

    const cp = [
      { name: '블로그', count: apiData.contentByPlatform.blog, color: '#03C75A' },
      { name: '카페', count: apiData.contentByPlatform.cafe, color: '#FF6B00' },
      { name: '쇼핑', count: apiData.contentByPlatform.shop, color: '#E91E63' },
      { name: '지식iN', count: apiData.contentByPlatform.kin, color: '#FFC107' },
      { name: '뉴스', count: apiData.contentByPlatform.news, color: '#1A73E8' },
    ].filter((p) => p.count > 0).sort((a, b) => b.count - a.count)

    // contentVolume: mock 월간 추정치 유지 (검색 API 총계는 누적값이라 월간 스케일에 부적합)
    const contentVolume = mock.contentVolume
    const mockMonthlyLast = contentVolume[contentVolume.length - 1]
    const cpApiTotal = cp.reduce((s, p) => s + p.count, 0)

    // contentByPlatform: API 플랫폼 비율을 mock 월간 추정치에 적용 → 월간 플랫폼별 발행량 추정
    const contentByPlatformMonthly = (cpApiTotal > 0 && cp.length > 0)
      ? cp.map(p => ({ ...p, count: Math.max(1, Math.round(mockMonthlyLast * p.count / cpApiTotal)) }))
      : mock.contentByPlatform

    return {
      ...mock,
      searchVolume,
      searchVolumePC,
      searchVolumeMobile,
      contentVolume,
      relatedKeywords,
      contentByPlatform: contentByPlatformMonthly,
      platformMentions: cp.length ? cp : mock.platformMentions,
      isReal: true,
      hasAdVolume: hasAdVol,
    }
  }
  return { ...mock, isReal: false, hasAdVolume: false }
}

// ── Google Trends 데이터 병합 ──────────────────────────────────────
function resolveGoogleData(
  mock: KeywordData,
  googleData: GoogleTrendsData | null,
  monthLabels: { key: string; label: string }[],
): KeywordData & { isGoogleReal: boolean } {
  if (!googleData || googleData.interestOverTime.length === 0) {
    return { ...mock, isGoogleReal: false }
  }

  // ALL_MONTHS의 각 인덱스에 Google Trends 값을 매핑
  const trendMap = new Map<string, number>()
  for (const pt of googleData.interestOverTime) {
    trendMap.set(pt.month, pt.value)
  }

  const trendValues = monthLabels.map(m => trendMap.get(m.key) ?? null)
  const validTrend = trendValues.filter((v): v is number => v !== null)

  if (validTrend.length === 0) return { ...mock, isGoogleReal: false }

  const avgTrend = validTrend.reduce((s, v) => s + v, 0) / validTrend.length
  const mockAvg = mock.searchVolume.reduce((s, v) => s + v, 0) / 12

  // 트렌드 상대값으로 검색량 스케일 조정
  const searchVolume = monthLabels.map((m, i) => {
    const trend = trendMap.get(m.key)
    if (trend === undefined || avgTrend === 0) return mock.searchVolume[i] ?? 0
    return Math.max(0, Math.round((trend / avgTrend) * mockAvg))
  })

  const pcRatio = mock.searchVolumePC.map((v, i) => (mock.searchVolume[i] > 0 ? v / mock.searchVolume[i] : 0.4))
  const searchVolumePC = searchVolume.map((v, i) => Math.round(v * (pcRatio[i] ?? 0.4)))
  const searchVolumeMobile = searchVolume.map((v, i) => v - searchVolumePC[i])

  // 연관 키워드를 Google 실측 데이터로 교체 (중복 쿼리 제거 후 상위 5개)
  const seenQueries = new Set<string>()
  const relatedKeywords: RelatedKeyword[] = googleData.relatedQueries
    .filter(q => { if (seenQueries.has(q.query)) return false; seenQueries.add(q.query); return true })
    .slice(0, 5)
    .map((q) => {
      const vol = Math.max(100, Math.round(mockAvg * (q.value / 100) * 0.8))
      const competition: RelatedKeyword['competition'] = vol > mockAvg * 0.5 ? 'high' : vol > mockAvg * 0.2 ? 'mid' : 'low'
      return { keyword: q.query, volume: vol, competition }
    })

  return {
    ...mock,
    searchVolume,
    searchVolumePC,
    searchVolumeMobile,
    relatedKeywords: relatedKeywords.length > 0 ? relatedKeywords : mock.relatedKeywords,
    isGoogleReal: true,
  }
}

// ── 전월 키 헬퍼 (Ad API 기준 월 = 전월) ─────────────────────────
function getPrevMonthKey(): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── DataLab 실측 트렌드 병합 ──────────────────────────────────────
// DataLab ratio(0-100)를 실제 검색량으로 환산
// adLastMonth: 검색광고 API 실측 전월 절대값
//
// [핵심 보정 로직]
// DataLab ratio = (키워드검색수 / 네이버전체검색수) × 정규화
// 네이버 전체 검색량이 시간에 따라 증가하므로, 단순 ratio 비율은
// 과거 달을 과대추정함. 기준 키워드(refRatios)를 함께 조회하면
// 분모(전체 검색수)가 상쇄되어 실제 키워드 검색량 비율에 근접.
//
// 보정식:
//   adjusted_ratio[i] = ratio[i] / refRatios[i]          (네이버 전체량 상쇄)
//   adjusted_anchor   = anchorRatio / refAnchorRatio
//   value[i] = (adjusted_ratio[i] / adjusted_anchor) × anchorValue
function resolveWithDatalab(
  data: KeywordData & { isReal: boolean; hasAdVolume: boolean },
  datalabData: DatalabTrendData,
  adLastMonth: number | null,
): KeywordData & { isReal: boolean; hasAdVolume: boolean } {
  const { monthlyRatios, refRatios } = datalabData
  if (Object.keys(monthlyRatios).length === 0) return data

  const anchorMonthKey = getPrevMonthKey()

  // 기준 키워드 ratio로 보정된 normalized ratio 계산
  // refRatios가 있으면 (키워드ratio / 기준ratio)로 네이버 전체량 변화 상쇄
  const refAnchor = refRatios?.[anchorMonthKey] ?? null
  const getNormalizedRatio = (monthKey: string, rawRatio: number): number => {
    if (!refRatios || refAnchor === null) return rawRatio
    const refVal = refRatios[monthKey]
    if (!refVal || refVal === 0) return rawRatio
    // 보정: (키워드ratio / 기준ratio) 로 분모 상쇄 후 기준 앵커로 재스케일
    return (rawRatio / refVal) * refAnchor
  }

  // 앵커 ratio: 전월 DataLab ratio (기준 키워드 보정 적용)
  let rawAnchorRatio = monthlyRatios[anchorMonthKey] ?? null
  if (rawAnchorRatio === null) {
    // 전월 데이터 없으면 마지막 유효 ratio로 fallback
    for (let i = ALL_MONTHS.length - 1; i >= 0; i--) {
      const v = monthlyRatios[ALL_MONTHS[i].key]
      if (v != null) { rawAnchorRatio = v; break }
    }
  }
  if (!rawAnchorRatio) return data

  // 기준 보정 후 앵커 ratio (보정 전후 동일 — 보정식의 분모·분자 모두 앵커 기준이므로)
  const anchorRatioNorm = getNormalizedRatio(anchorMonthKey, rawAnchorRatio)
  if (!anchorRatioNorm) return data

  // 앵커값: Ad API 전월 절대값 우선
  const anchorValue = adLastMonth ?? data.searchVolume[data.searchVolume.length - 1]

  const searchVolume = ALL_MONTHS.map((m, i) => {
    const raw = monthlyRatios[m.key]
    if (raw == null) {
      // null 구간 선형 보간
      const prev = ALL_MONTHS.slice(0, i).reverse().find(pm => monthlyRatios[pm.key] != null)
      const next = ALL_MONTHS.slice(i + 1).find(nm => monthlyRatios[nm.key] != null)
      const prevNorm = prev ? getNormalizedRatio(prev.key, monthlyRatios[prev.key]!) : null
      const nextNorm = next ? getNormalizedRatio(next.key, monthlyRatios[next.key]!) : null
      let interp: number | null = null
      if (prevNorm !== null && nextNorm !== null) interp = (prevNorm + nextNorm) / 2
      else if (prevNorm !== null) interp = prevNorm
      if (interp !== null) return Math.max(0, Math.round((interp / anchorRatioNorm) * anchorValue))
      return data.searchVolume[i] ?? 0
    }
    const norm = getNormalizedRatio(m.key, raw)
    return Math.max(0, Math.round((norm / anchorRatioNorm) * anchorValue))
  })

  // PC/Mobile 비율은 Ad API 실측 비율 유지
  const pcRatios = data.searchVolumePC.map((v, i) =>
    data.searchVolume[i] > 0 ? v / data.searchVolume[i] : 0.4
  )
  const searchVolumePC = searchVolume.map((v, i) => Math.round(v * (pcRatios[i] ?? 0.4)))
  const searchVolumeMobile = searchVolume.map((v, i) => Math.max(0, v - searchVolumePC[i]))

  return { ...data, searchVolume, searchVolumePC, searchVolumeMobile }
}

// ── 차트 로딩 skeleton ────────────────────────────────────────────
const SKELETON_HEIGHTS = [55, 72, 48, 88, 62, 95, 50, 78, 66, 83, 57, 74,
                          60, 70, 45, 85, 58, 92, 52, 76, 63, 80, 55, 71]

function ChartSkeleton({ count = 12 }: { count?: number }) {
  const bars = SKELETON_HEIGHTS.slice(0, Math.min(count, SKELETON_HEIGHTS.length))
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-[3px] h-[160px]">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gray-200 animate-pulse"
            style={{ height: `${h}%`, animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
      <div className="flex justify-between px-1">
        {bars.map((_, i) => (
          <div key={i} className="h-2.5 w-5 rounded bg-gray-200 animate-pulse"
            style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
    </div>
  )
}

// ── 연간 집계 (5y / 3y 구간에서 월별 → 연별 평균) ─────────────────
function aggregateToYearly(
  series: ChartSeries[],
  monthIndices: number[],
): { series: ChartSeries[]; labels: string[] } {
  // monthIndices 의 각 위치를 연도별로 그룹화
  const yearGroups = new Map<string, number[]>() // 'YYYY' → positions
  monthIndices.forEach((monthIdx, pos) => {
    const m = ALL_MONTHS[monthIdx]
    if (!m) return
    const year = m.key.slice(0, 4)
    if (!yearGroups.has(year)) yearGroups.set(year, [])
    yearGroups.get(year)!.push(pos)
  })

  const labels = Array.from(yearGroups.keys()).sort()
  const aggregated = series.map(s => ({
    ...s,
    data: labels.map(year => {
      const positions = yearGroups.get(year) ?? []
      if (!positions.length) return 0
      return Math.round(positions.reduce((sum, pos) => sum + (s.data[pos] ?? 0), 0) / positions.length)
    }),
  }))
  return { series: aggregated, labels }
}

const YEARLY_AGG_PERIODS = new Set<Period>(['5y', '3y', '2y'])

// ── Y축 nice-tick 헬퍼 ────────────────────────────────────────────
function buildYTicks(maxVal: number): number[] {
  if (maxVal <= 0) return [0, 1]
  const rawStep = maxVal / 4
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  const step = niceNorm * mag
  const niceMax = Math.ceil(maxVal / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= niceMax + step * 0.001; v += step) ticks.push(Math.round(v))
  return ticks
}

function fmtY(v: number): string {
  if (v === 0) return '0'
  if (v >= 10000) { const m = v / 10000; return `${Number.isInteger(m) ? m : parseFloat(m.toFixed(1))}만` }
  if (v >= 1000)  { const k = v / 1000;  return `${Number.isInteger(k) ? k : parseFloat(k.toFixed(1))}천` }
  return String(v)
}

// ── 검색량 추이 전용 차트 (ResizeObserver + 단일 SVG) ─────────────
function SearchTrendChart({
  series,
  labels,
  isYearly,
  chartType,
}: {
  series: ChartSeries[]
  labels: string[]
  isYearly: boolean
  chartType: 'bar' | 'line'
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cw, setCw] = useState(0)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setCw(w)
    })
    obs.observe(el)
    const initial = el.getBoundingClientRect().width
    if (initial > 0) setCw(initial)
    return () => obs.disconnect()
  }, [])

  const W = cw || 600
  const H = 200
  const PAD = { t: 16, b: 34, l: 56, r: 16 }
  const cW = Math.max(1, W - PAD.l - PAD.r)
  const cH = H - PAD.t - PAD.b

  const count = labels.length
  const allVals = series.flatMap(s => s.data)
  const maxVal  = Math.max(...allVals, 1)
  const yTicks  = buildYTicks(maxVal)
  const yMax    = yTicks[yTicks.length - 1]

  function toY(v: number) {
    return PAD.t + (1 - v / yMax) * cH
  }

  // Bar layout
  const slotW      = cW / Math.max(count, 1)
  const nSeries    = series.length
  const innerRatio = count === 1 ? 0.5 : 0.72
  const groupW     = slotW * innerRatio
  const gap        = nSeries > 1 ? Math.min(3, (groupW / nSeries) * 0.15) : 0
  const barW       = Math.max(2, (groupW - gap * (nSeries - 1)) / nSeries)
  const groupOff   = (slotW - groupW) / 2

  function barCenterX(slotIdx: number) {
    return PAD.l + (slotIdx + 0.5) * slotW
  }
  function barX(slotIdx: number, seriesIdx: number) {
    return PAD.l + slotIdx * slotW + groupOff + seriesIdx * (barW + gap)
  }

  // Line layout
  function ptX(i: number) {
    return PAD.l + (count > 1 ? (i / (count - 1)) * cW : cW / 2)
  }

  // X-label skip for dense monthly
  const skipFactor = count > 24 ? 4 : count > 12 ? 2 : 1

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svgRect = e.currentTarget.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return
    const svgX = ((e.clientX - svgRect.left) / svgRect.width) * W
    let idx: number
    if (chartType === 'bar') {
      idx = Math.min(count - 1, Math.max(0, Math.floor((svgX - PAD.l) / slotW)))
    } else {
      idx = Math.min(count - 1, Math.max(0, Math.round(((svgX - PAD.l) / cW) * (count - 1))))
    }
    setTooltip({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      label: labels[idx] ?? '',
      values: series.map(s => ({ keyword: s.keyword, value: s.data[idx] ?? 0, color: s.color })),
    })
  }

  const hoveredIdx = tooltip ? labels.indexOf(tooltip.label) : -1

  if (cw === 0) {
    return <div ref={containerRef} className="h-[200px]" />
  }

  return (
    <div ref={containerRef} className="relative">
      <svg
        width={W} height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y축 눈금선 + 레이블 */}
        {yTicks.map(tick => {
          const y = toY(tick)
          return (
            <g key={tick}>
              <line
                x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
                stroke={tick === 0 ? '#cbd5e1' : '#f1f5f9'}
                strokeWidth={tick === 0 ? 1 : 1}
              />
              <text
                x={PAD.l - 6} y={y}
                textAnchor="end" dominantBaseline="middle"
                fontSize={10} fill="#94a3b8"
              >
                {fmtY(tick)}
              </text>
            </g>
          )
        })}

        {/* hover 수직선 */}
        {hoveredIdx >= 0 && (
          <line
            x1={chartType === 'bar' ? barCenterX(hoveredIdx) : ptX(hoveredIdx)}
            y1={PAD.t}
            x2={chartType === 'bar' ? barCenterX(hoveredIdx) : ptX(hoveredIdx)}
            y2={H - PAD.b}
            stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3"
          />
        )}

        {chartType === 'bar' ? (
          /* ── 막대 차트 ─────────────────────────────────────── */
          <>
            {labels.map((_, i) => {
              const isHovered = hoveredIdx === i
              return (
                <g key={i}>
                  <rect
                    x={PAD.l + i * slotW} y={PAD.t}
                    width={slotW} height={cH}
                    fill={isHovered ? 'rgba(0,0,0,0.04)' : 'transparent'}
                  />
                  {series.map((s, j) => {
                    const val = s.data[i] ?? 0
                    const bH  = Math.max(val > 0 ? 2 : 0, (val / yMax) * cH)
                    const bX  = barX(i, j)
                    const bY  = toY(val)
                    const rx  = Math.min(3, barW / 3)
                    return (
                      <rect key={j} x={bX} y={bY} width={barW} height={bH} rx={rx} ry={rx}
                        fill={s.color} opacity={isHovered ? 1 : 0.85} />
                    )
                  })}
                </g>
              )
            })}
          </>
        ) : (
          /* ── 선형 차트 ─────────────────────────────────────── */
          <>
            <defs>
              {series.map((s, si) => {
                const id = `stg-${si}`
                return (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={s.color} stopOpacity="0.20" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
                  </linearGradient>
                )
              })}
            </defs>
            {series.map((s, si) => {
              const pts    = s.data.map((v, i) => ({ x: ptX(i), y: toY(v) }))
              const lineD  = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
              const areaD  = pts.length > 0
                ? `M${pts[0].x.toFixed(1)},${H - PAD.b} ` +
                  pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
                  ` L${pts.at(-1)!.x.toFixed(1)},${H - PAD.b} Z`
                : ''
              return (
                <g key={si}>
                  {areaD && <path d={areaD} fill={`url(#stg-${si})`} />}
                  <path d={lineD} fill="none" stroke={s.color} strokeWidth={2.5}
                    strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y}
                      r={hoveredIdx === i ? 5 : count <= 6 ? 3.5 : 2.5}
                      fill={s.color} />
                  ))}
                </g>
              )
            })}
          </>
        )}

        {/* X축 레이블 — SVG 내부에서 정확하게 정렬 */}
        {labels.map((lbl, i) => {
          const show = isYearly || i % skipFactor === 0 || i === count - 1
          if (!show) return null
          const lx = chartType === 'bar' ? barCenterX(i) : ptX(i)
          return (
            <text key={i} x={lx} y={H - 8}
              textAnchor="middle"
              fontSize={isYearly ? 11 : 10}
              fontWeight={isYearly ? 600 : 400}
              fill={isYearly ? '#475569' : '#94a3b8'}
            >
              {lbl}
            </text>
          )
        })}
      </svg>
      {tooltip && <ChartTooltip tooltip={tooltip} containerWidth={cw} />}
    </div>
  )
}

// ── 섹션별 기간 계산 헬퍼 ──────────────────────────────────────────
const PERIOD_COUNT: Record<Period, number> = { '5y': 60, '3y': 36, '2y': 24, '1y': 12, '3m': 3, '1m': 1 }
const PERIOD_LABEL: Record<Period, string> = {
  '5y': '지난 5년', '3y': '지난 3년', '2y': '지난 2년',
  '1y': '지난 1년', '3m': '지난 3개월', '1m': '지난달',
}

function calcSection(
  p: Period,
  showCustom: boolean,
  customStart: string,
  customEnd: string,
) {
  const customActive = showCustom && !!customStart && !!customEnd && customStart <= customEnd
  const months = customActive
    ? ALL_MONTHS.filter(m => m.key >= customStart.slice(0, 7) && m.key <= customEnd.slice(0, 7))
    : ALL_MONTHS.slice(ALL_MONTHS.length - PERIOD_COUNT[p])
  const indices = months
    .map(m => ALL_MONTHS.findIndex(am => am.key === m.key))
    .filter(i => i >= 0)
  const label = customActive && months.length > 0
    ? `${customStart.slice(0, 7)} ~ ${customEnd.slice(0, 7)}`
    : PERIOD_LABEL[p]
  return { months, indices, label, customActive }
}

// ── 간단 기간 탭 (사용자 정의 날짜 없음) ─────────────────────────
const PERIOD_TAB_OPTIONS: { value: Period; label: string }[] = [
  { value: '5y', label: '5년' },
  { value: '3y', label: '3년' },
  { value: '2y', label: '2년' },
  { value: '1y', label: '1년' },
  { value: '3m', label: '3개월' },
  { value: '1m', label: '1개월' },
]

function PeriodTabs({
  value, onChange,
}: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
      {PERIOD_TAB_OPTIONS.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={[
            'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
            value === opt.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── X축 레이블 (SVG preserveAspectRatio="none" 와 정확히 정렬) ────
// SVG 좌표계를 퍼센트로 변환해 absolute 포지셔닝 → 막대/점 중앙에 정확히 위치
function XAxisLabels({
  labels,
  chartType,
}: {
  labels: string[]
  chartType: 'bar' | 'line'
}) {
  const count = labels.length
  if (count === 0) return null

  // 너무 많을 때 레이블 간격 조정 (최대 ~12개 표시, 항상 첫·마지막 포함)
  const skipFactor = Math.max(1, Math.ceil(count / 12))

  const getLeftPct = (i: number): number => {
    if (chartType === 'bar') {
      // 막대 슬롯 중앙: (i + 0.5) / count
      return ((i + 0.5) / count) * 100
    }
    // 라인 차트: ptX(i) = pad.l + (i / (len-1)) * gW  (pad.l=12, gW=576, W=600)
    const x = 12 + (count > 1 ? (i / (count - 1)) * 576 : 288)
    return (x / 600) * 100
  }

  return (
    <div className="relative mt-1 h-5 select-none">
      {labels.map((label, i) => {
        if (i % skipFactor !== 0 && i !== count - 1) return null
        return (
          <span
            key={i}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-400"
            style={{ left: `${getLeftPct(i)}%` }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

// ── 툴팁 컴포넌트 ────────────────────────────────────────────────
function ChartTooltip({
  tooltip,
  containerWidth,
}: {
  tooltip: TooltipInfo
  containerWidth: number
}) {
  const TOOLTIP_W = 160
  const left = tooltip.x + 14 + TOOLTIP_W > containerWidth
    ? tooltip.x - TOOLTIP_W - 10
    : tooltip.x + 14

  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[140px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-lg"
      style={{ left, top: Math.max(0, tooltip.y - 52) }}
    >
      <p className="mb-1.5 text-[11px] font-semibold text-gray-400">{tooltip.label}</p>
      {tooltip.values.map((v) => (
        <div key={v.keyword} className="flex items-center gap-2 py-0.5 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: v.color }} />
          <span className="min-w-0 truncate text-gray-600">{v.keyword}</span>
          <span className="ml-auto font-bold text-gray-900">{fmt(v.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── 다중 막대 차트 (hover tooltip) ──────────────────────────────
function MultiBarChart({ series, labels }: { series: ChartSeries[]; labels: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setContainerWidth(w)
    })
    obs.observe(el)
    const initial = el.getBoundingClientRect().width
    if (initial > 0) setContainerWidth(initial)
    return () => obs.disconnect()
  }, [])

  const W = 600
  const H = 160
  const max = Math.max(...series.flatMap((s) => s.data), 1)
  const count = labels.length
  const slotW = W / count
  const barCount = series.length
  const groupW = slotW * (barCount > 1 ? 0.7 : 0.5)
  const gap = barCount > 1 ? 2 : 0
  const barW = Math.max(3, (groupW - gap * (barCount - 1)) / barCount)
  const groupOffset = (slotW - groupW) / 2

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svgRect = e.currentTarget.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return
    const relX = ((e.clientX - svgRect.left) / svgRect.width) * W
    const idx = Math.min(count - 1, Math.max(0, Math.floor(relX / slotW)))
    setTooltip({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      label: labels[idx],
      values: series.map((s) => ({ keyword: s.keyword, value: s.data[idx] ?? 0, color: s.color })),
    })
  }

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y축 기준선 (25 / 50 / 75%) */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={0} y1={4 + (1 - pct) * (H - 8)}
            x2={W} y2={4 + (1 - pct) * (H - 8)}
            stroke="#f0f0f0" strokeWidth="1"
          />
        ))}
        {labels.map((lbl, i) => {
          const slotX = i * slotW
          const isHovered = tooltip?.label === lbl
          return (
            <g key={i}>
              <rect
                x={slotX} y={0} width={slotW} height={H}
                fill={isHovered ? 'rgba(0,0,0,0.04)' : 'transparent'}
              />
              {series.map((s, j) => {
                const barH = Math.max(s.data[i] > 0 ? 3 : 0, Math.round((s.data[i] / max) * (H - 8)))
                const x = slotX + groupOffset + j * (barW + gap)
                const y = H - barH - 4
                return (
                  <rect
                    key={j} x={x} y={y} width={barW} height={barH} rx={2}
                    fill={s.color} opacity={isHovered ? 1 : 0.82}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>
      {tooltip && (
        <ChartTooltip tooltip={tooltip} containerWidth={containerWidth} />
      )}
    </div>
  )
}

// ── 다중 라인 차트 (hover tooltip + 수직선) ─────────────────────
function MultiLineChart({ series, labels }: { series: ChartSeries[]; labels: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setContainerWidth(w)
    })
    obs.observe(el)
    const initial = el.getBoundingClientRect().width
    if (initial > 0) setContainerWidth(initial)
    return () => obs.disconnect()
  }, [])

  const W = 600
  const H = 160
  const pad = { t: 14, b: 8, l: 12, r: 12 }
  const gW = W - pad.l - pad.r
  const gH = H - pad.t - pad.b
  const len = labels.length

  const allMin = Math.min(...series.flatMap((s) => s.data))
  const allMax = Math.max(...series.flatMap((s) => s.data), 1)
  const range = allMax - allMin || 1

  function ptX(i: number) {
    return pad.l + (len > 1 ? (i / (len - 1)) * gW : gW / 2)
  }
  function ptY(v: number) {
    return pad.t + (1 - (v - allMin) / range) * gH
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svgRect = e.currentTarget.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return
    const relX = ((e.clientX - svgRect.left) / svgRect.width) * W
    const idx = Math.min(len - 1, Math.max(0, Math.round(((relX - pad.l) / gW) * (len - 1))))
    setTooltip({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      label: labels[idx],
      values: series.map((s) => ({ keyword: s.keyword, value: s.data[idx] ?? 0, color: s.color })),
    })
  }

  const hoveredIdx = tooltip ? labels.indexOf(tooltip.label) : -1

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          {series.map((s, si) => {
            const id = `lg-${s.color.replace('#', '')}-${si}`
            return (
              <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
              </linearGradient>
            )
          })}
        </defs>

        {/* Y축 기준선 (25 / 50 / 75%) */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={0} y1={pad.t + (1 - pct) * gH}
            x2={W} y2={pad.t + (1 - pct) * gH}
            stroke="#f0f0f0" strokeWidth="1"
          />
        ))}

        {/* hover 수직선 */}
        {hoveredIdx >= 0 && (
          <line
            x1={ptX(hoveredIdx)} y1={pad.t}
            x2={ptX(hoveredIdx)} y2={H - pad.b}
            stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 3"
          />
        )}

        {series.map((s, si) => {
          const pts = s.data.map((v, i) => ({ x: ptX(i), y: ptY(v) }))
          const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
          const areaD =
            `M${pts[0].x.toFixed(1)},${H - pad.b} ` +
            pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
            ` L${pts.at(-1)!.x.toFixed(1)},${H - pad.b} Z`
          const gradId = `lg-${s.color.replace('#', '')}-${si}`
          return (
            <g key={`${s.keyword}-${si}`}>
              <path d={areaD} fill={`url(#${gradId})`} />
              <path d={pathD} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={hoveredIdx === i ? 5 : 3.5} fill={s.color} />
              ))}
            </g>
          )
        })}
      </svg>
      {tooltip && (
        <ChartTooltip tooltip={tooltip} containerWidth={containerWidth} />
      )}
    </div>
  )
}

// ── 경쟁도 ───────────────────────────────────────────────────────
const COMP_STYLE = {
  high: 'bg-red-50 text-red-600',
  mid: 'bg-amber-50 text-amber-600',
  low: 'bg-emerald-50 text-emerald-700',
}
const COMP_LABEL = { high: '경쟁 높음', mid: '경쟁 보통', low: '경쟁 낮음' }

// ── CSV ──────────────────────────────────────────────────────────
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildCsv(keyword: string, platform: string, data: KeywordData): string {
  const e = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows: string[] = []
  rows.push([e('키워드'), e(keyword)].join(','))
  rows.push([e('플랫폼'), e(platform)].join(','))
  rows.push('', e('[월별 검색량]'))
  rows.push([e('월'), e('전체'), e('PC'), e('Mobile')].join(','))
  ALL_MONTHS.forEach(({ label }, i) => {
    rows.push([e(label), e(String(data.searchVolume[i] ?? '')), e(String(data.searchVolumePC[i] ?? '')), e(String(data.searchVolumeMobile[i] ?? ''))].join(','))
  })
  rows.push('', e('[월별 콘텐츠 발행량]'))
  rows.push([e('월'), e('발행량')].join(','))
  ALL_MONTHS.forEach(({ label }, i) => { rows.push([e(label), e(String(data.contentVolume[i] ?? ''))].join(',')) })
  rows.push('', e('[플랫폼별 콘텐츠 분포]'))
  rows.push([e('플랫폼'), e('건수')].join(','))
  data.contentByPlatform.forEach((p) => rows.push([e(p.name), e(String(p.count))].join(',')))
  rows.push('', e('[플랫폼 언급량]'))
  rows.push([e('플랫폼'), e('언급수')].join(','))
  data.platformMentions.forEach((p) => rows.push([e(p.name), e(String(p.count))].join(',')))
  rows.push('', e('[연관 키워드]'))
  rows.push([e('키워드'), e('월간 검색량'), e('경쟁도')].join(','))
  data.relatedKeywords.forEach((k) => rows.push([e(k.keyword), e(String(k.volume)), e(COMP_LABEL[k.competition])].join(',')))
  return rows.join('\n')
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function BlueberryClient() {
  const [input, setInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [platform, setPlatform] = useState<'naver' | 'google'>('naver')
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
  // 섹션별 독립 기간
  const [searchPeriod, setSearchPeriod] = useState<Period>('1y')
  const [searchShowCustom, setSearchShowCustom] = useState(false)
  const [searchCustomStart, setSearchCustomStart] = useState('')
  const [searchCustomEnd, setSearchCustomEnd] = useState('')
  const [contentPeriod, setContentPeriod] = useState<Period>('1m')
  const [contentShowCustom, setContentShowCustom] = useState(false)
  const [contentCustomStart, setContentCustomStart] = useState('')
  const [contentCustomEnd, setContentCustomEnd] = useState('')
  const [mentionPeriod, setMentionPeriod] = useState<Period>('1y')
  const [relatedPeriod, setRelatedPeriod] = useState<Period>('1y')
  const [compareKeywords, setCompareKeywords] = useState<string[]>([])
  const [compareInput, setCompareInput] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pcMobileSplit, setPcMobileSplit] = useState(false)
  const [copiedSearch, setCopiedSearch] = useState(false)
  const [, startTransition] = useTransition()

  // ── API 상태 (Naver 전용) ────────────────────────────────────
  const [naverApiData, setNaverApiData] = useState<NaverApiData | null>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiConfigured, setApiConfigured] = useState(true)
  // 비교 키워드별 실측 데이터
  const [compareApiData, setCompareApiData] = useState<Record<string, NaverApiData | null>>({})
  const [compareApiLoading, setCompareApiLoading] = useState<Record<string, boolean>>({})

  // ── Google Trends API 상태 ───────────────────────────────────
  const [googleApiData, setGoogleApiData] = useState<GoogleTrendsData | null>(null)
  const [googleApiLoading, setGoogleApiLoading] = useState(false)
  const [googleApiError, setGoogleApiError] = useState(false)

  // ── Naver DataLab 트렌드 상태 ────────────────────────────────
  const [datalabTrendData, setDatalabTrendData] = useState<DatalabTrendData | null>(null)
  const [datalabLoading, setDatalabLoading] = useState(false)
  // 비교 키워드별 DataLab 트렌드
  const [compareDatalabData, setCompareDatalabData] = useState<Record<string, DatalabTrendData | null>>({})

  // ── 키워드 저장 ───────────────────────────────────────────────
  const [savedKeywords, setSavedKeywords] = useState<string[]>([])

  // ── PNG 내보내기 ─────────────────────────────────────────────
  const resultsRef = useRef<HTMLDivElement>(null)
  const [isExportingPng, setIsExportingPng] = useState(false)

  // ── localStorage 저장 키워드 로드 ───────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('blueberry-saved-keywords')
      if (raw) setSavedKeywords(JSON.parse(raw) as string[])
    } catch { /* ignore */ }
  }, [])

  // ── Naver 키워드/플랫폼 변경 시 API 호출 ────────────────────
  useEffect(() => {
    if (!keyword || platform !== 'naver') return
    setApiLoading(true)
    setNaverApiData(null)

    fetch('/api/blueberry/naver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
    })
      .then((r) => r.json())
      .then((data: NaverApiData & { error?: string }) => {
        if (data.error?.includes('환경변수')) { setApiConfigured(false); return }
        setApiConfigured(true)
        setNaverApiData(data)
      })
      .catch(() => { /* 네트워크 오류 시 목업 유지 */ })
      .finally(() => setApiLoading(false))
  }, [keyword, platform])

  // ── Google Trends API 호출 ───────────────────────────────────
  useEffect(() => {
    if (!keyword || platform !== 'google') return
    setGoogleApiLoading(true)
    setGoogleApiData(null)
    setGoogleApiError(false)

    fetch('/api/blueberry/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword }),
    })
      .then((r) => r.json())
      .then((data: GoogleTrendsData & { error?: string }) => {
        if (data.error) { setGoogleApiError(true); return }
        setGoogleApiData(data)
      })
      .catch(() => setGoogleApiError(true))
      .finally(() => setGoogleApiLoading(false))
  }, [keyword, platform])

  // ── Naver DataLab 트렌드 호출 (최근 5년 월별) ──────────────
  // 기준 키워드(DATALAB_REFERENCE_KEYWORD)를 함께 조회하여
  // 네이버 전체 검색량 증가에 의한 과거 데이터 과대추정을 보정
  function fetchDatalabTrend(kw: string) {
    setDatalabLoading(true)
    setDatalabTrendData(null)

    const now = new Date()
    const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const firstDayOf5yAgo = new Date(now.getFullYear() - 5, now.getMonth(), 1)
    const startDateStr = `${firstDayOf5yAgo.getFullYear()}-${String(firstDayOf5yAgo.getMonth() + 1).padStart(2, '0')}-01`
    const endDateStr = lastDayOfPrevMonth.toISOString().slice(0, 10)
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // 기준 키워드와 함께 한 번에 조회 (DataLab API는 그룹당 ratio를 동일 기준으로 정규화)
    const isRefKeyword = kw.trim() === DATALAB_REFERENCE_KEYWORD
    const keywordGroups = isRefKeyword
      ? [{ groupName: kw, keywords: [kw] }]
      : [
          { groupName: kw, keywords: [kw] },
          { groupName: '__ref__', keywords: [DATALAB_REFERENCE_KEYWORD] },
        ]

    fetch('/api/blueberry/datalab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: startDateStr, endDate: endDateStr, timeUnit: 'month', keywordGroups }),
    })
      .then(r => r.json())
      .then((res: { results?: { data: { period: string; ratio: number }[] }[]; error?: string }) => {
        if (res.error) return
        const parse = (idx: number): Record<string, number> => {
          const points = res.results?.[idx]?.data ?? []
          const out: Record<string, number> = {}
          for (const pt of points) {
            const monthKey = pt.period.slice(0, 7)
            if (monthKey !== currentMonthKey) out[monthKey] = pt.ratio
          }
          return out
        }
        const monthlyRatios = parse(0)
        const refRatios = !isRefKeyword ? parse(1) : undefined
        setDatalabTrendData({ monthlyRatios, ...(refRatios && Object.keys(refRatios).length > 0 ? { refRatios } : {}) })
      })
      .catch(() => {})
      .finally(() => setDatalabLoading(false))
  }

  useEffect(() => {
    if (!keyword || platform !== 'naver') return
    fetchDatalabTrend(keyword)
  }, [keyword, platform])

  // 주요 키워드 데이터
  const mockPrimary = keyword ? generateData(keyword, platform) : null
  const naverResolved = mockPrimary ? resolveAdData(mockPrimary, platform, naverApiData) : null
  const googleResolved = (mockPrimary && platform === 'google')
    ? resolveGoogleData(mockPrimary, googleApiData, ALL_MONTHS)
    : null

  // Ad API 절대값 (DataLab 스케일 앵커로 사용)
  const adAbsoluteLastMonth = (
    naverApiData?.monthlyPcQcCnt !== null &&
    naverApiData?.monthlyMobileQcCnt !== null
  ) ? ((naverApiData?.monthlyPcQcCnt ?? 0) + (naverApiData?.monthlyMobileQcCnt ?? 0)) || null
    : null

  const primaryData = platform === 'google'
    ? (googleResolved ? { ...naverResolved ?? mockPrimary!, ...googleResolved } : naverResolved)
    : (naverResolved && datalabTrendData
      ? resolveWithDatalab(naverResolved, datalabTrendData, adAbsoluteLastMonth)
      : naverResolved)
  const isRealData = platform === 'naver'
    ? (naverResolved as (KeywordData & { isReal?: boolean }) | null)?.isReal ?? false
    : googleResolved?.isGoogleReal ?? false
  const hasAdVolume = (naverResolved as (KeywordData & { hasAdVolume?: boolean }) | null)?.hasAdVolume ?? false

  // 비교 포함 전체 시리즈 — Ad API + DataLab 트렌드 모두 적용
  const allKeywords = keyword ? [keyword, ...compareKeywords] : []
  const allSeriesData = allKeywords.map((kw, i) => {
    const mock = generateData(kw, platform)
    const apiData = kw === keyword ? naverApiData : (compareApiData[kw] ?? null)
    const resolved = resolveAdData(mock, platform, apiData)
    // DataLab 트렌드 적용 (Naver 전용)
    if (platform === 'naver') {
      const dl = kw === keyword ? datalabTrendData : (compareDatalabData[kw] ?? null)
      const adTotal = (apiData?.monthlyPcQcCnt !== null && apiData?.monthlyMobileQcCnt !== null)
        ? ((apiData?.monthlyPcQcCnt ?? 0) + (apiData?.monthlyMobileQcCnt ?? 0)) || null
        : null
      if (dl) {
        const withDl = resolveWithDatalab(resolved, dl, adTotal)
        return { keyword: kw, data: withDl, color: getKeywordColor(kw, i) }
      }
    }
    return { keyword: kw, data: resolved, color: getKeywordColor(kw, i) }
  })

  // 섹션별 기간 계산
  const searchSec = calcSection(searchPeriod, searchShowCustom, searchCustomStart, searchCustomEnd)
  const contentSec = calcSection(contentPeriod, contentShowCustom, contentCustomStart, contentCustomEnd)
  const mentionMonthCount = PERIOD_COUNT[mentionPeriod]
  const mentionPeriodLabel = PERIOD_LABEL[mentionPeriod]
  const relatedMonthCount = PERIOD_COUNT[relatedPeriod]
  const relatedPeriodLabel = PERIOD_LABEL[relatedPeriod]

  // 차트 로딩 상태: DataLab(Naver) 또는 Google Trends(Google) 대기 중
  const isChartLoading = (platform === 'naver' && datalabLoading) ||
                         (platform === 'google' && googleApiLoading)

  // PC/Mobile 분리 가능 조건: Naver 실측 데이터 + 검색광고 API 연동
  const canSplit = isRealData && hasAdVolume && platform === 'naver'
  const isSplit = canSplit && pcMobileSplit

  const pickSearch = (arr: number[]) => searchSec.indices.map(i => arr[i] ?? 0)
  const pickContent = (arr: number[]) => contentSec.indices.map(i => arr[i] ?? 0)

  const searchSeries: ChartSeries[] = isSplit
    ? [
        ...allSeriesData.flatMap(({ keyword: kw, data, color }) => [
          {
            keyword: compareKeywords.length > 0 ? `${kw} PC` : 'PC',
            data: pickSearch(data.searchVolumePC),
            color: '#3B82F6',
          },
          {
            keyword: compareKeywords.length > 0 ? `${kw} 모바일` : '모바일',
            data: pickSearch(data.searchVolumeMobile),
            color,
          },
        ]),
      ]
    : allSeriesData.map(({ keyword: kw, data, color }) => ({
        keyword: kw, data: pickSearch(data.searchVolume), color,
      }))
  const contentSeries: ChartSeries[] = allSeriesData.map(({ keyword: kw, data, color }) => ({
    keyword: kw, data: pickContent(data.contentVolume), color,
  }))

  // 5y / 3y 는 연간 평균으로 집계해 차트에 표시
  const searchIsYearly = YEARLY_AGG_PERIODS.has(searchPeriod) && !searchSec.customActive
  const contentIsYearly = YEARLY_AGG_PERIODS.has(contentPeriod) && !contentSec.customActive

  const searchDisplay = searchIsYearly
    ? aggregateToYearly(searchSeries, searchSec.indices)
    : { series: searchSeries, labels: searchSec.months.map(m => m.label) }

  const contentDisplay = contentIsYearly
    ? aggregateToYearly(contentSeries, contentSec.indices)
    : { series: contentSeries, labels: contentSec.months.map(m => m.label) }

  function handleSearch() {
    const q = input.trim()
    if (!q) return
    startTransition(() => { setKeyword(q); setCompareKeywords([]) })
    setCompareApiData({})
    setCompareApiLoading({})
  }

  function handleRefresh() {
    if (!keyword || isRefreshing) return
    setIsRefreshing(true)
    setNaverApiData(null)

    if (platform === 'naver') {
      // DataLab 트렌드 재호출
      fetchDatalabTrend(keyword)
      // 주 키워드 새로고침
      fetch('/api/blueberry/naver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      })
        .then((r) => r.json())
        .then((data: NaverApiData & { error?: string }) => {
          if (!data.error) setNaverApiData(data)
        })
        .catch(() => {})
        .finally(() => setIsRefreshing(false))
      // 비교 키워드 새로고침
      setCompareApiData({})
      setCompareDatalabData({})
      compareKeywords.forEach(kw => fetchCompareApi(kw))
    } else {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  function fetchCompareApi(kw: string) {
    if (platform !== 'naver') return
    setCompareApiLoading(prev => ({ ...prev, [kw]: true }))
    // Naver Ad API 호출
    fetch('/api/blueberry/naver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw }),
    })
      .then(r => r.json())
      .then((data: NaverApiData & { error?: string }) => {
        if (!data.error) setCompareApiData(prev => ({ ...prev, [kw]: data }))
      })
      .catch(() => {})
      .finally(() => setCompareApiLoading(prev => ({ ...prev, [kw]: false })))
    // DataLab 트렌드 병렬 호출
    fetchCompareDatalabTrend(kw)
  }

  function fetchCompareDatalabTrend(kw: string) {
    const now = new Date()
    const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const firstDayOf5yAgo = new Date(now.getFullYear() - 5, now.getMonth(), 1)
    const startDateStr = `${firstDayOf5yAgo.getFullYear()}-${String(firstDayOf5yAgo.getMonth() + 1).padStart(2, '0')}-01`
    const endDateStr = lastDayOfPrevMonth.toISOString().slice(0, 10)
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const isRefKeyword = kw.trim() === DATALAB_REFERENCE_KEYWORD

    const keywordGroups = isRefKeyword
      ? [{ groupName: kw, keywords: [kw] }]
      : [
          { groupName: kw, keywords: [kw] },
          { groupName: '__ref__', keywords: [DATALAB_REFERENCE_KEYWORD] },
        ]

    fetch('/api/blueberry/datalab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: startDateStr, endDate: endDateStr, timeUnit: 'month', keywordGroups }),
    })
      .then(r => r.json())
      .then((res: { results?: { data: { period: string; ratio: number }[] }[]; error?: string }) => {
        if (res.error) return
        const parse = (idx: number): Record<string, number> => {
          const out: Record<string, number> = {}
          for (const pt of res.results?.[idx]?.data ?? []) {
            const mk = pt.period.slice(0, 7)
            if (mk !== currentMonthKey) out[mk] = pt.ratio
          }
          return out
        }
        const monthlyRatios = parse(0)
        const refRatios = !isRefKeyword ? parse(1) : undefined
        setCompareDatalabData(prev => ({
          ...prev,
          [kw]: { monthlyRatios, ...(refRatios && Object.keys(refRatios).length > 0 ? { refRatios } : {}) },
        }))
      })
      .catch(() => {})
  }

  function handleAddCompare() {
    const q = compareInput.trim()
    if (!q || q === keyword || compareKeywords.includes(q) || compareKeywords.length >= 4) return
    setCompareKeywords([...compareKeywords, q])
    setCompareInput('')
    fetchCompareApi(q)
  }

  function handleRemoveCompare(kw: string) {
    setCompareKeywords(compareKeywords.filter(k => k !== kw))
    setCompareApiData(prev => { const n = { ...prev }; delete n[kw]; return n })
    setCompareApiLoading(prev => { const n = { ...prev }; delete n[kw]; return n })
    setCompareDatalabData(prev => { const n = { ...prev }; delete n[kw]; return n })
  }

  function handleExport() {
    if (!primaryData || !keyword) return
    downloadCsv(
      buildCsv(keyword, platform === 'naver' ? 'Naver' : 'Google', primaryData),
      `blueberry_${keyword}_${platform}_${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  async function handleExportPng() {
    if (!resultsRef.current || !keyword || isExportingPng) return
    setIsExportingPng(true)
    try {
      const { toPng } = await import('html-to-image')
      const el = resultsRef.current
      const opts = { pixelRatio: 2, backgroundColor: '#f9fafb' }
      // 첫 호출로 폰트·이미지 캐시 워밍업, 두 번째 호출에서 실제 캡처
      await toPng(el, opts)
      const dataUrl = await toPng(el, opts)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `blueberry_${keyword}_${platform}_${new Date().toISOString().slice(0, 10)}.png`
      a.click()
    } catch (e) {
      console.error('[Blueberry] PNG export error:', e)
    } finally {
      setIsExportingPng(false)
    }
  }

  function handleToggleSave() {
    if (!keyword) return
    const next = savedKeywords.includes(keyword)
      ? savedKeywords.filter(k => k !== keyword)
      : [...savedKeywords, keyword]
    setSavedKeywords(next)
    try { localStorage.setItem('blueberry-saved-keywords', JSON.stringify(next)) } catch { /* ignore */ }
  }

  function handleRemoveSaved(kw: string) {
    const next = savedKeywords.filter(k => k !== kw)
    setSavedKeywords(next)
    try { localStorage.setItem('blueberry-saved-keywords', JSON.stringify(next)) } catch { /* ignore */ }
  }

  function handleLoadSaved(kw: string) {
    setInput(kw)
    startTransition(() => { setKeyword(kw); setCompareKeywords([]) })
    setCompareApiData({})
    setCompareApiLoading({})
    setGoogleApiData(null)
  }

  const platformLabel = platform === 'naver' ? 'Naver' : 'Google'

  // ── KPI 카드: 항상 월간(지난달) 고정 ─────────────────────────────
  // 검색광고 API 실측이 있을 때 KPI는 "전월 월간 검색량" 고정 표시 (Ad Center와 동일 기준)
  const adMonthlyPC     = naverApiData?.monthlyPcQcCnt ?? null
  const adMonthlyMobile = naverApiData?.monthlyMobileQcCnt ?? null
  const hasAdVolume_kpi = hasAdVolume && adMonthlyPC !== null && adMonthlyMobile !== null
  // 네이버 로딩 중에는 null로 처리 → "--" 표시 (mock값이 잠깐 보이는 플리커 방지)
  const naverLoading = platform === 'naver' && apiLoading
  const lastIdx = ALL_MONTHS.length - 1
  const totalSearch  = naverLoading ? null : hasAdVolume_kpi ? (adMonthlyPC! + adMonthlyMobile!) : primaryData ? (primaryData.searchVolume[lastIdx] ?? 0) : 0
  const totalPC      = naverLoading ? null : hasAdVolume_kpi ? adMonthlyPC!  : primaryData ? (primaryData.searchVolumePC[lastIdx] ?? 0) : 0
  const totalMobile  = naverLoading ? null : hasAdVolume_kpi ? adMonthlyMobile! : primaryData ? (primaryData.searchVolumeMobile[lastIdx] ?? 0) : 0
  const totalMention = primaryData
    ? Math.round(primaryData.platformMentions.reduce((s, p) => s + p.count, 0) / 12)
    : 0

  // contentByPlatform: 월간 추정치 (API 비율 × mock 월간 총계)
  const scaledContentByPlatform = primaryData?.contentByPlatform ?? []
  // 발행량 KPI: contentVolume[lastIdx] = mock 월간 추정 총계 (플랫폼별 합산과 일치)
  const totalContent = primaryData ? (primaryData.contentVolume[lastIdx] ?? 0) : 0

  const searchUnit = ''

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">

      {/* 헤더 */}
      <div className="grid md:grid-cols-2 justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-1.5">
            <Grape className="h-3.5 w-3.5 text-[#1a3f7e]" />
            블루베리 / 키워드 인사이트
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">키워드 분석</h1>
          <p className="mt-1 text-sm text-gray-500">
            키워드를 입력하면 검색량·콘텐츠 발행량·플랫폼 언급량을 분석합니다.
          </p>
          {/* API 연동 상태 표시 */}
          <div className="mt-2 flex items-center gap-1.5">
            {platform === 'naver' && (
              <>
                {!apiConfigured ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    <WifiOff className="h-3 w-3" />
                    Naver API 미설정 — 추정 데이터
                  </span>
                ) : apiLoading ? (
                  <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    검색량 로딩 중…
                  </span>
                ) : isRealData ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    <Wifi className="h-3 w-3" />
                    {hasAdVolume ? 'Naver 검색광고 · 검색 API 연동됨' : 'Naver 검색 API 연동됨'}
                  </span>
                ) : null}
                {apiConfigured && datalabLoading && (
                  <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    검색 트렌드 로딩 중…
                  </span>
                )}
                {apiConfigured && !datalabLoading && datalabTrendData && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    <Wifi className="h-3 w-3" />
                    DataLab 트렌드 연동됨
                  </span>
                )}
              </>
            )}
            {platform === 'google' && keyword && (
              <>
                {googleApiLoading ? (
                  <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Google Trends 로딩 중…
                  </span>
                ) : googleApiError ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    <WifiOff className="h-3 w-3" />
                    Google Trends 연동 불가 — 추정 데이터
                  </span>
                ) : googleApiData ? (
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                    <Wifi className="h-3 w-3" />
                    Google Trends 실 연동됨
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>
        {keyword && (
          <div className="flex items-center gap-2 my-2 justify-end">
            <button type="button" onClick={handleToggleSave}
              title={savedKeywords.includes(keyword) ? '저장 해제' : '키워드 저장'}
              className={[
                'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors',
                savedKeywords.includes(keyword)
                  ? 'border-[#1a3f7e] bg-[#e8eef7] text-[#1a3f7e]'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50',
              ].join(' ')}>
              {savedKeywords.includes(keyword)
                ? <BookmarkCheck className="h-3.5 w-3.5" />
                : <Bookmark className="h-3.5 w-3.5" />}
              {savedKeywords.includes(keyword) ? '저장됨' : '저장'}
            </button>
            <button type="button" onClick={handleExportPng} disabled={isExportingPng}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              {isExportingPng
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                : <ImageIcon className="h-3.5 w-3.5" />}
              PNG
            </button>
            <button type="button" onClick={handleExport}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button type="button" onClick={handleRefresh} disabled={isRefreshing}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
        )}
      </div>

      {/* 검색 입력 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="분석할 키워드를 입력하세요 (예: 슈링크, 피부과, 클래시스)"
            className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#1a3f7e] focus:outline-none focus:ring-2 focus:ring-[#e8eef7]"
          />
        </div>
        <button type="button" onClick={handleSearch} disabled={!input.trim()}
          className="rounded-2xl bg-[#1a3f7e] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#132d5c] disabled:opacity-50 transition-colors">
          분석하기
        </button>
      </div>

      {/* 저장된 키워드 */}
      {savedKeywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-semibold text-gray-400">
            <Bookmark className="h-3 w-3" />
            저장된 키워드
          </span>
          {savedKeywords.map((kw) => (
            <span key={kw}
              className="flex items-center gap-1 rounded-full border border-[#b3c2dc] bg-[#e8eef7] px-3 py-1 text-xs font-medium text-[#1a3f7e]">
              <button type="button" onClick={() => handleLoadSaved(kw)}
                className="hover:underline">
                {kw}
              </button>
              <button type="button" onClick={() => handleRemoveSaved(kw)}
                className="ml-0.5 text-[#1a3f7e]/60 hover:text-[#1a3f7e] transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 결과 */}
      {primaryData && keyword ? (
        <div ref={resultsRef} className="space-y-6">

          {/* 컨트롤: 플랫폼 · 차트 타입 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {(['naver', 'google'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPlatform(p)}
                  className={[
                    'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors',
                    platform === p
                      ? p === 'naver' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  ].join(' ')}>
                  {p === 'naver'
                    ? <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-white text-[10px] font-black text-green-600">N</span>
                    : <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-blue-600">G</span>
                  }
                  {p === 'naver' ? 'Naver' : 'Google'}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {canSplit && (
                <button
                  type="button"
                  onClick={() => setPcMobileSplit((v) => !v)}
                  className={[
                    'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors border',
                    isSplit
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                  ].join(' ')}>
                  <Monitor className="h-3 w-3" />
                  PC
                  <span className="text-gray-300">/</span>
                  <Smartphone className="h-3 w-3" />
                  Mobile
                </button>
              )}
              <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
                {(['bar', 'line'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setChartType(t)}
                    className={['rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', chartType === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'].join(' ')}>
                    {t === 'bar' ? '막대' : '선형'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KPI 카드 — 측정 기준 명시 */}
          <div className="grid md:grid-cols-3 gap-4">

            {/* 검색량 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex rounded-xl p-2 bg-[#e8eef7] shrink-0">
                  <TrendingUp className="h-4 w-4 text-[#1a3f7e]" />
                </div>
                <span className={[
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  isRealData ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400',
                ].join(' ')}>
                  {isRealData ? <Wifi className="h-3 w-3 shrink-0" /> : <Info className="h-3 w-3 shrink-0" />}
                  {isRealData
                    ? (hasAdVolume ? `${platformLabel} 검색광고 API 실측` : `${platformLabel} 검색 API`)
                    : '추정값'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <p className="text-2xl font-bold text-gray-900">
                  {naverLoading
                    ? <span className="text-gray-300 animate-pulse">--</span>
                    : <>{totalSearch !== null ? fmt(totalSearch) : '--'}{searchUnit && <span className="ml-1 text-sm font-normal text-gray-400">{searchUnit}</span>}</>
                  }
                </p>
                {!naverLoading && totalSearch !== null && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(totalSearch))
                      setCopiedSearch(true)
                      setTimeout(() => setCopiedSearch(false), 1500)
                    }}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                    title="클립보드에 복사"
                  >
                    {copiedSearch
                      ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                      : <Copy className="h-3.5 w-3.5" />
                    }
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500">월간 검색량 · 지난달 기준</p>
              <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-400"><Monitor className="h-3 w-3" /> PC</span>
                  <span className="font-semibold text-gray-700">
                    {naverLoading ? <span className="text-gray-300 animate-pulse">--</span> : (totalPC !== null ? fmt(totalPC) : '--')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-400"><Smartphone className="h-3 w-3" /> Mobile</span>
                  <span className="font-semibold text-gray-700">
                    {naverLoading ? <span className="text-gray-300 animate-pulse">--</span> : (totalMobile !== null ? fmt(totalMobile) : '--')}
                  </span>
                </div>
              </div>
            </div>

            {/* 발행량 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex rounded-xl p-2 bg-blue-50 shrink-0">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <span className={[
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  isRealData ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400',
                ].join(' ')}>
                  {isRealData ? <Wifi className="h-3 w-3 shrink-0" /> : <Info className="h-3 w-3 shrink-0" />}
                  {isRealData ? `${platformLabel} 검색 API 실측` : '추정값'}
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{fmt(totalContent)}</p>
              <p className="text-sm text-gray-500">월간 콘텐츠 발행량 · 지난달 기준</p>
              <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                {scaledContentByPlatform.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                    <span className="font-semibold text-gray-700">{fmt(p.count)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 언급량 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex rounded-xl p-2 bg-emerald-50 shrink-0">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                </div>
                <span className={[
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  isRealData ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400',
                ].join(' ')}>
                  {isRealData ? <Wifi className="h-3 w-3 shrink-0" /> : <Info className="h-3 w-3 shrink-0" />}
                  {isRealData ? `${platformLabel} 검색 API 실측` : '추정값'}
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">{fmt(totalMention)}</p>
              <p className="text-sm text-gray-500">플랫폼 언급량 · 월평균</p>
              <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                {primaryData.platformMentions.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                    <span className="font-semibold text-gray-700">{fmt(p.count)}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 키워드 비교 패널 */}
          <div className="rounded-2xl border border-[#b3c2dc] bg-[#e8eef7]/40 p-5">
            <p className="mb-3 text-sm font-semibold text-[#0d1f40]">키워드 비교 분석</p>
            <div className="flex flex-wrap items-center gap-2">
              {/* 주요 키워드 칩 */}
              <span
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: getKeywordColor(keyword, 0) }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                {keyword}
              </span>
              {/* 비교 키워드 칩 */}
              {compareKeywords.map((kw, i) => (
                <span
                  key={kw}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: getKeywordColor(kw, i + 1) }}
                >
                  {compareApiLoading[kw]
                    ? <RefreshCw className="h-3 w-3 animate-spin opacity-80" />
                    : <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                  }
                  {kw}
                  <button type="button" onClick={() => handleRemoveCompare(kw)}
                    className="ml-0.5 opacity-80 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {/* 비교 키워드 추가 입력 */}
              {compareKeywords.length < 4 && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text" value={compareInput}
                    onChange={(e) => setCompareInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCompare()}
                    placeholder="비교 키워드 입력"
                    className="w-32 rounded-xl border border-[#b3c2dc] bg-white px-3 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#1a3f7e] focus:outline-none"
                  />
                  <button type="button" onClick={handleAddCompare} disabled={!compareInput.trim()}
                    className="flex items-center gap-1 rounded-xl bg-[#1a3f7e] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#132d5c] disabled:opacity-40 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                    추가
                  </button>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-[#1a3f7e]">
              검색량 추이·콘텐츠 발행량 차트에서만 비교됩니다. 최대 4개까지 추가할 수 있습니다.
            </p>
          </div>

          {/* 검색량 추이 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">검색량 추이</p>
                  {searchIsYearly && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                      연간 평균
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{searchSec.label} · {platformLabel} 기준</p>
              </div>
              <div className="flex items-center gap-1.5">
                <PeriodTabs value={searchPeriod} onChange={(p) => { setSearchPeriod(p); setSearchShowCustom(false) }} />
                <button type="button" onClick={() => setSearchShowCustom(v => !v)}
                  className={[
                    'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    searchShowCustom ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700',
                  ].join(' ')}>
                  <Calendar className="h-3 w-3" />
                  직접 설정
                </button>
              </div>
            </div>
            {searchShowCustom && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex-1 min-w-[240px]">
                  <DateRangePickerInput
                    from={searchCustomStart}
                    to={searchCustomEnd}
                    onChange={({ from, to }) => { setSearchCustomStart(from); setSearchCustomEnd(to) }}
                    placeholder="시작일 - 종료일 선택"
                  />
                </div>
                {searchSec.customActive && searchSec.months.length === 0 && (
                  <span className="text-xs text-amber-600">선택한 기간의 데이터가 없습니다 (최근 5년만 지원)</span>
                )}
              </div>
            )}
            {isChartLoading
              ? <ChartSkeleton count={searchIsYearly ? PERIOD_COUNT[searchPeriod] / 12 : searchSec.months.length} />
              : <SearchTrendChart
                  series={searchDisplay.series}
                  labels={searchDisplay.labels}
                  isYearly={searchIsYearly}
                  chartType={chartType}
                />
            }
            {/* PC / Mobile 범례 */}
            {isSplit && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 border-t border-gray-100 pt-3">
                {compareKeywords.length === 0 ? (
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <span className="h-2.5 w-5 rounded-sm bg-blue-500 shrink-0" />
                      PC
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <span className="h-2.5 w-5 rounded-sm shrink-0" style={{ backgroundColor: allSeriesData[0]?.color }} />
                      Mobile
                    </span>
                  </>
                ) : (
                  allSeriesData.flatMap(({ keyword: kw, color }) => [
                    <span key={`${kw}-pc`} className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <span className="h-2.5 w-5 rounded-sm bg-blue-500 shrink-0" />
                      {kw} PC
                    </span>,
                    <span key={`${kw}-mo`} className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <span className="h-2.5 w-5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                      {kw} Mobile
                    </span>,
                  ])
                )}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* 콘텐츠 발행량 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">콘텐츠 발행량</p>
                    {contentIsYearly && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                        연간 평균
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {contentSec.label} · {contentIsYearly ? '연간 평균 콘텐츠 수' : '월별 신규 콘텐츠 수'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <PeriodTabs value={contentPeriod} onChange={(p) => { setContentPeriod(p); setContentShowCustom(false) }} />
                  <button type="button" onClick={() => setContentShowCustom(v => !v)}
                    className={[
                      'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      contentShowCustom ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700',
                    ].join(' ')}>
                    <Calendar className="h-3 w-3" />
                    직접 설정
                  </button>
                </div>
              </div>
              {contentShowCustom && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <div className="flex-1 min-w-[200px]">
                    <DateRangePickerInput
                      from={contentCustomStart}
                      to={contentCustomEnd}
                      onChange={({ from, to }) => { setContentCustomStart(from); setContentCustomEnd(to) }}
                      placeholder="시작일 - 종료일 선택"
                    />
                  </div>
                  {contentSec.customActive && contentSec.months.length === 0 && (
                    <span className="text-xs text-amber-600">선택한 기간의 데이터가 없습니다</span>
                  )}
                </div>
              )}
              {isChartLoading
                ? <ChartSkeleton count={contentIsYearly ? PERIOD_COUNT[contentPeriod] / 12 : contentSec.months.length} />
                : <>
                    {chartType === 'bar'
                      ? <MultiBarChart series={contentDisplay.series} labels={contentDisplay.labels} />
                      : <MultiLineChart series={contentDisplay.series} labels={contentDisplay.labels} />
                    }
                    <XAxisLabels labels={contentDisplay.labels} chartType={chartType} />
                  </>
              }
            </div>

            {/* 플랫폼별 언급량 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">플랫폼별 언급량</p>
                  <p className="text-xs text-gray-400">{mentionPeriodLabel} · 주요 채널 노출 분포</p>
                </div>
                <PeriodTabs value={mentionPeriod} onChange={setMentionPeriod} />
              </div>
              <div className="space-y-3">
                {primaryData.platformMentions.map((p) => {
                  const scaledCount = Math.round(p.count * mentionMonthCount / 12)
                  const maxCount = Math.round(primaryData.platformMentions[0].count * mentionMonthCount / 12)
                  const pct = Math.round((scaledCount / Math.max(1, maxCount)) * 100)
                  return (
                    <div key={p.name}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-gray-700">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </span>
                        <span className="text-gray-500">{scaledCount.toLocaleString()}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 연관 키워드 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">연관 키워드</p>
                <p className="text-xs text-gray-400">&ldquo;{keyword}&rdquo; 와 함께 검색되는 키워드 · {relatedPeriodLabel}</p>
              </div>
              <PeriodTabs value={relatedPeriod} onChange={setRelatedPeriod} />
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">키워드</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">검색량 ({relatedPeriodLabel})</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">경쟁도</th>
                  </tr>
                </thead>
                <tbody>
                  {primaryData.relatedKeywords.map((k, i) => {
                    const scaledVol = Math.round(k.volume * relatedMonthCount / 12)
                    return (
                      <tr key={`${k.keyword}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{k.keyword}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {naverLoading ? <span className="text-gray-300 animate-pulse">--</span> : fmt(scaledVol)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COMP_STYLE[k.competition]}`}>
                            {COMP_LABEL[k.competition]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-20 text-center">
          <Grape className="mx-auto mb-4 h-12 w-12 text-[#6b8cc4]" />
          <p className="text-base font-semibold text-gray-400">키워드를 입력해 분석을 시작하세요</p>
          <p className="mt-2 text-sm text-gray-400">
            Naver · Google 기준 검색량, 콘텐츠 발행량, 플랫폼 언급량을 확인할 수 있습니다.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['슈링크', '피부과', '클래시스', '볼뉴머', '홈뷰티'].map((k) => (
              <button key={k} type="button"
                onClick={() => { setInput(k); startTransition(() => setKeyword(k)) }}
                className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm text-gray-600 shadow-sm hover:border-[#8aa3cc] hover:text-[#132d5c] transition-colors">
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 검색어 트렌드 — 인트로 상태에서만 표시 */}
      {!keyword && <DatalabForm />}

    </div>
  )
}
