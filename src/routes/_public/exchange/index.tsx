import {Accordion, Button} from "@heroui/react";
import {useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ChevronDownIcon, ChevronRightIcon, PlusIcon} from "lucide-react";

import {AddNewExchangeHuntDialog} from "@/components/add-new-exchange-hunt-dialog";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/")({component: RouteComponent});

function RouteComponent() {
  const hunts = useSuspenseQuery(orpc.exchange.hunts.list.queryOptions()).data;
  const isAdmin = useQuery(orpc.exchange.isAdmin.queryOptions()).data ?? false;

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
                <a target="_blank" rel="noopener noreferrer" href="https://www.wafflehaus.io/wpe">
                  WPE
                </a>
                . The password is <code>sumhint</code>. Please be courteous! You're sharing this
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
              <Link to="/exchange/writing" className="button button--outline">
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
      <ul
        // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Tailwind preflight sets list-style:none, which makes Safari/VoiceOver drop the implicit list role
        role="list"
        className="divide-border outline-border bg-background dark:bg-input/30 dark:outline-input divide-y overflow-hidden shadow-xs outline-1 sm:rounded-xl dark:shadow-none dark:sm:-outline-offset-1">
        {hunts.map(hunt => (
          <li
            key={hunt.id}
            className="hover:bg-surface-secondary dark:hover:bg-input/50 relative flex justify-between gap-x-6 px-4 py-5 sm:px-6">
            <div className="flex min-w-0 gap-x-4">
              <div className="min-w-0 flex-auto">
                <p className="text-sm/6 font-semibold">
                  <Link to="/exchange/hunts/$huntId" params={{huntId: hunt.id}}>
                    <span className="absolute inset-x-0 -top-px bottom-0" />
                    {hunt.name}
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
