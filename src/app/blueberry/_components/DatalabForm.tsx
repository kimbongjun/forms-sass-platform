'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, BarChart2, Calendar } from 'lucide-react'
import { DateRangePickerInput } from '@/components/common/DatePickerInput'

// ── 타입 ──────────────────────────────────────────────────────────
interface TopicGroup {
  id: string
  groupName: string
  keywords: string  // 쉼표 구분
}

type PeriodType = 'all' | '1m' | '3m' | '1y' | 'custom'
type DeviceType = '' | 'pc' | 'mo'
type GenderType = '' | 'f' | 'm'
type AgeType = 'all' | '1020' | '2030' | '3040' | '4050' | '60plus'

// Naver Datalab 연령 코드
const AGE_MAP: Record<AgeType, string[]> = {
  all: [],
  '1020': ['2'],           // 13–18
  '2030': ['3', '4'],      // 19–24, 25–29
  '3040': ['5', '6'],      // 30–34, 35–39
  '4050': ['7', '8'],      // 40–44, 45–49
  '60plus': ['11'],        // 60+
}

const PERIOD_LABEL: Record<PeriodType, string> = {
  all: '전체', '1m': '1개월', '3m': '3개월', '1y': '1년', custom: '직접 입력',
}

// ── 날짜 범위 계산 ─────────────────────────────────────────────────
function getDateRange(
  period: PeriodType,
  customStart: string,
  customEnd: string,
): { startDate: string; endDate: string; timeUnit: 'date' | 'week' | 'month' } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const today = new Date()
  const endDate = fmt(today)

  if (period === 'custom') {
    // 기간에 따라 timeUnit 자동 결정
    const days = (new Date(customEnd).getTime() - new Date(customStart).getTime()) / 86400000
    return {
      startDate: customStart,
      endDate: customEnd,
      timeUnit: days <= 31 ? 'date' : days <= 90 ? 'week' : 'month',
    }
  }
  if (period === '1m') {
    const s = new Date(today); s.setMonth(s.getMonth() - 1)
    return { startDate: fmt(s), endDate, timeUnit: 'date' }
  }
  if (period === '3m') {
    const s = new Date(today); s.setMonth(s.getMonth() - 3)
    return { startDate: fmt(s), endDate, timeUnit: 'week' }
  }
  if (period === '1y') {
    const s = new Date(today); s.setFullYear(s.getFullYear() - 1)
    return { startDate: fmt(s), endDate, timeUnit: 'month' }
  }
  // all
  return { startDate: '2016-01-01', endDate, timeUnit: 'month' }
}

// ── 컴포넌트 ──────────────────────────────────────────────────────
export default function DatalabForm() {
  const router = useRouter()

  const [groups, setGroups] = useState<TopicGroup[]>([
    { id: '1', groupName: '', keywords: '' },
  ])
  const [periodType, setPeriodType] = useState<PeriodType>('1y')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [device, setDevice] = useState<DeviceType>('')
  const [gender, setGender] = useState<GenderType>('')
  const [ageGroup, setAgeGroup] = useState<AgeType>('all')

  // ── 그룹 조작 ────────────────────────────────────────────────────
  function addGroup() {
    if (groups.length >= 10) return
    setGroups(prev => [...prev, { id: Date.now().toString(), groupName: '', keywords: '' }])
  }

  function removeGroup(id: string) {
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  function updateGroup(id: string, field: 'groupName' | 'keywords', raw: string) {
    if (field === 'keywords') {
      // 키워드 20개 초과 시 자동 잘라냄
      const parts = raw.split(',')
      if (parts.length > 20) raw = parts.slice(0, 20).join(',')
    }
    setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: raw } : g))
  }

  function keywordCount(keywords: string) {
    return keywords.split(',').map(k => k.trim()).filter(Boolean).length
  }

  // ── 유효성 ────────────────────────────────────────────────────────
  const customValid = periodType !== 'custom' || (!!customStart && !!customEnd && customStart <= customEnd)
  const hasValidGroup = groups.some(g => g.groupName.trim() && g.keywords.trim())
  const canSubmit = hasValidGroup && customValid

  // ── 조회 실행 → /blueberry/datalab 페이지로 이동 ─────────────────
  function handleSubmit() {
    if (!canSubmit) return

    const validGroups = groups
      .filter(g => g.groupName.trim() && g.keywords.trim())
      .map(g => ({
        groupName: g.groupName.trim(),
        keywords: g.keywords.split(',').map(k => k.trim()).filter(Boolean).slice(0, 20),
      }))

    const { startDate, endDate, timeUnit } = getDateRange(periodType, customStart, customEnd)

    const payload = {
      groups: validGroups,
      startDate,
      endDate,
      timeUnit,
      device,
      gender,
      ages: AGE_MAP[ageGroup],
      // 표시용 메타
      periodLabel: PERIOD_LABEL[periodType],
      deviceLabel: device === 'pc' ? 'PC' : device === 'mo' ? '모바일' : '전체',
      genderLabel: gender === 'f' ? '여성' : gender === 'm' ? '남성' : '전체',
      ageLabel: ageGroup === 'all' ? '전체' : ageGroup === '1020' ? '10~20대' : ageGroup === '2030' ? '20~30대' : ageGroup === '3040' ? '30~40대' : ageGroup === '4050' ? '40~50대' : '60대~',
    }

    // base64 인코딩으로 URL 파라미터 전달
    const q = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    router.push(`/blueberry/datalab?q=${q}`)
  }

  // ── UI ───────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#1a3f7e]" />
            검색어 트렌드
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            주제어·검색어를 입력해 네이버 검색 트렌드를 분석합니다 (Naver Datalab 기반)
          </p>
        </div>
      </div>

      {/* 주제어 입력 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500">주제어 설정 <span className="text-gray-400">({groups.length}/10)</span></p>
        {groups.map((group, idx) => (
          <div key={group.id} className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-gray-400 w-12">주제어 {idx + 1}</span>
            <input
              type="text"
              value={group.groupName}
              onChange={e => updateGroup(group.id, 'groupName', e.target.value)}
              placeholder="주제어 (예: 볼뉴머)"
              className="w-32 shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1a3f7e] focus:outline-none focus:ring-2 focus:ring-[#e8eef7]"
            />
            <div className="relative flex-1">
              <input
                type="text"
                value={group.keywords}
                onChange={e => updateGroup(group.id, 'keywords', e.target.value)}
                onPaste={e => {
                  e.preventDefault()
                  const pasted = e.clipboardData.getData('text')
                  // 공백(스페이스·탭·줄바꿈)을 쉼표로 변환, 연속 쉼표 정리
                  const converted = pasted
                    .replace(/[\t\n\r]+/g, ',')   // 탭·줄바꿈 → 쉼표
                    .replace(/ +/g, ',')            // 스페이스 → 쉼표
                    .replace(/,{2,}/g, ',')         // 연속 쉼표 → 단일 쉼표
                    .replace(/^,|,$/g, '')          // 앞뒤 쉼표 제거
                  const el = e.currentTarget
                  const start = el.selectionStart ?? 0
                  const end = el.selectionEnd ?? 0
                  const next = group.keywords.slice(0, start) + converted + group.keywords.slice(end)
                  updateGroup(group.id, 'keywords', next)
                  // 커서 위치 복원 (비동기)
                  requestAnimationFrame(() => {
                    el.setSelectionRange(start + converted.length, start + converted.length)
                  })
                }}
                placeholder="검색어를 쉼표로 구분 입력 (최대 20개) — 볼뉴머, 볼뉴머 후기, 볼뉴머 가격, ..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 pr-14 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1a3f7e] focus:outline-none focus:ring-2 focus:ring-[#e8eef7]"
              />
              <span className={[
                'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium tabular-nums',
                keywordCount(group.keywords) >= 20 ? 'text-amber-500' : 'text-gray-400',
              ].join(' ')}>
                {keywordCount(group.keywords)}/20
              </span>
            </div>
            {groups.length > 1 && (
              <button type="button" onClick={() => removeGroup(group.id)}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {groups.length < 10 && (
          <button type="button" onClick={addGroup}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-4 py-2 text-xs text-gray-500 hover:border-[#1a3f7e] hover:text-[#1a3f7e] transition-colors">
            <Plus className="h-3.5 w-3.5" />
            주제어 추가
          </button>
        )}
      </div>

      {/* 필터 */}
      <div className="space-y-3 border-t border-gray-100 pt-4">

        {/* 기간 */}
        <FilterRow label="기간">
          <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
            {(['all', '1m', '3m', '1y', 'custom'] as PeriodType[]).map(p => (
              <button key={p} type="button" onClick={() => setPeriodType(p)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1',
                  periodType === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}>
                {p === 'custom' ? <><Calendar className="h-3 w-3" />직접 입력</> : PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          {periodType === 'custom' && (
            <div className="mt-2 w-72">
              <DateRangePickerInput
                from={customStart}
                to={customEnd}
                onChange={({ from, to }) => { setCustomStart(from); setCustomEnd(to) }}
                placeholder="시작일 - 종료일 선택"
              />
            </div>
          )}
        </FilterRow>

        {/* 범위 */}
        <FilterRow label="범위">
          <SegmentControl
            options={[['', '전체'], ['pc', 'PC'], ['mo', '모바일']] as [string, string][]}
            value={device}
            onChange={v => setDevice(v as DeviceType)}
          />
        </FilterRow>

        {/* 성별 */}
        <FilterRow label="성별">
          <SegmentControl
            options={[['', '전체'], ['f', '여성'], ['m', '남성']] as [string, string][]}
            value={gender}
            onChange={v => setGender(v as GenderType)}
          />
        </FilterRow>

        {/* 연령대 */}
        <FilterRow label="연령대">
          <SegmentControl
            options={[
              ['all', '전체'],
              ['1020', '10~20대'],
              ['2030', '20~30대'],
              ['3040', '30~40대'],
              ['4050', '40~50대'],
              ['60plus', '60대~'],
            ] as [string, string][]}
            value={ageGroup}
            onChange={v => setAgeGroup(v as AgeType)}
          />
        </FilterRow>
      </div>

      {/* 조회 버튼 */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        {!hasValidGroup && (
          <p className="text-xs text-gray-400">주제어와 검색어를 1개 이상 입력해주세요</p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-2xl bg-[#1a3f7e] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#132d5c] disabled:opacity-40 transition-colors">
          <BarChart2 className="h-4 w-4" />
          네이버 검색 데이터 조회
        </button>
      </div>
    </div>
  )
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <span className="mt-2 text-xs font-medium text-gray-500 w-12 shrink-0">{label}</span>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function SegmentControl({
  options, value, onChange,
}: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
      {options.map(([val, label]) => (
        <button key={val} type="button" onClick={() => onChange(val)}
          className={[
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            value === val ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}>
          {label}
        </button>
      ))}
    </div>
  )
}
