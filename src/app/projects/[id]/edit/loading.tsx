import {
  HeaderSkeleton,
  SectionSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function ProjectEditLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      {Array.from({ length: 3 }).map((_, i) => (
        <SectionSkeleton key={i} titleWidth={i === 0 ? 'w-40' : 'w-32'} lines={3} />
      ))}
      <div className="flex justify-end gap-3">
        <SkeletonBlock className="h-10 w-24 rounded-xl" />
        <SkeletonBlock className="h-10 w-24 rounded-xl" />
      </div>
    </div>
  )
}
