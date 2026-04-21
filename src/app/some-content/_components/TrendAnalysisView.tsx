'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  Download, Sparkles, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import type { ScKeyword } from '@/types/database'
import type { TrendResult } from '@/app/api/some-content/trend/route'
import type { SentimentResult, SentimentWord } from '@/app/api/some-content/sentiment/route'
import type { InsightsResult } from '@/app/api/some-content/insights/route'

const KeywordMindMap = dynamic(() => import('./KeywordMindMap'), { ssr: false })

// ─────────────────────────────────────────────
// Recharts 커스텀 툴팁
// ─────────────────────────────────────────────
function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-gray-900 px-4 py-2.5 shadow-xl ring-1 ring-white/10">
      <p className="text-xs font-semibold text-gray-300">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-white">검색지수 {payload[0].value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────
// 지표 카드
// ─────────────────────────────────────────────
function MetricCard({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent?: string; icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {icon && <span className="text-gray-300">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold leading-none ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────
// 감성 워드 클라우드 (크게 재디자인)
// ─────────────────────────────────────────────
function WordCloud({ words, baseColor, emptyMsg }: {
  words: SentimentWord[]
  baseColor: string
  emptyMsg?: string
}) {
  if (!words.length) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-gray-400">{emptyMsg ?? '게시글 수집 후 분석됩니다'}</p>
        <p className="text-xs text-gray-300">설정 탭 → 새로고침으로 데이터를 수집하세요</p>
      </div>
    )
  }
  const maxW = Math.max(1, ...words.map(w => w.weight))
  const sorted = [...words].sort((a, b) => b.weight - a.weight)

  return (
    <div className="flex min-h-[160px] flex-wrap items-center justify-center gap-x-3 gap-y-2 p-4">
      {sorted.map((w) => {
        const ratio = w.weight / maxW
        const size = 13 + Math.round(ratio * 42) // 13–55px
        const opacity = 0.35 + ratio * 0.65
        const weight = ratio > 0.7 ? 800 : ratio > 0.45 ? 700 : 600
        return (
          <span
            key={w.word}
            title={`가중치 ${w.weight}`}
            className="cursor-default leading-tight transition-transform duration-150 hover:scale-110"
            style={{ fontSize: `${size}px`, color: baseColor, opacity, fontWeight: weight }}
          >
            {w.word}
          </span>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// AI 인사이트 패널 (Groq)
// ─────────────────────────────────────────────
function InsightsPanel({
  keyword, trendData, sentimentData,
}: {
  keyword: string
  trendData: TrendResult | null
  sentimentData: SentimentResult | null
}) {
  const [insights, setInsights] = useState<InsightsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    if (!trendData && !sentimentData) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/some-content/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword,
          metrics: trendData?.metrics,
          sentimentSummary: sentimentData?.summary,
          positive: sentimentData?.positive?.slice(0, 5),
          negative: sentimentData?.negative?.slice(0, 5),
        }),
      })
      if (res.ok) setInsights(await res.json())
      else {
        const d = await res.json() as { error?: string }
        setError(d.error ?? '분석 오류')
      }
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }, [keyword, trendData, sentimentData])

  useEffect(() => { run() }, [run])

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h2 className="text-base font-bold text-gray-900">AI 종합 인사이트</h2>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
            Groq · Llama 3.3
          </span>
        </div>
        {!loading && (trendData || sentimentData) && (
          <button
            onClick={run}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-violet-600 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> 재분석
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white p-6">
        {loading ? (
          <div className="flex items-center gap-3 py-6 text-sm text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin text-violet-400" />
            <span>Groq AI가 트렌드·감성 데이터를 분석하고 있습니다...</span>
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-gray-400">{error}</p>
        ) : insights ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {insights.trend_summary && (
              <div className="lg:col-span-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">트렌드 요약</p>
                <p className="text-sm leading-relaxed text-gray-700">{insights.trend_summary}</p>
              </div>
            )}
            {insights.opportunities?.length > 0 && (
              <div className="rounded-xl bg-green-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-green-700">기회 요인</p>
                <ul className="space-y-1.5">
                  {insights.opportunities.map((o, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 shrink-0 text-green-500">▸</span>{o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insights.risks?.length > 0 && (
              <div className="rounded-xl bg-red-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-600">리스크</p>
                <ul className="space-y-1.5">
                  {insights.risks.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 shrink-0 text-red-400">▸</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insights.recommendations?.length > 0 && (
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">추천 액션</p>
                <ul className="space-y-1.5">
                  {insights.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 shrink-0 text-blue-500">▸</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-gray-400">
            트렌드와 감성 데이터가 수집되면 AI 인사이트를 자동 생성합니다
          </p>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────
// CSV 유틸
// ─────────────────────────────────────────────
function downloadCSV(filename: string, rows: (string | number)[][]) {
  const bom = '\uFEFF'
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function TrendAnalysisView({ keywords }: { keywords: ScKeyword[] }) {
  const activeKws = keywords.filter(k => k.is_active)
  const [selectedId, setSelectedId] = useState<string>(activeKws[0]?.id ?? '')
  const [trendData, setTrendData] = useState<TrendResult | null>(null)
  const [sentimentData, setSentimentData] = useState<SentimentResult | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [sentimentLoading, setSentimentLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)

  const selected = activeKws.find(k => k.id === selectedId) ?? activeKws[0]
  const selId = selected?.id ?? ''
  const selKw = selected?.keyword ?? ''

  useEffect(() => {
    if (!selKw) return
    setTrendData(null); setTrendError(null); setTrendLoading(true)
    fetch(`/api/some-content/trend?keyword=${encodeURIComponent(selKw)}`)
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? '오류')))
      .then((d: TrendResult) => setTrendData(d))
      .catch((e: unknown) => setTrendError(String(e)))
      .finally(() => setTrendLoading(false))
  }, [selId, selKw])

  useEffect(() => {
    if (!selId || !selKw) return
    setSentimentData(null); setSentimentLoading(true)
    fetch(`/api/some-content/sentiment?keyword_id=${selId}&keyword=${encodeURIComponent(selKw)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: SentimentResult | null) => setSentimentData(d))
      .finally(() => setSentimentLoading(false))
  }, [selId, selKw])

  const handleExportCSV = () => {
    const date = new Date().toISOString().slice(0, 10)
    const rows: (string | number)[][] = []
    if (trendData) {
      rows.push(['[검색량 트렌드]', '', '']); rows.push(['월', '레이블', '검색지수'])
      for (const p of trendData.points) rows.push([p.month, p.label, p.value])
      if (trendData.metrics) {
        const m = trendData.metrics; rows.push(['', '', '']); rows.push(['[트렌드 지표]', '', ''])
        rows.push(['방향', m.trend === 'up' ? '상승세' : m.trend === 'down' ? '하락세' : '보합세', ''])
        rows.push(['성장률', `${m.growthRate}%`, '']); rows.push(['변동성', `${m.volatility}%`, ''])
        rows.push(['전체 평균', m.avg, '']); rows.push(['최근 3개월', m.recent3Avg, ''])
      }
    }
    if (sentimentData) {
      rows.push(['', '', '']); rows.push(['[감성 분석]', '', '']); rows.push(['감성', '키워드', '가중치'])
      for (const w of sentimentData.positive)  rows.push(['긍정', w.word, w.weight])
      for (const w of sentimentData.negative)  rows.push(['부정', w.word, w.weight])
      for (const w of sentimentData.neutral)   rows.push(['중립', w.word, w.weight])
    }
    if (rows.length === 0) return
    downloadCSV(`썸콘텐츠_${selKw}_${date}.csv`, rows)
  }

  if (activeKws.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-24">
        <p className="text-sm text-gray-400">설정 탭에서 키워드를 추가하세요.</p>
      </div>
    )
  }

  const m = trendData?.metrics
  const trendColor = m?.trend === 'up' ? '#10B981' : m?.trend === 'down' ? '#EF4444' : '#6B7280'

  return (
    <div className="space-y-10">

      {/* ── 키워드 선택 + CSV ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {activeKws.map(k => (
            <button
              key={k.id}
              onClick={() => setSelectedId(k.id)}
              className={[
                'rounded-full px-5 py-2 text-sm font-semibold transition-all',
                (selectedId === k.id || (!selectedId && k === activeKws[0]))
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ].join(' ')}
            >
              {k.keyword}
            </button>
          ))}
        </div>
        {(trendData || sentimentData) && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            CSV 내보내기
          </button>
        )}
      </div>

      {/* ── SECTION 1: 연관어 마인드맵 ── */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-gray-900">연관어 마인드맵</h2>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
            Naver 검색광고 API · 실시간
          </span>
        </div>
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm" style={{ minHeight: '560px' }}>
          {selected && <KeywordMindMap centerKeyword={selected.keyword} />}
        </div>
        <p className="mt-3 text-center text-xs text-gray-400">
          노드 클릭 시 해당 키워드로 탐색 · 검색량 기준 노드 크기 · 전체화면 버튼으로 크게 보기
        </p>
      </section>

      {/* ── SECTION 2: 검색량 트렌드 ── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-gray-900">검색량 트렌드</h2>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
              Naver DataLab · 최근 12개월 상대지수
            </span>
          </div>
          {m && (
            <div className={[
              'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold',
              m.trend === 'up'   ? 'bg-green-100 text-green-700' :
              m.trend === 'down' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600',
            ].join(' ')}>
              {m.trend === 'up'   ? <TrendingUp className="h-4 w-4" /> :
               m.trend === 'down' ? <TrendingDown className="h-4 w-4" /> :
               <Minus className="h-4 w-4" />}
              {m.trend === 'up' ? '상승세' : m.trend === 'down' ? '하락세' : '보합세'}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          {trendLoading ? (
            <div className="flex h-[300px] items-center justify-center gap-3 text-gray-400">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-sm">Naver DataLab 조회 중...</span>
            </div>
          ) : trendError ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">{trendError}</div>
          ) : trendData ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData.points} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={trendColor} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={trendColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }} />
                {m && (
                  <ReferenceLine
                    y={m.avg}
                    stroke="#9CA3AF"
                    strokeDasharray="4 3"
                    label={{ value: `평균 ${m.avg}`, position: 'right', fontSize: 10, fill: '#9CA3AF' }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={trendColor}
                  strokeWidth={2.5}
                  fill="url(#trendFill)"
                  dot={{ r: 3.5, fill: trendColor, strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: trendColor, stroke: 'white', strokeWidth: 2.5 }}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>

        {m && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="최고 검색지수" value={String(m.max)} sub={m.maxMonth} />
            <MetricCard label="최저 검색지수" value={String(m.min)} sub={m.minMonth} />
            <MetricCard label="12개월 평균" value={String(m.avg)} />
            <MetricCard label="최근 3개월 평균" value={String(m.recent3Avg)} sub={`직전 3개월 ${m.prev3Avg}`} />
            <MetricCard
              label="성장률"
              value={`${m.growthRate > 0 ? '+' : ''}${m.growthRate}%`}
              sub="최근 vs 직전 3개월"
              accent={m.growthRate > 5 ? 'text-green-600' : m.growthRate < -5 ? 'text-red-500' : 'text-gray-700'}
              icon={m.growthRate > 0 ? <ArrowUpRight className="h-4 w-4 text-green-500" /> : m.growthRate < 0 ? <ArrowDownRight className="h-4 w-4 text-red-400" /> : undefined}
            />
            <MetricCard
              label="변동성"
              value={`${m.volatility}%`}
              sub="최고·최저 진폭"
              accent={m.volatility > 60 ? 'text-orange-500' : m.volatility > 30 ? 'text-amber-500' : 'text-gray-700'}
            />
          </div>
        )}
      </section>

      {/* ── SECTION 3: 감성 키워드 분석 ── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-gray-900">감성 키워드 분석</h2>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
              Groq AI · {sentimentData?.total_posts ? `${sentimentData.total_posts}건 게시글 분석` : '게시글 수집 필요'}
            </span>
          </div>
        </div>

        {sentimentLoading ? (
          <div className="flex h-[240px] items-center justify-center gap-3 rounded-3xl border border-gray-200 bg-white text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">AI 감성 분석 중...</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* 긍정 */}
              <div className="rounded-3xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50/30 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white">
                    <span className="text-xs font-bold">+</span>
                  </div>
                  <h3 className="text-base font-bold text-green-900">긍정 키워드</h3>
                  {sentimentData?.positive?.length ? (
                    <span className="ml-auto text-xs text-green-600">{sentimentData.positive.length}개</span>
                  ) : null}
                </div>
                <WordCloud words={sentimentData?.positive ?? []} baseColor="#16a34a" />
              </div>
              {/* 부정 */}
              <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50/30 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white">
                    <span className="text-xs font-bold">−</span>
                  </div>
                  <h3 className="text-base font-bold text-red-900">부정 키워드</h3>
                  {sentimentData?.negative?.length ? (
                    <span className="ml-auto text-xs text-red-600">{sentimentData.negative.length}개</span>
                  ) : null}
                </div>
                <WordCloud words={sentimentData?.negative ?? []} baseColor="#dc2626" />
              </div>
            </div>

            {sentimentData?.summary && (
              <div className="rounded-2xl border border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                  AI 감성 요약
                </p>
                <p className="text-sm leading-relaxed text-gray-700">{sentimentData.summary}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── SECTION 4: AI 종합 인사이트 ── */}
      <InsightsPanel keyword={selKw} trendData={trendData} sentimentData={sentimentData} />

    </div>
  )
}
