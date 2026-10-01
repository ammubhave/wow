import {HoverCard} from "@heroui-pro/react";
import {Button, ButtonGroup, InputGroup, TextField} from "@heroui/react";
import {
  AngryIcon,
  CircleQuestionMarkIcon,
  HeartIcon,
  LaughIcon,
  SendIcon,
  SmilePlusIcon,
  ThumbsUpIcon,
} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import Markdown, {type Components} from "react-markdown";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";
import remarkGfm from "remark-gfm";
import {cn} from "tailwind-variants";

import {NO_PRESENCES} from "@/features/presences/presences";
import type {ChatMessage, ChatRoomReceivedMessage, ChatRoomSentMessage} from "@/server/do/chat";
import {useAppSelector} from "@/store";

import {EggoText} from "./eggo";
import {gravatarUrl, UserHoverCard} from "./user-hover-card";

function formatTime(date: Date) {
  return date.toLocaleString([], {weekday: "short", hour: "2-digit", minute: "2-digit"});
}

type Reaction = "like" | "love" | "laugh" | "question" | "angry";

function ReactionPopover({onReact}: {onReact: (reaction: Reaction) => void}) {
  const [isOpen, setIsOpen] = useState(false);
  const react = (reaction: Reaction) => {
    onReact(reaction);
    setIsOpen(false);
  };
  return (
    <HoverCard open={isOpen} onOpenChange={setIsOpen} openDelay={0}>
      <HoverCard.Trigger>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="Add reaction"
          onPress={() => setIsOpen(true)}>
          <SmilePlusIcon />
        </Button>
      </HoverCard.Trigger>
      <HoverCard.Content className="w-fit p-0" aria-label="Reactions">
        <ButtonGroup orientation="horizontal">
          <Button
            isIconOnly
            variant="outline"
            aria-label="React like"
            onPress={() => react("like")}>
            <ThumbsUpIcon className="text-green-950" fill="limegreen" />
          </Button>
          <Button
            isIconOnly
            variant="outline"
            aria-label="React love"
            onPress={() => react("love")}>
            <HeartIcon className="text-red-950" fill="hotpink" />
          </Button>
          <Button
            isIconOnly
            variant="outline"
            aria-label="React laugh"
            onPress={() => react("laugh")}>
            <LaughIcon className="text-yellow-950" fill="orange" />
          </Button>
          <Button
            isIconOnly
            variant="outline"
            aria-label="React question"
            onPress={() => react("question")}>
            <CircleQuestionMarkIcon className="text-blue-950" fill="lightskyblue" />
          </Button>
          <Button
            isIconOnly
            variant="outline"
            aria-label="React angry"
            onPress={() => react("angry")}>
            <AngryIcon className="text-violet-950" fill="violet" />
          </Button>
        </ButtonGroup>
      </HoverCard.Content>
    </HoverCard>
  );
}

const markdownComponents: Components = {
  h1: ({children, className, node: _node, ...rest}) => (
    <h1
      {...rest}
      className={cn(className, "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl")}>
      {children}
    </h1>
  ),
  h2: ({children, className, node: _node, ...rest}) => (
    <h2
      {...rest}
      className={cn(
        className,
        "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0"
      )}>
      {children}
    </h2>
  ),
  h3: ({children, className, node: _node, ...rest}) => (
    <h3 {...rest} className={cn(className, "scroll-m-20 text-2xl font-semibold tracking-tight")}>
      {children}
    </h3>
  ),
  h4: ({children, className, node: _node, ...rest}) => (
    <h4 {...rest} className={cn(className, "scroll-m-20 text-xl font-semibold tracking-tight")}>
      {children}
    </h4>
  ),
  h5: ({children, className, node: _node, ...rest}) => (
    <h4 {...rest} className={cn(className, "scroll-m-20 text-lg font-semibold tracking-tight")}>
      {children}
    </h4>
  ),
  h6: ({children, className, node: _node, ...rest}) => (
    <h4 {...rest} className={cn(className, "scroll-m-20 text-base font-semibold tracking-tight")}>
      {children}
    </h4>
  ),
  p: ({children, className, node: _node, ...rest}) => (
    <p {...rest} className={cn(className, "whitespace-pre-wrap leading-7 not-first:mt-6")}>
      {children}
    </p>
  ),
  blockquote: ({children, className, node: _node, ...rest}) => (
    <blockquote {...rest} className={cn(className, "mt-6 border-l-2 pl-6 italic")}>
      {children}
    </blockquote>
  ),
  ul: ({children, className, node: _node, ...rest}) => (
    <ul {...rest} className={cn(className, "my-6 ml-6 list-disc [&>li]:mt-2")}>
      {children}
    </ul>
  ),
  ol: ({children, className, node: _node, ...rest}) => (
    <ol {...rest} className={cn(className, "my-6 ml-6 list-decimal [&>li]:mt-2")}>
      {children}
    </ol>
  ),
  code: ({children, className, node: _node, ...rest}) => (
    <code
      {...rest}
      className={cn(
        className,
        "relative rounded bg-surface-secondary px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
      )}>
      {children}
    </code>
  ),
  table: ({children, className, node: _node, ...rest}) => (
    <div className="my-6 w-full overflow-y-auto">
      <table {...rest} className={cn(className, "w-full")}>
        {children}
      </table>
    </div>
  ),
  tr: ({children, className, node: _node, ...rest}) => (
    <tr {...rest} className={cn(className, "m-0 border-t p-0 even:bg-surface-secondary")}>
      {children}
    </tr>
  ),
  td: ({children, className, node: _node, ...rest}) => (
    <td
      {...rest}
      className={cn(
        className,
        "border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right"
      )}>
      {children}
    </td>
  ),
  th: ({children, className, node: _node, ...rest}) => (
    <th
      {...rest}
      className={cn(
        className,
        "border px-4 py-2 text-left font-bold [[align=center]]:text-center [[align=right]]:text-right"
      )}>
      {children}
    </th>
  ),
  a: ({children, className, node: _node, ...rest}) => (
    <a
      {...rest}
      className={cn(className, "font-medium underline underline-offset-4")}
      target="_blank"
      rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export function Chat({puzzleId}: {puzzleId: string}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          if (!prev.find(m => m.id === message.message.id)) {
            return [...prev, message.message];
          }
          return prev.map(m => (m.id === message.message.id ? message.message : m));
        });
      }
    },
  });

  // Scroll to the newest message whenever one arrives. Keyed on the count, not the array, so a
  // reaction on an older message doesn't yank someone reading the history back to the bottom.
  const messageCount = messages.length;
  useEffect(() => {
    if (messageCount === 0) return;
    messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
  }, [messageCount]);

  const handleSend = () => {
    if (input.trim()) {
      sendJsonMessage({type: "send", text: input} satisfies ChatRoomSentMessage);
      setInput("");
    }
  };

  const presences = useAppSelector(state => state.presences.value[puzzleId]) ?? NO_PRESENCES;

  return (
    <div className="flex flex-1 flex-col pb-4">
      <div className="flex flex-col gap-2 px-2 py-2">
        <div className="flex max-h-25 flex-row flex-wrap gap-0.5 overflow-y-auto">
          {presences.map(user => (
            <UserHoverCard key={user.id} user={user}>
              <span className="inline-flex items-center gap-x-0.5 rounded-full bg-green-200 px-1 py-0.5 text-[10px] font-medium text-green-900 dark:bg-green-800 dark:text-green-100">
                <img
                  src={user.image ?? gravatarUrl(user.email ?? "", {size: 96, d: "identicon"})}
                  alt=""
                  className="size-3 rounded-full"
                />
                <span>{user.name}</span>
              </span>
            </UserHoverCard>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-2">
        <div className="relative flex-1">
          <div className="absolute inset-0 justify-end gap-1 overflow-y-auto text-xs">
            {messages.map((message, idx) => (
              <div
                key={message.id}
                style={{overflowWrap: "anywhere"}}
                className={cn(
                  "group/message",
                  (idx === messages.length - 1 || messages[idx + 1]!.name !== message.name) &&
                    "mb-4"
                )}>
                {(idx === 0 ||
                  messages[idx - 1]!.name !== message.name ||
                  (messages[idx - 1] &&
                    message.timestamp - messages[idx - 1]!.timestamp > 60 * 1000)) && (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{message.name}</span>
                    <span
                      className="text-muted text-xs"
                      title={new Date(message.timestamp).toLocaleString()}>
                      {formatTime(new Date(message.timestamp))}
                    </span>
                  </div>
                )}
                {/* A <div>, not a <p>: it holds rendered Markdown paragraphs and the reaction popover. */}
                <div
                  className={cn(
                    "bg-surface-secondary mr-2 mt-1 rounded-lg p-2 relative",
                    message.name == "Eggö" ? "flex" : "inline-block"
                  )}>
                  {message.name == "Eggö" ? (
                    <EggoText text={message.text} />
                  ) : (
                    <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {message.text}
                    </Markdown>
                  )}
                  <div className="bg-surface invisible absolute right-0 bottom-0 border opacity-0 transition-all duration-300 group-hover/message:visible group-hover/message:opacity-100">
                    <ReactionPopover
                      onReact={reaction => {
                        sendJsonMessage({
                          type: "react",
                          messageId: message.id,
                          reaction,
                        } satisfies ChatRoomSentMessage);
                      }}
                    />
                  </div>
                </div>
                {Object.entries(message.reactions).length > 0 && (
                  <div className="mt-1 flex">
                    {Object.entries(message.reactions).map(([reaction, count]) => (
                      <div
                        key={reaction}
                        className="bg-surface inline-flex items-center gap-1 px-2 py-0.5 text-xs">
                        {reaction === "like" && (
                          <ThumbsUpIcon className="size-3 text-green-950" fill="limegreen" />
                        )}
                        {reaction === "love" && (
                          <HeartIcon className="size-3 text-red-950" fill="hotpink" />
                        )}
                        {reaction === "laugh" && (
                          <LaughIcon className="size-3 text-yellow-950" fill="orange" />
                        )}
                        {reaction === "question" && (
                          <CircleQuestionMarkIcon
                            className="size-3 text-blue-950"
                            fill="lightskyblue"
                          />
                        )}
                        {reaction === "angry" && (
                          <AngryIcon className="size-3 text-violet-950" fill="violet" />
                        )}
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <TextField value={input} onChange={setInput} aria-label="Chat message">
          <InputGroup>
            <InputGroup.TextArea
              placeholder="Type your message...&#10;!help for Eggö"
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSend();
                }
              }}
            />
            <InputGroup.Suffix className="self-end">
              <Button
                isIconOnly
                size="sm"
                className="rounded-4xl"
                aria-label="Send message"
                onPress={handleSend}>
                <SendIcon />
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
        </TextField>
      </div>
    </div>
  );
}
