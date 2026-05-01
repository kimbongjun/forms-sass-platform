import {
  HeaderSkeleton,
  SectionSkeleton,
  SkeletonBlock,
  TableRowSkeleton,
} from '@/components/common/LoadingSkeleton'

export default function CategoryLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="flex justify-end">
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
      </div>
      <SectionSkeleton titleWidth="w-32" lines={2} />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
