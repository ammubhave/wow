import {HoverCard} from "@heroui-pro/react";
import {chipVariants} from "@heroui/react";

import {NO_PRESENCES} from "@/features/presences/presences";
import {useAppSelector} from "@/store";

import {gravatarUrl, UserHoverCard} from "./user-hover-card";

export function PresencesCard({id}: {id: string}) {
  const presences = useAppSelector(state => state.presences.value[id]) ?? NO_PRESENCES;
  return (
    <HoverCard openDelay={500}>
      <HoverCard.Trigger>
        <span
          className={chipVariants({color: "success", variant: "soft", size: "sm"}).base({
            className: "cursor-default text-nowrap",
          })}>
          <svg viewBox="0 0 6 6" aria-hidden="true" className="size-1.5 shrink-0 fill-current">
            <circle r={3} cx={3} cy={3} />
          </svg>
          {presences.length} Online
        </span>
      </HoverCard.Trigger>
      <HoverCard.Content className="flex w-fit flex-col gap-1 text-sm font-normal">
        {presences.map(user => (
          <UserHoverCard key={user.id} user={user} side="left">
            <div key={user.id} className="inline-flex cursor-default items-center gap-x-1 text-xs">
              <img
                src={user.image ?? gravatarUrl(user.email ?? "", {size: 96, d: "identicon"})}
                alt=""
                className="size-4 rounded-full"
              />
              <span>{user.name}</span>
            </div>
          </UserHoverCard>
        ))}
      </HoverCard.Content>
    </HoverCard>
  );
}
