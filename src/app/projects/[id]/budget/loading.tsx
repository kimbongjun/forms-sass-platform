import {
  HeaderSkeleton,
  SectionSkeleton,
  StatCardSkeleton,
  TableRowSkeleton,
} from '@/components/common/LoadingSkeleton'

export default function ProjectBudgetLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <SectionSkeleton titleWidth="w-36" lines={2} />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
