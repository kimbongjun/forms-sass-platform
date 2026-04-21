'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, Globe, Settings, RefreshCw,
  Plus, Trash2, ExternalLink, BarChart3,
  CheckCircle2, XCircle, ChevronDown,
  Download, ChevronUp, Cpu, AlertCircle, Info,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ScKeyword, ScMentionSummary, ScPost, ScKeywordCategory, ScChannel } from '@/types/database'

const TrendAnalysisView = dynamic(() => import('./TrendAnalysisView'), { ssr: false })

type Tab = 'dashboard' | 'trend' | 'channel' | 'settings'

// ── 채널 메타데이터 ────────────────────────────────────────────────
type DataSource = 'real' | 'crawled' | 'estimated'

const CHANNEL_META: Record<ScChannel, { label: string; color: string; badge: string; source: DataSource }> = {
  naver_blog:    { label: '네이버 블로그', color: '#03C75A', badge: 'bg-green-100 text-green-700',   source: 'real' },
  naver_cafe:    { label: '네이버 카페',   color: '#FF6B00', badge: 'bg-orange-100 text-orange-700', source: 'real' },
  naver_news:    { label: '네이버 뉴스',   color: '#1A73E8', badge: 'bg-blue-100 text-blue-700',     source: 'real' },
  youtube:       { label: '유튜브',        color: '#FF0000', badge: 'bg-red-100 text-red-700',       source: 'real' },
  dcinside:      { label: 'DC인사이드',    color: '#4285F4', badge: 'bg-indigo-100 text-indigo-700', source: 'crawled' },
  ppomppu:       { label: '뽐뿌',          color: '#FF5722', badge: 'bg-orange-100 text-orange-700', source: 'crawled' },
  gangnam_unnie: { label: '강남언니',      color: '#FF69B4', badge: 'bg-rose-100 text-rose-700',     source: 'crawled' },
  babitalk:      { label: '바비톡',        color: '#9C27B0', badge: 'bg-purple-100 text-purple-700', source: 'crawled' },
  fmkorea:       { label: '에펨코리아',    color: '#00ADEF', badge: 'bg-sky-100 text-sky-700',       source: 'crawled' },
  theqoo:        { label: '더쿠',          color: '#F43F5E', badge: 'bg-rose-100 text-rose-700',     source: 'crawled' },
  sungyesa:      { label: '성예사',        color: '#8B5CF6', badge: 'bg-violet-100 text-violet-700', source: 'crawled' },
  instagram:     { label: '인스타그램',    color: '#E1306C', badge: 'bg-pink-100 text-pink-700',     source: 'estimated' },
  twitter:       { label: 'X(트위터)',     color: '#000000', badge: 'bg-gray-100 text-gray-700',     source: 'estimated' },
  facebook:      { label: '페이스북',      color: '#1877F2', badge: 'bg-blue-100 text-blue-700',     source: 'estimated' },
}

const SOURCE_LABEL: Record<DataSource, { text: string; badge: string }> = {
  real:      { text: 'API 실측',  badge: 'bg-green-50 text-green-600 border border-green-200' },
  crawled:   { text: '크롤링',   badge: 'bg-blue-50 text-blue-600 border border-blue-200' },
  estimated: { text: '추정',     badge: 'bg-amber-50 text-amber-600 border border-amber-200' },
}

const CHANNEL_ORDER: ScChannel[] = [
  'naver_blog', 'naver_cafe', 'naver_news', 'youtube',
  'dcinside', 'ppomppu', 'gangnam_unnie', 'babitalk',
  'fmkorea', 'theqoo', 'sungyesa',
  'instagram', 'twitter', 'facebook',
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

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const bom = '\uFEFF'
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
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
  const channelTotals: Partial<Record<ScChannel, number>> = {}
  for (const m of mentions) {
    for (const [ch, cnt] of Object.entries(m.by_channel)) {
      channelTotals[ch as ScChannel] = (channelTotals[ch as ScChannel] ?? 0) + (cnt as number)
    }
  }
  const maxChannel = Math.max(0, ...Object.values(channelTotals).map(v => v ?? 0))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="전체 언급량 (7일)" value={fmt(totalMentions)} sub="모든 채널 합산" />
        <KpiCard label="모니터링 키워드" value={String(keywords.filter(k => k.is_active).length)} sub={`전체 ${keywords.length}개`} />
        <KpiCard label="수집 채널" value="14" sub="API 실측 4 · 크롤링 7 · 추정 3" />
      </div>

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
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden lg:table-cell">주요 채널</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 hidden sm:table-cell">동기화</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mentions.sort((a, b) => b.total - a.total).map(m => {
                  const kw = kwMap.get(m.keyword_id)
                  const topChs = CHANNEL_ORDER.filter(ch => (m.by_channel[ch] ?? 0) > 0).slice(0, 3)
                  return (
                    <tr key={m.keyword_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.keyword}</td>
                      <td className="px-4 py-3">
                        {kw && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_META[kw.category].badge}`}>
                            {CATEGORY_META[kw.category].label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(m.total)}</td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {topChs.map(ch => (
                            <span key={ch} className={`rounded-full px-1.5 py-0.5 text-xs ${CHANNEL_META[ch].badge}`}>
                              {CHANNEL_META[ch].label} {fmt(m.by_channel[ch] ?? 0)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-right text-xs text-gray-400 sm:table-cell">
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

      {totalMentions > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">채널별 분포 (7일 합산)</h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2.5">
            {CHANNEL_ORDER.filter(ch => (channelTotals[ch] ?? 0) > 0).map(ch => {
              const cnt = channelTotals[ch] ?? 0
              const pct = maxChannel > 0 ? (cnt / maxChannel) * 100 : 0
              const meta = CHANNEL_META[ch]
              const srcMeta = SOURCE_LABEL[meta.source]
              return (
                <div key={ch} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-right text-xs text-gray-600">{meta.label}</div>
                  <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: meta.color, opacity: meta.source === 'estimated' ? 0.5 : 0.85 }}
                    />
                  </div>
                  <div className="w-14 text-right text-xs font-medium text-gray-700">{fmt(cnt)}</div>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs ${srcMeta.badge}`}>
                    {srcMeta.text}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
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

  const presentChannels = [...new Set(posts.map(p => p.channel))] as ScChannel[]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Chip active={selectedChannel === 'all'} onClick={() => setSelectedChannel('all')}>전체 채널</Chip>
        {presentChannels.map(ch => (
          <Chip
            key={ch}
            active={selectedChannel === ch}
            onClick={() => setSelectedChannel(ch)}
            color={selectedChannel === ch ? CHANNEL_META[ch].color : undefined}
          >
            {CHANNEL_META[ch]?.label ?? ch}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip small active={selectedKeyword === 'all'} onClick={() => setSelectedKeyword('all')}>모든 키워드</Chip>
        {keywords.filter(k => k.is_active).map(k => (
          <Chip small key={k.id} active={selectedKeyword === k.id} onClick={() => setSelectedKeyword(k.id)}>
            {k.keyword}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={posts.length === 0
          ? '새로고침 또는 커뮤니티 크롤링 버튼을 눌러 게시글을 수집하세요.'
          : '해당 필터에 맞는 게시글이 없습니다.'
        } />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">{filtered.length}건 표시 중</p>
          {filtered.map(post => <PostCard key={post.id} post={post} />)}
        </div>
      )}
    </div>
  )
}

function PostCard({ post }: { post: ScPost & { keyword: string } }) {
  const ch = post.channel as ScChannel
  const meta = CHANNEL_META[ch] ?? { label: post.channel, badge: 'bg-gray-100 text-gray-700', source: 'estimated' as DataSource }
  const srcMeta = SOURCE_LABEL[meta.source]
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>{meta.label}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-xs ${srcMeta.badge}`}>{srcMeta.text}</span>
          {post.keyword && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">#{post.keyword}</span>}
        </div>
        {post.url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" /> 원문
          </a>
        )}
      </div>
      {post.title && <p className="font-medium text-gray-900 leading-snug">{post.title}</p>}
      {post.content && <p className="text-sm text-gray-500 line-clamp-2">{post.content}</p>}
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
    <div className="space-y-8">
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
              placeholder="모니터링 키워드 (예: 클래시스, 볼뉴머)"
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
              className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {adding ? '추가 중...' : '추가'}
            </button>
          </div>
        </div>
      </section>

      {/* 키워드 목록 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">수집 키워드 ({keywords.length}개)</h2>
          <div className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs text-blue-600">
            <Info className="h-3.5 w-3.5 shrink-0" />
            상단 <span className="font-semibold">전체 갱신</span> 버튼으로 API 동기화 + 크롤링을 함께 실행합니다
          </div>
        </div>
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
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_META[k.category].badge}`}>
                        {CATEGORY_META[k.category].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs ${k.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${k.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {k.is_active ? '수집 중' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(k.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { if (confirm(`"${k.keyword}" 키워드를 삭제하시겠습니까?`)) onDelete(k.id) }}
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

      {/* API 연동 가이드 */}
      <ApiGuideSection />

      {/* 데이터 정책 요약 */}
      <DataPolicySection />
    </div>
  )
}

// ── API 연동 가이드 ──────────────────────────────────────────────
function ApiGuideSection() {
  const [open, setOpen] = useState<string | null>(null)

  const guides = [
    {
      id: 'youtube',
      title: 'YouTube Data API v3',
      status: 'active' as const,
      badge: 'API 실측 중',
      badgeClass: 'bg-green-100 text-green-700',
      icon: '▶',
      summary: 'YOUTUBE_API_KEY 설정됨 · 무료 10,000 쿼터/일',
      steps: [
        '1. Google Cloud Console (console.cloud.google.com) 접속',
        '2. 새 프로젝트 생성 또는 기존 프로젝트 선택',
        '3. "API 및 서비스" → "라이브러리" → "YouTube Data API v3" 활성화',
        '4. "사용자 인증 정보" → "API 키" 생성',
        '5. .env.local 에 YOUTUBE_API_KEY=발급받은_키 설정',
      ],
      limits: '무료: 10,000 유닛/일 · 검색 1회 = 100유닛 · 약 100회 검색/일 가능',
      note: '이미 설정되어 있습니다. 일일 쿼터 초과 시 추정값으로 전환됩니다.',
    },
    {
      id: 'instagram',
      title: 'Instagram Graph API (Meta)',
      status: 'setup_required' as const,
      badge: '설정 필요',
      badgeClass: 'bg-amber-100 text-amber-700',
      icon: '📷',
      summary: 'Business 계정 연동 + Meta 앱 심사 필요 (2~4주)',
      steps: [
        '1. Meta for Developers (developers.facebook.com) 접속',
        '2. "내 앱" → "앱 만들기" → 유형: "비즈니스"',
        '3. 인스타그램 비즈니스 계정과 Facebook 페이지 연결',
        '4. Instagram Graph API 제품 추가',
        '5. 앱 심사 (instagram_basic, instagram_content_publish 권한) 신청',
        '6. 심사 완료 후 액세스 토큰 발급',
        '7. .env.local 에 INSTAGRAM_GRAPH_API_TOKEN=발급받은_토큰 설정',
      ],
      limits: '게시물 조회: 200건/시간 · 인사이트: 비즈니스 계정만 가능',
      note: '앱 심사까지 2~4주 소요. 개인 계정은 불가, 비즈니스/크리에이터 계정 필수.',
    },
    {
      id: 'twitter',
      title: 'X (Twitter) API v2',
      status: 'paid' as const,
      badge: '유료 플랜 필요',
      badgeClass: 'bg-red-100 text-red-700',
      icon: '𝕏',
      summary: 'Basic 플랜 $100/월 · 검색 쿼리 필요',
      steps: [
        '1. developer.twitter.com 접속 후 개발자 계정 신청',
        '2. 앱 생성 및 용도 설명 작성 (승인 1~3일)',
        '3. Basic 플랜($100/월) 또는 Pro 플랜($5,000/월) 구독',
        '4. Bearer Token, API Key, API Secret 발급',
        '5. .env.local 에 TWITTER_BEARER_TOKEN=발급받은_토큰 설정',
      ],
      limits: 'Free: 읽기 월 500건(실질 사용 불가) · Basic($100/월): 월 10,000건 읽기',
      note: '2023년 무료 티어가 사실상 폐지됨. 브랜드 모니터링 목적이면 Basic 이상 필요.',
    },
    {
      id: 'facebook',
      title: 'Facebook Graph API (Meta)',
      status: 'setup_required' as const,
      badge: '설정 필요',
      badgeClass: 'bg-amber-100 text-amber-700',
      icon: 'f',
      summary: 'Facebook 페이지 관리자 권한 + 앱 심사 필요',
      steps: [
        '1. Meta for Developers 에서 앱 생성 (인스타그램과 동일 앱 사용 가능)',
        '2. Facebook 로그인 제품 추가 → pages_read_engagement 권한 요청',
        '3. 앱 심사 통과 후 페이지 액세스 토큰 발급',
        '4. .env.local 에 FACEBOOK_PAGE_ACCESS_TOKEN=발급받은_토큰 설정',
      ],
      limits: '게시물 조회: 200건/시간 · 본인 관리 페이지만 인사이트 접근 가능',
      note: '공개 게시물 검색은 Graph API로 불가. 자사 Facebook 페이지 분석에 적합.',
    },
    {
      id: 'gangnam_unnie',
      title: '강남언니 커뮤니티',
      status: 'crawling' as const,
      badge: '크롤링 구현',
      badgeClass: 'bg-blue-100 text-blue-700',
      icon: '💉',
      summary: '내부 API 엔드포인트 시도 · 응답 여부 불확실',
      steps: [
        '현재: 비공식 내부 API 엔드포인트를 통한 데이터 수집 시도 중',
        '강남언니 측 공식 파트너십 API 문의 필요 (biz@hindocs.com)',
        '공식 API 미지원 시 Playwright/Puppeteer 헤드리스 브라우저 크롤링으로 전환 가능',
        '주의: 이용약관 확인 후 수집 범위 결정 필요',
      ],
      limits: '비공식 API는 언제든 차단될 수 있음 · 공식 제휴 권장',
      note: '헤드리스 브라우저 크롤링이 필요한 경우 별도 서버(Puppeteer) 구축 안내 가능.',
    },
    {
      id: 'babitalk',
      title: '바비톡 커뮤니티',
      status: 'crawling' as const,
      badge: '크롤링 구현',
      badgeClass: 'bg-blue-100 text-blue-700',
      icon: '💊',
      summary: '내부 API 엔드포인트 시도 · 응답 여부 불확실',
      steps: [
        '현재: 비공식 내부 API 엔드포인트를 통한 데이터 수집 시도 중',
        '바비톡 측 파트너십 API 문의: contact@babitalk.com',
        '공식 API 미지원 시 헤드리스 브라우저 크롤링으로 전환 가능',
        '주의: robots.txt 및 이용약관 준수 필수',
      ],
      limits: '비공식 API는 언제든 차단될 수 있음',
      note: '수집 주기를 24시간 이상으로 설정하여 서버 부하를 최소화하세요.',
    },
    {
      id: 'dcinside',
      title: 'DC인사이드',
      status: 'crawling' as const,
      badge: '크롤링 구현',
      badgeClass: 'bg-blue-100 text-blue-700',
      icon: '🖥',
      summary: '검색 페이지 HTML 파싱 · 즉시 사용 가능',
      steps: [
        '현재: search.dcinside.com 검색 결과 페이지 HTML 파싱으로 게시글 수집',
        '추가 갤러리 지정 수집: 갤러리 ID 목록을 설정에 추가하면 특정 갤러리만 수집 가능',
        'IP 차단 시 요청 간격 조정 (현재 키워드당 1회/일)',
      ],
      limits: '검색 결과 최대 10건/키워드 · IP 차단 가능성 있음 (서버리스 IP풀 공유)',
      note: '운영 중인 마케팅 관련 갤러리 ID를 추가하면 더 정확한 데이터 수집 가능.',
    },
    {
      id: 'ppomppu',
      title: '뽐뿌',
      status: 'crawling' as const,
      badge: '크롤링 구현',
      badgeClass: 'bg-blue-100 text-blue-700',
      icon: '🛒',
      summary: '게시판 검색 결과 HTML 파싱 · 즉시 사용 가능',
      steps: [
        '현재: ppomppu.co.kr 검색 결과 페이지 HTML 파싱으로 게시글 수집',
        '뷰티/의료 카테고리 게시판 ID 지정 수집 추가 가능',
        'Referer 헤더 포함으로 차단 최소화 적용 중',
      ],
      limits: '검색 결과 최대 10건/키워드',
      note: '미용·뷰티 관련 게시판(id=beauty 등)으로 범위 좁히면 노이즈 감소.',
    },
  ]

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Cpu className="h-4 w-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-700">API 연동 가이드</h2>
      </div>
      <div className="space-y-2">
        {guides.map(g => (
          <div key={g.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <button
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(o => o === g.id ? null : g.id)}
            >
              <span className="shrink-0 text-lg">{g.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{g.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${g.badgeClass}`}>{g.badge}</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500 truncate">{g.summary}</p>
              </div>
              {open === g.id ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
            </button>

            {open === g.id && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">발급 절차</p>
                  <ol className="space-y-1">
                    {g.steps.map((s, i) => (
                      <li key={i} className="text-sm text-gray-600">{s}</li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <p className="text-xs text-gray-600"><span className="font-medium">한도:</span> {g.limits}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <p className="text-xs text-gray-600"><span className="font-medium">참고:</span> {g.note}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function DataPolicySection() {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-700">데이터 수집 현황</h2>
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
        {[
          { src: 'API 실측', channels: '네이버 블로그 / 카페 / 뉴스 · YouTube', detail: 'Search API 실측 카운트 + 최신 원문 수집', cls: SOURCE_LABEL.real.badge },
          { src: '크롤링',  channels: 'DC인사이드 · 뽐뿌 · 에펨코리아 · 더쿠 · 강남언니 · 바비톡 · 성예사', detail: 'HTML 파싱 또는 내부 API — 커뮤니티 크롤링 버튼으로 수동 실행', cls: SOURCE_LABEL.crawled.badge },
          { src: '추정',    channels: '인스타그램 · X(트위터) · 페이스북', detail: '포털 데이터 기준 비례 추정 (공식 API 미연동)', cls: SOURCE_LABEL.estimated.badge },
        ].map(r => (
          <div key={r.src} className="flex items-start gap-3">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${r.cls}`}>{r.src}</span>
            <div>
              <p className="font-medium text-gray-700 text-xs">{r.channels}</p>
              <p className="text-xs text-gray-500">{r.detail}</p>
            </div>
          </div>
        ))}
        <p className="pt-1 text-xs text-gray-400">
          • 포털 API 동기화: 새로고침 버튼 (1시간 캐시) · 커뮤니티 크롤링: 설정 탭에서 수동 실행
        </p>
      </div>
    </section>
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

function Chip({ active, onClick, children, color, small }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string; small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-full font-medium transition-colors',
        small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        active ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      ].join(' ')}
      style={active ? { backgroundColor: color ?? '#111827' } : undefined}
    >
      {children}
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12">
      <BarChart3 className="mb-3 h-8 w-8 text-gray-300" />
      <p className="text-sm text-gray-500 text-center px-4">{message}</p>
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
  const [syncPhase, setSyncPhase] = useState<'idle' | 'api' | 'crawl'>('idle')
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

  const handleRefreshAll = async () => {
    if (syncPhase !== 'idle') return
    try {
      setSyncPhase('api')
      await fetch('/api/some-content/mentions/sync', { method: 'POST' })
      setSyncPhase('crawl')
      await fetch('/api/some-content/posts/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      await fetchAll()
    } finally {
      setSyncPhase('idle')
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
    } finally { setAdding(false) }
  }

  const handleDeleteKeyword = async (id: string) => {
    const res = await fetch(`/api/some-content/keywords?id=${id}`, { method: 'DELETE' })
    if (res.ok) await fetchAll()
  }

  const handleExportMentions = () => {
    const date = new Date().toISOString().slice(0, 10)
    const rows: (string | number)[][] = [
      ['키워드', ...CHANNEL_ORDER.map(ch => CHANNEL_META[ch].label), '총합'],
      ...mentions.map(m => [
        m.keyword,
        ...CHANNEL_ORDER.map(ch => m.by_channel[ch] ?? 0),
        m.total,
      ]),
    ]
    downloadCSV(`썸콘텐츠_언급량_${date}.csv`, rows)
  }

  const handleExportPosts = () => {
    const date = new Date().toISOString().slice(0, 10)
    const rows: (string | number)[][] = [
      ['키워드', '채널', '제목', '내용', 'URL', '작성일'],
      ...posts.map(p => [
        p.keyword,
        CHANNEL_META[p.channel as ScChannel]?.label ?? p.channel,
        p.title ?? '',
        p.content ?? '',
        p.url ?? '',
        p.published_at ? new Date(p.published_at).toLocaleDateString('ko-KR') : '',
      ]),
    ]
    downloadCSV(`썸콘텐츠_게시글_${date}.csv`, rows)
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
          <div className="flex items-center gap-2">
            {lastSync && (
              <span className="hidden text-xs text-gray-400 sm:inline">
                동기화: {fmtDate(lastSync)}
              </span>
            )}
            {mentions.length > 0 && (
              <button
                onClick={handleExportMentions}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                title="언급량 CSV 다운로드"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">언급량</span>
              </button>
            )}
            {posts.length > 0 && (
              <button
                onClick={handleExportPosts}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                title="게시글 CSV 다운로드"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">게시글</span>
              </button>
            )}
            <button
              onClick={handleRefreshAll}
              disabled={syncPhase !== 'idle'}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${syncPhase !== 'idle' ? 'animate-spin' : ''}`} />
              {syncPhase === 'api' ? 'API 동기화 중...' : syncPhase === 'crawl' ? '크롤링 중...' : '전체 갱신'}
            </button>
          </div>
        </div>

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

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardTab mentions={mentions} keywords={keywords} />}
            {activeTab === 'trend' && (
              <TrendAnalysisView keywords={keywords} />
            )}
            {activeTab === 'channel' && (
              <ChannelTab
                posts={posts} keywords={keywords}
                selectedChannel={selectedChannel} setSelectedChannel={setSelectedChannel}
                selectedKeyword={selectedKeyword} setSelectedKeyword={setSelectedKeyword}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                keywords={keywords}
                newKeyword={newKeyword} setNewKeyword={setNewKeyword}
                newCategory={newCategory} setNewCategory={setNewCategory}
                adding={adding} onAdd={handleAddKeyword}
                onDelete={handleDeleteKeyword}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
