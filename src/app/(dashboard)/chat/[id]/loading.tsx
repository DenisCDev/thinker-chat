import { Skeleton } from '@/components/ui/skeleton'

export default function ConversationLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Messages skeleton */}
      <div className="flex-1 p-4 space-y-6 max-w-4xl mx-auto w-full">
        {/* User message */}
        <div className="flex gap-3 justify-end">
          <div className="space-y-2 max-w-[70%]">
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        </div>

        {/* Assistant message */}
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>

        {/* User message */}
        <div className="flex gap-3 justify-end">
          <div className="space-y-2 max-w-[70%]">
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        </div>

        {/* Assistant message */}
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* Input skeleton */}
      <div className="p-4 max-w-4xl mx-auto w-full">
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  )
}
