import {QueryClient} from "@tanstack/react-query";
import {Link, useRouter} from "@tanstack/react-router";
import {
  BellRingIcon,
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  LogOut,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PuzzleIcon,
  RotateCcwKeyIcon,
  SunIcon,
  UserCogIcon,
} from "lucide-react";

import {useTheme} from "@/components/theme-provider";
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {SidebarMenuButton} from "@/components/ui/sidebar";
import {authClient} from "@/lib/auth-client";

import {gravatarUrl} from "./user-hover-card";

export function NavUser({children}: {children?: React.ReactNode}) {
  const {theme, setTheme} = useTheme();
  const router = useRouter();
  const queryClient = new QueryClient();
  const user = authClient.useSession().data?.user;
  if (!user) {
    return <div className="min-w-59.75 rounded-md h-12 animate-pulse"></div>;
  }
  const src =
    user.image ?? (user.email ? gravatarUrl(user.email, {size: 96, d: "identicon"}) : undefined);
  return (
    <div className="w-60">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="sm"
              className="w-60 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground">
              <Avatar size="sm">
                <AvatarImage src={src} alt={user.name ?? user.email} />
                <AvatarFallback className="rounded-lg">
                  {user.name
                    .trim()
                    .split(" ")
                    .map(n => n[0]?.toUpperCase())
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-accent-foreground">{user.name}</span>
              </div>
              <ChevronsUpDownIcon />
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          side="bottom"
          align="end"
          sideOffset={4}>
          {children && (
            <>
              {children}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PaletteIcon />
              Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                  <DropdownMenuRadioItem value="light">
                    <SunIcon />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <MoonIcon />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <MonitorIcon />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <BellRingIcon />
              Notifications
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuCheckboxItem
                checked={!user.notificationsDisabled}
                onClick={async () => {
                  await authClient.updateUser({notificationsDisabled: false});
                  await queryClient.invalidateQueries();
                }}>
                Enabled
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={user.notificationsDisabled}
                onClick={async () => {
                  await authClient.updateUser({notificationsDisabled: true});
                  await queryClient.invalidateQueries();
                }}>
                Disabled
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            render={
              <Link to="/profile">
                <UserCogIcon />
                Profile
              </Link>
            }
          />
          <DropdownMenuItem
            render={
              <Link to="/change-password">
                <RotateCcwKeyIcon />
                Change password
              </Link>
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={
              <a href="https://www.buymeacoffee.com/amolbhave" target="_blank">
                <PuzzleIcon />
                Buy me a puzzle
                <ExternalLinkIcon className="absolute right-2" />
              </a>
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await authClient.signOut();
              await router.navigate({to: "/login"});
            }}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
