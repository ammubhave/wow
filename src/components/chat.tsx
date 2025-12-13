import {SendIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import useWebSocket from "react-use-websocket";

import {cn} from "@/lib/utils";

import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {ScrollArea} from "./ui/scroll-area";
import {Textarea} from "./ui/textarea";

interface Message {
  text: string;
  name: string;
  timestamp: number;
}

function formatTime(date: Date) {
  return date.toLocaleString([], {weekday: "short", hour: "2-digit", minute: "2-digit"});
}

export function Chat({puzzleId}: {puzzleId: string}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {sendJsonMessage, lastJsonMessage} = useWebSocket(
    `${typeof window !== "undefined" ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}` : ""}/api/chat/${puzzleId}`,
    {share: false, shouldReconnect: () => true}
  );
  useEffect(() => {
    if (Array.isArray(lastJsonMessage)) {
      setMessages(lastJsonMessage);
    } else if (lastJsonMessage !== null) {
      setMessages([...messages, lastJsonMessage as Message]);
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      sendJsonMessage({text: input});
      setInput("");
    }
  };

  return (
    <>
      <ScrollArea className="flex-1 pr-4">
        {messages.map((message, idx) => (
          <div
            key={idx}
            style={{overflowWrap: "anywhere"}}
            className={cn(
              "max-w-54.25",
              (idx === messages.length - 1 || messages[idx + 1]!.name !== message.name) && "mb-4"
            )}>
            {(idx === 0 ||
              messages[idx - 1]!.name !== message.name ||
              (messages[idx - 1] &&
                message.timestamp - messages[idx - 1]!.timestamp > 60 * 1000)) && (
              <div className="flex items-baseline justify-between space-x-2">
                <span className="font-semibold">{message.name}</span>
                <span
                  className="text-muted-foreground text-[10px]"
                  title={new Date(message.timestamp).toLocaleString()}>
                  {formatTime(new Date(message.timestamp))}
                </span>
              </div>
            )}
            <p className="bg-muted mt-1 inline-block rounded-lg p-2">{message.text}</p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>
      <div className="mt-4 flex">
        <div className="relative w-full">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Type your message...`}
            className="mr-2 grow absolute"
            onKeyDown={e => e.key === "Enter" && handleSend()}
          />
          <div className="invisible mr-2">{input}</div>
        </div>
        <Button onClick={handleSend}>
          <SendIcon className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </>
  );
}
