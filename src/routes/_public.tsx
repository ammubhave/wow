import {Navbar} from "@heroui-pro/react";
import {Button, Dropdown, Header, Label} from "@heroui/react";
import {createFileRoute, Link, Outlet} from "@tanstack/react-router";
import {ChevronsUpDownIcon, MonitorIcon, MoonIcon, PaletteIcon, SunIcon} from "lucide-react";

import {BrandTitle} from "@/components/decrypted-text";
import {useTheme} from "@/components/theme-provider";

export const Route = createFileRoute("/_public")({component: RouteComponent});

function isTheme(value: unknown): value is "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system";
}

function RouteComponent() {
  const {theme, setTheme} = useTheme();
  return (
    <div className="flex h-screen flex-col">
      <Navbar aria-label="Site" maxWidth="full">
        <Navbar.Header>
          <Navbar.Brand>
            <Link to="/" className="flex items-center gap-2">
              <img src="/favicon.ico" alt="" className="size-6 shrink-0 rounded-full" />
              <BrandTitle className="text-lg font-semibold md:text-base" />
            </Link>
          </Navbar.Brand>
          <Navbar.Spacer />
          <Dropdown>
            <Button variant="ghost" size="sm" aria-label="Theme">
              <PaletteIcon />
              <ChevronsUpDownIcon />
            </Button>
            <Dropdown.Popover className="w-(--trigger-width) min-w-56" placement="bottom end">
              <Dropdown.Menu
                selectedKeys={[theme]}
                selectionMode="single"
                disallowEmptySelection
                onSelectionChange={key => {
                  const value = key instanceof Set ? key.values().next().value : undefined;
                  if (isTheme(value)) setTheme(value);
                }}>
                <Dropdown.Section>
                  <Header>Appearance</Header>
                  <Dropdown.Item id="light">
                    <Dropdown.ItemIndicator />
                    <SunIcon className="text-muted size-4 shrink-0" />
                    <Label>Light</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="dark">
                    <Dropdown.ItemIndicator />
                    <MoonIcon className="text-muted size-4 shrink-0" />
                    <Label>Dark</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="system">
                    <Dropdown.ItemIndicator />
                    <MonitorIcon className="text-muted size-4 shrink-0" />
                    <Label>System</Label>
                  </Dropdown.Item>
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </Navbar.Header>
      </Navbar>
      <main className="flex min-h-[calc(100dvh-(--spacing(16)))] flex-1 flex-col gap-4 overflow-y-auto p-4 md:gap-8 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
