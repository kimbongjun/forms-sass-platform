import {
  CardGridSkeleton,
  HeaderSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function ClippingsLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="flex gap-3">
        <SkeletonBlock className="h-10 flex-1 rounded-xl" />
        <SkeletonBlock className="h-10 w-28 rounded-xl" />
        <SkeletonBlock className="h-10 w-28 rounded-xl" />
      </div>
      <CardGridSkeleton count={6} />
    </div>
  )
}
