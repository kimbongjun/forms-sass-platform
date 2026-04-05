'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart2, Download } from 'lucide-react'
import { SectionSkeleton, SkeletonBlock } from '@/components/common/LoadingSkeleton'
import { createClient } from '@/utils/supabase/client'
import type { FormField } from '@/types/database'
import { stripHtml } from '@/utils/rich-text'

const INPUT_TYPES = ['text', 'email', 'textarea', 'checkbox', 'select', 'radio', 'checkbox_group', 'date']
const STAT_TYPES = ['select', 'radio', 'checkbox_group']
const LOAD_LIMIT = 100

interface Submission {
  id: string
  answers: Record<string, unknown>
  created_at: string
}

interface ResponsesTabProps {
  workspaceId: string
  projectId: string
  projectSlug: string
  fields: FormField[]
}

export default function ResponsesTab({ workspaceId, projectId, projectSlug, fields }: ResponsesTabProps) {
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

  const inputFields = fields.filter((field) => INPUT_TYPES.includes(field.type))
  const statFields = fields.filter((field) => STAT_TYPES.includes(field.type))
  const total = submissions.length

  const stats: Record<string, Record<string, number>> = {}
  for (const field of statFields) {
    stats[field.id] = {}
    for (const row of submissions) {
      const value = row.answers?.[field.id]
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item) stats[field.id][String(item)] = (stats[field.id][String(item)] || 0) + 1
        })
      } else if (typeof value === 'string' && value) {
        stats[field.id][value] = (stats[field.id][value] || 0) + 1
      }
    }
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-8 w-24" />
            </div>
            <SkeletonBlock className="h-9 w-28 rounded-lg" />
          </div>
          <SectionSkeleton titleWidth="w-40" lines={4} />
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <SkeletonBlock className="h-4 w-32" />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid grid-cols-4 gap-4">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="h-4 w-full" />
                  <SkeletonBlock className="h-4 w-full" />
                  <SkeletonBlock className="h-4 w-full" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              총 <span className="text-2xl font-bold text-gray-900">{total}</span>건
              {total >= LOAD_LIMIT && <span className="ml-1 text-xs text-gray-400">(최근 {LOAD_LIMIT}건 기준)</span>}
            </p>
          </div>
          {total > 0 && (
            <a
              href={`/projects/${workspaceId}/execution/forms/${projectId}/export`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV 내보내기
            </a>
          )}
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-24 text-center">
            <BarChart2 className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-400">아직 응답이 없습니다.</p>
            <p className="mt-1 text-xs text-gray-400">
              <Link href={`/${projectSlug}`} target="_blank" className="text-blue-500 hover:underline">
                공개 폼
              </Link>
              을 공유해 응답을 받아보세요.
            </p>
          </div>
        ) : (
          <>
            {statFields.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">선택형 응답 통계</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {statFields.map((field) => {
                    const fieldStats = stats[field.id] ?? {}
                    const entries = Object.entries(fieldStats).sort((a, b) => b[1] - a[1])
                    const maxCount = entries[0]?.[1] ?? 1

                    return (
                      <div key={field.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                        <p className="mb-3 text-sm font-semibold text-gray-800">{stripHtml(field.label) || '(제목 없음)'}</p>
                        <div className="space-y-2">
                          {entries.length === 0 ? (
                            <p className="text-xs text-gray-400">응답 없음</p>
                          ) : entries.map(([option, count]) => (
                            <div key={option}>
                              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                                <span className="truncate max-w-[180px]">{option}</span>
                                <span className="ml-2 shrink-0 font-medium">
                                  {count}건 ({Math.round((count / total) * 100)}%)
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full bg-gray-900 transition-all"
                                  style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
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

            {inputFields.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">최근 응답 (상위 10건)</h2>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-gray-600">
                            제출 시각
                          </th>
                          {inputFields.slice(0, 3).map((field) => (
                            <th key={field.id} className="max-w-[160px] px-4 py-3 text-left text-xs font-semibold text-gray-600">
                              {stripHtml(field.label) || '(제목 없음)'}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.slice(0, 10).map((submission) => (
                          <tr key={submission.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                              {new Intl.DateTimeFormat('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Asia/Seoul',
                              }).format(new Date(submission.created_at))}
                            </td>
                            {inputFields.slice(0, 3).map((field) => {
                              const value = submission.answers?.[field.id]
                              const display = Array.isArray(value)
                                ? value.join(', ')
                                : typeof value === 'boolean'
                                  ? (value ? '예' : '-')
                                  : String(value ?? '-')

                              return (
                                <td key={field.id} className="max-w-[160px] truncate px-4 py-2.5 text-xs text-gray-700">
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
                    + {total - 10}건의 추가 응답은 이 폼의 신청 현황 탭에서 계속 확인할 수 있습니다.
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
