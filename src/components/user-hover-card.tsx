import {HoverCard} from "@heroui-pro/react";
import {Avatar, AvatarGroup, Chip} from "@heroui/react";
import {sha256} from "js-sha256";

type User = {name: string; email: string | null; image: string | null};

export function gravatarUrl(email: string, opts?: {size?: number; d?: string}) {
  const size = opts?.size ?? 96;
  const d = opts?.d ?? "identicon";
  // Gravatar accepts SHA-256 hashes of the trimmed, lowercased email.
  const hash = sha256(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${encodeURIComponent(d)}`;
}

/** The user's own picture, else their Gravatar (an identicon when they have none). */
export function userAvatarSrc(user: {email?: string | null; image?: string | null}) {
  return (
    user.image ?? (user.email ? gravatarUrl(user.email, {size: 96, d: "identicon"}) : undefined)
  );
}

/** Up to two initials, for an avatar's fallback. */
export function userInitials(name: string) {
  return name
    .trim()
    .split(" ")
    .map(n => n[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}

export function UserHoverCard({
  side,
  children,
  user,
}: {
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactElement;
  user: User;
}) {
  return (
    <HoverCard openDelay={200}>
      <HoverCard.Trigger>{children}</HoverCard.Trigger>
      <HoverCard.Content
        className="flex w-fit items-center justify-center"
        placement={side ?? "bottom"}>
        <div className="flex items-center gap-2">
          <Avatar>
            <Avatar.Image src={userAvatarSrc(user)} />
            <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col items-baseline">
            <div className="text-foreground font-medium">{user.name}</div>
          </div>
        </div>
      </HoverCard.Content>
    </HoverCard>
  );
}

/** A small chip (avatar and name) for someone working on a puzzle, with their hover card. */
export function UserPresenceChip({user}: {user: User}) {
  return (
    <UserHoverCard user={user}>
      <Chip color="success" variant="soft" size="sm" className="cursor-default gap-1 ps-0.5">
        <Avatar size="sm" className="size-4 text-[8px]">
          <Avatar.Image src={userAvatarSrc(user)} alt="" />
          <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
        </Avatar>
        <Chip.Label>{user.name}</Chip.Label>
      </Chip>
    </UserHoverCard>
  );
}

/** Who's working on something, as overlapping avatars (names on hover); compact for table cells. */
export function UserPresenceAvatars({
  users,
  max = 4,
}: {
  users: readonly (User & {id: string})[];
  max?: number;
}) {
  if (users.length === 0) return null;
  return (
    <AvatarGroup size="sm" max={max} aria-label={users.map(user => user.name).join(", ")}>
      {users.map(user => (
        <UserHoverCard key={user.id} user={user}>
          <Avatar size="sm" className="size-6 cursor-default text-[10px]">
            <Avatar.Image src={userAvatarSrc(user)} alt={user.name} />
            <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
          </Avatar>
        </UserHoverCard>
      ))}
    </AvatarGroup>
  );
}
