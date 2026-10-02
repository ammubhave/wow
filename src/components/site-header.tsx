import {Navbar} from "@heroui-pro/react";
import {Link} from "@tanstack/react-router";

import {BrandTitle} from "./decrypted-text";
import {NavUser} from "./nav-user";

export function SiteHeader() {
  return (
    <Navbar aria-label="Site" maxWidth="full" size="sm">
      <Navbar.Header>
        <Navbar.Brand>
          <Link to="/workspaces" className="flex items-center gap-2">
            <img src="/favicon.ico" alt="" className="size-6 rounded-full" />
            <BrandTitle className="text-sm font-semibold text-nowrap" />
          </Link>
        </Navbar.Brand>
        <Navbar.Spacer />
        <NavUser />
      </Navbar.Header>
    </Navbar>
  );
}
