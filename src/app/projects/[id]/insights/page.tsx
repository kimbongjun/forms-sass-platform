'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  BarChart3,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  Newspaper,
  RefreshCw,
  Share2,
  TrendingUp,
} from 'lucide-react'
import { HeaderSkeleton, SectionSkeleton, SkeletonBlock, StatCardSkeleton } from '@/components/common/LoadingSkeleton'

type Platform = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'twitter' | 'other'

interface Deliverable {
  id: string
  platform: Platform
  title: string
  url: string
  views: number
  likes: number
  comments: number
  shares: number
  last_synced_at: string | null
}

interface Clipping {
  id: string
  title: string
  url: string
  source: string | null
  published_at: string | null
  description: string | null
}

const CACHE_TTL_MS = 60 * 60 * 1000

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  other: '기타',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  youtube: 'bg-red-100 text-red-700',
  tiktok: 'bg-gray-900 text-white',
  facebook: 'bg-blue-100 text-blue-700',
  twitter: 'bg-sky-100 text-sky-700',
  other: 'bg-gray-100 text-gray-600',
}

function formatNum(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString('ko-KR')
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d))
}

function formatSyncTime(d: string | null) {
  if (!d) return '-'
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

export default function InsightsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [clippings, setClippings] = useState<Clipping[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastFetchedAt = useRef<number | null>(null)

  const fetchData = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && lastFetchedAt.current && now - lastFetchedAt.current < CACHE_TTL_MS) return
    if (force) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [dRes, cRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/deliverables`),
        fetch(`/api/projects/${projectId}/clippings`),
      ])
      if (!dRes.ok || !cRes.ok) throw new Error('데이터를 불러오지 못했습니다.')
      const [d, c] = await Promise.all([dRes.json(), cRes.json()])
      setDeliverables(d)
      setClippings(c)
      lastFetchedAt.current = Date.now()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), CACHE_TTL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  // 집계
  const totalViews = deliverables.reduce((s, d) => s + d.views, 0)
  const totalLikes = deliverables.reduce((s, d) => s + d.likes, 0)
  const totalComments = deliverables.reduce((s, d) => s + d.comments, 0)
  const totalShares = deliverables.reduce((s, d) => s + d.shares, 0)
  const totalEngagement = totalLikes + totalComments + totalShares

  // 플랫폼별 집계
  const byPlatform = deliverables.reduce<Record<string, { views: number; engagement: number; count: number }>>((acc, d) => {
    if (!acc[d.platform]) acc[d.platform] = { views: 0, engagement: 0, count: 0 }
    acc[d.platform].views += d.views
    acc[d.platform].engagement += d.likes + d.comments + d.shares
    acc[d.platform].count += 1
    return acc
  }, {})

  // 인게이지먼트율 (조회수 대비 인게이지먼트)
  const engagementRate = totalViews > 0 ? ((totalEngagement / totalViews) * 100).toFixed(2) : '0.00'

  const lastSynced = deliverables.reduce<string | null>((latest, d) => {
    if (!d.last_synced_at) return latest
    if (!latest) return d.last_synced_at
    return d.last_synced_at > latest ? d.last_synced_at : latest
  }, null)

  const kpiCards = [
    { label: '전체 조회 / 노출', value: formatNum(totalViews), icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '전체 인게이지먼트', value: formatNum(totalEngagement), icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: '인게이지먼트율', value: `${engagementRate}%`, icon: BarChart3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '보도자료 노출', value: `${clippings.length}건`, icon: Newspaper, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  const loadingSkeleton = (
      <div className="space-y-6">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SkeletonBlock className="h-5 w-36" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl bg-gray-50 p-4">
              <SkeletonBlock className="h-4 w-12" />
              <SkeletonBlock className="mt-3 h-6 w-20" />
            </div>
          ))}
        </div>
      </section>
      <SectionSkeleton titleWidth="w-40" lines={5} />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">운영 결과 보고서</h2>
          <p className="mt-0.5 text-sm text-gray-400">
            산출물 전체의 SNS 합산 지표 및 미디어 노출 현황을 한눈에 확인합니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {lastSynced && (
            <p className="text-xs text-gray-400">마지막 갱신: {formatSyncTime(lastSynced)}</p>
          )}
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw className={['h-4 w-4', refreshing ? 'animate-spin' : ''].join(' ')} />
            새로고침
          </button>
        </div>
      </div>

      {loading && loadingSkeleton}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && (
        <>
          {/* KPI 카드 */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className={`mb-3 inline-flex rounded-xl p-2 ${card.bg}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{card.value}</p>
                </div>
              )
            })}
          </div>

          {/* 세부 인게이지먼트 분해 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">인게이지먼트 상세</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: '좋아요', value: totalLikes, icon: Heart, color: 'text-pink-500' },
                { label: '댓글', value: totalComments, icon: MessageCircle, color: 'text-blue-500' },
                { label: '공유', value: totalShares, icon: Share2, color: 'text-violet-500' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                    <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                    <div>
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className="text-xl font-semibold text-gray-900">{formatNum(item.value)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 플랫폼별 분석 */}
          {Object.keys(byPlatform).length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">플랫폼별 성과</h3>
              <div className="space-y-3">
                {Object.entries(byPlatform)
                  .sort((a, b) => b[1].views - a[1].views)
                  .map(([platform, stats]) => {
                    const maxViews = Math.max(...Object.values(byPlatform).map((s) => s.views), 1)
                    const pct = Math.round((stats.views / maxViews) * 100)
                    return (
                      <div key={platform}>
                        <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLATFORM_COLORS[platform as Platform]}`}>
                              {PLATFORM_LABELS[platform as Platform]}
                            </span>
                            <span className="text-xs text-gray-400">{stats.count}건</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 sm:justify-end">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5 text-gray-400" />
                              {formatNum(stats.views)}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
                              {formatNum(stats.engagement)}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gray-700 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* 주요 보도자료 */}
          {clippings.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">주요 보도자료 및 클리핑</h3>
                <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                  총 {clippings.length}건
                </span>
              </div>
              <ol className="space-y-2.5">
                {clippings.map((c, i) => (
                  <li key={c.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.source && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                            {c.source}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(c.published_at)}</span>
                      </div>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 flex items-center gap-1 text-sm font-medium text-gray-800 hover:text-gray-600"
                      >
                        {c.title}
                        <ExternalLink className="h-3 w-3 shrink-0 text-gray-400" />
                      </a>
                      {c.description && (
                        <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{c.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 산출물 없을 때 */}
          {deliverables.length === 0 && clippings.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 text-center">
              <BarChart3 className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-base font-medium text-gray-500">아직 데이터가 없습니다.</p>
              <p className="mt-1 text-sm text-gray-400">산출물 관리 또는 보도자료 클리핑에서 데이터를 먼저 등록하세요.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
