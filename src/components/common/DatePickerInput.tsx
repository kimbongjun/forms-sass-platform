'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { DayPicker, type DateRange } from 'react-day-picker'

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function toDate(value: string | null | undefined) {
  if (!value) return undefined
  return parseISO(`${value}T00:00:00`)
}

function toValue(date: Date | undefined) {
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

function formatLabel(date: Date | undefined, placeholder: string) {
  if (!date) return placeholder
  return format(date, 'yyyy년 M월 d일', { locale: ko })
}

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, onClose])

  return ref
}

const baseDayPickerClassNames = {
  root: 'rdp-root',
  months: 'flex flex-col gap-4 sm:flex-row',
  month: 'space-y-4',
  month_caption: 'flex items-center justify-center px-2 pt-2 relative',
  caption_label: 'text-base font-semibold text-gray-900',
  nav: 'flex items-center gap-1 absolute inset-x-0 justify-between px-1',
  button_previous: 'flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900',
  button_next: 'flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900',
  month_grid: 'w-full border-collapse',
  weekdays: 'grid grid-cols-7 gap-1',
  weekday: 'py-2 text-center text-xs font-semibold text-gray-400',
  week: 'mt-1 grid grid-cols-7 gap-1',
  day: 'h-10 w-10 p-0 font-medium',
  day_button: 'h-10 w-10 rounded-full text-sm transition-colors hover:bg-gray-100 hover:text-gray-900',
  today: 'text-gray-900',
  outside: 'text-gray-300 opacity-60',
  disabled: 'text-gray-300 opacity-40',
  selected: 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white',
  range_start: 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white',
  range_end: 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white',
  range_middle: 'bg-blue-50 text-gray-900 rounded-none hover:bg-blue-50',
}

interface DatePickerInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  min?: string
  max?: string
  className?: string
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = '날짜 선택',
  min,
  max,
  className,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useOutsideClose(open, () => setOpen(false))
  const selected = useMemo(() => toDate(value), [value])
  const disabledDays = useMemo(() => {
    const matchers = []
    if (min) matchers.push({ before: toDate(min)! })
    if (max) matchers.push({ after: toDate(max)! })
    return matchers.length > 0 ? matchers : undefined
  }, [max, min])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-900 shadow-sm transition-colors hover:border-gray-300"
      >
        <span className={cn(selected ? 'text-gray-900' : 'text-gray-400')}>
          {formatLabel(selected, placeholder)}
        </span>
        <CalendarDays className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-40 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
          <DayPicker
            locale={ko}
            mode="single"
            selected={selected}
            onSelect={(date) => {
              onChange(toValue(date))
              if (date) setOpen(false)
            }}
            startMonth={min ? toDate(min) : undefined}
            endMonth={max ? toDate(max) : undefined}
            disabled={disabledDays}
            classNames={baseDayPickerClassNames}
            components={{
              Chevron: ({ orientation, className: iconClassName }) =>
                orientation === 'left'
                  ? <ChevronLeft className={iconClassName} />
                  : <ChevronRight className={iconClassName} />,
            }}
          />
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-400">YYYY-MM-DD 형식으로 저장됩니다.</p>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
                초기화
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface DateRangePickerInputProps {
  from: string
  to: string
  onChange: (value: { from: string; to: string }) => void
  placeholder?: string
  className?: string
}

export function DateRangePickerInput({
  from,
  to,
  onChange,
  placeholder = '기간 선택',
  className,
}: DateRangePickerInputProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useOutsideClose(open, () => setOpen(false))
  const selected = useMemo<DateRange | undefined>(() => ({
    from: toDate(from),
    to: toDate(to),
  }), [from, to])

  const label = useMemo(() => {
    if (selected?.from && selected?.to) {
      return `${format(selected.from, 'yyyy년 M월 d일', { locale: ko })} - ${format(selected.to, 'yyyy년 M월 d일', { locale: ko })}`
    }
    if (selected?.from) {
      return `${format(selected.from, 'yyyy년 M월 d일', { locale: ko })} - 종료일 선택`
    }
    return placeholder
  }, [placeholder, selected])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-900 shadow-sm transition-colors hover:border-gray-300"
      >
        <span className={cn(selected?.from ? 'text-gray-900' : 'text-gray-400')}>{label}</span>
        <CalendarDays className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-40 rounded-[28px] border border-gray-200 bg-white p-4 shadow-2xl">
          <DayPicker
            locale={ko}
            mode="range"
            selected={selected}
            onSelect={(range) => {
              onChange({
                from: toValue(range?.from),
                to: toValue(range?.to),
              })
            }}
            numberOfMonths={1}
            classNames={baseDayPickerClassNames}
            components={{
              Chevron: ({ orientation, className: iconClassName }) =>
                orientation === 'left'
                  ? <ChevronLeft className={iconClassName} />
                  : <ChevronRight className={iconClassName} />,
            }}
          />
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-400">
              {from && to ? `${from} - ${to}` : '시작일과 종료일을 순서대로 선택하세요.'}
            </p>
            {(from || to) && (
              <button
                type="button"
                onClick={() => onChange({ from: '', to: '' })}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
                초기화
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
