import {HoverCard} from "@heroui-pro/react";
import {Avatar, Chip} from "@heroui/react";
import {useState} from "react";

import {usePresences} from "@/features/presences/presences";

import {UserHoverCard, userAvatarSrc, userInitials} from "./user-hover-card";

export function PresencesCard({id}: {id: string}) {
  const presences = usePresences(id);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <HoverCard openDelay={500} open={isOpen} onOpenChange={setIsOpen}>
      {/* Hover, focus or a tap: touch screens have no hover. */}
      <HoverCard.Trigger
        tabIndex={0}
        aria-label={`${presences.length} online: show who`}
        onClick={() => setIsOpen(true)}>
        <Chip color="success" variant="soft" size="sm" className="cursor-default text-nowrap">
          <svg viewBox="0 0 6 6" aria-hidden="true" className="size-1.5 shrink-0 fill-current">
            <circle r={3} cx={3} cy={3} />
          </svg>
          <Chip.Label>{presences.length} Online</Chip.Label>
        </Chip>
      </HoverCard.Trigger>
      <HoverCard.Content className="flex w-fit flex-col gap-1 text-sm font-normal">
        {presences.map(user => (
          <UserHoverCard key={user.id} user={user} side="left">
            <div className="inline-flex cursor-default items-center gap-x-1 text-xs">
              <Avatar size="sm" className="size-4 text-[8px]">
                <Avatar.Image src={userAvatarSrc(user)} alt="" />
                <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
              </Avatar>
              <span>{user.name}</span>
            </div>
          </UserHoverCard>
        ))}
      </HoverCard.Content>
    </HoverCard>
  );
}
