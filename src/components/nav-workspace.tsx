"use client";

import {useQuery} from "@tanstack/react-query";
import {Link} from "@tanstack/react-router";
import {GalleryVerticalEndIcon, Share2Icon, PlusIcon} from "lucide-react";
import {toast} from "sonner";

import {Avatar, AvatarFallback} from "@/components/ui/avatar";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";

import {useWorkspace} from "./use-workspace";

export function NavWorkspace({workspaceId}: {workspaceId: string}) {
  const workspaces = useQuery(orpc.workspaces.list.queryOptions());
  const workspace = useWorkspace({workspaceId});
  const user = authClient.useSession().data?.user;

  if (!workspaces.data || !user) return null;
  return (
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
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <GalleryVerticalEndIcon />
          Workspaces
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          sideOffset={4}>
          <DropdownMenuLabel className=" text-xs flex items-center gap-2">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg">
                {workspace.get.data.eventName
                  ?.split(" ")
                  .map(word => word[0]?.toLocaleUpperCase())
                  .filter(c => !!c)
                  .slice(0, 2)
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight font-bold">
              <span className="truncate">{workspace.get.data.eventName}</span>
              <span className="truncate text-xs">{workspace.get.data.teamName}</span>
            </div>
          </DropdownMenuLabel>
          {workspaces.data.length > 1 && <DropdownMenuSeparator />}
          {workspaces.data
            .filter(ws => ws.slug !== workspaceId)
            .map(ws => (
              <DropdownMenuItem
                key={ws.id}
                className="gap-2 p-2"
                render={
                  <Link to="/$workspaceId" params={{workspaceId: ws.slug}}>
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {ws.eventName
                          ?.split(" ")
                          .map(word => word[0]?.toLocaleUpperCase())
                          .filter(c => !!c)
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{ws.eventName}</span>
                      <span className="truncate text-xs">{ws.teamName}</span>
                    </div>
                  </Link>
                }
              />
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 p-2"
            render={
              <Link to="/workspaces">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <GalleryVerticalEndIcon />
                </div>
                <div className="text-muted-foreground font-medium">All workspaces</div>
              </Link>
            }
          />
          <DropdownMenuItem
            className="gap-2 p-2"
            render={
              <Link to="/workspaces/create">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon />
                </div>
                <div className="text-muted-foreground font-medium">Add workspace</div>
              </Link>
            }
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuGroup>
  );
}
