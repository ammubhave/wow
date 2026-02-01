import {useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ChevronRightIcon, PlusIcon} from "lucide-react";

import {AddNewExchangeHuntDialog} from "@/components/add-new-exchange-hunt-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {Button} from "@/components/ui/button";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/")({component: RouteComponent});

function RouteComponent() {
  const hunts = useSuspenseQuery(orpc.exchange.hunts.list.queryOptions()).data;
  const isAdmin = useQuery(orpc.exchange.isAdmin.queryOptions()).data ?? false;

  return (
    <div className="flex flex-col gap-4 flex-1">
      <h1 className="text-2xl font-bold mb-4 text-center">Wafflehaüs Puzzle Exchange</h1>
      <p>
        Every month, Wafflehaüs releases a small number of approachable, short, Hunt-length puzzles
        written by team members, as well as spotlighting puzzles from other hunts.
      </p>
      <Accordion multiple defaultValue={["solving", "writing"]}>
        <AccordionItem value="solving">
          <AccordionTrigger>Interested in solving?</AccordionTrigger>
          <AccordionContent>
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
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="writing">
          <AccordionTrigger>Interested in writing?</AccordionTrigger>
          <AccordionContent>
            <p>Reach out to Allen on Discord!</p>
            <Button
              variant="outline"
              render={<Link to="/exchange/writing">Learn about writing WPE puzzles</Link>}
            />
          </AccordionContent>
        </AccordionItem>
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
        role="list"
        className="divide-y divide-border overflow-hidden shadow-xs outline-1 outline-border sm:rounded-xl bg-background dark:bg-input/30 dark:shadow-none dark:outline-input dark:sm:-outline-offset-1">
        {hunts.map(hunt => (
          <li
            key={hunt.id}
            className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-muted sm:px-6 dark:hover:bg-input/50">
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
              <ChevronRightIcon aria-hidden="true" className="size-5 flex-none text-foreground" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
