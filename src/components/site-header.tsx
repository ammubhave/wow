import type {User} from "better-auth";

import {Separator} from "@/components/ui/separator";

import {NavUser} from "./nav-user";

export function SiteHeader({user}: {user: User}) {
  return (
    <header className="bg-background fixed top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <div className="px-2 flex items-center gap-4">
          <img src="/favicon.ico" className="shrink-0 size-6 rounded-full" />
          <div className="contents flex-1 text-lg font-semibold">
            <span className="font-semi-bold text-lg">Wafflehaüs Organized Workspace</span>
          </div>
        </div>
        <div className="w-full sm:ml-auto sm:w-auto" />
        <Separator orientation="vertical" />
        <NavUser user={user} />
      </div>
    </header>
  );
}
