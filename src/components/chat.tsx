import {
  ChatAttachment,
  ChatAttachmentGroup,
  ChatAttachmentInput,
  ChatConversation,
  ChatLoader,
  ChatMessage,
  EmptyState,
  PromptInput,
  usePromptInputTokens,
} from "@heroui-pro/react";
import {Avatar, Menu} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {useParams} from "@tanstack/react-router";
import {MessagesSquareIcon, PinIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {TokenFieldValue} from "react-aria-components/TokenField";
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {NO_PRESENCES} from "@/features/presences/presences";
import {PuzzleVoiceStrip} from "@/features/voice/voice-ui";
import {describeChatMessage, track} from "@/lib/analytics";
import {ARRIVE_FROM_BOTTOM, useMountedAt} from "@/lib/arrivals";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";
import {uploadImage} from "@/lib/upload-image";
import type {
  ChatMessage as ChatMessageData,
  ChatRoomReceivedMessage,
  ChatRoomSentMessage,
} from "@/server/do/chat";
import {mentionMarkdown} from "@/server/notifications";
import {useAppSelector} from "@/store";

import {MessageActions, MessageEditor, PinnedBar} from "./chat-message-tools";
import {EggoText} from "./eggo";
import {ImageLightbox} from "./image-lightbox";
import {LazyMarkdown} from "./lazy-markdown";
import {ReactionPicker, Reactions} from "./reactions";
import {userAvatarSrc, userInitials} from "./user-hover-card";

const EGGO = "Eggö";

/** Consecutive messages from one sender within this window are grouped under one header. */
const GROUP_WINDOW_MS = 60 * 1000;

function formatTime(date: Date) {
  return date.toLocaleString([], {weekday: "short", hour: "2-digit", minute: "2-digit"});
}

type PendingImage = {key: string; file: File; src: string};

const MAX_IMAGES = 10;
// Matches the server's limit; bigger images are scaled down and re-encoded before upload.
const IMAGE_LIMITS = {maxBytes: 5 * 1024 * 1024, maxSide: 2560};

const imageUrl = (puzzleId: string, id: string) => `/api/chat/${puzzleId}/images/${id}`;

/** Scrolls to a (pinned) message and briefly highlights it. */
function jumpTo(id: string) {
  const element = document.getElementById(`chat-message-${id}`);
  if (!element) {
    toast("That message is older than what's loaded here.");
    return;
  }
  element.scrollIntoView({behavior: "smooth", block: "center"});
  element.focus({preventScroll: true});
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

/** Someone who can be @mentioned (a workspace member). */
type Member = {id: string; name: string; email: string; image: string | null};

export function Chat({puzzleId}: {puzzleId: string}) {
  const {workspaceSlug} = useParams({from: "/_workspace/$workspaceSlug"});
  // null until the room's snapshot arrives.
  const [messages, setMessages] = useState<ChatMessageData[] | null>(null);
  // The composer's text with @mention tokens (each carries the member it refers to).
  const tokens = usePromptInputTokens<Member>({triggers: ["@"]});
  const input = tokens.value.toString();
  const clearInput = () => tokens.setValue(new TokenFieldValue<Member>([]));
  /** The message as sent: text, with mentions as markdown links the room can find. */
  const outgoingText = () =>
    tokens.value.segments
      .map(segment =>
        segment.type === "token" && segment.value
          ? mentionMarkdown(segment.value.name, segment.value.id)
          : segment.text
      )
      .join("");
  const {data: memberList} = useQuery(
    orpc.workspaces.members.list.queryOptions({input: {workspaceSlug}})
  );
  const mentionable = (memberList?.members ?? [])
    .map(member => member.user)
    .filter(user => user.name.toLowerCase().includes(tokens.query.toLowerCase()))
    .slice(0, 8);
  const pickTopSuggestion = (event: React.KeyboardEvent) => {
    const top = mentionable[0];
    const highlighted =
      event.target instanceof HTMLElement && event.target.getAttribute("aria-activedescendant");
    if (
      (event.key === "Enter" || event.key === "Tab") &&
      !event.shiftKey &&
      tokens.isOpen &&
      top &&
      !highlighted
    ) {
      event.preventDefault();
      event.stopPropagation();
      tokens.insertToken(`@${top.name}`, {value: top});
    }
  };
  const [images, setImages] = useState<PendingImage[]>([]);
  // Every pinned message (some may be older than the loaded ones), and the one being edited.
  const [pinned, setPinned] = useState<ChatMessageData[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const me = authClient.useSession().data?.user.id;
  const [isUploading, setIsUploading] = useState(false);
  const mountedAt = useMountedAt();

  // Previews are blob: URLs; release whatever is still pending when the chat closes.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => () => imagesRef.current.forEach(image => URL.revokeObjectURL(image.src)), []);

  const addImages = (files: File[]) => {
    const added = files
      .filter(file => file.type.startsWith("image/"))
      .map(file => ({key: crypto.randomUUID(), file, src: URL.createObjectURL(file)}));
    setImages(current => {
      const next = [...current, ...added];
      next.slice(MAX_IMAGES).forEach(image => URL.revokeObjectURL(image.src));
      return next.slice(0, MAX_IMAGES);
    });
  };
  const removeImage = (key: string) =>
    setImages(current => {
      const removed = current.find(image => image.key === key);
      if (removed) URL.revokeObjectURL(removed.src);
      return current.filter(image => image.key !== key);
    });

  const {sendJsonMessage} = useWebSocket<ChatRoomReceivedMessage>(`/api/chat/${puzzleId}`, {
    share: false,
    shouldReconnect: () => true,
    // Nothing reads `lastMessage`; skip storing it (messages are kept in `messages` above).
    filter: () => false,
    onMessage: event => {
      const message: ChatRoomReceivedMessage = JSON.parse(event.data);
      if (message.type === "snapshot") {
        setMessages(message.messages);
        setPinned(message.pinned ?? []);
      } else if (message.type === "message") {
        const updated = message.message;
        setPinned(prev =>
          updated.pinned
            ? [...prev.filter(m => m.id !== updated.id), updated]
            : prev.filter(m => m.id !== updated.id)
        );
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

  const send = (message: ChatRoomSentMessage) => {
    sendJsonMessage(message);
    trackChat(message);
  };

  const handleSend = async () => {
    if (isUploading || (!input.trim() && images.length === 0)) return;
    const text = outgoingText();
    if (images.length === 0) {
      send({type: "send", text});
      clearInput();
      return;
    }
    setIsUploading(true);
    try {
      const ids = await Promise.all(
        images.map(image => uploadImage(image.file, id => imageUrl(puzzleId, id), IMAGE_LIMITS))
      );
      send({type: "send", text, images: ids});
      clearInput();
      images.forEach(image => URL.revokeObjectURL(image.src));
      setImages([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't upload the image.");
    } finally {
      setIsUploading(false);
    }
  };

  const presences = useAppSelector(state => state.presences.value[puzzleId]) ?? NO_PRESENCES;
  // Messages only carry the sender's name; show the picture of whoever here goes by that name.
  const presenceByName = new Map(presences.map(user => [user.name, user]));

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-4">
      <PuzzleVoiceStrip puzzleId={puzzleId} viewers={presences} />
      <PinnedBar
        pinned={pinned}
        onJump={jumpTo}
        onUnpin={id => send({type: "pin", messageId: id, pinned: false})}
      />
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
                <EmptyState.Title>Quiet in here</EmptyState.Title>
                <EmptyState.Description>
                  Say hi, @mention a teammate, or send !help for Eggö's commands.
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : (
            messages.map((message, idx) => {
              const isFirstInGroup = startsGroup(messages, idx);
              const sender = presenceByName.get(message.name);
              return (
                <ChatMessage.Assistant
                  key={message.id}
                  id={`chat-message-${message.id}`}
                  // Focusable (not tabbable) so tapping a message on a touch screen, which has no
                  // hover, focuses it and reveals its reaction button.
                  tabIndex={-1}
                  // `group`: the reaction button appears while the message is hovered or focused.
                  className={cn(
                    "group hover:bg-surface-secondary/60 focus:bg-surface-secondary/60 relative -mx-2 rounded-lg px-2 outline-none",
                    isFirstInGroup ? "mt-2 pt-1 pb-0.5" : "py-0.5",
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
                        <span className="text-muted flex items-center gap-1 text-xs">
                          {message.pinned && (
                            <PinIcon
                              className="text-accent size-3"
                              aria-label={`Pinned by ${message.pinned.by}`}
                            />
                          )}
                          <time
                            dateTime={new Date(message.timestamp).toISOString()}
                            title={new Date(message.timestamp).toLocaleString()}>
                            {formatTime(new Date(message.timestamp))}
                          </time>
                        </span>
                      </div>
                    )}
                    <ChatMessage.Content className="flex min-w-0 flex-1 flex-col gap-1.5 wrap-anywhere">
                      {message.deleted ? (
                        <p className="text-muted text-sm italic">Message deleted</p>
                      ) : editingId === message.id ? (
                        <MessageEditor
                          message={message}
                          onCancel={() => setEditingId(null)}
                          onSave={text => {
                            send({type: "edit", messageId: message.id, text});
                            setEditingId(null);
                          }}
                        />
                      ) : message.name === EGGO ? (
                        <EggoText text={message.text} />
                      ) : (
                        message.text && <LazyMarkdown>{message.text}</LazyMarkdown>
                      )}
                      {message.editedAt && !message.deleted && editingId !== message.id && (
                        <span
                          className="text-muted -mt-1 text-xs"
                          title={`Edited ${new Date(message.editedAt).toLocaleString()}`}>
                          (edited)
                        </span>
                      )}
                      {message.images?.map(id => (
                        <ImageLightbox
                          key={id}
                          src={imageUrl(puzzleId, id)}
                          alt={`Shared by ${message.name}`}
                        />
                      ))}
                    </ChatMessage.Content>
                    {/* Floats over the corner instead of taking a column on every message. */}
                    {!message.deleted && editingId !== message.id && (
                      <ChatMessage.Actions className="bg-surface absolute -top-3 right-1 rounded-lg opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100">
                        <ReactionPicker
                          onReact={reaction =>
                            send({type: "react", messageId: message.id, reaction})
                          }
                        />
                        <MessageActions
                          message={message}
                          isMine={me !== undefined && message.userId === me}
                          onPin={isPinned =>
                            send({type: "pin", messageId: message.id, pinned: isPinned})
                          }
                          onEdit={() => setEditingId(message.id)}
                          onDelete={() => send({type: "delete", messageId: message.id})}
                        />
                      </ChatMessage.Actions>
                    )}
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
          status={isUploading ? "submitted" : "ready"}
          onSubmit={() => void handleSend()}>
          <ChatAttachmentInput accept="image/*" onFilesSelected={addImages}>
            <ChatAttachmentInput.Dropzone
              render={dropzoneProps => (
                <PromptInput.Shell {...dropzoneProps}>
                  {/* Tokens wraps only the field and its suggestions (a menu in the toolbar would
                      join the suggestion list). */}
                  <PromptInput.Tokens>
                    {/* TokenInput's React Aria wrapper must let the editable field occupy
                        the compact shell's textarea grid area. */}
                    <PromptInput.Content className="[&_.react-aria-TokenField]:contents">
                      {images.length > 0 && (
                        <PromptInput.Attachments>
                          <ChatAttachmentGroup>
                            {images.map(image => (
                              <ChatAttachment
                                key={image.key}
                                mimeType={image.file.type}
                                name={image.file.name}
                                size={image.file.size}
                                src={image.src}>
                                <ChatAttachment.Preview />
                                <ChatAttachment.Remove
                                  aria-label="Remove image"
                                  onPress={() => removeImage(image.key)}
                                />
                              </ChatAttachment>
                            ))}
                          </ChatAttachmentGroup>
                        </PromptInput.Attachments>
                      )}
                      {/* Enter or Tab with suggestions showing (and none highlighted yet) picks
                          the top one, like other chat apps, instead of sending "@Pri". */}
                      <div className="contents" onKeyDownCapture={pickTopSuggestion}>
                        <PromptInput.TokenInput
                          tokens={tokens}
                          aria-label="Chat message"
                          placeholder="Message… (@ to mention, !help for Eggö)"
                        />
                      </div>
                    </PromptInput.Content>
                    <PromptInput.TokenSuggestions
                      isOpen={tokens.isOpen && mentionable.length > 0}
                      placement="top start"
                      tokens={tokens}>
                      <Menu aria-label="Mention someone" items={mentionable}>
                        {user => (
                          <Menu.Item
                            id={user.id}
                            textValue={user.name}
                            onAction={() => tokens.insertToken(`@${user.name}`, {value: user})}>
                            <Avatar size="sm" className="size-6">
                              <Avatar.Image src={userAvatarSrc(user)} alt="" />
                              <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
                            </Avatar>
                            <span className="truncate">{user.name}</span>
                          </Menu.Item>
                        )}
                      </Menu>
                    </PromptInput.TokenSuggestions>
                  </PromptInput.Tokens>
                  <PromptInput.Toolbar>
                    <PromptInput.ToolbarEnd>
                      <PromptInput.Send
                        aria-label="Send message"
                        // The composer only enables Send for text; an image on its own is a message too.
                        isDisabled={isUploading || (!input.trim() && images.length === 0)}
                      />
                    </PromptInput.ToolbarEnd>
                  </PromptInput.Toolbar>
                </PromptInput.Shell>
              )}
            />
          </ChatAttachmentInput>
        </PromptInput>
      </div>
    </div>
  );
}

/** Product analytics for what you do in a chat (see `track`). */
function trackChat(message: ChatRoomSentMessage) {
  switch (message.type) {
    case "send":
      track("chat_message_sent", describeChatMessage(message.text, message.images?.length));
      break;
    case "edit":
      track("chat_message_edited");
      break;
    case "delete":
      track("chat_message_deleted");
      break;
    case "pin":
      track(message.pinned ? "chat_message_pinned" : "chat_message_unpinned");
      break;
    case "react":
      track("chat_reaction_toggled", {isCustomEmoji: message.reaction.startsWith(":")});
      break;
  }
}
