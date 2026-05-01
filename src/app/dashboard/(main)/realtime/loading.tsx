import {
  HeaderSkeleton,
  SectionSkeleton,
  StatCardSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function RealtimeLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {/* Live feed area */}
      <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-6 w-16 rounded-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-4 flex-1" />
              <SkeletonBlock className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <SectionSkeleton titleWidth="w-44" lines={2} />
    </div>
  )
}
