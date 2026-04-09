import { Suspense } from 'react'
import DatalabResultClient from './_components/DatalabResultClient'

export const metadata = { title: '검색어 트렌드 결과 — 블루베리' }

export default function DatalabResultPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32 text-gray-400 text-sm">
        로딩 중...
      </div>
    }>
      <DatalabResultClient />
    </Suspense>
  )
}
