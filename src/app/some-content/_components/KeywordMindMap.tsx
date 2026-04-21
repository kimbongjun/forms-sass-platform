'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, RotateCcw, ChevronRight, Maximize2 } from 'lucide-react'

type SourceType = 'ad' | 'autocomplete' | 'news' | 'blog'
type Category = 'brand' | 'product' | 'review' | 'price' | 'how_to' | 'trend' | 'event' | 'general'

interface GraphNode {
  keyword: string
  pc: number
  mobile: number
  total: number
  sources: SourceType[]
  category: Category
}

interface LayoutNode extends GraphNode {
  x: number
  y: number
  r: number
  lw: number
  ring: 'inner' | 'outer'
}

interface MindMapProps {
  centerKeyword: string
}

const CAT: Record<Category, { label: string; color: string }> = {
  brand:   { label: '브랜드',    color: '#6366F1' },
  product: { label: '제품',      color: '#10B981' },
  review:  { label: '후기/리뷰',  color: '#F59E0B' },
  price:   { label: '가격/할인',  color: '#EF4444' },
  how_to:  { label: '사용법',    color: '#3B82F6' },
  trend:   { label: '트렌드',    color: '#EC4899' },
  event:   { label: '이벤트',    color: '#14B8A6' },
  general: { label: '일반',      color: '#8B5CF6' },
}

const SRC_LABELS: Record<SourceType, string> = {
  ad: '광고API', autocomplete: '자동완성', news: '뉴스', blog: '블로그',
}

const W = 1200
const H = 820
const CX = W / 2
const CY = H / 2
const INNER_R = 215
const OUTER_R = 345
const INNER_MAX = 15

function fmt(n: number): string {
  return n > 0 ? n.toLocaleString('ko-KR') : '-'
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export default function KeywordMindMap({ centerKeyword }: MindMapProps) {
  const [center, setCenter] = useState(centerKeyword)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([centerKeyword])
  const [fullscreen, setFullscreen] = useState(false)
  const [loaded, setLoaded] = useState(false)
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
      const data: GraphNode[] = await res.json()
      setNodes(data.slice(0, 60))
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

  const innerNodes = nodes.slice(0, INNER_MAX)
  const outerNodes = nodes.slice(INNER_MAX)
  const maxInnerVol = Math.max(1, ...innerNodes.map(n => n.total))
  const maxOuterVol = Math.max(1, ...outerNodes.map(n => n.total))

  const layoutInner: LayoutNode[] = innerNodes.map((n, i) => {
    const angle = (i / innerNodes.length) * 2 * Math.PI - Math.PI / 2
    const vr = n.total > 0 ? n.total / maxInnerVol : 0.3
    return { ...n, x: CX + Math.cos(angle) * INNER_R, y: CY + Math.sin(angle) * INNER_R, r: 30 + vr * 18, lw: 1.2 + vr * 3.5, ring: 'inner' }
  })
  const layoutOuter: LayoutNode[] = outerNodes.map((n, i) => {
    const angle = (i / outerNodes.length) * 2 * Math.PI - Math.PI / 2
    const vr = n.total > 0 ? n.total / maxOuterVol : 0.3
    return { ...n, x: CX + Math.cos(angle) * OUTER_R, y: CY + Math.sin(angle) * OUTER_R, r: 17 + vr * 10, lw: 0.9 + vr * 1.8, ring: 'outer' }
  })
  const allNodes = [...layoutInner, ...layoutOuter]
  const hoveredNode = allNodes.find(n => n.keyword === hovered)

  const clientToSvg = (cx: number, cy: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { svgX: 0, svgY: 0 }
    return { svgX: ((cx - rect.left) / rect.width) * W, svgY: ((cy - rect.top) / rect.height) * H }
  }

  const presentCategories = [...new Set(nodes.map(n => n.category))] as Category[]
  const presentSources = [...new Set(nodes.flatMap(n => n.sources))] as SourceType[]

  const wrapClass = [
    'rounded-2xl border border-gray-200 bg-white overflow-hidden transition-all',
    fullscreen ? 'fixed inset-4 z-50 shadow-2xl flex flex-col' : '',
  ].join(' ')

  return (
    <div className={wrapClass}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 shrink-0 bg-white">
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
                <span className={i === history.length - 1 ? 'font-semibold text-gray-700' : 'text-gray-400'}>{h}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-gray-300" />}
          {!loading && presentSources.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {presentSources.map(s => (
                <span key={s} className="text-[10px] font-medium rounded px-1.5 py-0.5 bg-gray-100 text-gray-500">{SRC_LABELS[s]}</span>
              ))}
            </div>
          )}
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
        style={{ height: fullscreen ? 'calc(100% - 104px)' : '620px', backgroundColor : '#ffffff' }}
        onMouseMove={(e) => { if (hovered) setTooltipPos(clientToSvg(e.clientX, e.clientY)) }}
      >
        <defs>
          {/* 8 category-level gradients */}
          {(Object.keys(CAT) as Category[]).map(cat => (
            <radialGradient key={cat} id={`cg-${cat}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor={CAT[cat].color} stopOpacity="0.85" />
              <stop offset="100%" stopColor={CAT[cat].color} stopOpacity="1" />
            </radialGradient>
          ))}

          <radialGradient id="cg-center" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#4B5563" />
            <stop offset="100%" stopColor="#111827" />
          </radialGradient>

          <filter id="ds" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#00000018" />
          </filter>

          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          <filter id="centerGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          <style>{`
            @keyframes mm-pulse { 0%,100%{opacity:0.15;r:62} 50%{opacity:0.35;r:76} }
            .mm-pulse-ring { animation:mm-pulse 3s ease-in-out infinite; transform-box:fill-box; transform-origin:center }
          `}</style>
        </defs>

        {/* Background rings */}
        {[INNER_R * 0.45, INNER_R, OUTER_R].map((r, i) => (
          <circle
            key={i} cx={CX} cy={CY} r={r}
            fill="none" stroke="#F3F4F6"
            strokeWidth={i === 1 ? 1.5 : 1}
            strokeDasharray={i === 2 ? '6 4' : undefined}
          />
        ))}

        {/* Connection lines */}
        {allNodes.map((n, i) => {
          const isHov = hovered === n.keyword
          return (
            <path
              key={`l-${i}`}
              d={`M ${CX} ${CY} L ${n.x.toFixed(1)} ${n.y.toFixed(1)}`}
              pathLength={1}
              stroke={CAT[n.category].color}
              strokeWidth={isHov ? n.lw + 2 : n.lw}
              strokeOpacity={isHov ? 0.9 : n.ring === 'inner' ? 0.4 : 0.18}
              strokeLinecap="round"
              strokeDasharray="1"
              strokeDashoffset={loaded ? 0 : 1}
              fill="none"
              filter={isHov ? 'url(#glow)' : undefined}
              style={{
                transition: `stroke-dashoffset 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 0.022}s, stroke-opacity 0.2s, stroke-width 0.15s`,
              }}
            />
          )
        })}

        {/* Satellite nodes */}
        {allNodes.map((n, i) => {
          const isHov = hovered === n.keyword
          const isInner = n.ring === 'inner'
          const maxChars = isHov ? 12 : isInner ? 7 : 5
          const fs = isHov
            ? (n.keyword.length > 8 ? 13 : n.keyword.length > 5 ? 15 : 17)
            : isInner
              ? (n.keyword.length > 6 ? 12 : n.keyword.length > 4 ? 14 : 16)
              : (n.keyword.length > 4 ? 9 : 11)

          return (
            <g
              key={`n-${i}`}
              style={{
                cursor: 'pointer',
                opacity: loaded ? 1 : 0,
                transform: loaded ? 'scale(1)' : 'scale(0.3)',
                transformBox: 'fill-box',
                transformOrigin: 'center',
                transition: `opacity 0.35s ease-out ${0.05 + i * 0.022}s, transform 0.45s cubic-bezier(0.34,1.56,0.64,1) ${0.05 + i * 0.022}s`,
              }}
              onClick={() => navigateTo(n.keyword)}
              onMouseEnter={(e) => {
                setHovered(n.keyword)
                setTooltipPos(clientToSvg(e.clientX, e.clientY))
              }}
              onMouseLeave={() => { setHovered(null); setTooltipPos(null) }}
            >
              {isHov && <circle cx={n.x} cy={n.y} r={n.r + 18} fill={CAT[n.category].color} fillOpacity={0.15} />}
              {isHov && <circle cx={n.x} cy={n.y} r={n.r + 9} fill={CAT[n.category].color} fillOpacity={0.1} />}
              <circle
                cx={n.x} cy={n.y}
                r={isHov ? n.r + 8 : n.r}
                fill={`url(#cg-${n.category})`}
                filter={isHov ? 'url(#glow)' : 'url(#ds)'}
                style={{ transition: 'r 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
              />
              <text
                x={n.x} y={n.y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize={fs} fontWeight="700"
                style={{ pointerEvents: 'none' }}
              >
                {trunc(n.keyword, maxChars)}
              </text>
            </g>
          )
        })}

        {/* Center node */}
        <g>
          <circle cx={CX} cy={CY} r={62} fill="#111827" className="mm-pulse-ring" />
          <circle cx={CX} cy={CY} r={60} fill="url(#cg-center)" filter="url(#centerGlow)" />
          <circle cx={CX} cy={CY} r={59} fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.1" />
          <text
            x={CX} y={CY - 10}
            textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={center.length > 6 ? 16 : 21}
            fontWeight="800" letterSpacing="-0.5"
            style={{ pointerEvents: 'none' }}
          >
            {trunc(center, 9)}
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" fill="#ddd" fontSize="12" fontWeight="500" style={{ pointerEvents: 'none' }}>
            연관어 맵
          </text>
        </g>

        {/* Hover tooltip */}
        {hovered && hoveredNode && tooltipPos && (() => {
          const tx = Math.min(tooltipPos.svgX + 14, W - 220)
          const ty = Math.max(tooltipPos.svgY - 72, 4)
          const hasVol = hoveredNode.total > 0
          const srcText = hoveredNode.sources.map(s => SRC_LABELS[s]).join(' · ')
          const boxH = hasVol ? 84 : 66
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={tx} y={ty} width={260} height={boxH} rx={10} ry={10} fill="#111827" fillOpacity={0.97} />
              <circle cx={tx + 14} cy={ty + 16} r={5} fill={CAT[hoveredNode.category].color} />
              <text x={tx + 24} y={ty + 20} fill="white" fontSize="13" fontWeight="700">{hovered}</text>
              {hasVol && (
                <text x={tx + 12} y={ty + 38} fill="#ffffff" fontSize="15">
                  PC {fmt(hoveredNode.pc)} · 모바일 {fmt(hoveredNode.mobile)} · 총 {fmt(hoveredNode.total)}
                </text>
              )}
              <text x={tx + 12} y={ty + (hasVol ? 54 : 38)} fill="#ffffff" fontSize="10">
                {CAT[hoveredNode.category].label}
              </text>
              <text x={tx + 12} y={ty + (hasVol ? 68 : 52)} fill="#ffffff" fontSize="10">
                출처: {srcText} · 클릭해서 탐색
              </text>
            </g>
          )
        })()}

        {/* Empty / error state */}
        {!loading && nodes.length === 0 && (
          <>
            <text x={CX} y={CY + 90} textAnchor="middle" fill="#D1D5DB" fontSize="14">
              {error ?? '연관어 데이터가 없습니다'}
            </text>
            {error && (
              <text x={CX} y={CY + 112} textAnchor="middle" fill="#D1D5DB" fontSize="11">
                Naver Ad API 키 설정 필요
              </text>
            )}
          </>
        )}
      </svg>

      {/* Category legend */}
      {presentCategories.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 shrink-0">
          {presentCategories.map(cat => (
            <span key={cat} className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CAT[cat].color }} />
              {CAT[cat].label}
            </span>
          ))}
        </div>
      )}

      {/* Fullscreen backdrop */}
      {fullscreen && (
        <div className="fixed inset-0 -z-10 bg-black/50 backdrop-blur-sm" onClick={() => setFullscreen(false)} />
      )}
    </div>
  )
}
