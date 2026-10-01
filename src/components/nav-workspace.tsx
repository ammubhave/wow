import {Avatar, Dropdown, Header, Label, Separator} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {GalleryVerticalEndIcon, Share2Icon, PlusIcon} from "lucide-react";
import {toast} from "sonner";

import {useWorkspace} from "@/hooks/use-workspace";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";

export function NavWorkspace({workspaceSlug}: {workspaceSlug: string}) {
  const workspaces = authClient.useListOrganizations();
  const workspace = useWorkspace();
  const shareGoogleDriveFolderMutation = useMutation(
    orpc.workspaces.shareGoogleDriveFolder.mutationOptions()
  );
  const user = authClient.useSession().data?.user;

  if (!workspaces.data || !user) return null;
  return (
    <>
      <Dropdown.Item
        id="share-google-drive-folder"
        textValue="Share Google Drive folder"
        onAction={() => {
          toast.promise(
            shareGoogleDriveFolderMutation.mutateAsync({workspaceSlug, email: user.email}),
            {
              loading: "Sharing Google Drive folder...",
              success: "Success! Google Drive folder has been shared.",
              error: "Oops! Something went wrong.",
            }
          );
        }}>
        <Share2Icon />
        <Label>Share Google Drive folder</Label>
      </Dropdown.Item>
      <Dropdown.SubmenuTrigger>
        <Dropdown.Item id="workspaces" textValue="Workspaces">
          <GalleryVerticalEndIcon />
          <Label>Workspaces</Label>
          <Dropdown.SubmenuIndicator />
        </Dropdown.Item>
        <Dropdown.Popover className="w-(--trigger-width) min-w-56 rounded-lg">
          <Dropdown.Menu>
            <Dropdown.Section>
              <Header className="flex items-center gap-2 text-xs">
                <Avatar>
                  <Avatar.Fallback>
                    {workspace.eventName
                      ?.split(" ")
                      .map(word => word[0]?.toLocaleUpperCase())
                      .filter(c => !!c)
                      .slice(0, 2)
                      .join("")}
                  </Avatar.Fallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight font-bold">
                  <span className="truncate">{workspace.eventName}</span>
                  <span className="truncate text-xs">{workspace.teamName}</span>
                </div>
              </Header>
            </Dropdown.Section>
            {workspaces.data.length > 1 && <Separator />}
            {workspaces.data
              .filter(ws => ws.slug !== workspaceSlug)
              .map(ws => (
                <Dropdown.Item
                  key={ws.id}
                  id={ws.id}
                  textValue={ws.eventName ?? ws.slug}
                  className="gap-2 p-2"
                  href={`/${ws.slug}`}>
                  <Avatar>
                    <Avatar.Fallback>
                      {ws.eventName
                        ?.split(" ")
                        .map(word => word[0]?.toLocaleUpperCase())
                        .filter(c => !!c)
                        .slice(0, 2)
                        .join("")}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{ws.eventName}</span>
                    <span className="truncate text-xs">{ws.teamName}</span>
                  </div>
                </Dropdown.Item>
              ))}
            <Separator />
            <Dropdown.Item id="all-workspaces" textValue="All workspaces" href="/workspaces">
              <GalleryVerticalEndIcon />
              <Label>All workspaces</Label>
            </Dropdown.Item>
            <Dropdown.Item id="add-workspace" textValue="Add workspace" href="/workspaces/create">
              <PlusIcon />
              <Label>Add workspace</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.SubmenuTrigger>
    </>
  );
}
