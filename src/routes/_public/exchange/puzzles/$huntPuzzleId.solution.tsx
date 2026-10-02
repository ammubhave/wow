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
    queryClient.ensureQueryData(orpc.exchange.puzzles.get.queryOptions({input: {huntPuzzleId}})),
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
  const puzzle = useSuspenseQuery(
    orpc.exchange.puzzles.get.queryOptions({input: {huntPuzzleId: huntPuzzleId}})
  ).data;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <Breadcrumbs>
          <Breadcrumbs.Item href="/exchange">Hunts</Breadcrumbs.Item>
          <Breadcrumbs.Item href={`/exchange/hunts/${puzzle.hunts.id}`}>
            {puzzle.hunts.name}
          </Breadcrumbs.Item>
          <Breadcrumbs.Item href={`/exchange/puzzles/${puzzle.hunt_puzzles.id}`}>
            {puzzle.hunt_puzzles.title}
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>Solution</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-2xl font-bold">{puzzle.hunt_puzzles.title}</div>
        <span className="text-lg font-semibold">Solution</span>
        <span className="text-accent font-mono font-black">{puzzle.hunt_puzzles.answer}</span>
      </div>
      <div className="dark:bg-surface bg-surface-secondary flex flex-col gap-4">
        <PuzzleRichTextEditor
          huntPuzzleId={huntPuzzleId}
          defaultValue={puzzle.hunt_puzzles.solution ?? undefined}
        />
      </div>
    </div>
  );
}
