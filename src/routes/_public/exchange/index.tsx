import {ItemCard, ItemCardGroup} from "@heroui-pro/react";
import {Accordion, Button, buttonVariants, Code, Link as HeroLink, Separator} from "@heroui/react";
import {useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ChevronDownIcon, ChevronRightIcon, PlusIcon} from "lucide-react";
import {Fragment} from "react";

import {AddNewExchangeHuntDialog} from "@/components/add-new-exchange-hunt-dialog";
import {HuntListSkeleton} from "@/components/exchange-skeletons";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/")({
  // Prefetch so the page renders with data instead of suspending (and flashing) on mount.
  loader: ({context: {queryClient}}) =>
    Promise.all([
      queryClient.ensureQueryData(orpc.exchange.hunts.list.queryOptions()),
      queryClient.ensureQueryData(orpc.exchange.isAdmin.queryOptions()),
    ]),
  pendingComponent: HuntListSkeleton,
  component: RouteComponent,
});

function RouteComponent() {
  const hunts = useSuspenseQuery(orpc.exchange.hunts.list.queryOptions()).data;
  const isAdmin = useSuspenseQuery(orpc.exchange.isAdmin.queryOptions()).data;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="mb-4 text-center text-2xl font-bold">Wafflehaüs Puzzle Exchange</h1>
      <p>
        Every month, Wafflehaüs releases a small number of approachable, short, Hunt-length puzzles
        written by team members, as well as spotlighting puzzles from other hunts.
      </p>
      <Accordion allowsMultipleExpanded defaultExpandedKeys={["solving", "writing"]}>
        <Accordion.Item id="solving">
          <Accordion.Heading>
            <Accordion.Trigger>
              Interested in solving?
              <Accordion.Indicator>
                <ChevronDownIcon />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <p>
                Feel free to solve by yourself or with friends! Once you've solved the puzzle, go
                react to the corresponding Discord message!
              </p>
              <p>
                There has been a WOW workspace set up for your convenience called{" "}
                <HeroLink
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://www.wafflehaus.io/wpe">
                  WPE
                </HeroLink>
                . The password is <Code>sumhint</Code>. Please be courteous! You're sharing this
                workspace with the whole team. See instructions on the workspace itself.
              </p>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item id="writing">
          <Accordion.Heading>
            <Accordion.Trigger>
              Interested in writing?
              <Accordion.Indicator>
                <ChevronDownIcon />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <p>Reach out to Allen on Discord!</p>
              <Link to="/exchange/writing" className={buttonVariants({variant: "outline"})}>
                Learn about writing WPE puzzles
              </Link>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <div className="flex items-center justify-between gap-1">
        <span className="text-2xl">Hunts</span>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <AddNewExchangeHuntDialog>
              <Button>
                <PlusIcon />
                Create Hunt
              </Button>
            </AddNewExchangeHuntDialog>
          </div>
        )}
      </div>
      <ItemCardGroup className="overflow-hidden">
        {hunts.map((hunt, i) => (
          <Fragment key={hunt.id}>
            {i > 0 && <Separator />}
            <ItemCard<"a">
              className="hover:bg-default/20 active:bg-default-hover/50 relative w-full overflow-hidden transition-colors"
              render={props => (
                <Link {...props} to="/exchange/hunts/$huntId" params={{huntId: hunt.id}} />
              )}>
              <ItemCard.Content>
                <ItemCard.Title>{hunt.name}</ItemCard.Title>
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
