import {ChatMessage} from "@heroui-pro/react";
import {Button, Popover, TextArea} from "@heroui/react";
import {ChevronDownIcon, PencilIcon, PinIcon, PinOffIcon, Trash2Icon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {cn} from "tailwind-variants";

import type {ChatMessage as ChatMessageData} from "@/server/do/chat";
import {MENTION_PATTERN, mentionMarkdown, plainMentions} from "@/server/notifications";

/** Pin/unpin, and (on your own messages) edit and delete, for a message's hover bar. */
export function MessageActions({
  message,
  isMine,
  onPin,
  onEdit,
  onDelete,
}: {
  message: ChatMessageData;
  isMine: boolean;
  onPin: (pinned: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  return (
    <>
      <ChatMessage.Action
        aria-label={message.pinned ? "Unpin message" : "Pin message"}
        tooltip={message.pinned ? "Unpin" : "Pin to the top of the chat"}
        onPress={() => onPin(!message.pinned)}>
        {message.pinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
      </ChatMessage.Action>
      {isMine && (
        <>
          <ChatMessage.Action aria-label="Edit message" tooltip="Edit" onPress={onEdit}>
            <PencilIcon className="size-4" />
          </ChatMessage.Action>
          <Popover isOpen={isConfirming} onOpenChange={setIsConfirming}>
            <ChatMessage.Action aria-label="Delete message" tooltip="Delete">
              <Trash2Icon className="size-4" />
            </ChatMessage.Action>
            <Popover.Content placement="top end">
              <Popover.Dialog aria-label="Delete message" className="flex flex-col gap-2 p-3">
                <p className="text-sm">Delete this message for everyone?</p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onPress={() => setIsConfirming(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onPress={() => {
                      setIsConfirming(false);
                      onDelete();
                    }}>
                    Delete
                  </Button>
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </>
      )}
    </>
  );
}

/**
 * Editing a message in place. It's shown with its mentions as plain "@Name"; those still in the
 * text when you save become mentions again.
 */
export function MessageEditor({
  message,
  onSave,
  onCancel,
}: {
  message: ChatMessageData;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(() => plainMentions(message.text));
  // Opens focused with the caret at the end, ready to keep typing.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);
  const save = () => {
    let restored = text.trim();
    if (!restored) return;
    // Put back each original mention whose "@Name" survived the edit.
    for (const [, name, userId] of message.text.matchAll(MENTION_PATTERN)) {
      restored = restored.replace(`@${name}`, mentionMarkdown(name!, userId!));
    }
    if (restored === message.text) onCancel();
    else onSave(restored);
  };
  return (
    <div className="flex flex-col gap-1">
      <TextArea
        aria-label="Edit message"
        ref={inputRef}
        value={text}
        onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            save();
          } else if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="min-h-16 text-sm"
      />
      <p className="text-muted text-xs">
        Enter to save · Esc to cancel
        <span className="ms-2 inline-flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2" onPress={onCancel}>
            Cancel
          </Button>
          <Button size="sm" className="h-6 px-2" onPress={save}>
            Save
          </Button>
        </span>
      </p>
    </div>
  );
}

/**
 * Above the chat: what's pinned (newest first). Collapsed it shows the latest pin; expanded, all of
 * them, each jumping to its message (when it's loaded) or unpinning.
 */
export function PinnedBar({
  pinned,
  onJump,
  onUnpin,
}: {
  pinned: ChatMessageData[];
  onJump: (id: string) => void;
  onUnpin: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (pinned.length === 0) return null;
  const sorted = pinned.toSorted((a, b) => (b.pinned?.at ?? 0) - (a.pinned?.at ?? 0));
  const shown = isOpen ? sorted : sorted.slice(0, 1);
  return (
    <section
      aria-label="Pinned messages"
      className="border-separator bg-surface-secondary/50 mx-2 mb-1 rounded-lg border px-2 py-1.5">
      <button
        type="button"
        className="text-muted flex w-full items-center gap-1 text-xs"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}>
        <PinIcon className="size-3" />
        {pinned.length === 1 ? "Pinned" : `${pinned.length} pinned`}
        {pinned.length > 1 && (
          <ChevronDownIcon className={cn("ms-auto size-3.5 transition", isOpen && "rotate-180")} />
        )}
      </button>
      <ul className={cn("flex flex-col", isOpen && "max-h-48 overflow-y-auto")}>
        {shown.map(message => (
          <li key={message.id} className="group/pin flex items-start gap-2 py-0.5">
            <button
              type="button"
              className="min-w-0 flex-1 text-start text-sm hover:underline"
              onClick={() => onJump(message.id)}>
              <span className="font-medium">{message.name}: </span>
              <span className="line-clamp-2">
                {plainMentions(message.text) || (message.images?.length ? "🖼 an image" : "")}
              </span>
            </button>
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              className="h-6 w-6 min-w-6 opacity-60 group-hover/pin:opacity-100"
              aria-label={`Unpin ${message.name}'s message`}
              onPress={() => onUnpin(message.id)}>
              <PinOffIcon className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
