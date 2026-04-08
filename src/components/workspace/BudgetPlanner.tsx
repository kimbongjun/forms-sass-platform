'use client'

import { useMemo, useRef, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import type { ProjectBudgetItem } from '@/types/database'
import { formatNumberWithCommas, parseNullableNumberInput, parseNumberInput } from '@/utils/money'

interface BudgetPlannerProps {
  projectId: string
  initialTotalBudget: number
  initialCurrency: string
  initialItems: ProjectBudgetItem[]
  warning?: string | null
}

const ITEM_TYPE_OPTIONS: Array<{ value: ProjectBudgetItem['type']; label: string; color: string }> = [
  { value: 'media', label: '미디어', color: '#2563eb' },
  { value: 'production', label: '제작', color: '#8b5cf6' },
  { value: 'operation', label: '운영', color: '#14b8a6' },
  { value: 'staff', label: '인건비', color: '#f97316' },
  { value: 'venue', label: '행사장', color: '#ef4444' },
  { value: 'etc', label: '기타', color: '#6b7280' },
]

const CURRENCY_SYMBOL: Record<string, string> = {
  KRW: '₩',
  USD: '$',
  JPY: '¥',
  EUR: '€',
}

function createItem(id: string): ProjectBudgetItem {
  return {
    id,
    name: '',
    type: 'media',
    amount: 0,
    actual_amount: null,
    min_amount: null,
    max_amount: null,
    weight: 0,
  }
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900'

export default function BudgetPlanner({
  projectId,
  initialTotalBudget,
  initialCurrency,
  initialItems,
  warning,
}: BudgetPlannerProps) {
  const itemIdRef = useRef(initialItems.length || 1)
  const [totalBudget, setTotalBudget] = useState(initialTotalBudget)
  const [currency, setCurrency] = useState(initialCurrency || 'KRW')
  const [items, setItems] = useState(initialItems.length > 0 ? initialItems : [createItem('budget-item-1')])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const currencySymbol = CURRENCY_SYMBOL[currency] ?? currency

  const totalPlanned = useMemo(() => items.reduce((s, i) => s + (Number(i.amount) || 0), 0), [items])
  const totalActual = useMemo(() => items.reduce((s, i) => s + (Number(i.actual_amount) || 0), 0), [items])
  const utilizationRate = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0

  const chartData = useMemo(() => {
    const normalized = items
      .map((item) => ({ ...item, weight: Math.max(0, Number(item.weight) || 0) }))
      .filter((item) => item.name.trim() && item.weight > 0)
    const totalWeight = normalized.reduce((sum, item) => sum + item.weight, 0)

    let current = 0
    const gradientStops: string[] = []
    const legend = normalized.map((item) => {
      const pct = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0
      const itemType = ITEM_TYPE_OPTIONS.find((type) => type.value === item.type)
      const from = current
      const to = current + pct
      current = to
      gradientStops.push(`${itemType?.color ?? '#6b7280'} ${from}% ${to}%`)
      return {
        ...item,
        pct,
        color: itemType?.color ?? '#6b7280',
        typeLabel: itemType?.label ?? item.type,
      }
    })

    return {
      totalWeight,
      legend,
      gradient: gradientStops.length > 0 ? `conic-gradient(${gradientStops.join(', ')})` : '',
    }
  }, [items])

  function updateItem(id: string, patch: Partial<ProjectBudgetItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)))
  }

  function addItem() {
    itemIdRef.current += 1
    setItems((prev) => [...prev, createItem(`budget-item-${itemIdRef.current}`)])
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/projects/${projectId}/budget`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalBudget, currency, items }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '예산 저장에 실패했습니다.')
      setNotice('예산 계획이 저장되었습니다.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {warning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {warning}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      )}

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        {totalActual > 0 && (
          <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-900">집행률</span>
              <span className={`font-bold ${utilizationRate > 100 ? 'text-red-600' : 'text-gray-900'}`}>
                {utilizationRate}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all ${utilizationRate > 100 ? 'bg-red-500' : 'bg-gray-900'}`}
                style={{ width: `${Math.min(utilizationRate, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>집행 {currencySymbol}{formatNumberWithCommas(totalActual)}</span>
              <span>계획 {currencySymbol}{formatNumberWithCommas(totalPlanned)}</span>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">총 예산</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {currencySymbol}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={formatNumberWithCommas(totalBudget)}
                onChange={(event) => setTotalBudget(parseNumberInput(event.target.value))}
                placeholder="예) 1,000"
                className={`${inputCls} pl-7`}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              프로젝트 전체 예산 기준값입니다. 항목별 비중과 비교할 때 기준선으로 사용됩니다.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">통화 (기본 KRW)</label>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} className={inputCls}>
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
              <option value="JPY">JPY</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">입력 가이드</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <strong>범위 최소/최대</strong>: 협의 가능한 예산 상한/하한입니다.
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <strong>예산 금액</strong>: 실제로 배정하려는 계획 금액입니다. 차트와 총합 검토의 기준이 됩니다.
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <strong>실집행</strong>: 실제로 집행된 금액입니다. 입력하면 항목별·전체 집행률을 확인할 수 있습니다.
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <strong>비중</strong>: 도넛 차트에서 각 항목이 차지하는 전략적 우선순위입니다.
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">예산 항목</h3>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            항목 추가
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const itemActual = Number(item.actual_amount) || 0
            const itemPlanned = Number(item.amount) || 0
            const itemRate = itemPlanned > 0 ? Math.round((itemActual / itemPlanned) * 100) : null

            return (
            <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid gap-3 lg:grid-cols-7">
                <input
                  type="text"
                  value={item.name}
                  onChange={(event) => updateItem(item.id, { name: event.target.value })}
                  placeholder="항목명"
                  className={inputCls}
                />
                <select
                  value={item.type}
                  onChange={(event) => updateItem(item.id, { type: event.target.value as ProjectBudgetItem['type'] })}
                  className={inputCls}
                >
                  {ITEM_TYPE_OPTIONS.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currencySymbol}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={item.min_amount == null ? '' : formatNumberWithCommas(item.min_amount)}
                    onChange={(event) =>
                      updateItem(item.id, {
                        min_amount: parseNullableNumberInput(event.target.value),
                      })
                    }
                    placeholder="범위 최소"
                    className={`${inputCls} pl-7`}
                  />
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currencySymbol}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={item.max_amount == null ? '' : formatNumberWithCommas(item.max_amount)}
                    onChange={(event) =>
                      updateItem(item.id, {
                        max_amount: parseNullableNumberInput(event.target.value),
                      })
                    }
                    placeholder="범위 최대"
                    className={`${inputCls} pl-7`}
                  />
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currencySymbol}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithCommas(item.amount)}
                    onChange={(event) => updateItem(item.id, { amount: parseNumberInput(event.target.value) })}
                    placeholder="예산 금액"
                    className={`${inputCls} pl-7`}
                  />
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currencySymbol}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={item.actual_amount == null ? '' : formatNumberWithCommas(item.actual_amount)}
                    onChange={(event) =>
                      updateItem(item.id, { actual_amount: parseNullableNumberInput(event.target.value) })
                    }
                    placeholder="실집행"
                    className={`${inputCls} pl-7 ${itemRate !== null && itemRate > 100 ? 'border-red-300 focus:ring-red-200' : ''}`}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithCommas(item.weight)}
                    onChange={(event) => updateItem(item.id, { weight: parseNumberInput(event.target.value) })}
                    placeholder="비중"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-red-200 px-3 text-red-500 transition-colors hover:bg-red-50"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {itemRate !== null && (
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                    <span>집행률</span>
                    <span className={itemRate > 100 ? 'font-semibold text-red-600' : ''}>{itemRate}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full ${itemRate > 100 ? 'bg-red-500' : 'bg-gray-700'}`}
                      style={{ width: `${Math.min(itemRate, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">비중 시각화</h3>
        <div className="mt-5 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col items-center justify-center">
            <div
              className="h-56 w-56 rounded-full border border-gray-200"
              style={{
                background: chartData.gradient || 'conic-gradient(#e5e7eb 0% 100%)',
              }}
            />
            <p className="mt-3 text-xs text-gray-500">
              총 비중 합계: {chartData.totalWeight.toLocaleString('ko-KR')}
            </p>
          </div>
          <div className="space-y-3">
            {chartData.legend.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center text-sm text-gray-400">
                비중이 있는 항목을 입력하면 차트가 표시됩니다.
              </div>
            ) : (
              chartData.legend.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs font-medium text-gray-500">
                      {item.pct.toFixed(1)}% ({item.weight.toLocaleString('ko-KR')})
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">
                    {item.typeLabel}
                    {' · '}
                    {currencySymbol}{formatNumberWithCommas(item.amount)} ({currency})
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
