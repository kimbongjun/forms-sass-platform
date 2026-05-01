import {
  HeaderSkeleton,
  SectionSkeleton,
  StatCardSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function ProjectInsightsLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {/* Charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="mt-5 h-48 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <SectionSkeleton titleWidth="w-52" lines={4} />
    </div>
  )
}
