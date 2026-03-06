import { Skeleton } from '@/components/ui/skeleton'

export default function AssistantsLoading() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-12">
      {/* Header skeleton */}
      <div className="text-center mb-12 max-w-2xl">
        <div className="flex justify-center mb-6">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <Skeleton className="h-10 w-72 mx-auto mb-4" />
        <Skeleton className="h-5 w-96 mx-auto" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl w-full mb-12">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-card rounded-2xl p-6 border border-border/50">
            <div className="flex justify-center mb-4">
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-6 w-32 mx-auto mb-5" />
            <div className="flex justify-center mb-5">
              <Skeleton className="h-16 w-16 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5 mx-auto" />
            </div>
          </div>
        ))}
      </div>

      {/* CTA skeleton */}
      <Skeleton className="h-11 w-40 rounded-lg" />
    </div>
  )
}
