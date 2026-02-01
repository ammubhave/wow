import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ChevronRightIcon} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/hunts/$huntId")({
  component: RouteComponent,
});

function RouteComponent() {
  const {huntId} = Route.useParams();
  const hunt = useSuspenseQuery(orpc.exchange.hunts.get.queryOptions({input: {huntId}})).data;

  return (
    <div className="flex flex-col gap-4 flex-1">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/exchange">Hunts</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{hunt.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <span className="text-2xl">{hunt.name}</span>
      <ul
        role="list"
        className="divide-y divide-border overflow-hidden shadow-xs outline-1 outline-border sm:rounded-xl bg-background dark:bg-input/30 dark:shadow-none dark:outline-input dark:sm:-outline-offset-1">
        {hunt.hunt_puzzles.map(puzzle => (
          <li
            key={puzzle.id}
            className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-muted sm:px-6 dark:hover:bg-input/50">
            <div className="flex min-w-0 gap-x-4">
              <div className="min-w-0 flex-auto">
                <p className="text-sm/6 font-semibold">
                  <Link to="/exchange/puzzles/$huntPuzzleId" params={{huntPuzzleId: puzzle.id}}>
                    <span className="absolute inset-x-0 -top-px bottom-0" />
                    {puzzle.title}
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-x-4">
              <ChevronRightIcon aria-hidden="true" className="size-5 flex-none text-foreground" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
