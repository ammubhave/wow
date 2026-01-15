import {Popover as PopoverPrimitive} from "@base-ui/react/popover";
import {AngryIcon, HeartIcon, LaughIcon, SendIcon, SmilePlusIcon, ThumbsUpIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import useWebSocket from "react-use-websocket";
import {cn} from "tailwind-variants";

import type {ChatMessage, ChatRoomReceivedMessage, ChatRoomSentMessage} from "@/server/do/chat";

import {useAppSelector} from "@/store";

import {Button} from "./ui/button";
import {ButtonGroup} from "./ui/button-group";
import {Field} from "./ui/field";
import {InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea} from "./ui/input-group";
import {Popover, PopoverContent, PopoverTrigger} from "./ui/popover";
import {gravatarUrl, UserHoverCard} from "./user-hover-card";

function formatTime(date: Date) {
  return date.toLocaleString([], {weekday: "short", hour: "2-digit", minute: "2-digit"});
}

export function Chat({puzzleId}: {puzzleId: string}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {sendJsonMessage} = useWebSocket<ChatRoomReceivedMessage>(
    `${typeof window !== "undefined" ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}` : ""}/api/chat/${puzzleId}`,
    {
      share: false,
      shouldReconnect: () => true,
      onMessage: async event => {
        const message = JSON.parse(event.data) as ChatRoomReceivedMessage;
        if (message.type === "snapshot") {
          setMessages(message.messages);
        } else if (message.type === "message") {
          setMessages(messages => {
            if (!messages.find(m => m.id === message.message.id)) {
              return [...messages, message.message];
            }
            return messages.map(m => (m.id === message.message.id ? message.message : m));
          });
        }
      },
    }
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      sendJsonMessage({type: "send", text: input} satisfies ChatRoomSentMessage);
      setInput("");
    }
  };

  const presences = useAppSelector(state => state.presences.value)[puzzleId] ?? [];

  return (
    <div className="flex flex-1 flex-col pb-4">
      <div className="flex flex-col gap-2 px-2 py-2">
        <div className="flex flex-row flex-wrap gap-0.5 max-h-25 overflow-y-auto">
          {presences.map(user => (
            <UserHoverCard key={user.id} user={user}>
              <span className="inline-flex items-center gap-x-0.5 rounded-full bg-green-200 dark:bg-green-800 dark:text-green-100 px-1 py-0.5 text-[10px] font-medium text-green-900">
                <img
                  src={user.image ?? gravatarUrl(user.email ?? "", {size: 96, d: "identicon"})}
                  className="size-3 rounded-full"
                />
                {user.displayUsername ?? user.name}
              </span>
            </UserHoverCard>
          ))}
        </div>
      </div>
      <div className="px-4 flex-1 flex flex-col pt-2">
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-y-auto text-xs flex flex-col justify-end gap-1">
            {messages.map((message, idx) => (
              <div
                key={idx}
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
                  <div className="flex items-baseline justify-between space-x-2">
                    <span className="font-semibold">{message.name}</span>
                    <span
                      className="text-muted-foreground text-xs"
                      title={new Date(message.timestamp).toLocaleString()}>
                      {formatTime(new Date(message.timestamp))}
                    </span>
                  </div>
                )}
                <p className="bg-muted mt-1 inline-block rounded-lg p-2 relative">
                  {message.text}
                  <div className="absolute border right-0 bottom-0 bg-card invisible opacity-0 group-hover/message:visible group-hover/message:opacity-100 transition-all duration-300">
                    <Popover>
                      <PopoverTrigger
                        openOnHover
                        delay={0}
                        render={
                          <Button size="icon-xs" variant="ghost">
                            <SmilePlusIcon />
                          </Button>
                        }
                      />
                      <PopoverContent className="w-fit p-0">
                        <ButtonGroup orientation="horizontal">
                          <PopoverPrimitive.Close
                            render={
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  sendJsonMessage({
                                    type: "react",
                                    messageId: message.id,
                                    reaction: "like",
                                  } satisfies ChatRoomSentMessage);
                                }}>
                                <ThumbsUpIcon className="text-blue-600" />
                              </Button>
                            }
                          />
                          <PopoverPrimitive.Close
                            render={
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  sendJsonMessage({
                                    type: "react",
                                    messageId: message.id,
                                    reaction: "love",
                                  } satisfies ChatRoomSentMessage);
                                }}>
                                <HeartIcon className="text-red-600" />
                              </Button>
                            }
                          />
                          <PopoverPrimitive.Close
                            render={
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  sendJsonMessage({
                                    type: "react",
                                    messageId: message.id,
                                    reaction: "laugh",
                                  } satisfies ChatRoomSentMessage);
                                }}>
                                <LaughIcon className="text-yellow-600" />
                              </Button>
                            }
                          />
                          <PopoverPrimitive.Close
                            render={
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  sendJsonMessage({
                                    type: "react",
                                    messageId: message.id,
                                    reaction: "angry",
                                  } satisfies ChatRoomSentMessage);
                                }}>
                                <AngryIcon className="text-red-800" />
                              </Button>
                            }
                          />
                        </ButtonGroup>
                      </PopoverContent>
                    </Popover>
                  </div>
                </p>
                {Object.entries(message.reactions).length > 0 && (
                  <div className="mt-1 flex">
                    {Object.entries(message.reactions).map(([reaction, count]) => (
                      <div
                        key={reaction}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 text-xs">
                        {reaction === "like" && <ThumbsUpIcon className="size-3 text-blue-600" />}
                        {reaction === "love" && <HeartIcon className="size-3 text-red-600" />}
                        {reaction === "laugh" && <LaughIcon className="size-3 text-yellow-500" />}
                        {reaction === "angry" && <AngryIcon className="size-3 text-red-800" />}
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
        <Field>
          <InputGroup>
            <InputGroupTextarea
              placeholder="Type your message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
            />
            <InputGroupAddon align="inline-end" className="self-end">
              <InputGroupButton
                size="icon-sm"
                variant="default"
                className="rounded-4xl"
                onClick={handleSend}>
                <SendIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </div>
    </div>
  );
}
