import {
  ChatConversation,
  ChatLoader,
  ChatMessage,
  EmojiReactionButton,
  EmptyState,
  PromptInput,
} from "@heroui-pro/react";
import {Button, Popover} from "@heroui/react";
import {MessagesSquareIcon, SmilePlusIcon} from "lucide-react";
import {useState} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";
import {cn} from "tailwind-variants";

import {NO_PRESENCES} from "@/features/presences/presences";
import {ARRIVE_FROM_BOTTOM, useMountedAt} from "@/lib/arrivals";
import type {
  ChatMessage as ChatMessageData,
  ChatRoomReceivedMessage,
  ChatRoomSentMessage,
} from "@/server/do/chat";
import {useAppSelector} from "@/store";

import {EggoText} from "./eggo";
import {LazyMarkdown} from "./lazy-markdown";
import {UserPresenceChip, userAvatarSrc, userInitials} from "./user-hover-card";

const EGGO = "Eggö";

type Reaction = Extract<ChatRoomSentMessage, {type: "react"}>["reaction"];

const REACTIONS: {reaction: Reaction; emoji: string; label: string}[] = [
  {reaction: "like", emoji: "👍", label: "Like"},
  {reaction: "love", emoji: "❤️", label: "Love"},
  {reaction: "laugh", emoji: "😂", label: "Laugh"},
  {reaction: "question", emoji: "❓", label: "Question"},
  {reaction: "angry", emoji: "😠", label: "Angry"},
];

/** Consecutive messages from one sender within this window are grouped under one header. */
const GROUP_WINDOW_MS = 60 * 1000;

function formatTime(date: Date) {
  return date.toLocaleString([], {weekday: "short", hour: "2-digit", minute: "2-digit"});
}

function startsGroup(messages: ChatMessageData[], idx: number) {
  const message = messages[idx]!;
  const previous = messages[idx - 1];
  return (
    !previous ||
    previous.name !== message.name ||
    message.timestamp - previous.timestamp > GROUP_WINDOW_MS
  );
}

export function Chat({puzzleId}: {puzzleId: string}) {
  // null until the room's snapshot arrives.
  const [messages, setMessages] = useState<ChatMessageData[] | null>(null);
  const [input, setInput] = useState("");
  const mountedAt = useMountedAt();

  const {sendJsonMessage} = useWebSocket<ChatRoomReceivedMessage>(`/api/chat/${puzzleId}`, {
    share: false,
    shouldReconnect: () => true,
    // Nothing reads `lastMessage`; skip storing it (messages are kept in `messages` above).
    filter: () => false,
    onMessage: event => {
      const message: ChatRoomReceivedMessage = JSON.parse(event.data);
      if (message.type === "snapshot") {
        setMessages(message.messages);
      } else if (message.type === "message") {
        setMessages(prev => {
          if (!prev) return [message.message];
          if (!prev.some(m => m.id === message.message.id)) {
            return [...prev, message.message];
          }
          return prev.map(m => (m.id === message.message.id ? message.message : m));
        });
      }
    },
  });

  const send = (message: ChatRoomSentMessage) => sendJsonMessage(message);

  const handleSend = () => {
    if (input.trim()) {
      send({type: "send", text: input});
      setInput("");
    }
  };

  const presences = useAppSelector(state => state.presences.value[puzzleId]) ?? NO_PRESENCES;
  // Messages only carry the sender's name; show the picture of whoever here goes by that name.
  const presenceByName = new Map(presences.map(user => [user.name, user]));

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-4">
      {presences.length > 0 && (
        <div className="flex max-h-25 flex-row flex-wrap gap-0.5 overflow-y-auto px-2 py-2">
          {presences.map(user => (
            <UserPresenceChip key={user.id} user={user} />
          ))}
        </div>
      )}
      <ChatConversation className="flex-1" initial="instant">
        <ChatConversation.Content className="gap-0 px-3 py-3">
          {messages === null ? (
            <ChatLoader.Skeleton label="Loading messages" />
          ) : messages.length === 0 ? (
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <MessagesSquareIcon />
                </EmptyState.Media>
                <EmptyState.Title>No messages yet</EmptyState.Title>
                <EmptyState.Description>Send !help for Eggö's commands.</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : (
            messages.map((message, idx) => {
              const isFirstInGroup = startsGroup(messages, idx);
              const sender = presenceByName.get(message.name);
              return (
                <ChatMessage.Assistant
                  key={message.id}
                  className={cn(
                    isFirstInGroup ? "pt-3 pb-0.5" : "py-0.5",
                    message.timestamp > mountedAt && ARRIVE_FROM_BOTTOM
                  )}>
                  <ChatMessage.Avatar
                    show={isFirstInGroup}
                    alt={message.name}
                    src={sender ? userAvatarSrc(sender) : undefined}
                    fallback={message.name === EGGO ? "🧇" : userInitials(message.name)}
                  />
                  <ChatMessage.Body className="gap-1 pe-0">
                    {isFirstInGroup && (
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{message.name}</span>
                        <time
                          className="text-muted text-xs"
                          dateTime={new Date(message.timestamp).toISOString()}
                          title={new Date(message.timestamp).toLocaleString()}>
                          {formatTime(new Date(message.timestamp))}
                        </time>
                      </div>
                    )}
                    <div className="flex items-start gap-1">
                      <ChatMessage.Content className="min-w-0 flex-1 wrap-anywhere">
                        {message.name === EGGO ? (
                          <EggoText text={message.text} />
                        ) : (
                          <LazyMarkdown>{message.text}</LazyMarkdown>
                        )}
                      </ChatMessage.Content>
                      <ChatMessage.Actions>
                        <ReactionPicker
                          onReact={reaction =>
                            send({type: "react", messageId: message.id, reaction})
                          }
                        />
                      </ChatMessage.Actions>
                    </div>
                    <Reactions
                      reactions={message.reactions}
                      onReact={reaction => send({type: "react", messageId: message.id, reaction})}
                    />
                  </ChatMessage.Body>
                </ChatMessage.Assistant>
              );
            })
          )}
        </ChatConversation.Content>
        <ChatConversation.ScrollButton aria-label="Scroll to newest" tooltip="Scroll to newest" />
      </ChatConversation>
      <div className="px-3">
        <PromptInput
          layout="compact"
          size="sm"
          value={input}
          onValueChange={setInput}
          onSubmit={handleSend}>
          <PromptInput.Shell>
            <PromptInput.Content>
              <PromptInput.TextArea
                aria-label="Chat message"
                placeholder="Type your message... (!help for Eggö)"
                onKeyDown={e => {
                  // Sending is handled by the composer; keep Enter from reaching page shortcuts.
                  if (e.key === "Enter" && !e.shiftKey) e.stopPropagation();
                }}
              />
            </PromptInput.Content>
            <PromptInput.Toolbar>
              <PromptInput.ToolbarEnd>
                <PromptInput.Send aria-label="Send message" />
              </PromptInput.ToolbarEnd>
            </PromptInput.Toolbar>
          </PromptInput.Shell>
        </PromptInput>
      </div>
    </div>
  );
}

/** The add-a-reaction action: the room only supports a fixed set of reactions. */
function ReactionPicker({onReact}: {onReact: (reaction: Reaction) => void}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <ChatMessage.Action aria-label="Add reaction" tooltip="Add reaction">
        <SmilePlusIcon className="size-4" />
      </ChatMessage.Action>
      <Popover.Content placement="top end">
        <Popover.Dialog aria-label="Reactions" className="flex gap-1 p-1">
          {REACTIONS.map(({reaction, emoji, label}) => (
            <Button
              key={reaction}
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={label}
              onPress={() => {
                onReact(reaction);
                setIsOpen(false);
              }}>
              <span className="text-base leading-none">{emoji}</span>
            </Button>
          ))}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/** A message's reaction counts; pressing one adds that reaction again. */
function Reactions({
  reactions,
  onReact,
}: {
  reactions: Record<string, number>;
  onReact: (reaction: Reaction) => void;
}) {
  const present = REACTIONS.filter(({reaction}) => (reactions[reaction] ?? 0) > 0);
  if (present.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {present.map(({reaction, emoji, label}) => (
        <EmojiReactionButton
          key={reaction}
          size="sm"
          aria-label={`${label}: ${reactions[reaction]}`}
          // The room keeps only counts (not who reacted), so there is no "mine" state to show.
          isSelected={false}
          onChange={() => onReact(reaction)}>
          <EmojiReactionButton.Emoji>{emoji}</EmojiReactionButton.Emoji>
          <EmojiReactionButton.Count>{reactions[reaction]}</EmojiReactionButton.Count>
        </EmojiReactionButton>
      ))}
    </div>
  );
}
