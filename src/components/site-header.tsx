import {Separator} from "@heroui/react";
import {Link} from "@tanstack/react-router";

import {NavUser} from "./nav-user";

export function SiteHeader() {
  return (
    <header className="bg-background fixed top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-2">
        <div className="flex shrink-0 items-center gap-4 px-2">
          <Link to="/workspaces" className="shrink-0">
            <img src="/favicon.ico" alt="WOW" className="size-6 rounded-full" />
          </Link>
          <div className="contents flex-1 text-lg font-semibold">
            <span className="font-semi-bold text-lg text-nowrap">
              Wafflehaüs Organized Workspaces
            </span>
          </div>
        </div>
        <div className="w-full sm:ml-auto sm:w-auto" />
        <Separator orientation="vertical" />
        <NavUser />
      </div>
    </header>
  );
}
