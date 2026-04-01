'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BarChart2, Download, ExternalLink } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { FormField } from '@/types/database'

const INPUT_TYPES = ['text', 'email', 'textarea', 'checkbox', 'select', 'radio', 'checkbox_group']
const STAT_TYPES = ['select', 'radio', 'checkbox_group']
const LOAD_LIMIT = 100

interface Submission {
  id: string
  answers: Record<string, unknown>
  created_at: string
}

interface ResponsesTabProps {
  projectId: string
  projectSlug: string
  fields: FormField[]
}

export default function ResponsesTab({ projectId, projectSlug, fields }: ResponsesTabProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('submissions')
      .select('id, answers, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(LOAD_LIMIT)
      .then(({ data }) => {
        setSubmissions((data as Submission[]) ?? [])
        setLoading(false)
      })
  }, [projectId])

  const inputFields = fields.filter((f) => INPUT_TYPES.includes(f.type))
  const statFields = fields.filter((f) => STAT_TYPES.includes(f.type))
  const total = submissions.length

  // Compute stats from loaded submissions
  const stats: Record<string, Record<string, number>> = {}
  for (const f of statFields) {
    stats[f.id] = {}
    for (const row of submissions) {
      const val = row.answers?.[f.id]
      if (Array.isArray(val)) {
        val.forEach((v) => { if (v) stats[f.id][v as string] = (stats[f.id][v as string] || 0) + 1 })
      } else if (typeof val === 'string' && val) {
        stats[f.id][val] = (stats[f.id][val] || 0) + 1
      }
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">불러오는 중...</p>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              총 <span className="text-2xl font-bold text-gray-900">{total}</span>건
              {total >= LOAD_LIMIT && <span className="ml-1 text-xs text-gray-400">(최근 {LOAD_LIMIT}건 기준)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {total > 0 && (
              <Link
                href={`/dashboard/${projectId}/responses/export`}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                CSV 내보내기
              </Link>
            )}
            <Link
              href={`/dashboard/${projectId}/responses`}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              전체 응답 보기
            </Link>
          </div>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 text-center">
            <BarChart2 className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-400">아직 응답이 없습니다</p>
            <p className="mt-1 text-xs text-gray-400">
              <Link href={`/${projectSlug}`} target="_blank" className="text-blue-500 hover:underline">
                폼 링크
              </Link>
              를 공유하여 응답을 받아보세요.
            </p>
          </div>
        ) : (
          <>
            {/* 통계 카드 */}
            {statFields.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">필드별 응답 통계</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {statFields.map((f) => {
                    const fieldStats = stats[f.id] ?? {}
                    const entries = Object.entries(fieldStats).sort((a, b) => b[1] - a[1])
                    const maxCount = entries[0]?.[1] ?? 1
                    return (
                      <div key={f.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="mb-3 text-sm font-semibold text-gray-800">{f.label || '(제목 없음)'}</p>
                        <div className="space-y-2">
                          {entries.length === 0 ? (
                            <p className="text-xs text-gray-400">응답 없음</p>
                          ) : entries.map(([opt, count]) => (
                            <div key={opt}>
                              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                                <span className="truncate max-w-[180px]">{opt}</span>
                                <span className="ml-2 shrink-0 font-medium">
                                  {count}건 ({Math.round(count / total * 100)}%)
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full bg-gray-900 transition-all"
                                  style={{ width: `${Math.round(count / maxCount * 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* 최근 응답 목록 */}
            {inputFields.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  최근 응답 (상위 10건)
                </h2>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                            제출 시각
                          </th>
                          {inputFields.slice(0, 3).map((f) => (
                            <th key={f.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 max-w-[160px]">
                              {f.label || '(제목 없음)'}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.slice(0, 10).map((sub) => (
                          <tr key={sub.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                              {new Intl.DateTimeFormat('ko-KR', {
                                month: '2-digit', day: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                                timeZone: 'Asia/Seoul',
                              }).format(new Date(sub.created_at))}
                            </td>
                            {inputFields.slice(0, 3).map((f) => {
                              const val = sub.answers?.[f.id]
                              const display = Array.isArray(val)
                                ? val.join(', ')
                                : typeof val === 'boolean'
                                  ? (val ? '✓' : '-')
                                  : String(val ?? '-')
                              return (
                                <td key={f.id} className="px-4 py-2.5 text-xs text-gray-700 max-w-[160px] truncate">
                                  {display}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {total > 10 && (
                  <p className="mt-2 text-center text-xs text-gray-400">
                    + {total - 10}건 더 있습니다.{' '}
                    <Link href={`/dashboard/${projectId}/responses`} className="text-blue-500 hover:underline">
                      전체 보기
                    </Link>
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
