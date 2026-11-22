import {Navbar} from "@heroui-pro/react";
import {buttonVariants} from "@heroui/react";
import {Link} from "@tanstack/react-router";
import {BookOpenIcon, CalendarDaysIcon} from "lucide-react";

import {BrandTitle} from "./decrypted-text";
import {NavUser} from "./nav-user";

export function SiteHeader() {
  return (
    <Navbar aria-label="Site" maxWidth="full" size="sm">
      <Navbar.Header>
        {/* The brand gives way (truncates) on a phone, so the links and avatar always fit. */}
        <Navbar.Brand className="min-w-0 shrink">
          <Link to="/workspaces" className="flex min-w-0 items-center gap-2">
            <img src="/favicon.ico" alt="" className="size-6 shrink-0 rounded-full" />
            <BrandTitle className="truncate text-sm font-semibold text-nowrap" />
          </Link>
        </Navbar.Brand>
        <Navbar.Spacer />
        <Link
          to="/docs"
          className={buttonVariants({size: "sm", variant: "ghost"})}
          aria-label="Docs"
          activeProps={{className: "text-accent"}}>
          <BookOpenIcon />
          <span className="hidden sm:inline">Docs</span>
        </Link>
        <Link
          to="/hunts"
          className={buttonVariants({size: "sm", variant: "ghost", className: "me-2"})}
          aria-label="Puzzle hunts"
          activeProps={{className: "text-accent"}}>
          <CalendarDaysIcon />
          <span className="hidden sm:inline">Hunts</span>
        </Link>
        <NavUser />
      </Navbar.Header>
    </Navbar>
  );
}
