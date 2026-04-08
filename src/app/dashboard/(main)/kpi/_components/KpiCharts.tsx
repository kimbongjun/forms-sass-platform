'use client'

interface MonthlyPoint {
  month: string
  label: string
  count: number
  projectCount: number
}

interface Props {
  monthlyData: MonthlyPoint[]
}

function BarChart({
  data,
  valueKey,
  color,
  label,
}: {
  data: MonthlyPoint[]
  valueKey: 'count' | 'projectCount'
  color: string
  label: string
}) {
  const maxVal = Math.max(...data.map((d) => d[valueKey]), 1)
  const total = data.reduce((s, d) => s + d[valueKey], 0)

  return (
    <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
          최근 6개월 합계 {total.toLocaleString('ko-KR')}
        </span>
      </div>
      <p className="mb-5 text-xs text-gray-400">월별 추이</p>

      <div className="flex items-end gap-2 sm:gap-3">
        {data.map((d) => {
          const pct = Math.round((d[valueKey] / maxVal) * 100)
          return (
            <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-700">{d[valueKey] > 0 ? d[valueKey] : ''}</span>
              <div className="relative w-full overflow-hidden rounded-t-lg bg-gray-100" style={{ height: 80 }}>
                <div
                  className="absolute bottom-0 w-full rounded-t-lg transition-all duration-500"
                  style={{ height: `${pct}%`, backgroundColor: color, minHeight: d[valueKey] > 0 ? 4 : 0 }}
                />
              </div>
              <span className="text-[11px] text-gray-400">{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function KpiCharts({ monthlyData }: Props) {
  const hasSubmissions = monthlyData.some((d) => d.count > 0)
  const hasProjects = monthlyData.some((d) => d.projectCount > 0)

  if (!hasSubmissions && !hasProjects) {
    return (
      <div className="rounded-[28px] border-2 border-dashed border-gray-200 bg-white py-12 text-center">
        <p className="text-sm text-gray-400">아직 데이터가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {hasSubmissions && (
        <BarChart
          data={monthlyData}
          valueKey="count"
          color="#111827"
          label="월별 응답 수"
        />
      )}
      {hasProjects && (
        <BarChart
          data={monthlyData}
          valueKey="projectCount"
          color="#6366f1"
          label="월별 프로젝트 생성 수"
        />
      )}
    </div>
  )
}
