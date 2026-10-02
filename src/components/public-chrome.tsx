import {Navbar} from "@heroui-pro/react";
import {Button, buttonVariants, Dropdown, Header, Label, Separator} from "@heroui/react";
import {Link, useRouterState} from "@tanstack/react-router";
import {MonitorIcon, MoonIcon, PaletteIcon, SunIcon} from "lucide-react";

import {authClient} from "@/lib/auth-client";

import {CoffeeIcon} from "./coffee-icon";
import {BrandTitle} from "./decrypted-text";
import {useTheme} from "./theme-provider";

const NAV_LINKS = [
  {to: "/docs", label: "Docs"},
  {to: "/exchange", label: "Puzzle Exchange"},
] as const;

function isTheme(value: unknown): value is "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system";
}

function ThemeMenu() {
  const {theme, setTheme} = useTheme();
  return (
    <Dropdown>
      <Button variant="ghost" size="sm" isIconOnly aria-label="Theme">
        {theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <PaletteIcon />}
      </Button>
      <Dropdown.Popover className="min-w-48" placement="bottom end">
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
  );
}

/** Signed in: straight to the workspaces. Signed out: log in, or sign up. */
function AuthActions() {
  const {data: session, isPending} = authClient.useSession();
  if (isPending) return <div className="w-36" />;
  if (session) {
    return (
      <Link to="/workspaces" className={buttonVariants({size: "sm"})}>
        My workspaces
      </Link>
    );
  }
  return (
    <>
      <Link to="/login" className={buttonVariants({variant: "ghost", size: "sm"})}>
        Log in
      </Link>
      <Link to="/signup" className={buttonVariants({size: "sm"})}>
        Get started
      </Link>
    </>
  );
}

/** The header on the homepage, docs, legal and Exchange pages. */
export function PublicNavbar({className}: {className?: string}) {
  const pathname = useRouterState({select: state => state.location.pathname});
  return (
    <Navbar aria-label="Site" maxWidth="xl" className={className}>
      <Navbar.Header>
        <Navbar.MenuToggle className="md:hidden" />
        <Navbar.Brand>
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.ico" alt="" className="size-6 shrink-0 rounded-full" />
            <BrandTitle className="hidden text-base font-semibold sm:inline" />
            <span className="font-semibold sm:hidden">WOW</span>
          </Link>
        </Navbar.Brand>
        <Navbar.Content className="hidden md:flex">
          {NAV_LINKS.map(link => (
            <Navbar.Item key={link.to} href={link.to} isCurrent={pathname.startsWith(link.to)}>
              {link.label}
            </Navbar.Item>
          ))}
        </Navbar.Content>
        <Navbar.Spacer />
        <Navbar.Content>
          <ThemeMenu />
          <AuthActions />
        </Navbar.Content>
      </Navbar.Header>
      <Navbar.Menu>
        {NAV_LINKS.map(link => (
          <Navbar.MenuItem key={link.to} href={link.to} isCurrent={pathname.startsWith(link.to)}>
            {link.label}
          </Navbar.MenuItem>
        ))}
      </Navbar.Menu>
    </Navbar>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      {to: "/workspaces", label: "My workspaces"},
      {to: "/workspaces/create", label: "Create a workspace"},
      {to: "/exchange", label: "Puzzle Exchange"},
    ],
  },
  {
    title: "Learn",
    links: [
      {to: "/docs", label: "Getting started"},
      {to: "/docs/blackboard", label: "Blackboard"},
      {to: "/docs/google-drive", label: "Google Drive"},
      {to: "/docs/discord", label: "Discord"},
    ],
  },
  {
    title: "Legal",
    links: [
      {to: "/tos", label: "Terms of Service"},
      {to: "/privacy-policy", label: "Privacy Policy"},
    ],
  },
] as const;

export function PublicFooter() {
  return (
    <footer className="border-separator border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="flex flex-col items-start gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.ico" alt="" className="size-6 rounded-full" />
            <span className="font-semibold">Wafflehaüs Organized Workspaces</span>
          </Link>
          <p className="text-muted max-w-xs text-sm">
            The shared workspace for puzzle hunt teams. Made by Team Wafflehaüs.
          </p>
          <a
            className={buttonVariants({variant: "secondary", size: "sm"})}
            href="https://www.buymeacoffee.com/amolbhave"
            target="_blank"
            rel="noopener noreferrer">
            <CoffeeIcon aria-hidden="true" />
            Buy me a puzzle
          </a>
        </div>
        {FOOTER_COLUMNS.map(column => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">{column.title}</h2>
            {column.links.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-muted hover:text-foreground w-fit text-sm transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <Separator />
      <p className="text-muted mx-auto max-w-7xl px-6 py-6 text-xs">
        © {new Date().getFullYear()} Wafflehaüs
      </p>
    </footer>
  );
}
