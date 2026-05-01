import {
  HeaderSkeleton,
  SkeletonBlock,
  StatCardSkeleton,
  TableRowSkeleton,
} from '@/components/common/LoadingSkeleton'

export default function ProjectTasksLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="flex gap-3">
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
        <SkeletonBlock className="h-10 w-28 rounded-xl" />
        <div className="flex-1" />
        <SkeletonBlock className="h-10 w-28 rounded-xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
