import {Skeleton} from "@heroui/react";

/**
 * Loading placeholders shaped like the Exchange pages, used as route `pendingComponent`s (shown
 * only when a load is slow) and Suspense fallbacks, so pages don't flash blank while loading.
 */

export function HuntListSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-40 rounded-lg" />
      <Skeleton className="h-8 w-64 rounded-lg" />
      <div className="flex flex-col gap-2">
        {Array.from({length: 6}, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function ExchangePuzzleSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-72 rounded-lg" />
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-80 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full rounded-lg" />
        <Skeleton className="h-4 w-11/12 rounded-lg" />
        <Skeleton className="h-4 w-4/5 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
