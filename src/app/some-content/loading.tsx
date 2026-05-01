import {
  CardGridSkeleton,
  HeaderSkeleton,
  SectionSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function SomeContentLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <SectionSkeleton titleWidth="w-44" lines={2} />
      <CardGridSkeleton count={6} />
    </div>
  )
}
