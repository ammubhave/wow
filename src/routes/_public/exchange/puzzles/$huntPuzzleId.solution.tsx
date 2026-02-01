import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";

import {SimpleEditor} from "@/components/tiptap-templates/simple/simple-editor";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/puzzles/$huntPuzzleId/solution")({
  component: RouteComponent,
});

function RouteComponent() {
  const {huntPuzzleId} = Route.useParams();
  const puzzle = useSuspenseQuery(
    orpc.exchange.puzzles.get.queryOptions({input: {huntPuzzleId: huntPuzzleId}})
  ).data;

  return (
    <div className="flex flex-1 gap-4 flex-col">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/exchange">Hunts</Link>} />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <Link to="/exchange/hunts/$huntId" params={{huntId: puzzle.hunts.id}}>
                    {puzzle.hunts.name}
                  </Link>
                }
              />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <Link
                    to="/exchange/puzzles/$huntPuzzleId"
                    params={{huntPuzzleId: puzzle.hunt_puzzles.id}}>
                    {puzzle.hunt_puzzles.title}
                  </Link>
                }
              />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Solution</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex gap-4 flex-col items-center justify-center">
        <div className="text-2xl font-bold">{puzzle.hunt_puzzles.title}</div>
        <span className="text-lg font-semibold">Solution</span>
        <span className="font-mono text-primary font-black">{puzzle.hunt_puzzles.answer}</span>
      </div>
      <div className="flex flex-col gap-4 dark:bg-card bg-muted">
        <SimpleEditor
          huntPuzzleId={huntPuzzleId}
          defaultValue={puzzle.hunt_puzzles.solution ?? undefined}
        />
      </div>
    </div>
  );
}
