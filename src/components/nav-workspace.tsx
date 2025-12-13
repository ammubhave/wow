"use client";

import {useQuery} from "@tanstack/react-query";
import {Link} from "@tanstack/react-router";
import {ChevronsUpDown, GalleryVerticalEndIcon, PlusIcon} from "lucide-react";

import {Avatar, AvatarFallback} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {SidebarMenuButton, useSidebar} from "@/components/ui/sidebar";
import {orpc} from "@/lib/orpc";
import {RouterOutputs} from "@/server/router";

export function NavWorkspace({
  workspace,
}: {
  workspace: RouterOutputs["workspaces"]["get"] | undefined;
}) {
  const {isMobile} = useSidebar();
  const workspaces = useQuery(orpc.workspaces.list.queryOptions());

  if (!workspace || !workspaces.data) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="max-w-[239px] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback className="rounded-lg">
              {workspace.eventName
                ?.split(" ")
                .map(word => word[0]?.toLocaleUpperCase())
                .filter(c => !!c)
                .slice(0, 2)
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{workspace.eventName}</span>
            <span className="truncate text-xs">{workspace.teamName}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}>
        <DropdownMenuLabel className="text-muted-foreground text-xs">Workspaces</DropdownMenuLabel>
        {workspaces.data.map(workspace => (
          <DropdownMenuItem key={workspace.id} asChild className="gap-2 p-2">
            <Link to="/$workspaceId" params={{workspaceId: workspace.slug}}>
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {workspace.eventName
                    ?.split(" ")
                    .map(word => word[0]?.toLocaleUpperCase())
                    .filter(c => !!c)
                    .slice(0, 2)
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{workspace.eventName}</span>
                <span className="truncate text-xs">{workspace.teamName}</span>
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 p-2" asChild>
          <Link to="/workspaces">
            <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
              <GalleryVerticalEndIcon className="size-4" />
            </div>
            <div className="text-muted-foreground font-medium">All workspaces</div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 p-2" asChild>
          <Link to="/workspaces/create">
            <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
              <PlusIcon className="size-4" />
            </div>
            <div className="text-muted-foreground font-medium">Add workspace</div>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
