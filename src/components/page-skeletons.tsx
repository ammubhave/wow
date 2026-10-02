import {Card, Skeleton} from "@heroui/react";

/**
 * Loading placeholders shaped like the pages they stand in for, so a slow load shows the page's
 * outline instead of a blank screen or a lone spinner. Used as route `pendingComponent`s (which
 * TanStack Router shows only once a load takes longer than ~1s) and as Suspense fallbacks.
 */

/** Generic page: title and a few lines. The router's default for routes without their own. */
export function PageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6"
      aria-busy="true"
      aria-label="Loading">
      <Skeleton className="h-8 w-56 rounded-lg" />
      <Skeleton className="h-4 w-full rounded-lg" />
      <Skeleton className="h-4 w-11/12 rounded-lg" />
      <Skeleton className="h-4 w-3/4 rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

/** A workspace while its room state loads: header, search row, board rows, sidebar, footer. */
export function WorkspaceSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Loading workspace">
      <div className="flex h-12 items-center gap-3 border-b px-4">
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-7 w-44 rounded-lg" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-20 rounded-lg" />
        <Skeleton className="h-4 w-16 rounded-lg" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <div className="flex flex-1">
        <div className="flex flex-1 flex-col gap-2 p-2">
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-full rounded-lg" />
          {Array.from({length: 14}, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="hidden w-64 flex-col gap-3 border-l p-3 md:flex">
          <Skeleton className="h-16 w-full rounded-lg" />
          {Array.from({length: 6}, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex h-12 items-center gap-3 border-t px-4">
        <Skeleton className="h-4 w-40 rounded-lg" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-56 rounded-lg" />
      </div>
    </div>
  );
}

/** A card listing people (e.g. workspace members). */
export function PeopleCardSkeleton({rows = 6}: {rows?: number}) {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <Card.Header>
        <Skeleton className="h-5 w-32 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded-lg" />
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {Array.from({length: rows}, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-40 rounded-lg" />
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

/** A centered single-card form page (join, login-style pages). */
export function CardFormSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center" aria-busy="true" aria-label="Loading">
      <Card className="w-full max-w-sm">
        <Card.Header>
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </Card.Content>
      </Card>
    </div>
  );
}
