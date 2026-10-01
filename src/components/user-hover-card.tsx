import {HoverCard} from "@heroui-pro/react";
import {Avatar} from "@heroui/react";
import {sha256} from "js-sha256";

export function gravatarUrl(email: string, opts?: {size?: number; d?: string}) {
  const size = opts?.size ?? 96;
  const d = opts?.d ?? "identicon";
  // Gravatar accepts SHA-256 hashes of the trimmed, lowercased email.
  const hash = sha256(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${encodeURIComponent(d)}`;
}

export function UserHoverCard({
  side,
  children,
  user,
}: {
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactElement;
  user: {name: string; email: string; image: string | null};
}) {
  const src =
    user.image ?? (user.email ? gravatarUrl(user.email, {size: 96, d: "identicon"}) : undefined);
  return (
    <HoverCard openDelay={200}>
      <HoverCard.Trigger>{children}</HoverCard.Trigger>
      <HoverCard.Content
        className="flex w-fit items-center justify-center"
        placement={side ?? "bottom"}>
        <div className="flex items-center gap-2">
          <Avatar>
            <Avatar.Image src={src} />
            <Avatar.Fallback>
              {user.name
                .trim()
                .split(" ")
                .map(n => n[0]?.toUpperCase())
                .join("")
                .slice(0, 2)}
            </Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col items-baseline">
            <div className="text-foreground font-medium">{user.name}</div>
          </div>
        </div>
      </HoverCard.Content>
    </HoverCard>
  );
}
