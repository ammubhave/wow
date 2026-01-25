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

export function NavWorkspace({workspaceSlug}: {workspaceSlug: string}) {
  const workspaces = useQuery(orpc.workspaces.list.queryOptions());
  const workspace = useWorkspace({workspaceSlug});
  const user = authClient.useSession().data?.user;

  if (!workspaces.data || !user) return null;
  return (
    <DropdownMenuGroup>
      <DropdownMenuItem
        onClick={() => {
          toast.promise(
            workspace.shareGoogleDriveFolder.mutateAsync({workspaceSlug, email: user.email!}),
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
          <DropdownMenuLabel className="text-xs flex items-center gap-2">
            <Avatar>
              <AvatarFallback>
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
            .filter(ws => ws.slug !== workspaceSlug)
            .map(ws => (
              <DropdownMenuItem
                key={ws.id}
                className="gap-2 p-2"
                render={
                  <Link to="/$workspaceSlug" params={{workspaceSlug: ws.slug}}>
                    <Avatar>
                      <AvatarFallback>
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
            render={
              <Link to="/workspaces">
                <GalleryVerticalEndIcon />
                All workspaces
              </Link>
            }
          />
          <DropdownMenuItem
            render={
              <Link to="/workspaces/create">
                <PlusIcon />
                Add workspace
              </Link>
            }
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuGroup>
  );
}
