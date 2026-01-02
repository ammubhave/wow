import MD5 from "crypto-js/md5";

import {Avatar, AvatarFallback, AvatarImage} from "./ui/avatar";
import {HoverCard, HoverCardContent, HoverCardTrigger} from "./ui/hover-card";

export function gravatarUrl(email: string, opts?: {size?: number; d?: string}) {
  const size = opts?.size ?? 96;
  const d = opts?.d ?? "identicon";
  const hash = MD5(email.trim().toLowerCase()).toString();
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${encodeURIComponent(d)}`;
}

export function UserHoverCard({
  children,
  user,
}: {
  children: React.ReactElement;
  user: {name: string; email: string; image: string | null; displayUsername: string | null};
}) {
  const src =
    user.image ?? (user.email ? gravatarUrl(user.email, {size: 96, d: "identicon"}) : undefined);
  return (
    <HoverCard>
      <HoverCardTrigger delay={200} render={children} />
      <HoverCardContent className="flex items-center justify-center p-2 w-fit">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src={src} />
            <AvatarFallback>
              {user.name
                .trim()
                .split(" ")
                .map(n => n[0]?.toUpperCase())
                .join("")
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-baseline flex-col">
            <div className="font-medium text-accent-foreground">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.displayUsername}</div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
