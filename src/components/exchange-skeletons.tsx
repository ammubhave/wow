import {Skeleton} from "@heroui/react";

/**
 * Loading placeholders shaped like the Exchange pages, used as route `pendingComponent`s (shown
 * only when a load is slow) and Suspense fallbacks, so pages don't flash blank while loading.
 */

export function HuntListSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-64" />
      <div className="flex flex-col gap-2">
        {Array.from({length: 6}, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ExchangePuzzleSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-72" />
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
