'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Globe, Settings, RefreshCw,
  Plus, Trash2, ExternalLink, BarChart3,
  CheckCircle2, XCircle, ChevronDown,
} from 'lucide-react'
import type { ScKeyword, ScMentionSummary, ScPost, ScKeywordCategory, ScChannel } from '@/types/database'

type Tab = 'dashboard' | 'trend' | 'channel' | 'settings'

// ── 채널 메타데이터 ────────────────────────────────────────────────
const CHANNEL_META: Record<ScChannel, { label: string; color: string; badge: string; api: 'real' | 'estimated' }> = {
  naver_blog:    { label: '네이버 블로그', color: '#03C75A', badge: 'bg-green-100 text-green-700',  api: 'real' },
  naver_cafe:    { label: '네이버 카페',   color: '#FF6B00', badge: 'bg-orange-100 text-orange-700', api: 'real' },
  naver_news:    { label: '네이버 뉴스',   color: '#1A73E8', badge: 'bg-blue-100 text-blue-700',    api: 'real' },
  instagram:     { label: '인스타그램',    color: '#E1306C', badge: 'bg-pink-100 text-pink-700',    api: 'estimated' },
  youtube:       { label: '유튜브',        color: '#FF0000', badge: 'bg-red-100 text-red-700',      api: 'estimated' },
  twitter:       { label: 'X(트위터)',     color: '#000000', badge: 'bg-gray-100 text-gray-700',    api: 'estimated' },
  facebook:      { label: '페이스북',      color: '#1877F2', badge: 'bg-blue-100 text-blue-700',    api: 'estimated' },
  dcinside:      { label: 'DC인사이드',    color: '#4285F4', badge: 'bg-indigo-100 text-indigo-700', api: 'estimated' },
  ppomppu:       { label: '뽐뿌',          color: '#FF5722', badge: 'bg-orange-100 text-orange-700', api: 'estimated' },
  gangnam_unnie: { label: '강남언니',      color: '#FF69B4', badge: 'bg-rose-100 text-rose-700',    api: 'estimated' },
  babitalk:      { label: '바비톡',        color: '#9C27B0', badge: 'bg-purple-100 text-purple-700', api: 'estimated' },
}

const CHANNEL_ORDER: ScChannel[] = [
  'naver_blog', 'naver_cafe', 'naver_news',
  'instagram', 'youtube', 'twitter', 'facebook',
  'dcinside', 'ppomppu', 'gangnam_unnie', 'babitalk',
]

const CATEGORY_META: Record<ScKeywordCategory, { label: string; badge: string }> = {
  brand:      { label: '브랜드',  badge: 'bg-blue-100 text-blue-700' },
  product:    { label: '제품',    badge: 'bg-green-100 text-green-700' },
  competitor: { label: '경쟁사', badge: 'bg-red-100 text-red-700' },
  general:    { label: '일반',   badge: 'bg-gray-100 text-gray-700' },
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── 대시보드 탭 ────────────────────────────────────────────────────
function DashboardTab({ mentions, keywords }: { mentions: ScMentionSummary[]; keywords: ScKeyword[] }) {
  const totalMentions = mentions.reduce((s, m) => s + m.total, 0)
  const kwMap = new Map(keywords.map(k => [k.id, k]))

  // 채널별 합산
  const channelTotals: Partial<Record<ScChannel, number>> = {}
  for (const m of mentions) {
    for (const [ch, cnt] of Object.entries(m.by_channel)) {
      channelTotals[ch as ScChannel] = (channelTotals[ch as ScChannel] ?? 0) + (cnt as number)
    }
  }
  const maxChannel = Math.max(0, ...Object.values(channelTotals).map(v => v ?? 0))

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="전체 언급량 (7일)" value={fmt(totalMentions)} sub="모든 채널 합산" />
        <KpiCard label="모니터링 키워드" value={String(keywords.filter(k => k.is_active).length)} sub={`전체 ${keywords.length}개`} />
        <KpiCard label="수집 채널" value="11" sub="네이버 실측 · 타 채널 추정" />
      </div>

      {/* 키워드별 언급량 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">키워드별 언급량</h2>
        {mentions.length === 0 ? (
          <EmptyState message="키워드를 추가하고 새로고침을 눌러 데이터를 수집하세요." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">키워드</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">분류</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">총 언급량</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden lg:table-cell">채널 분포</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 hidden sm:table-cell">최근 동기화</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mentions.sort((a, b) => b.total - a.total).map(m => {
                  const kw = kwMap.get(m.keyword_id)
                  const topChannels = CHANNEL_ORDER
                    .filter(ch => (m.by_channel[ch] ?? 0) > 0)
                    .slice(0, 4)
                  return (
                    <tr key={m.keyword_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.keyword}</td>
                      <td className="px-4 py-3">
                        {kw && (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_META[kw.category].badge}`}>
                            {CATEGORY_META[kw.category].label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(m.total)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {topChannels.map(ch => (
                            <span key={ch} className={`rounded-full px-1.5 py-0.5 text-xs ${CHANNEL_META[ch].badge}`}>
                              {CHANNEL_META[ch].label} {fmt(m.by_channel[ch] ?? 0)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400 hidden sm:table-cell">
                        {fmtDate(m.last_synced)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 채널별 분포 */}
      {totalMentions > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">채널별 분포 (7일 합산)</h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2.5">
            {CHANNEL_ORDER.filter(ch => (channelTotals[ch] ?? 0) > 0).map(ch => {
              const cnt = channelTotals[ch] ?? 0
              const pct = maxChannel > 0 ? (cnt / maxChannel) * 100 : 0
              const meta = CHANNEL_META[ch]
              return (
                <div key={ch} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-xs text-gray-600 text-right">{meta.label}</div>
                  <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: meta.color }}
                    />
                  </div>
                  <div className="w-16 text-right text-xs font-medium text-gray-700">{fmt(cnt)}</div>
                  {meta.api === 'estimated' && (
                    <span className="text-xs text-gray-300">추정</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ── 트렌드 분석 탭 ─────────────────────────────────────────────────
function TrendTab({
  mentions, keywords, selectedKeyword, setSelectedKeyword,
}: {
  mentions: ScMentionSummary[]
  keywords: ScKeyword[]
  selectedKeyword: string
  setSelectedKeyword: (v: string) => void
}) {
  const activeMentions = selectedKeyword === 'all'
    ? mentions
    : mentions.filter(m => m.keyword_id === selectedKeyword)

  const mergedByChannel: Partial<Record<ScChannel, number>> = {}
  for (const m of activeMentions) {
    for (const [ch, cnt] of Object.entries(m.by_channel)) {
      mergedByChannel[ch as ScChannel] = (mergedByChannel[ch as ScChannel] ?? 0) + (cnt as number)
    }
  }
  const maxVal = Math.max(0, ...Object.values(mergedByChannel).map(v => v ?? 0))

  const realChannels = CHANNEL_ORDER.filter(ch => CHANNEL_META[ch].api === 'real' && (mergedByChannel[ch] ?? 0) > 0)
  const estChannels = CHANNEL_ORDER.filter(ch => CHANNEL_META[ch].api === 'estimated' && (mergedByChannel[ch] ?? 0) > 0)

  return (
    <div className="space-y-6">
      {/* 키워드 선택 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedKeyword('all')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedKeyword === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체
        </button>
        {keywords.filter(k => k.is_active).map(k => (
          <button
            key={k.id}
            onClick={() => setSelectedKeyword(k.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedKeyword === k.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {k.keyword}
          </button>
        ))}
      </div>

      {activeMentions.length === 0 ? (
        <EmptyState message="키워드를 선택하거나 새로고침하여 데이터를 수집하세요." />
      ) : (
        <>
          {/* 실측 채널 */}
          {realChannels.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-700">포털 실측 데이터</h2>
                <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" /> API 실측
                </span>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                {realChannels.map(ch => {
                  const cnt = mergedByChannel[ch] ?? 0
                  const pct = maxVal > 0 ? (cnt / maxVal) * 100 : 0
                  return (
                    <div key={ch} className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{CHANNEL_META[ch].label}</span>
                        <span className="font-medium">{fmt(cnt)}건</span>
                      </div>
                      <div className="h-5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: CHANNEL_META[ch].color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* 추정 채널 */}
          {estChannels.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-700">SNS · 커뮤니티 추정 데이터</h2>
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                  <XCircle className="h-3 w-3" /> 포털 기준 추정
                </span>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                {estChannels.map(ch => {
                  const cnt = mergedByChannel[ch] ?? 0
                  const pct = maxVal > 0 ? (cnt / maxVal) * 100 : 0
                  return (
                    <div key={ch} className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{CHANNEL_META[ch].label}</span>
                        <span className="font-medium text-gray-400">{fmt(cnt)}건 (추정)</span>
                      </div>
                      <div className="h-4 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 opacity-50"
                          style={{ width: `${pct}%`, backgroundColor: CHANNEL_META[ch].color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                ※ SNS · 커뮤니티 채널은 공식 API 미지원으로 네이버 포털 데이터 기준으로 추정됩니다. 추후 공식 API 연동 시 실측 전환 예정입니다.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ── 채널 탐색 탭 ─────────────────────────────────────────────────
function ChannelTab({
  posts, keywords, selectedChannel, setSelectedChannel, selectedKeyword, setSelectedKeyword,
}: {
  posts: (ScPost & { keyword: string })[]
  keywords: ScKeyword[]
  selectedChannel: string
  setSelectedChannel: (v: string) => void
  selectedKeyword: string
  setSelectedKeyword: (v: string) => void
}) {
  const filtered = posts.filter(p => {
    if (selectedChannel !== 'all' && p.channel !== selectedChannel) return false
    if (selectedKeyword !== 'all' && p.keyword_id !== selectedKeyword) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* 채널 필터 */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={selectedChannel === 'all'} onClick={() => setSelectedChannel('all')} label="전체 채널" />
        {CHANNEL_ORDER.map(ch => (
          <FilterChip
            key={ch}
            active={selectedChannel === ch}
            onClick={() => setSelectedChannel(ch)}
            label={CHANNEL_META[ch].label}
            color={CHANNEL_META[ch].color}
          />
        ))}
      </div>

      {/* 키워드 필터 */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={selectedKeyword === 'all'} onClick={() => setSelectedKeyword('all')} label="모든 키워드" small />
        {keywords.filter(k => k.is_active).map(k => (
          <FilterChip
            key={k.id}
            active={selectedKeyword === k.id}
            onClick={() => setSelectedKeyword(k.id)}
            label={k.keyword}
            small
          />
        ))}
      </div>

      {/* 원문 목록 */}
      {filtered.length === 0 ? (
        <EmptyState message={
          posts.length === 0
            ? '새로고침을 눌러 네이버 블로그 원문을 수집하세요.'
            : '선택한 필터에 해당하는 게시글이 없습니다.'
        } />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">{filtered.length}건 표시 중</p>
          {filtered.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

function PostCard({ post }: { post: ScPost & { keyword: string } }) {
  const meta = CHANNEL_META[post.channel as ScChannel] ?? { label: post.channel, badge: 'bg-gray-100 text-gray-700', api: 'estimated' }
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
            {meta.label}
          </span>
          {post.keyword && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              #{post.keyword}
            </span>
          )}
          {post.sentiment && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              post.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
              post.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {post.sentiment === 'positive' ? '긍정' : post.sentiment === 'negative' ? '부정' : '중립'}
            </span>
          )}
        </div>
        {post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            원문
          </a>
        )}
      </div>
      {post.title && <p className="font-medium text-gray-900 leading-snug">{post.title}</p>}
      {post.content && (
        <p className="text-sm text-gray-500 line-clamp-2">{post.content}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        {post.author && <span>{post.author}</span>}
        {post.published_at && <span>{fmtDate(post.published_at)}</span>}
      </div>
    </div>
  )
}

// ── 설정 탭 ───────────────────────────────────────────────────────
function SettingsTab({
  keywords, newKeyword, setNewKeyword, newCategory, setNewCategory,
  adding, onAdd, onDelete,
}: {
  keywords: ScKeyword[]
  newKeyword: string
  setNewKeyword: (v: string) => void
  newCategory: ScKeywordCategory
  setNewCategory: (v: ScKeywordCategory) => void
  adding: boolean
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      {/* 키워드 추가 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">키워드 추가</h2>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
              placeholder="모니터링할 키워드 입력 (예: 클래시스, 볼뉴머)"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            />
            <div className="relative">
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value as ScKeywordCategory)}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-gray-400"
              >
                {(Object.entries(CATEGORY_META) as [ScKeywordCategory, { label: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            <button
              onClick={onAdd}
              disabled={adding || !newKeyword.trim()}
              className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {adding ? '추가 중...' : '추가'}
            </button>
          </div>
        </div>
      </section>

      {/* 키워드 목록 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          수집 키워드 ({keywords.length}개)
        </h2>
        {keywords.length === 0 ? (
          <EmptyState message="모니터링할 키워드를 추가하세요." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">키워드</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">분류</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">등록일</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keywords.map(k => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{k.keyword}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_META[k.category].badge}`}>
                        {CATEGORY_META[k.category].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs ${k.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${k.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {k.is_active ? '수집 중' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(k.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`"${k.keyword}" 키워드를 삭제하시겠습니까?`)) onDelete(k.id)
                        }}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 데이터 수집 정책 안내 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">데이터 수집 정책</h2>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3 text-sm text-gray-600">
          <PolicyRow
            channel="네이버 블로그 / 카페 / 뉴스"
            status="실측"
            description="Naver Search API — 총 게시글 수 실측 + 최신 원문 5건 수집"
          />
          <PolicyRow
            channel="인스타그램 / 유튜브 / X / 페이스북"
            status="추정"
            description="공식 API 미연동 — 네이버 합산 기준 비례 추정 (향후 연동 예정)"
          />
          <PolicyRow
            channel="DC인사이드 / 뽐뿌"
            status="추정"
            description="공식 API 미지원 — 크롤러 연동 계획 중"
          />
          <PolicyRow
            channel="강남언니 / 바비톡"
            status="추정"
            description="공식 API 협의 중 — 연동 시 실측 전환"
          />
          <p className="pt-1 text-xs text-gray-400">
            • 동기화 주기: 수동 새로고침 또는 1시간마다 서버 캐시 갱신<br />
            • 광고성 게시물 및 중복 도배 글은 포털 API 레벨에서 필터링됨
          </p>
        </div>
      </section>
    </div>
  )
}

function PolicyRow({ channel, status, description }: { channel: string; status: string; description: string }) {
  const isReal = status === '실측'
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${isReal ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
        {status}
      </span>
      <div>
        <p className="font-medium text-gray-700">{channel}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  )
}

// ── 공통 컴포넌트 ──────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{sub}</p>
    </div>
  )
}

function FilterChip({ active, onClick, label, color, small }: {
  active: boolean
  onClick: () => void
  label: string
  color?: string
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-full font-medium transition-colors',
        small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      ].join(' ')}
      style={active && color ? { backgroundColor: color } : undefined}
    >
      {label}
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
      <BarChart3 className="h-8 w-8 text-gray-300 mb-3" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function SomeContentClient() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [keywords, setKeywords] = useState<ScKeyword[]>([])
  const [mentions, setMentions] = useState<ScMentionSummary[]>([])
  const [posts, setPosts] = useState<(ScPost & { keyword: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [selectedKeyword, setSelectedKeyword] = useState('all')
  const [selectedChannel, setSelectedChannel] = useState('all')
  const [newKeyword, setNewKeyword] = useState('')
  const [newCategory, setNewCategory] = useState<ScKeywordCategory>('brand')
  const [adding, setAdding] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [kwRes, mentionRes, postRes] = await Promise.all([
        fetch('/api/some-content/keywords'),
        fetch('/api/some-content/mentions'),
        fetch('/api/some-content/posts'),
      ])
      if (kwRes.ok) setKeywords(await kwRes.json())
      if (mentionRes.ok) {
        const data = await mentionRes.json()
        setMentions(data.mentions ?? [])
        setLastSync(data.last_sync ?? null)
      }
      if (postRes.ok) setPosts(await postRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/some-content/mentions/sync', { method: 'POST' })
      if (res.ok) await fetchAll()
    } finally {
      setSyncing(false)
    }
  }

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/some-content/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword.trim(), category: newCategory }),
      })
      if (res.ok) { setNewKeyword(''); await fetchAll() }
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteKeyword = async (id: string) => {
    const res = await fetch(`/api/some-content/keywords?id=${id}`, { method: 'DELETE' })
    if (res.ok) await fetchAll()
  }

  const TABS = [
    { key: 'dashboard' as Tab, label: '대시보드',   icon: BarChart3 },
    { key: 'trend'     as Tab, label: '트렌드 분석', icon: TrendingUp },
    { key: 'channel'   as Tab, label: '채널 탐색',  icon: Globe },
    { key: 'settings'  as Tab, label: '설정',       icon: Settings },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">썸콘텐츠</h1>
            <p className="mt-0.5 text-sm text-gray-500">소셜 빅데이터 인사이트 플랫폼</p>
          </div>
          <div className="flex items-center gap-3">
            {lastSync && (
              <span className="hidden text-xs text-gray-400 sm:inline">
                동기화: {fmtDate(lastSync)}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '동기화 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="mt-4 flex gap-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={[
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab mentions={mentions} keywords={keywords} />
            )}
            {activeTab === 'trend' && (
              <TrendTab
                mentions={mentions}
                keywords={keywords}
                selectedKeyword={selectedKeyword}
                setSelectedKeyword={setSelectedKeyword}
              />
            )}
            {activeTab === 'channel' && (
              <ChannelTab
                posts={posts}
                keywords={keywords}
                selectedChannel={selectedChannel}
                setSelectedChannel={setSelectedChannel}
                selectedKeyword={selectedKeyword}
                setSelectedKeyword={setSelectedKeyword}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                keywords={keywords}
                newKeyword={newKeyword}
                setNewKeyword={setNewKeyword}
                newCategory={newCategory}
                setNewCategory={setNewCategory}
                adding={adding}
                onAdd={handleAddKeyword}
                onDelete={handleDeleteKeyword}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
