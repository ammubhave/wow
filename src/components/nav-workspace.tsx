import {Avatar, Button, Dropdown, Label, Separator} from "@heroui/react";
import {ChevronsUpDownIcon, GalleryVerticalEndIcon, PlusIcon} from "lucide-react";

import {useWorkspace} from "@/hooks/use-workspace";
import {authClient} from "@/lib/auth-client";

function initials(name: string | null | undefined) {
  return (name ?? "")
    .split(" ")
    .map(word => word[0]?.toLocaleUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

/**
 * The current workspace (in the footer), opening a menu to switch, create or list workspaces.
 * Kept out of the header: solvers stay in one workspace for a whole hunt.
 */
export function WorkspaceSwitcher({workspaceSlug}: {workspaceSlug: string}) {
  const workspace = useWorkspace();
  const workspaces = authClient.useListOrganizations().data ?? [];
  const others = workspaces.filter(ws => ws.slug !== workspaceSlug);

  return (
    <Dropdown>
      <Button variant="ghost" size="sm" className="min-w-0 font-semibold">
        <span className="truncate">{workspace.eventName}</span>
        <span aria-hidden="true">•</span>
        <span className="truncate">{workspace.teamName}</span>
        <ChevronsUpDownIcon className="text-muted shrink-0" />
      </Button>
      {/* containerPadding 0: the trigger hugs the viewport edge, so the default 12px keep-out would
          shift the menu off its left edge. */}
      <Dropdown.Popover className="min-w-64" placement="top start" containerPadding={0}>
        <Dropdown.Menu aria-label="Workspaces">
          {others.length > 0 && (
            <Dropdown.Section aria-label="Other workspaces">
              {others.map(ws => (
                <Dropdown.Item
                  key={ws.id}
                  id={ws.id}
                  textValue={ws.eventName ?? ws.slug}
                  href={`/${ws.slug}`}>
                  <Avatar size="sm">
                    <Avatar.Fallback>{initials(ws.eventName)}</Avatar.Fallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-left leading-tight">
                    <Label className="truncate">{ws.eventName}</Label>
                    <span className="text-muted truncate text-xs">{ws.teamName}</span>
                  </div>
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
          )}
          {others.length > 0 && <Separator />}
          <Dropdown.Item id="all-workspaces" textValue="All workspaces" href="/workspaces">
            <GalleryVerticalEndIcon />
            <Label>All workspaces</Label>
          </Dropdown.Item>
          <Dropdown.Item id="add-workspace" textValue="New workspace" href="/workspaces/create">
            <PlusIcon />
            <Label>New workspace</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
