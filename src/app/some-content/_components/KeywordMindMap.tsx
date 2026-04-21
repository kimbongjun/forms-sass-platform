'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, RotateCcw, ChevronRight, Maximize2 } from 'lucide-react'

interface RelatedNode {
  keyword: string
  pc: number
  mobile: number
  total: number
}

interface MindMapProps {
  centerKeyword: string
}

// 채도 높은 팔레트
const PALETTE = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
  '#EC4899', '#14B8A6', '#F97316', '#8B5CF6', '#06B6D4',
  '#84CC16', '#F43F5E',
]

const W = 880
const H = 540
const CX = W / 2
const CY = H / 2
const ORBIT_R = 230

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function truncate(s: string, max = 7): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export default function KeywordMindMap({ centerKeyword }: MindMapProps) {
  const [center, setCenter] = useState(centerKeyword)
  const [nodes, setNodes] = useState<RelatedNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([centerKeyword])
  const [fullscreen, setFullscreen] = useState(false)
  const [loaded, setLoaded] = useState(false)   // for entrance animation
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ svgX: number; svgY: number } | null>(null)

  const load = useCallback(async (kw: string) => {
    setLoaded(false)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/some-content/related?keyword=${encodeURIComponent(kw)}`)
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? '데이터 로드 실패')
        setNodes([])
        return
      }
      const data: RelatedNode[] = await res.json()
      setNodes(data.slice(0, 12))
      // Trigger entrance animation after data loads
      setTimeout(() => setLoaded(true), 80)
    } catch {
      setError('네트워크 오류')
      setNodes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (centerKeyword !== center) {
      setCenter(centerKeyword)
      setHistory([centerKeyword])
    }
  }, [centerKeyword]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(center) }, [center, load])

  const navigateTo = (kw: string) => {
    setHistory(h => [...h, kw])
    setCenter(kw)
  }

  const goBack = () => {
    if (history.length <= 1) return
    const next = history.slice(0, -1)
    setHistory(next)
    setCenter(next[next.length - 1])
  }

  const maxVol = Math.max(1, ...nodes.map(n => n.total))

  // 타원형 배치, 노드 크기는 검색량 비례
  const nodeData = nodes.map((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2
    const r = 24 + (node.total / maxVol) * 28  // 24–52
    const lw = 1 + (node.total / maxVol) * 4.5  // 1–5.5
    return {
      ...node,
      x: CX + Math.cos(angle) * ORBIT_R * 1.05,
      y: CY + Math.sin(angle) * ORBIT_R * 0.78,
      r,
      lw,
      color: PALETTE[i % PALETTE.length],
    }
  })

  const clientToSvg = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { svgX: 0, svgY: 0 }
    return {
      svgX: ((clientX - rect.left) / rect.width) * W,
      svgY: ((clientY - rect.top) / rect.height) * H,
    }
  }

  const hoveredNode = nodeData.find(n => n.keyword === hovered)

  const wrapClass = [
    'rounded-2xl border border-gray-200 bg-white overflow-hidden transition-all',
    fullscreen ? 'fixed inset-4 z-50 shadow-2xl' : '',
  ].join(' ')

  return (
    <div className={wrapClass}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={goBack}
            disabled={history.length <= 1}
            title="이전 키워드"
            className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            이전
          </button>

          <div className="flex items-center gap-1 overflow-x-auto text-xs text-gray-400 scrollbar-none">
            {history.map((h, i) => (
              <span key={i} className="flex shrink-0 items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300" />}
                <span className={i === history.length - 1 ? 'font-semibold text-gray-700' : 'text-gray-400'}>
                  {h}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-gray-300" />}
          <span className="text-xs text-gray-400">{nodes.length}개 연관어</span>
          <button
            onClick={() => setFullscreen(f => !f)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
            title={fullscreen ? '창 크기로' : '전체화면'}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        style={{ height: fullscreen ? 'calc(100% - 52px)' : '480px' }}
        onMouseMove={(e) => {
          if (hovered) setTooltipPos(clientToSvg(e.clientX, e.clientY))
        }}
      >
        <defs>
          {/* 노드별 라디알 그라디언트 */}
          {nodeData.map((n, i) => (
            <radialGradient key={i} id={`ng-${i}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor={n.color} stopOpacity="0.85" />
              <stop offset="100%" stopColor={n.color} stopOpacity="1" />
            </radialGradient>
          ))}

          {/* 중심 노드 그라디언트 */}
          <radialGradient id="cg" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#4B5563" />
            <stop offset="100%" stopColor="#111827" />
          </radialGradient>

          {/* 드롭 섀도우 */}
          <filter id="ds" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#00000018" />
          </filter>

          {/* 강한 글로우 (호버) */}
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* 중심 노드 글로우 */}
          <filter id="centerGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* CSS 키프레임 애니메이션 */}
          <style>{`
            @keyframes mm-pulse {
              0%, 100% { opacity: 0.15; r: 62; }
              50% { opacity: 0.35; r: 76; }
            }
            @keyframes mm-spin-slow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            .mm-pulse-ring {
              animation: mm-pulse 3s ease-in-out infinite;
              transform-box: fill-box;
              transform-origin: center;
            }
            .mm-orbit-ring {
              animation: mm-spin-slow 30s linear infinite;
              transform-box: fill-box;
              transform-origin: center;
            }
          `}</style>
        </defs>

        {/* 배경 동심원 */}
        {[ORBIT_R * 0.42, ORBIT_R * 0.82, ORBIT_R * 1.22].map((r, i) => (
          <circle key={i} cx={CX} cy={CY} r={r} fill="none" stroke="#F3F4F6" strokeWidth={i === 1 ? 1.5 : 1} strokeDasharray={i === 2 ? '6 4' : undefined} />
        ))}

        {/* 연결선 (path로 pathLength 애니메이션) */}
        {nodeData.map((n, i) => {
          const isHov = hovered === n.keyword
          return (
            <path
              key={`l-${i}`}
              d={`M ${CX} ${CY} L ${n.x.toFixed(1)} ${n.y.toFixed(1)}`}
              pathLength={1}
              stroke={n.color}
              strokeWidth={isHov ? n.lw + 2 : n.lw}
              strokeOpacity={isHov ? 1 : 0.35}
              strokeLinecap="round"
              strokeDasharray="1"
              strokeDashoffset={loaded ? 0 : 1}
              fill="none"
              filter={isHov ? 'url(#glow)' : undefined}
              style={{
                transition: `stroke-dashoffset 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.045}s, stroke-opacity 0.2s, stroke-width 0.15s`,
              }}
            />
          )
        })}

        {/* 위성 노드 */}
        {nodeData.map((n, i) => {
          const isHov = hovered === n.keyword
          const labelLen = n.keyword.length
          const labelFs = labelLen > 7 ? 10 : labelLen > 5 ? 11 : 12
          return (
            <g
              key={`n-${i}`}
              style={{
                cursor: 'pointer',
                opacity: loaded ? 1 : 0,
                transform: loaded ? 'scale(1)' : 'scale(0.3)',
                transformBox: 'fill-box',
                transformOrigin: 'center',
                transition: `opacity 0.35s ease-out ${0.08 + i * 0.05}s, transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.08 + i * 0.05}s`,
              }}
              onClick={() => navigateTo(n.keyword)}
              onMouseEnter={(e) => {
                setHovered(n.keyword)
                setTooltipPos(clientToSvg(e.clientX, e.clientY))
              }}
              onMouseLeave={() => { setHovered(null); setTooltipPos(null) }}
            >
              {/* 호버 오라 링 */}
              {isHov && (
                <circle cx={n.x} cy={n.y} r={n.r + 12} fill={n.color} fillOpacity={0.12} />
              )}
              {/* 메인 노드 */}
              <circle
                cx={n.x} cy={n.y}
                r={isHov ? n.r + 4 : n.r}
                fill={`url(#ng-${i})`}
                filter="url(#ds)"
                style={{ transition: 'r 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              />
              {/* 키워드 텍스트 */}
              <text
                x={n.x} y={n.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={labelFs}
                fontWeight="700"
                letterSpacing="-0.3"
                style={{ pointerEvents: 'none' }}
              >
                {truncate(n.keyword, 7)}
              </text>
              {/* 검색량 서브라벨 */}
              <text
                x={n.x}
                y={n.y + n.r + 15}
                textAnchor="middle"
                fill="#9CA3AF"
                fontSize="9.5"
                fontWeight="500"
                style={{ pointerEvents: 'none' }}
              >
                {fmt(n.total)}
              </text>
            </g>
          )
        })}

        {/* 중심 노드 */}
        <g>
          {/* 펄스 링 */}
          <circle cx={CX} cy={CY} r={62} fill="#111827" className="mm-pulse-ring" />
          {/* 본체 */}
          <circle cx={CX} cy={CY} r={60} fill="url(#cg)" filter="url(#centerGlow)" />
          {/* 내부 하이라이트 링 */}
          <circle cx={CX} cy={CY} r={59} fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.1" />
          <text
            x={CX} y={CY - 10}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={center.length > 6 ? 14 : 16}
            fontWeight="800"
            letterSpacing="-0.5"
            style={{ pointerEvents: 'none' }}
          >
            {truncate(center, 9)}
          </text>
          <text
            x={CX} y={CY + 12}
            textAnchor="middle"
            fill="#9CA3AF"
            fontSize="10"
            fontWeight="500"
            style={{ pointerEvents: 'none' }}
          >
            연관어 맵
          </text>
        </g>

        {/* 호버 툴팁 */}
        {hovered && hoveredNode && tooltipPos && (() => {
          const tx = Math.min(tooltipPos.svgX + 14, W - 160)
          const ty = Math.max(tooltipPos.svgY - 52, 4)
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={tx} y={ty} width={150} height={68} rx={10} ry={10} fill="#111827" fillOpacity={0.97} />
              <text x={tx + 12} y={ty + 20} fill="white" fontSize="13" fontWeight="700">{hovered}</text>
              <text x={tx + 12} y={ty + 37} fill="#9CA3AF" fontSize="10">
                PC {fmt(hoveredNode.pc)} · 모바일 {fmt(hoveredNode.mobile)}
              </text>
              <text x={tx + 12} y={ty + 52} fill="#6B7280" fontSize="9.5">
                총 {fmt(hoveredNode.total)} · 클릭해서 탐색
              </text>
            </g>
          )
        })()}

        {/* 빈 상태 / 에러 */}
        {!loading && nodes.length === 0 && (
          <>
            <text x={CX} y={CY + 90} textAnchor="middle" fill="#D1D5DB" fontSize="14">
              {error ?? '연관어 데이터가 없습니다'}
            </text>
            {error && (
              <text x={CX} y={CY + 112} textAnchor="middle" fill="#D1D5DB" fontSize="11">
                Naver Ad API 키(NAVER_AD_SECRET_KEY) 설정 필요
              </text>
            )}
          </>
        )}
      </svg>

      {/* 풀스크린 backdrop */}
      {fullscreen && (
        <div
          className="fixed inset-0 -z-10 bg-black/50 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        />
      )}
    </div>
  )
}
