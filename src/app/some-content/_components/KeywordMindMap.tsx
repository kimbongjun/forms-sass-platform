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

const PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#6366F1',
  '#84CC16', '#F43F5E',
]

const W = 720
const H = 460
const CX = W / 2
const CY = H / 2
const ORBIT_R = 190

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
  const svgRef = useRef<SVGSVGElement>(null)

  // Track pointer for tooltip positioning
  const [tooltipPos, setTooltipPos] = useState<{ svgX: number; svgY: number } | null>(null)

  const load = useCallback(async (kw: string) => {
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
      setNodes(data.slice(0, 10))
    } catch {
      setError('네트워크 오류')
      setNodes([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Sync when parent prop changes
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

  // Position satellite nodes on an ellipse
  const nodeData = nodes.map((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2
    const r = 20 + (node.total / maxVol) * 24  // radius 20–44
    const lw = 0.8 + (node.total / maxVol) * 4   // line width 0.8–4.8
    return {
      ...node,
      x: CX + Math.cos(angle) * ORBIT_R,
      y: CY + Math.sin(angle) * ORBIT_R * 0.82, // slight vertical squeeze
      r,
      lw,
      color: PALETTE[i % PALETTE.length],
    }
  })

  // Convert client coords → SVG coords
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
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
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

          {/* Breadcrumb */}
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
        style={{ height: fullscreen ? 'calc(100% - 44px)' : '400px' }}
        onMouseMove={(e) => {
          if (hovered) setTooltipPos(clientToSvg(e.clientX, e.clientY))
        }}
      >
        <defs>
          {/* Per-node radial gradient */}
          {nodeData.map((n, i) => (
            <radialGradient key={i} id={`ng-${i}`} cx="35%" cy="35%">
              <stop offset="0%" stopColor={n.color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={n.color} stopOpacity="1" />
            </radialGradient>
          ))}

          {/* Center gradient */}
          <radialGradient id="cg" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="100%" stopColor="#111827" />
          </radialGradient>

          {/* Drop shadow */}
          <filter id="ds" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#00000020" />
          </filter>

          {/* Glow for hovered lines */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background radial grid — subtle */}
        {[ORBIT_R * 0.5, ORBIT_R, ORBIT_R * 1.45].map((r, i) => (
          <circle key={i} cx={CX} cy={CY} r={r} fill="none" stroke="#F3F4F6" strokeWidth="1" />
        ))}

        {/* Connection lines */}
        {nodeData.map((n, i) => {
          const isHov = hovered === n.keyword
          return (
            <line
              key={`l-${i}`}
              x1={CX} y1={CY}
              x2={n.x} y2={n.y}
              stroke={n.color}
              strokeWidth={isHov ? n.lw + 2 : n.lw}
              strokeOpacity={isHov ? 0.9 : 0.3}
              strokeDasharray={isHov ? undefined : '6 4'}
              filter={isHov ? 'url(#glow)' : undefined}
              style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.15s' }}
            />
          )
        })}

        {/* Satellite nodes */}
        {nodeData.map((n, i) => {
          const isHov = hovered === n.keyword
          const labelLen = n.keyword.length
          const labelFontSize = labelLen > 7 ? 9 : labelLen > 5 ? 10 : 11
          return (
            <g
              key={`n-${i}`}
              style={{ cursor: 'pointer' }}
              onClick={() => navigateTo(n.keyword)}
              onMouseEnter={(e) => {
                setHovered(n.keyword)
                setTooltipPos(clientToSvg(e.clientX, e.clientY))
              }}
              onMouseLeave={() => { setHovered(null); setTooltipPos(null) }}
            >
              {/* Outer glow ring on hover */}
              {isHov && (
                <circle
                  cx={n.x} cy={n.y}
                  r={n.r + 8}
                  fill={n.color}
                  fillOpacity={0.15}
                />
              )}
              <circle
                cx={n.x} cy={n.y}
                r={isHov ? n.r + 3 : n.r}
                fill={`url(#ng-${i})`}
                filter="url(#ds)"
                style={{ transition: 'r 0.15s' }}
              />
              <text
                x={n.x} y={n.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={labelFontSize}
                fontWeight="700"
                style={{ pointerEvents: 'none' }}
              >
                {truncate(n.keyword, 7)}
              </text>
              {/* Volume sub-label */}
              <text
                x={n.x}
                y={n.y + n.r + 13}
                textAnchor="middle"
                fill="#9CA3AF"
                fontSize="9"
                style={{ pointerEvents: 'none' }}
              >
                {fmt(n.total)}
              </text>
            </g>
          )
        })}

        {/* Center node */}
        <g>
          <circle cx={CX} cy={CY} r={54} fill="url(#cg)" filter="url(#ds)" />
          <text
            x={CX} y={CY - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={center.length > 6 ? 12 : 14}
            fontWeight="800"
            style={{ pointerEvents: 'none' }}
          >
            {truncate(center, 8)}
          </text>
          <text
            x={CX} y={CY + 10}
            textAnchor="middle"
            fill="#6B7280"
            fontSize="9"
            style={{ pointerEvents: 'none' }}
          >
            연관어 맵
          </text>
        </g>

        {/* Tooltip */}
        {hovered && hoveredNode && tooltipPos && (() => {
          const tx = tooltipPos.svgX + 12
          const ty = tooltipPos.svgY - 46
          const safeX = Math.min(tx, W - 148)
          const safeY = Math.max(ty, 4)
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={safeX} y={safeY} width={140} height={62} rx={8} ry={8}
                fill="#1F2937" fillOpacity={0.96} />
              <text x={safeX + 10} y={safeY + 18} fill="white" fontSize="12" fontWeight="700">
                {hovered}
              </text>
              <text x={safeX + 10} y={safeY + 34} fill="#9CA3AF" fontSize="9.5">
                PC: {fmt(hoveredNode.pc)} · 모바일: {fmt(hoveredNode.mobile)}
              </text>
              <text x={safeX + 10} y={safeY + 48} fill="#6B7280" fontSize="9">
                클릭하면 이 키워드로 이동
              </text>
            </g>
          )
        })()}

        {/* Empty / error state */}
        {!loading && nodes.length === 0 && (
          <text x={CX} y={CY + 90} textAnchor="middle" fill="#D1D5DB" fontSize="13">
            {error ?? '연관어 데이터가 없습니다'}
          </text>
        )}
        {!loading && nodes.length === 0 && error && (
          <text x={CX} y={CY + 110} textAnchor="middle" fill="#D1D5DB" fontSize="11">
            Naver Ad API 키(NAVER_AD_SECRET_KEY) 설정 필요
          </text>
        )}
      </svg>

      {/* Fullscreen backdrop */}
      {fullscreen && (
        <div
          className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        />
      )}
    </div>
  )
}
