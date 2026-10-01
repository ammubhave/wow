import {ItemCard, ItemCardGroup} from "@heroui-pro/react";
import {Breadcrumbs, Button, Separator} from "@heroui/react";
import {useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ChevronRightIcon, PlusIcon} from "lucide-react";
import {Fragment, Suspense} from "react";

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
      <ItemCardGroup className="overflow-hidden">
        {hunt.hunt_puzzles.map((puzzle, i) => (
          <Fragment key={puzzle.id}>
            {i > 0 && <Separator />}
            <ItemCard<"a">
              className="hover:bg-default/20 active:bg-default-hover/50 relative w-full overflow-hidden transition-colors"
              render={props => (
                <Link
                  {...props}
                  to={
                    puzzle.answer === ""
                      ? "/exchange/puzzles/$huntPuzzleId/edit"
                      : "/exchange/puzzles/$huntPuzzleId"
                  }
                  params={{huntPuzzleId: puzzle.id}}
                />
              )}>
              <ItemCard.Content>
                <ItemCard.Title>{puzzle.title}</ItemCard.Title>
              </ItemCard.Content>
              <ItemCard.Action>
                <ChevronRightIcon aria-hidden="true" className="text-muted size-4" />
              </ItemCard.Action>
            </ItemCard>
          </Fragment>
        ))}
      </ItemCardGroup>
    </div>
  );
}
