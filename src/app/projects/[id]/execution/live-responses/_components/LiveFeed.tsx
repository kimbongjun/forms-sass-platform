'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

interface Form {
  id: string
  title: string
  created_at: string
}

interface Submission {
  id: string
  project_id: string
  created_at: string
}

interface LiveFeedProps {
  workspaceId: string
  forms: Form[]
  initialSubmissions: Submission[]
  initialTotal: number
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
}

export default function LiveFeed({ workspaceId, forms, initialSubmissions, initialTotal }: LiveFeedProps) {
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions)
  const [total, setTotal] = useState(initialTotal)
  const [pulse, setPulse] = useState(false)
  const formIds = useRef(forms.map((f) => f.id))
  const formMap = new Map(forms.map((f) => [f.id, f]))

  useEffect(() => {
    if (formIds.current.length === 0) return

    const supabase = createClient()
    const channel = supabase
      .channel(`live-responses-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions',
          filter: `project_id=in.(${formIds.current.join(',')})`,
        },
        (payload) => {
          const newSub = payload.new as Submission
          setSubmissions((prev) => [newSub, ...prev].slice(0, 20))
          setTotal((prev) => prev + 1)
          setPulse(true)
          setTimeout(() => setPulse(false), 1500)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workspaceId])

  return (
    <>
      {/* 라이브 인디케이터 */}
      <div className="flex items-center gap-2">
        <span className={`relative flex h-2.5 w-2.5`}>
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 ${pulse ? 'opacity-100' : 'opacity-40'}`} />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-emerald-600">실시간 연결됨</span>
        <span className="ml-auto text-xs text-gray-400">누적 {total.toLocaleString('ko-KR')}건</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            <tr>
              <th className="px-4 py-3">폼</th>
              <th className="px-4 py-3">수집 시각</th>
              <th className="px-4 py-3">이동</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400 sm:py-10">
                  아직 수집된 응답이 없습니다.
                </td>
              </tr>
            ) : (
              submissions.map((sub) => {
                const form = formMap.get(sub.project_id)
                return (
                  <tr key={sub.id} className="border-t border-gray-100 transition-colors first:bg-emerald-50/30">
                    <td className="px-4 py-4 font-medium text-gray-900">{form?.title ?? '알 수 없는 폼'}</td>
                    <td className="px-4 py-4 text-gray-500">{formatDateTime(sub.created_at)}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/projects/${workspaceId}/execution/forms/${sub.project_id}?tab=responses`}
                        className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                      >
                        신청 현황 열기
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
