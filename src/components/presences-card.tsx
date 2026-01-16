import {useAppSelector} from "@/store";

import {HoverCard, HoverCardContent, HoverCardTrigger} from "./ui/hover-card";
import {gravatarUrl, UserHoverCard} from "./user-hover-card";

export function PresencesCard({id}: {id: string}) {
  const presences = useAppSelector(state => state.presences.value)[id] ?? [];
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={500}
        render={
          <span className="text-nowrap cursor-default inline-flex items-center gap-x-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200">
            <svg
              viewBox="0 0 6 6"
              aria-hidden="true"
              className="h-1.5 w-1.5 fill-green-500 shrink-0">
              <circle r={3} cx={3} cy={3} />
            </svg>
            {presences.length} Online
          </span>
        }
      />
      <HoverCardContent className="flex flex-col gap-1 text-sm font-normal w-fit">
        {presences.map(user => (
          <UserHoverCard key={user.id} user={user} side="left">
            <div key={user.id} className="inline-flex items-center gap-x-1 text-xs cursor-default">
              <img
                src={user.image ?? gravatarUrl(user.email ?? "", {size: 96, d: "identicon"})}
                className="size-4 rounded-full"
              />
              <span>{user.name ?? user.displayUsername}</span>
            </div>
          </UserHoverCard>
        ))}
      </HoverCardContent>
    </HoverCard>
  );
}
