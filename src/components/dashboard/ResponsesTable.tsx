'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { FormField } from '@/types/database'

interface Submission {
  id: string
  created_at: string
  answers: Record<string, string | boolean | string[]>
}

interface ResponsesTableProps {
  submissions: Submission[]
  inputFields: FormField[]
  page: number
  totalPages: number
}

export default function ResponsesTable({ submissions, inputFields, page, totalPages }: ResponsesTableProps) {
  const [detailSub, setDetailSub] = useState<Submission | null>(null)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function formatValue(val: string | boolean | string[] | undefined): string {
    if (val === undefined || val === null || val === '') return '—'
    if (Array.isArray(val)) return val.join(', ') || '—'
    if (typeof val === 'boolean') return val ? '✅ 동의' : '❌ 미동의'
    return String(val)
  }

  return (
    <>
      {/* 상세 모달 */}
      {detailSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailSub(null)}>
          <div className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">응답 상세</p>
                <p className="text-xs text-gray-400">{formatDate(detailSub.created_at)}</p>
              </div>
              <button type="button" onClick={() => setDetailSub(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y divide-gray-50 p-5">
              {inputFields.map((f) => (
                <div key={f.id} className="py-3">
                  <p className="mb-1 text-xs font-medium text-gray-500">{f.label || '(제목 없음)'}</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                    {formatValue(detailSub.answers?.[f.id])}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">제출 시각</th>
                {inputFields.map((f) => (
                  <th key={f.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    <span className="block max-w-[160px] truncate">{f.label || '(제목 없음)'}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub, idx) => (
                <tr
                  key={sub.id}
                  onClick={() => setDetailSub(sub)}
                  className={[
                    'cursor-pointer border-b border-gray-50 transition-colors hover:bg-blue-50/40',
                    idx % 2 !== 0 ? 'bg-gray-50/40' : '',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDate(sub.created_at)}</td>
                  {inputFields.map((f) => (
                    <td key={f.id} className="px-4 py-3 text-gray-700">
                      <span className="block max-w-[200px] truncate">{formatValue(sub.answers?.[f.id])}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <a href={`?page=${page - 1}`} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              이전
            </a>
          )}
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          {page < totalPages && (
            <a href={`?page=${page + 1}`} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              다음
            </a>
          )}
        </div>
      )}
    </>
  )
}
