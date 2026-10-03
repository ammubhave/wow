import {ChatMessage, EmojiReactionButton} from "@heroui-pro/react";
import {Button, Popover, Spinner} from "@heroui/react";
import {useParams} from "@tanstack/react-router";
import {EmojiPicker, type EmojiPickerListComponents} from "frimousse";
import {SmilePlusIcon} from "lucide-react";
import {useState} from "react";

import {customEmojiUrl} from "@/components/settings/workspace-look-cards";
import {useWorkspace} from "@/hooks/use-workspace";

/**
 * Chat reactions: any emoji, or one of the team's own (":name:"). Messages from before reactions
 * were open-ended stored a few names ("like", "love", …); those still show as their emoji.
 */
const LEGACY: Record<string, string> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  question: "❓",
  angry: "😠",
};
const QUICK = ["👍", "❤️", "😂", "🎉", "🤔", "👀", "🔥", "😭"];

const customName = (reaction: string) => /^:([a-z0-9_-]+):$/.exec(reaction)?.[1];

/** A reaction as it looks: an emoji, or a team emoji's image. */
function Glyph({reaction, className}: {reaction: string; className?: string}) {
  const {workspaceSlug} = useParams({from: "/_workspace/$workspaceSlug"});
  const {theme} = useWorkspace();
  const name = customName(reaction);
  if (name) {
    const custom = theme.customEmoji?.find(e => e.name === name);
    if (!custom) return <span className={className}>❔</span>;
    return (
      <img
        src={customEmojiUrl(workspaceSlug, custom.fileId)}
        alt={`:${name}:`}
        className={className ?? "inline-block size-[1.1em] align-[-0.15em]"}
      />
    );
  }
  return <span className={className}>{LEGACY[reaction] ?? reaction}</span>;
}

/** A small celebratory pop of the emoji when you react. */
function Burst({reaction}: {reaction: string}) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {[-14, -5, 5, 14].map((dx, i) => (
        <span
          key={dx}
          className="animate-reaction-burst absolute top-1/2 left-1/2 text-sm"
          style={
            {
              "--dx": `${dx}px`,
              "--dy": `${-22 - (i % 2) * 8}px`,
              animationDelay: `${i * 30}ms`,
            } as React.CSSProperties
          }>
          <Glyph reaction={reaction} />
        </span>
      ))}
    </span>
  );
}

// The full picker's parts (module-level: stable component identities).
const PICKER_PARTS: Partial<EmojiPickerListComponents> = {
  CategoryHeader: ({category, ...props}) => (
    <div {...props} className="bg-overlay text-muted px-1 py-1 text-xs">
      {category.label}
    </div>
  ),
  Emoji: ({emoji, ...props}) => (
    <button
      {...props}
      className="data-[active]:bg-default flex size-8 items-center justify-center rounded-md text-lg">
      {emoji.emoji}
    </button>
  ),
};

/** The add-a-reaction action: quick picks, the team's emoji, and every other emoji. */
export function ReactionPicker({onReact}: {onReact: (reaction: string) => void}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const {theme} = useWorkspace();
  const pick = (reaction: string) => {
    onReact(reaction);
    setIsOpen(false);
    setShowAll(false);
  };
  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <ChatMessage.Action aria-label="Add reaction" tooltip="Add reaction">
        <SmilePlusIcon className="size-4" />
      </ChatMessage.Action>
      <Popover.Content placement="top end">
        <Popover.Dialog aria-label="Reactions" className="flex w-72 flex-col gap-1 p-1">
          <div className="flex flex-wrap gap-0.5">
            {QUICK.map(emoji => (
              <Button
                key={emoji}
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={emoji}
                onPress={() => pick(emoji)}>
                <span className="text-base leading-none">{emoji}</span>
              </Button>
            ))}
          </div>
          {(theme.customEmoji?.length ?? 0) > 0 && (
            <div className="border-separator flex flex-wrap gap-0.5 border-t pt-1">
              {theme.customEmoji!.map(e => (
                <Button
                  key={e.name}
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={`:${e.name}:`}
                  onPress={() => pick(`:${e.name}:`)}>
                  <Glyph reaction={`:${e.name}:`} className="size-5" />
                </Button>
              ))}
            </div>
          )}
          {showAll ? (
            <EmojiPicker.Root
              className="border-separator flex h-64 flex-col border-t pt-1"
              columns={8}
              onEmojiSelect={({emoji}) => pick(emoji)}>
              <EmojiPicker.Search
                aria-label="Search emoji"
                placeholder="Search emoji…"
                className="bg-default mb-1 rounded-lg px-2 py-1 text-sm outline-none"
                autoFocus
              />
              <EmojiPicker.Viewport className="relative flex-1">
                <EmojiPicker.Loading className="text-muted flex h-full items-center justify-center">
                  <Spinner size="sm" />
                </EmojiPicker.Loading>
                <EmojiPicker.Empty className="text-muted p-4 text-center text-sm">
                  No emoji found.
                </EmojiPicker.Empty>
                <EmojiPicker.List components={PICKER_PARTS} />
              </EmojiPicker.Viewport>
            </EmojiPicker.Root>
          ) : (
            <Button size="sm" variant="ghost" onPress={() => setShowAll(true)}>
              More emoji…
            </Button>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** A message's reaction counts; pressing one adds it again (with a little burst). */
export function Reactions({
  reactions,
  onReact,
}: {
  reactions: Record<string, number>;
  onReact: (reaction: string) => void;
}) {
  // The most recent burst, keyed so pressing again replays it.
  const [burst, setBurst] = useState<{reaction: string; key: number} | null>(null);
  const present = Object.entries(reactions).filter(([, count]) => count > 0);
  if (present.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {present.map(([reaction, count]) => (
        <span key={reaction} className="relative">
          <EmojiReactionButton
            size="sm"
            aria-label={`${LEGACY[reaction] ?? reaction}: ${count}`}
            // The room keeps only counts (not who reacted), so there is no "mine" state to show.
            isSelected={false}
            onChange={() => {
              onReact(reaction);
              setBurst({reaction, key: Date.now()});
            }}>
            <EmojiReactionButton.Emoji>
              <Glyph reaction={reaction} />
            </EmojiReactionButton.Emoji>
            <EmojiReactionButton.Count>{count}</EmojiReactionButton.Count>
          </EmojiReactionButton>
          {burst?.reaction === reaction && <Burst key={burst.key} reaction={reaction} />}
        </span>
      ))}
    </div>
  );
}
