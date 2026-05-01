import {
  HeaderSkeleton,
  SectionSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function AccountLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      {/* Avatar section */}
      <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-5">
          <SkeletonBlock className="h-20 w-20 rounded-full" />
          <div className="space-y-3 flex-1">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-4 w-56" />
            <SkeletonBlock className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      </div>
      <SectionSkeleton titleWidth="w-48" lines={4} />
      <SectionSkeleton titleWidth="w-36" lines={2} />
    </div>
  )
}
