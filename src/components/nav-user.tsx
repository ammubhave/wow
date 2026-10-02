import {Avatar, Button, Dropdown, Header, Label, Separator, Skeleton} from "@heroui/react";
import {useQueryClient} from "@tanstack/react-query";
import {useRouter} from "@tanstack/react-router";
import {
  BellRingIcon,
  ExternalLinkIcon,
  LogOut,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PuzzleIcon,
  SunIcon,
  UserCogIcon,
} from "lucide-react";
import {toast} from "sonner";

import {useTheme} from "@/components/theme-provider";
import {authClient} from "@/lib/auth-client";

import {gravatarUrl} from "./user-hover-card";

/** `children` are extra menu items (e.g. the workspace section) shown above the account items. */
export function NavUser({children}: {children?: React.ReactNode}) {
  const {theme, setTheme} = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = authClient.useSession().data?.user;
  if (!user) {
    return <Skeleton className="size-8 rounded-full" />;
  }
  const src =
    user.image ?? (user.email ? gravatarUrl(user.email, {size: 96, d: "identicon"}) : undefined);
  return (
    <Dropdown>
      <Button isIconOnly variant="ghost" aria-label="Account menu">
        <Avatar size="sm">
          <Avatar.Image src={src} alt="" />
          <Avatar.Fallback>
            {user.name
              .trim()
              .split(" ")
              .map(n => n[0]?.toUpperCase())
              .join("")
              .slice(0, 2)}
          </Avatar.Fallback>
        </Avatar>
      </Button>
      <Dropdown.Popover className="min-w-56" placement="bottom end">
        <Dropdown.Menu>
          <Dropdown.Section>
            <Header>
              <span className="text-foreground block truncate font-medium">{user.name}</span>
              <span className="text-muted block truncate font-normal">{user.email}</span>
            </Header>
          </Dropdown.Section>
          <Separator />
          {children}
          {children && <Separator />}
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="theme" textValue="Theme">
              <PaletteIcon />
              <Label>Theme</Label>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover>
              <Dropdown.Menu
                selectedKeys={[theme]}
                selectionMode="single"
                disallowEmptySelection
                onSelectionChange={key => {
                  if (!(key instanceof Set)) return;
                  const value = key.values().next().value;
                  if (value === "light" || value === "dark" || value === "system") {
                    setTheme(value);
                  }
                }}>
                <Dropdown.Section>
                  <Header>Appearance</Header>
                  <Dropdown.Item id="light" textValue="Light">
                    <Dropdown.ItemIndicator />
                    <SunIcon />
                    <Label>Light</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="dark" textValue="Dark">
                    <Dropdown.ItemIndicator />
                    <MoonIcon />
                    <Label>Dark</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="system" textValue="System">
                    <Dropdown.ItemIndicator />
                    <MonitorIcon />
                    <Label>System</Label>
                  </Dropdown.Item>
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="notifications" textValue="Notifications">
              <BellRingIcon />
              <Label>Notifications</Label>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover>
              <Dropdown.Menu
                selectedKeys={[user.notificationsDisabled ? "disabled" : "enabled"]}
                selectionMode="single"
                disallowEmptySelection
                onSelectionChange={async key => {
                  if (key instanceof Set) {
                    const selected = key.values().next().value;
                    // better-auth reports failures in `error` rather than throwing.
                    const {error} = await authClient.updateUser({
                      notificationsDisabled: selected === "disabled",
                    });
                    if (error) {
                      toast.error("Oops! Something went wrong.");
                      return;
                    }
                    await queryClient.invalidateQueries();
                  }
                }}>
                <Dropdown.Item id="enabled" textValue="Enabled">
                  <Dropdown.ItemIndicator />
                  <Label>Enabled</Label>
                </Dropdown.Item>
                <Dropdown.Item id="disabled" textValue="Disabled">
                  <Dropdown.ItemIndicator />
                  <Label>Disabled</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>
          <Dropdown.Item id="account" textValue="Account" href="/profile">
            <UserCogIcon />
            <Label>Account</Label>
          </Dropdown.Item>
          <Separator />
          <Dropdown.Item
            id="buy-me-a-puzzle"
            textValue="Buy me a puzzle"
            href="https://www.buymeacoffee.com/amolbhave"
            target="_blank">
            <PuzzleIcon />
            <Label>Buy me a puzzle</Label>
            <ExternalLinkIcon className="absolute right-2" />
          </Dropdown.Item>
          <Separator />
          <Dropdown.Item
            id="log-out"
            textValue="Log out"
            onAction={async () => {
              await authClient.signOut();
              await router.navigate({to: "/login"});
            }}>
            <LogOut />
            <Label>Log out</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
