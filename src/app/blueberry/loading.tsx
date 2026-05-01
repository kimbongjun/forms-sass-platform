import {
  CardGridSkeleton,
  HeaderSkeleton,
  SectionSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function BlueberryLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mt-4 h-8 w-28" />
            <SkeletonBlock className="mt-3 h-4 w-24" />
          </div>
        ))}
      </div>
      <SectionSkeleton titleWidth="w-40" lines={3} />
      <CardGridSkeleton count={4} />
    </div>
  )
}
