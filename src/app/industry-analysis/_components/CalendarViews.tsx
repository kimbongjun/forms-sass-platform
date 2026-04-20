'use client'

import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import type { IndustryAnalysisItem, IndustryCategory } from '@/types/database'
import { INDUSTRY_CATEGORY_META } from '@/types/database'

type ColorKey = 'blue' | 'purple' | 'pink' | 'cyan' | 'amber' | 'rose' | 'indigo' | 'green' | 'orange'

const DOT_COLOR: Record<ColorKey, string> = {
  blue: 'bg-blue-500', purple: 'bg-purple-500', pink: 'bg-pink-500',
  cyan: 'bg-cyan-500', amber: 'bg-amber-500', rose: 'bg-rose-500',
  indigo: 'bg-indigo-500', green: 'bg-green-500', orange: 'bg-orange-500',
}
const PILL_COLOR: Record<ColorKey, string> = {
  blue: 'bg-blue-100 text-blue-800', purple: 'bg-purple-100 text-purple-800',
  pink: 'bg-pink-100 text-pink-800', cyan: 'bg-cyan-100 text-cyan-800',
  amber: 'bg-amber-100 text-amber-800', rose: 'bg-rose-100 text-rose-800',
  indigo: 'bg-indigo-100 text-indigo-800', green: 'bg-green-100 text-green-800',
  orange: 'bg-orange-100 text-orange-800',
}

function catColor(cat: IndustryCategory): ColorKey {
  return (INDUSTRY_CATEGORY_META[cat]?.color ?? 'blue') as ColorKey
}

const WEEKDAYS_KO = ['월', '화', '수', '목', '금', '토', '일']

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// ── 주간 캘린더 ──────────────────────────────────────────────────
export function WeeklyCalendar({
  items,
  weekOffset,
  setWeekOffset,
}: {
  items: IndustryAnalysisItem[]
  weekOffset: number
  setWeekOffset: (n: number) => void
}) {
  // 현재 주의 월요일 계산
  const today = new Date()
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1 // 0=월
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const firstDay = days[0]
  const lastDay = days[6]
  const headerLabel = firstDay.getMonth() === lastDay.getMonth()
    ? `${firstDay.getFullYear()}년 ${firstDay.getMonth() + 1}월 ${firstDay.getDate()}일 ~ ${lastDay.getDate()}일`
    : `${firstDay.getFullYear()}년 ${firstDay.getMonth() + 1}월 ${firstDay.getDate()}일 ~ ${lastDay.getMonth() + 1}월 ${lastDay.getDate()}일`

  // 날짜별 아이템 매핑
  const byDay = new Map<string, IndustryAnalysisItem[]>()
  for (const day of days) byDay.set(toDateKey(day), [])

  for (const item of items) {
    const d = parseDate(item.published_at)
    if (!d) continue
    const key = toDateKey(d)
    if (byDay.has(key)) byDay.get(key)!.push(item)
  }

  const todayKey = toDateKey(today)

  return (
    <div>
      {/* 헤더 네비 */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setWeekOffset(weekOffset - 1)} className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-700">{headerLabel}</span>
        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          disabled={weekOffset >= 0}
          className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* 7열 그리드 */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, idx) => {
          const key = toDateKey(day)
          const dayItems = byDay.get(key) ?? []
          const isToday = key === todayKey
          const isSat = idx === 5
          const isSun = idx === 6

          return (
            <div key={key} className="min-h-[160px]">
              {/* 요일 헤더 */}
              <div className={`mb-2 rounded-xl py-2 text-center text-xs font-semibold ${isToday ? 'bg-gray-900 text-white' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-500'}`}>
                <div>{WEEKDAYS_KO[idx]}</div>
                <div className="text-sm">{day.getDate()}</div>
              </div>

              {/* 아이템 */}
              <div className="space-y-1.5">
                {dayItems.length === 0 && (
                  <div className="rounded-lg bg-gray-50 py-2 text-center text-xs text-gray-300">—</div>
                )}
                {dayItems.map(item => {
                  const ck = catColor(item.category)
                  return (
                    <div key={item.id} className={`rounded-lg p-2 text-xs leading-snug ${PILL_COLOR[ck]}`}>
                      <div className="flex items-start gap-1">
                        <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLOR[ck]}`} />
                        <span className="line-clamp-2 font-medium">{item.title}</span>
                      </div>
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-0.5 opacity-60 hover:opacity-100">
                          <ExternalLink className="h-2.5 w-2.5" /> 원문
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 월간 캘린더 ──────────────────────────────────────────────────
export function MonthlyCalendar({
  items,
  monthOffset,
  setMonthOffset,
}: {
  items: IndustryAnalysisItem[]
  monthOffset: number
  setMonthOffset: (n: number) => void
}) {
  const today = new Date()
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // 0=월

  // 앞 빈칸 + 날짜 배열
  const calDays: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)),
  ]
  // 6주 맞추기 (42칸)
  while (calDays.length % 7 !== 0) calDays.push(null)

  // 날짜별 아이템
  const byDay = new Map<string, IndustryAnalysisItem[]>()
  for (const item of items) {
    const d = parseDate(item.published_at)
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) continue
    const key = toDateKey(d)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(item)
  }

  const todayKey = toDateKey(today)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const selectedItems = selectedDay ? (byDay.get(selectedDay) ?? []) : []

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setMonthOffset(monthOffset - 1)} className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-700">{year}년 {month + 1}월</span>
        <button
          onClick={() => setMonthOffset(monthOffset + 1)}
          disabled={monthOffset >= 0}
          className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-gray-400">
        {WEEKDAYS_KO.map((d, i) => (
          <div key={d} className={i === 6 ? 'text-red-400' : i === 5 ? 'text-blue-400' : ''}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {calDays.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="h-20 rounded-xl" />
          const key = toDateKey(day)
          const dayItems = byDay.get(key) ?? []
          const isToday = key === todayKey
          const isSelected = key === selectedDay
          const dow = idx % 7

          return (
            <button
              key={key}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              className={`relative flex h-20 flex-col rounded-xl border p-1.5 text-left transition-all ${
                isSelected
                  ? 'border-gray-900 bg-gray-900 text-white ring-2 ring-gray-900/20'
                  : isToday
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className={`text-xs font-semibold ${isSelected ? 'text-white' : isToday ? 'text-blue-700' : dow === 6 ? 'text-red-400' : dow === 5 ? 'text-blue-500' : 'text-gray-700'}`}>
                {day.getDate()}
              </span>

              {/* 카테고리 도트 */}
              {dayItems.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-0.5 overflow-hidden">
                  {dayItems.slice(0, 4).map(item => {
                    const ck = catColor(item.category)
                    return (
                      <span key={item.id} className={`h-2 w-2 rounded-full ${isSelected ? 'bg-white/70' : DOT_COLOR[ck]}`} title={item.title} />
                    )
                  })}
                  {dayItems.length > 4 && (
                    <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>+{dayItems.length - 4}</span>
                  )}
                </div>
              )}
              {dayItems.length > 0 && (
                <span className={`absolute right-1.5 top-1 rounded-full px-1 py-0 text-xs ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {dayItems.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 선택 날짜 아이템 패널 */}
      {selectedDay && selectedItems.length > 0 && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold text-gray-500">
            {new Date(selectedDay).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 아이템 ({selectedItems.length}건)
          </p>
          <div className="space-y-3">
            {selectedItems.map(item => {
              const ck = catColor(item.category)
              return (
                <div key={item.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[ck]}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    {item.summary && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{item.summary}</p>}
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PILL_COLOR[ck]}`}>
                        {INDUSTRY_CATEGORY_META[item.category]?.label}
                      </span>
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700">
                          <ExternalLink className="h-3 w-3" /> 원문
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// useState를 사용하기 때문에 파일 상단에 임포트 필요
import { useState } from 'react'
