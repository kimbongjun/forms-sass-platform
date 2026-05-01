import {
  CardGridSkeleton,
  HeaderSkeleton,
  SectionSkeleton,
} from '@/components/common/LoadingSkeleton'

export default function ProjectGoalsLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <SectionSkeleton titleWidth="w-32" lines={2} />
      <CardGridSkeleton count={4} />
    </div>
  )
}
