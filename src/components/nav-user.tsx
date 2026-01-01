"use client";

import {QueryClient} from "@tanstack/react-query";
import {useRouter} from "@tanstack/react-router";
import {
  BellRingIcon,
  ChevronsUpDownIcon,
  LogOut,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
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
    <div className="w-59.75">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="lg"
              className="w-59.75 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground">
              <Avatar>
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
                <span className="truncate text-muted-foreground">{user.displayUsername}</span>
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
          {/* <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.image ?? undefined} alt={user.name ?? user.email} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
            </div>
          </DropdownMenuLabel> */}
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
            onClick={async () => {
              await router.navigate({to: "/profile"});
            }}>
            <UserCogIcon />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              await router.navigate({to: "/change-password"});
            }}>
            <RotateCcwKeyIcon />
            Change password
          </DropdownMenuItem>
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
