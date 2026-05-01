import {
  HeaderSkeleton,
  SectionSkeleton,
  StatCardSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function KpiLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {/* Chart area */}
      <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <SkeletonBlock className="h-5 w-48" />
        <SkeletonBlock className="mt-6 h-64 w-full rounded-xl" />
      </div>
      <SectionSkeleton titleWidth="w-40" lines={3} />
    </div>
  )
}
