import {createFileRoute, Link, Outlet} from "@tanstack/react-router";
import {ChevronsUpDownIcon, MonitorIcon, MoonIcon, PaletteIcon, SunIcon} from "lucide-react";

import {useTheme} from "@/components/theme-provider";
import {Button} from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {SidebarMenuButton} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_public")({component: RouteComponent});

function RouteComponent() {
  const {theme, setTheme} = useTheme();
  return (
    <div className="h-screen flex flex-col">
      <header className="bg-background sticky top-0 z-10 flex h-16 items-center gap-4 border-b px-4 md:px-6">
        <nav className="flex flex-1 flex-row items-center gap-5 text-lg font-medium md:text-sm lg:gap-6">
          <Button
            variant="ghost"
            render={
              <Link to="/" className="flex items-center gap-2 text-lg font-semibold md:text-base">
                <img src="/favicon.ico" className="shrink-0 size-6 rounded-full" />
              </Link>
            }
          />
          <div className="flex-1 text-lg font-semibold">
            <span className="font-semi-bold text-lg">Wafflehaüs Organized Workspaces</span>
          </div>
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="sm">
                    <PaletteIcon />
                    <ChevronsUpDownIcon />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}>
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </header>
      <main className="overflow-y-auto flex min-h-[calc(100dvh-(--spacing(16)))] flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
