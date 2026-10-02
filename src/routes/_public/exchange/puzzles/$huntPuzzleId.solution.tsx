import {Breadcrumbs} from "@heroui/react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {Suspense} from "react";

import {ExchangePuzzleSkeleton} from "@/components/exchange-skeletons";
import {PuzzleRichTextEditor} from "@/components/rich-text-editor";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/puzzles/$huntPuzzleId/solution")({
  // Prefetch so the page renders with data instead of suspending (and flashing) on mount.
  loader: ({context: {queryClient}, params: {huntPuzzleId}}) =>
    queryClient.ensureQueryData(
      orpc.exchange.puzzles.solution.queryOptions({input: {huntPuzzleId}})
    ),
  pendingComponent: ExchangePuzzleSkeleton,
  component: KeyedRouteComponent,
});

// Remount per puzzle so the form and the (uncontrolled) rich text editors don't keep showing the
// previous puzzle when navigating directly between puzzles (e.g. via browser history).
function KeyedRouteComponent() {
  const {huntPuzzleId} = Route.useParams();
  return (
    <Suspense key={huntPuzzleId} fallback={<ExchangePuzzleSkeleton />}>
      <RouteComponent />
    </Suspense>
  );
}

function RouteComponent() {
  const {huntPuzzleId} = Route.useParams();
  // The answer and solution come from their own endpoint: the puzzle itself doesn't carry them.
  const puzzle = useSuspenseQuery(
    orpc.exchange.puzzles.solution.queryOptions({input: {huntPuzzleId}})
  ).data;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <Breadcrumbs>
          <Breadcrumbs.Item href="/exchange">Hunts</Breadcrumbs.Item>
          <Breadcrumbs.Item href={`/exchange/hunts/${puzzle.hunt.id}`}>
            {puzzle.hunt.name}
          </Breadcrumbs.Item>
          <Breadcrumbs.Item href={`/exchange/puzzles/${huntPuzzleId}`}>
            {puzzle.title}
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>Solution</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-2xl font-bold">{puzzle.title}</div>
        <span className="text-lg font-semibold">Solution</span>
        <span className="text-accent font-mono font-black">{puzzle.answer}</span>
      </div>
      <div className="dark:bg-surface bg-surface-secondary flex flex-col gap-4">
        <PuzzleRichTextEditor
          huntPuzzleId={huntPuzzleId}
          defaultValue={puzzle.solution ?? undefined}
        />
      </div>
    </div>
  );
}
