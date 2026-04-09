'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import {
  Search, TrendingUp, FileText, MessageSquare, RefreshCw, Grape,
  Download, Monitor, Smartphone, Calendar, Plus, X, Info, Wifi, WifiOff, Copy, Check,
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

// ── 동적 월 라벨 (현재 달 기준 최근 N개월) ─────────────────────
function getMonthLabels(count: number): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('ko-KR', { month: 'short' }).format(d),
    })
  }
  return result
}

const ALL_MONTHS = getMonthLabels(12)

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

type Period = '1y' | '3m' | '1m'

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
function generateData(keyword: string, platform: 'naver' | 'google'): KeywordData {
  const seed = hashStr(keyword + platform) // keyword 고정 → 항상 동일 결과

  const baseSearch = platform === 'naver' ? 20000 + (seed % 80000) : 5000 + (seed % 30000)
  const searchVolume = Array.from({ length: 12 }, (_, i) => {
    const seasonal = Math.sin((i / 12) * Math.PI * 2) * 0.25
    const noise = seededRand(seed, i) * 0.4 - 0.2
    return Math.max(500, Math.round(baseSearch * (1 + seasonal + noise)))
  })

  const pcRatio = 0.38 + seededRand(seed, 20) * 0.24
  const searchVolumePC = searchVolume.map((v, i) => {
    const r = Math.min(0.8, Math.max(0.2, pcRatio + (seededRand(seed + 5, i) - 0.5) * 0.1))
    return Math.round(v * r)
  })
  const searchVolumeMobile = searchVolume.map((v, i) => v - searchVolumePC[i])

  const baseContent = platform === 'naver' ? 1000 + (seed % 8000) : 300 + (seed % 3000)
  const contentVolume = Array.from({ length: 12 }, (_, i) => {
    const noise = seededRand(seed + 1, i) * 0.5 - 0.2
    return Math.max(50, Math.round(baseContent * (1 + noise)))
  })

  const contentPlatformDefs = platform === 'naver'
    ? [{ name: '블로그', color: '#03C75A' }, { name: '카페', color: '#FF6B00' },
       { name: '쇼핑', color: '#E91E63' }, { name: '지식iN', color: '#FFC107' }]
    : [{ name: '웹사이트', color: '#1A73E8' }, { name: '뉴스', color: '#EA4335' },
       { name: '유튜브', color: '#FF0000' }, { name: '이미지', color: '#34A853' }]

  const latestContent = contentVolume[11]
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

    // 목업 계절 패턴을 유지하면서 실측 월간 평균값으로 스케일
    const scaleToMonthlyAvg = (arr: number[], monthlyVal: number) => {
      const arrSum = arr.reduce((s, v) => s + v, 0) || 1
      const scaled = arr.map((v) => Math.round((v / arrSum) * 12 * monthlyVal))
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

    // 콘텐츠 발행량: contentByPlatform 합계를 contentVolume에 반영
    const totalContent = cp.reduce((s, p) => s + p.count, 0)
    const contentVolume = scaleToMonthlyAvg(mock.contentVolume, totalContent || mock.contentVolume[11])

    return {
      ...mock,
      searchVolume,
      searchVolumePC,
      searchVolumeMobile,
      contentVolume,
      relatedKeywords,
      contentByPlatform: cp.length ? cp : mock.contentByPlatform,
      platformMentions: cp.length ? cp : mock.platformMentions,
      isReal: true,
      hasAdVolume: hasAdVol,
    }
  }
  return { ...mock, isReal: false, hasAdVolume: false }
}

// ── 섹션별 기간 계산 헬퍼 ──────────────────────────────────────────
function calcSection(
  p: Period,
  showCustom: boolean,
  customStart: string,
  customEnd: string,
) {
  const PERIOD_COUNT: Record<Period, number> = { '1y': 12, '3m': 3, '1m': 1 }
  const customActive = showCustom && !!customStart && !!customEnd && customStart <= customEnd
  const months = customActive
    ? ALL_MONTHS.filter(m => m.key >= customStart.slice(0, 7) && m.key <= customEnd.slice(0, 7))
    : ALL_MONTHS.slice(12 - PERIOD_COUNT[p])
  const indices = months
    .map(m => ALL_MONTHS.findIndex(am => am.key === m.key))
    .filter(i => i >= 0)
  const label = customActive && months.length > 0
    ? `${customStart.slice(0, 7)} ~ ${customEnd.slice(0, 7)}`
    : p === '1y' ? '지난 1년' : p === '3m' ? '지난 3개월' : '지난달'
  return { months, indices, label, customActive }
}

// ── 간단 기간 탭 (사용자 정의 날짜 없음) ─────────────────────────
function PeriodTabs({
  value, onChange,
}: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
      {(['1y', '3m', '1m'] as const).map((p) => (
        <button key={p} type="button" onClick={() => onChange(p)}
          className={[
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            value === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}>
          {p === '1y' ? '1년' : p === '3m' ? '3개월' : '1개월'}
        </button>
      ))}
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
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

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
        <ChartTooltip tooltip={tooltip} containerWidth={containerRef.current?.offsetWidth ?? 0} />
      )}
    </div>
  )
}

// ── 다중 라인 차트 (hover tooltip + 수직선) ─────────────────────
function MultiLineChart({ series, labels }: { series: ChartSeries[]; labels: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

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
        <ChartTooltip tooltip={tooltip} containerWidth={containerRef.current?.offsetWidth ?? 0} />
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
  const [contentPeriod, setContentPeriod] = useState<Period>('1y')
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

  // 주요 키워드 데이터
  const mockPrimary = keyword ? generateData(keyword, platform) : null
  const primaryData = mockPrimary ? resolveAdData(mockPrimary, platform, naverApiData) : null
  const isRealData = primaryData?.isReal ?? false
  const hasAdVolume = (primaryData as (KeywordData & { hasAdVolume?: boolean }) | null)?.hasAdVolume ?? false

  // 비교 포함 전체 시리즈 — 비교 키워드도 실측 API 데이터 적용
  const allKeywords = keyword ? [keyword, ...compareKeywords] : []
  const allSeriesData = allKeywords.map((kw, i) => {
    const mock = generateData(kw, platform)
    const apiData = kw === keyword ? naverApiData : (compareApiData[kw] ?? null)
    const resolved = resolveAdData(mock, platform, apiData)
    return { keyword: kw, data: resolved, color: getKeywordColor(kw, i) }
  })

  // 섹션별 기간 계산
  const searchSec = calcSection(searchPeriod, searchShowCustom, searchCustomStart, searchCustomEnd)
  const contentSec = calcSection(contentPeriod, contentShowCustom, contentCustomStart, contentCustomEnd)
  const PERIOD_COUNT: Record<Period, number> = { '1y': 12, '3m': 3, '1m': 1 }
  const mentionMonthCount = PERIOD_COUNT[mentionPeriod]
  const mentionPeriodLabel = mentionPeriod === '1y' ? '지난 1년' : mentionPeriod === '3m' ? '지난 3개월' : '지난달'
  const relatedMonthCount = PERIOD_COUNT[relatedPeriod]
  const relatedPeriodLabel = relatedPeriod === '1y' ? '지난 1년' : relatedPeriod === '3m' ? '지난 3개월' : '지난달'

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
      compareKeywords.forEach(kw => fetchCompareApi(kw))
    } else {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  function fetchCompareApi(kw: string) {
    if (platform !== 'naver') return
    setCompareApiLoading(prev => ({ ...prev, [kw]: true }))
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
  }

  function handleExport() {
    if (!primaryData || !keyword) return
    downloadCsv(
      buildCsv(keyword, platform === 'naver' ? 'Naver' : 'Google', primaryData),
      `blueberry_${keyword}_${platform}_${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  const platformLabel = platform === 'naver' ? 'Naver' : 'Google'

  // ── KPI 카드: 항상 월간(지난달) 고정 ─────────────────────────────
  // 검색광고 API 실측이 있을 때 KPI는 "전월 월간 검색량" 고정 표시 (Ad Center와 동일 기준)
  const adMonthlyPC     = naverApiData?.monthlyPcQcCnt ?? null
  const adMonthlyMobile = naverApiData?.monthlyMobileQcCnt ?? null
  const hasAdVolume_kpi = hasAdVolume && adMonthlyPC !== null && adMonthlyMobile !== null
  // 네이버 로딩 중에는 null로 처리 → "--" 표시 (mock값이 잠깐 보이는 플리커 방지)
  const naverLoading = platform === 'naver' && apiLoading
  const totalSearch  = naverLoading ? null : hasAdVolume_kpi ? (adMonthlyPC! + adMonthlyMobile!) : primaryData ? (primaryData.searchVolume[11] ?? 0) : 0
  const totalPC      = naverLoading ? null : hasAdVolume_kpi ? adMonthlyPC!  : primaryData ? (primaryData.searchVolumePC[11] ?? 0) : 0
  const totalMobile  = naverLoading ? null : hasAdVolume_kpi ? adMonthlyMobile! : primaryData ? (primaryData.searchVolumeMobile[11] ?? 0) : 0
  // 발행량·언급량도 월간(index 11) 고정
  const totalContent = primaryData ? (primaryData.contentVolume[11] ?? 0) : 0
  const totalMention = primaryData
    ? Math.round(primaryData.platformMentions.reduce((s, p) => s + p.count, 0) / 12)
    : 0

  // 실측 데이터는 contentByPlatform이 이미 실측값이므로 그대로 사용
  const scaledContentByPlatform = primaryData?.contentByPlatform ?? []

  const searchUnit = ''

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-1.5">
            <Grape className="h-3.5 w-3.5 text-[#1a3f7e]" />
            블루베리 / 키워드 인사이트
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">키워드 분석</h1>
          <p className="mt-1 text-sm text-gray-500">
            키워드를 입력하면 검색량·콘텐츠 발행량·플랫폼 언급량을 분석합니다.
          </p>
          {/* API 연동 상태 표시 (Naver 전용) */}
          {platform === 'naver' && (
            <div className="mt-2 flex items-center gap-1.5">
              {!apiConfigured ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  <WifiOff className="h-3 w-3" />
                  Naver API 미설정 — 추정 데이터
                </span>
              ) : apiLoading ? (
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Naver 실측 데이터 로딩 중…
                </span>
              ) : isRealData ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  <Wifi className="h-3 w-3" />
                  {hasAdVolume
                    ? 'Naver 검색광고 · 검색 API 연동됨'
                    : 'Naver 검색 API 연동됨'}
                </span>
              ) : null}
            </div>
          )}
        </div>
        {keyword && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExport}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              <Download className="h-3.5 w-3.5" />
              CSV 내보내기
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

      {/* 결과 */}
      {primaryData && keyword ? (
        <div className="space-y-6">

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
              <p className="text-sm text-gray-500">콘텐츠 발행량 · 지난달 기준</p>
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
                <p className="text-sm font-semibold text-gray-900">검색량 추이</p>
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
                  <span className="text-xs text-amber-600">선택한 기간의 데이터가 없습니다 (최근 12개월만 지원)</span>
                )}
              </div>
            )}
            {chartType === 'bar'
              ? <MultiBarChart series={searchSeries} labels={searchSec.months.map((m) => m.label)} />
              : <MultiLineChart series={searchSeries} labels={searchSec.months.map((m) => m.label)} />
            }
            {/* PC / Mobile 범례 — split 모드일 때 차트 바로 아래 중앙 표시 */}
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
            <div className="mt-3 flex justify-between text-[10px] text-gray-400">
              {searchSec.months.map((m) => <span key={m.key}>{m.label}</span>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 콘텐츠 발행량 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">콘텐츠 발행량</p>
                  <p className="text-xs text-gray-400">{contentSec.label} · 월별 신규 콘텐츠 수</p>
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
              {chartType === 'bar'
                ? <MultiBarChart series={contentSeries} labels={contentSec.months.map((m) => m.label)} />
                : <MultiLineChart series={contentSeries} labels={contentSec.months.map((m) => m.label)} />
              }
              <div className="mt-3 flex justify-between text-[10px] text-gray-400">
                {contentSec.months.map((m) => <span key={m.key}>{m.label}</span>)}
              </div>
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
                      <tr key={k.keyword} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
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

      {/* 검색어 트렌드 — Naver Datalab */}
      <DatalabForm />

    </div>
  )
}
