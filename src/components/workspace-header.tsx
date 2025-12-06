// import * as TabsPrimitive from "@radix-ui/react-tabs";
// import { useLocalStorage } from "@uidotdev/usehooks";
import {Link, useChildMatches} from "@tanstack/react-router";
import {ExternalLinkIcon, Share2Icon} from "lucide-react";
import {toast} from "sonner";

// import { ArrowLeftIcon } from "lucide-react";

// import { HomeIcon, XIcon } from "lucide-react";
// import { useEffect } from "react";

import {Separator} from "@/components/ui/separator";
import {SidebarTrigger, useSidebar} from "@/components/ui/sidebar";

import {NavUser} from "./nav-user";
import {NavWorkspace} from "./nav-workspace";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import {Button} from "./ui/button";
import {DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator} from "./ui/dropdown-menu";
// import { Button } from "./ui/button";
// import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {useWorkspace} from "./use-workspace";

export function WorkspaceHeader({workspaceId, user}: {workspaceId: string; user: {email: string}}) {
  const workspace = useWorkspace({workspaceId});
  const {isMobile} = useSidebar();
  const childMatches = useChildMatches();
  const match = childMatches[childMatches.length - 1]!;
  const puzzleId =
    match.routeId === "/_workspace/$workspaceId/puzzles/$puzzleId"
      ? match.params.puzzleId
      : undefined;
  // const navigate = useNavigate();
  // const [openTabs, setOpenTabs] = useLocalStorage<string[]>("openTabs", []);
  // useEffect(() => {
  //   if (puzzleId && !openTabs.includes(puzzleId)) {
  //     setOpenTabs([...openTabs, puzzleId]);
  //   }
  // }, [puzzleId]);

  const puzzle = workspace.rounds.list.data
    .flatMap(round => round.puzzles)
    .find(p => p.id === puzzleId);

  return (
    <header className="bg-background fixed top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-2">
        <div className="px-2 flex items-center gap-4">
          <img src="/favicon.ico" className="shrink-0 size-6 rounded-full" />
        </div>
        <Separator orientation="vertical" />
        <NavWorkspace workspace={workspace.get.data} />
        <Separator orientation="vertical" />
        <div className="w-full px-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/$workspaceId" params={{workspaceId}}>
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {puzzle && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>{puzzle.name}</BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
          {/* <Button variant="ghost" asChild>
            <ArrowLeftIcon /> Home
          </Button> */}
          {/* <Tabs
            value={puzzleId ?? "home"}
            onValueChange={(value) => {
              if (value === "home") {
                navigate({ to: "/$workspaceId", params: { workspaceId } });
              } else {
                navigate({ to: "/$workspaceId/puzzles/$puzzleId", params: { workspaceId, puzzleId: value } });
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="home">
                <HomeIcon /> Home
              </TabsTrigger>
              {openTabs.map((tab) => (
                <div
                  key={tab}
                  className="has-data-[state=active]:bg-background dark:has-data-[state=active]:text-foreground has-focus-visible:border-ring has-focus-visible:ring-ring/50 has-focus-visible:outline-ring dark:has-data-[state=active]:border-input dark:has-data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 pr-0.5 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] has-focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 has-data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                >
                  <TabsPrimitive.Trigger
                    value={tab}
                    data-slot="tabs-trigger"
                    className="peer inline-flex items-center justify-center gap-1.5"
                  >
                    {tab}
                  </TabsPrimitive.Trigger>
                  <button
                    onClick={() => {
                      setOpenTabs(openTabs.filter((t) => t !== tab));
                      if (puzzleId === tab) {
                        navigate({ to: "/$workspaceId", params: { workspaceId } });
                      }
                    }}
                    className="size-6 peer-data-[state=active]:hover:bg-accent hover:bg-background hover:text-accent-foreground dark:peer-data-[state=active]:hover:bg-accent/50 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
            </TabsList>
          </Tabs> */}
        </div>
        <div className="flex items-center gap-1">
          {workspace.links.list.data.map((link, index) => (
            <Button key={index} variant="ghost" asChild>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                {link.name} <ExternalLinkIcon className="size-4" />
              </a>
            </Button>
          ))}
        </div>
        <Separator orientation="vertical" />
        <NavUser user={user}>
          {isMobile && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {workspace.links.list.data.map((link, index) => (
                  <DropdownMenuItem key={index} asChild>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gap-2 justify-between">
                      {link.name} <ExternalLinkIcon className="size-4" />
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                toast.promise(
                  workspace.shareGoogleDriveFolder.mutateAsync({
                    workspaceId: workspaceId,
                    email: user.email!,
                  }),
                  {
                    loading: "Sharing Google Drive folder...",
                    success: "Success! Google Drive folder has been shared.",
                    error: "Oops! Something went wrong.",
                  }
                );
              }}>
              <Share2Icon />
              Share Google Drive folder
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </NavUser>
        {isMobile && (
          <>
            <Separator orientation="vertical" className="mr-2" />
            <SidebarTrigger className="size-8" />
          </>
        )}
      </div>
    </header>
  );
}
