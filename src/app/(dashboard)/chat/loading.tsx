import { Skeleton } from '@/components/ui/skeleton'

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Empty state skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Skeleton className="h-10 w-10 rounded-full mb-6" />
        <Skeleton className="h-8 w-72 mb-3" />
        <Skeleton className="h-4 w-56 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Input skeleton */}
      <div className="p-4 max-w-4xl mx-auto w-full">
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  )
}
