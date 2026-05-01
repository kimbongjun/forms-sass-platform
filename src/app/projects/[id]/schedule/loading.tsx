import {
  HeaderSkeleton,
  SkeletonBlock,
} from '@/components/common/LoadingSkeleton'

export default function ProjectScheduleLoading() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      {/* Gantt chart area */}
      <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        {/* Header row */}
        <div className="flex gap-2 mb-4">
          <SkeletonBlock className="h-8 w-40 rounded-xl" />
          <div className="flex-1 flex gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-8 flex-1 rounded-lg" />
            ))}
          </div>
        </div>
        {/* Gantt rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2 mb-3 items-center">
            <SkeletonBlock className="h-6 w-40 rounded-lg" />
            <div className="flex-1 relative h-6">
              <div
                className="absolute h-6"
                style={{ left: `${(i * 11) % 60}%`, width: `${20 + (i * 7) % 40}%` }}
              >
                <SkeletonBlock className="h-6 w-full rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
