import {
  HeaderSkeleton,
  SectionSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function DatalabLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      {/* Search/filter bar */}
      <div className="flex gap-3">
        <SkeletonBlock className="h-10 flex-1 rounded-xl" />
        <SkeletonBlock className="h-10 w-28 rounded-xl" />
      </div>
      {/* Chart area */}
      <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <SkeletonBlock className="h-5 w-40" />
        <SkeletonBlock className="mt-6 h-56 w-full rounded-xl" />
      </div>
      <SectionSkeleton titleWidth="w-48" lines={4} />
    </div>
  )
}
