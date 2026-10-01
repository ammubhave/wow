import {Breadcrumbs, Button} from "@heroui/react";
import {useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ChevronRightIcon, PlusIcon} from "lucide-react";
import {Suspense} from "react";

import {AddNewExchangePuzzleDialog} from "@/components/add-new-exchange-puzzle-dialog";
import {ChangeExchangeHuntDraftSwitch} from "@/components/change-exchange-hunt-draft-switch";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/hunts/$huntId")({
  component: () => (
    <Suspense>
      <RouteComponent />
    </Suspense>
  ),
});

function RouteComponent() {
  const {huntId} = Route.useParams();
  const hunt = useSuspenseQuery(orpc.exchange.hunts.get.queryOptions({input: {huntId}})).data;
  const isAdmin = useQuery(orpc.exchange.isAdmin.queryOptions()).data ?? false;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/exchange">Hunts</Breadcrumbs.Item>
        <Breadcrumbs.Item>{hunt.name}</Breadcrumbs.Item>
      </Breadcrumbs>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{hunt.name}</span>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <AddNewExchangePuzzleDialog huntId={huntId}>
              <Button>
                <PlusIcon />
                Create Puzzle
              </Button>
            </AddNewExchangePuzzleDialog>
            <ChangeExchangeHuntDraftSwitch huntId={huntId} />
          </div>
        )}
      </div>
      <ul
        // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Tailwind preflight sets list-style:none, which makes Safari/VoiceOver drop the implicit list role
        role="list"
        className="divide-border outline-border bg-background dark:bg-input/30 dark:outline-input divide-y overflow-hidden shadow-xs outline-1 sm:rounded-xl dark:shadow-none dark:sm:-outline-offset-1">
        {hunt.hunt_puzzles.map(puzzle => (
          <li
            key={puzzle.id}
            className="hover:bg-surface-secondary dark:hover:bg-input/50 relative flex justify-between gap-x-6 px-4 py-5 sm:px-6">
            <div className="flex min-w-0 gap-x-4">
              <div className="min-w-0 flex-auto">
                <p className="text-sm/6 font-semibold">
                  <Link
                    to={
                      puzzle.answer === ""
                        ? "/exchange/puzzles/$huntPuzzleId/edit"
                        : "/exchange/puzzles/$huntPuzzleId"
                    }
                    params={{huntPuzzleId: puzzle.id}}>
                    <span className="absolute inset-x-0 -top-px bottom-0" />
                    {puzzle.title}
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-x-4">
              <ChevronRightIcon aria-hidden="true" className="text-foreground size-5 flex-none" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
