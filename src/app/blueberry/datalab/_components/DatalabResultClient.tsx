'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Download, Info } from 'lucide-react'

// ── 타입 ──────────────────────────────────────────────────────────
interface DatalabPayload {
  groups: { groupName: string; keywords: string[] }[]
  startDate: string
  endDate: string
  timeUnit: 'date' | 'week' | 'month'
  device: string
  gender: string
  ages: string[]
  periodLabel: string
  deviceLabel: string
  genderLabel: string
  ageLabel: string
}

interface DatalabDataPoint { period: string; ratio: number }
interface DatalabResult {
  title: string
  keywords: string[]
  data: DatalabDataPoint[]
}
interface DatalabResponse {
  startDate: string
  endDate: string
  timeUnit: string
  results: DatalabResult[]
  error?: string
  detail?: string
  status?: number
}

interface ApiError {
  message: string
  detail?: string
  status?: number
}

// ── 색상 팔레트 ────────────────────────────────────────────────────
const COLORS = [
  '#1a3f7e', '#10B981', '#F59E0B', '#EF4444',
  '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4',
  '#84CC16', '#F97316',
]

// ── 라인 차트 ─────────────────────────────────────────────────────
function TrendChart({ results }: { results: DatalabResult[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number>(-1)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; period: string; values: { title: string; ratio: number; color: string }[] } | null>(null)

  if (!results.length || !results[0].data.length) return null

  const W = 700, H = 280
  const pad = { t: 16, r: 16, b: 28, l: 36 }
  const dataLen = results[0].data.length
  const labels = results[0].data.map(d => d.period)
  const allRatios = results.flatMap(r => r.data.map(d => d.ratio))
  const maxVal = Math.max(...allRatios, 1)

  const ptX = (i: number) => pad.l + (i / Math.max(dataLen - 1, 1)) * (W - pad.l - pad.r)
  const ptY = (v: number) => pad.t + (1 - v / maxVal) * (H - pad.t - pad.b)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = (e.clientX - rect.left) * (W / rect.width)
    const idx = Math.min(dataLen - 1, Math.max(0, Math.round((relX - pad.l) / ((W - pad.l - pad.r) / Math.max(dataLen - 1, 1)))))
    setHoveredIdx(idx)
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      period: labels[idx],
      values: results.map((r, ri) => ({
        title: r.title,
        ratio: r.data[idx]?.ratio ?? 0,
        color: COLORS[ri % COLORS.length],
      })),
    })
  }

  // 눈금선 y값
  const ticks = [0, 25, 50, 75, 100]

  return (
    <div className="relative" style={{ aspectRatio: `${W}/${H}` }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredIdx(-1); setTooltip(null) }}
      >
        <defs>
          {results.map((r, ri) => {
            const color = COLORS[ri % COLORS.length]
            return (
              <linearGradient key={`lg-${ri}`} id={`dlg-${ri}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={color} stopOpacity="0.01" />
              </linearGradient>
            )
          })}
        </defs>

        {/* 수평 눈금선 */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.l} y1={ptY(t)} x2={W - pad.r} y2={ptY(t)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={pad.l - 6} y={ptY(t)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#94a3b8">{t}</text>
          </g>
        ))}

        {/* hover 수직선 */}
        {hoveredIdx >= 0 && (
          <line
            x1={ptX(hoveredIdx)} y1={pad.t}
            x2={ptX(hoveredIdx)} y2={H - pad.b}
            stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 3"
          />
        )}

        {/* 각 시리즈 */}
        {results.map((r, ri) => {
          const color = COLORS[ri % COLORS.length]
          const pts = r.data.map((d, i) => ({ x: ptX(i), y: ptY(d.ratio) }))
          const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
          const areaD = pts.length > 0
            ? `M${pts[0].x.toFixed(1)},${H - pad.b} ` +
              pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
              ` L${pts.at(-1)!.x.toFixed(1)},${H - pad.b} Z`
            : ''
          return (
            <g key={`series-${ri}`}>
              <path d={areaD} fill={`url(#dlg-${ri})`} />
              <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={hoveredIdx === i ? 5 : 3} fill={color} />
              ))}
            </g>
          )
        })}
      </svg>

      {/* 툴팁 */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-gray-200 bg-white p-3 shadow-lg text-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8, transform: tooltip.x > 480 ? 'translateX(-110%)' : undefined }}
        >
          <p className="mb-1.5 font-semibold text-gray-700">{tooltip.period}</p>
          {tooltip.values.map(v => (
            <div key={v.title} className="flex items-center gap-2 py-0.5">
              <span className="h-2 w-4 rounded-sm shrink-0" style={{ backgroundColor: v.color }} />
              <span className="text-gray-600">{v.title}</span>
              <span className="ml-auto font-semibold text-gray-900 tabular-nums">{v.ratio.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* x축 라벨 */}
      <div className="mt-1 flex justify-between px-9 text-[10px] text-gray-400">
        {labels.filter((_, i) => {
          const step = Math.max(1, Math.floor(labels.length / 12))
          return i % step === 0 || i === labels.length - 1
        }).map(l => <span key={l}>{l.slice(0, 7)}</span>)}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export default function DatalabResultClient() {
  const params = useSearchParams()
  const router = useRouter()
  const [payload, setPayload] = useState<DatalabPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DatalabResponse | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  // URL 파라미터 파싱
  useEffect(() => {
    const q = params.get('q')
    if (!q) return
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(q)))) as DatalabPayload
      setPayload(decoded)
    } catch {
      setError({ message: '잘못된 요청 파라미터입니다.' })
    }
  }, [params])

  // payload가 설정되면 API 호출
  useEffect(() => {
    if (!payload) return
    fetchData(payload)
  }, [payload])

  async function fetchData(p: DatalabPayload) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/blueberry/datalab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: p.startDate,
          endDate: p.endDate,
          timeUnit: p.timeUnit,
          keywordGroups: p.groups,
          device: p.device || undefined,
          gender: p.gender || undefined,
          ages: p.ages.length ? p.ages : undefined,
        }),
      })
      const data: DatalabResponse = await res.json()
      if (data.error) {
        setError({ message: data.error, detail: data.detail, status: data.status })
      } else {
        setResult(data)
      }
    } catch (e) {
      setError({ message: String(e) })
    } finally {
      setLoading(false)
    }
  }

  // CSV 다운로드
  function handleExport() {
    if (!result || !payload) return
    const rows: string[] = []
    rows.push(['기간', ...result.results.map(r => r.title)].join(','))
    const dataLen = result.results[0]?.data.length ?? 0
    for (let i = 0; i < dataLen; i++) {
      rows.push([
        result.results[0].data[i].period,
        ...result.results.map(r => String(r.data[i]?.ratio ?? '')),
      ].join(','))
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `datalab_trend_${payload.startDate}_${payload.endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!payload && !error) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        파라미터를 불러오는 중...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <button type="button" onClick={() => router.back()}
            className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            블루베리 / 검색어 트렌드
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">검색어 트렌드 결과</h1>
          {payload && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                payload.periodLabel,
                payload.deviceLabel,
                payload.genderLabel,
                payload.ageLabel,
              ].map((label, i) => (
                <span key={i} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
        {result && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => payload && fetchData(payload)} disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button type="button" onClick={handleExport}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        )}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center shadow-sm">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-[#1a3f7e]" />
          <p className="text-sm font-medium text-gray-600">Naver Datalab에서 데이터를 가져오는 중...</p>
          <p className="mt-1 text-xs text-gray-400">잠시만 기다려주세요</p>
        </div>
      )}

      {/* 오류 */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">{error.message}</p>
              {error.status === 403 && (
                <div className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-700 space-y-1">
                  <p className="font-semibold">해결 방법:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li><a href="https://developers.naver.com/apps/#/list" target="_blank" rel="noopener noreferrer" className="underline">Naver 개발자 센터 &gt; 내 애플리케이션</a>으로 이동</li>
                    <li>사용 중인 앱 선택 → <strong>API 설정</strong> 탭</li>
                    <li><strong>데이터랩(검색어 트렌드)</strong> 체크 후 저장</li>
                    <li>권한 반영까지 수 분 소요될 수 있음</li>
                  </ol>
                </div>
              )}
              {error.status === 401 && (
                <p className="mt-1 text-xs text-red-500">
                  .env의 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 값을 다시 확인해주세요.
                </p>
              )}
              {error.detail && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-red-400 hover:text-red-600">Naver 원본 오류 보기</summary>
                  <pre className="mt-1 rounded bg-red-100 p-2 text-[10px] text-red-600 whitespace-pre-wrap break-all">{error.detail}</pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 결과 */}
      {result && !loading && (
        <div className="space-y-6">

          {/* 범례 */}
          <div className="flex flex-wrap gap-3">
            {result.results.map((r, i) => (
              <div key={r.title} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm">
                <span className="h-3 w-6 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <div>
                  <p className="text-xs font-semibold text-gray-800">{r.title}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">{r.keywords.join(', ')}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 차트 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">검색량 상대 지수 추이</p>
                <p className="text-xs text-gray-400">
                  {result.startDate} ~ {result.endDate} · {result.timeUnit === 'date' ? '일별' : result.timeUnit === 'week' ? '주별' : '월별'}
                  <span className="ml-2 text-gray-300">|</span>
                  <span className="ml-2">0~100 기준 (가장 많이 검색된 기간 = 100)</span>
                </p>
              </div>
            </div>
            <TrendChart results={result.results} />
          </div>

          {/* 데이터 테이블 */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">상세 데이터</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">기간</th>
                    {result.results.map((r, i) => (
                      <th key={r.title} className="px-4 py-2.5 text-right text-xs font-semibold" style={{ color: COLORS[i % COLORS.length] }}>
                        {r.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.results[0].data.map((d, i) => (
                    <tr key={d.period} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2 text-xs font-medium text-gray-600">{d.period.slice(0, 10)}</td>
                      {result.results.map((r) => (
                        <td key={r.title} className="px-4 py-2 text-right text-xs tabular-nums text-gray-700">
                          {(r.data[i]?.ratio ?? 0).toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
