import {
  HeaderSkeleton,
  SectionSkeleton,
  SkeletonBlock,
  StatCardSkeleton,
} from '@/components/common/LoadingSkeleton'

export default function LiveResponsesLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {/* Live indicator */}
      <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="h-6 w-16 rounded-full" />
        </div>
        <SectionSkeleton titleWidth="w-0" lines={5} />
      </div>
    </div>
  )
}
