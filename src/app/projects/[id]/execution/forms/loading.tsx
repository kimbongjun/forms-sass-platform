import {
  CardGridSkeleton,
  HeaderSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function ProjectFormsLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="flex gap-3 justify-end">
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
      </div>
      <CardGridSkeleton count={4} />
    </div>
  )
}
