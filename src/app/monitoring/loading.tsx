import {
  HeaderSkeleton,
  SectionSkeleton,
  SkeletonBlock,
  StatCardSkeleton,
} from '@/components/common/LoadingSkeleton'

export default function MonitoringLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {/* Monitor list */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto' }}
          >
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-3/4" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
            <SkeletonBlock className="h-6 w-16 rounded-full" />
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-4 w-16" />
            <SkeletonBlock className="h-8 w-8 rounded-lg" />
          </div>
        ))}
      </div>
      <SectionSkeleton titleWidth="w-36" lines={3} />
    </div>
  )
}
