import {Button, Card, Input, Label, TextField, Tooltip} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {CheckIcon, ImagePlusIcon, TrashIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {useWorkspace} from "@/hooks/use-workspace";
import {useIsWorkspaceOwner} from "@/hooks/use-workspace-role";
import {orpc} from "@/lib/orpc";
import {uploadImage} from "@/lib/upload-image";
import {workspaceMutations} from "@/lib/workspace-mutations";
import {ACCENTS} from "@/lib/workspace-theme";

export const customEmojiUrl = (workspaceSlug: string, fileId: string) =>
  `/api/workspaces/${workspaceSlug}/emoji/${fileId}`;

/** Accent color and team emoji (owners). */
export function LookCard({workspaceSlug}: {workspaceSlug: string}) {
  const workspace = useWorkspace();
  const isOwner = useIsWorkspaceOwner();
  const update = useMutation(workspaceMutations.workspaces.update());
  const [emoji, setEmoji] = useState(workspace.theme.emoji ?? "");
  const current = workspace.theme.accent ?? "default";
  return (
    <Card>
      <Card.Header>
        <Card.Title>Look</Card.Title>
        <Card.Description>
          Give the workspace your hunt's colors: an accent color for buttons, progress and
          highlights, and an emoji beside your team name.
          {!isOwner && " Only owners can change these."}
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Accent color</legend>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map(accent => (
              <Tooltip key={accent.id} delay={300}>
                <Tooltip.Trigger>
                  <button
                    type="button"
                    aria-pressed={current === accent.id}
                    aria-label={accent.label}
                    disabled={!isOwner}
                    onClick={() => update.mutate({workspaceSlug, accent: accent.id})}
                    className={cn(
                      "ring-offset-surface flex size-8 items-center justify-center rounded-full ring-offset-2 transition disabled:cursor-not-allowed",
                      current === accent.id && "ring-foreground ring-2"
                    )}
                    style={{background: accent.color ?? "oklch(66.98% 0.1605 57.71)"}}>
                    {current === accent.id && <CheckIcon className="size-4 text-white" />}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content>{accent.label}</Tooltip.Content>
              </Tooltip>
            ))}
          </div>
        </fieldset>
        <form
          className="flex items-end gap-2"
          onSubmit={event => {
            event.preventDefault();
            update.mutate(
              {workspaceSlug, emoji: emoji.trim() || null},
              {onSuccess: () => toast.success(emoji.trim() ? "Emoji saved." : "Emoji removed.")}
            );
          }}>
          <TextField
            variant="secondary"
            value={emoji}
            onChange={setEmoji}
            isReadOnly={!isOwner}
            className="w-32">
            <Label>Team emoji</Label>
            <Input placeholder="🧇" maxLength={16} />
          </TextField>
          {isOwner && (
            <Button type="submit" variant="secondary">
              Save
            </Button>
          )}
        </form>
      </Card.Content>
    </Card>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const toMs = (value: string) => (value ? new Date(value).getTime() : null);

/** `datetime-local` value for a timestamp, in this browser's time zone. */
function toLocalInput(date: Date | string | null | undefined) {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Optional hunt start/end times (owners): the header shows a clock, the chart the window. */
export function HuntClockCard({workspaceSlug}: {workspaceSlug: string}) {
  const workspace = useWorkspace();
  const isOwner = useIsWorkspaceOwner();
  const update = useMutation(workspaceMutations.workspaces.update());
  const [start, setStart] = useState(toLocalInput(workspace.huntStartsAt));
  const [end, setEnd] = useState(toLocalInput(workspace.huntEndsAt));
  return (
    <Card>
      <Card.Header>
        <Card.Title>Hunt clock</Card.Title>
        <Card.Description>
          Optional. With a start (and end) time, the header counts the hunt down and up, and the
          solves chart covers the hunt.
          {!isOwner && " Only owners can change these."}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={event => {
            event.preventDefault();
            const huntStartsAt = toMs(start);
            const huntEndsAt = toMs(end);
            if (huntStartsAt && huntEndsAt && huntEndsAt <= huntStartsAt) {
              toast.error("The hunt has to end after it starts.");
              return;
            }
            update.mutate(
              {workspaceSlug, huntStartsAt, huntEndsAt},
              {onSuccess: () => toast.success("Hunt clock saved.")}
            );
          }}>
          <TextField variant="secondary" value={start} onChange={setStart} isReadOnly={!isOwner}>
            <Label>Starts</Label>
            <Input type="datetime-local" />
          </TextField>
          <TextField variant="secondary" value={end} onChange={setEnd} isReadOnly={!isOwner}>
            <Label>Ends</Label>
            <Input type="datetime-local" />
          </TextField>
          {isOwner && (
            <div className="flex gap-2">
              <Button type="submit" variant="secondary">
                Save
              </Button>
              {(start || end) && (
                <Button
                  variant="ghost"
                  onPress={() => {
                    setStart("");
                    setEnd("");
                    update.mutate({workspaceSlug, huntStartsAt: null, huntEndsAt: null});
                  }}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </form>
      </Card.Content>
    </Card>
  );
}

const EMOJI_LIMITS = {maxBytes: 256 * 1024, maxSide: 128};

/** The team's custom reaction emoji (anyone can add): small images used as :name:. */
export function TeamEmojiCard({workspaceSlug}: {workspaceSlug: string}) {
  const {theme} = useWorkspace();
  const add = useMutation(orpc.workspaces.customEmoji.add.mutationOptions());
  const remove = useMutation(orpc.workspaces.customEmoji.remove.mutationOptions());
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // Preview of the chosen image (released when replaced, or when the card goes away).
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef(preview);
  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);
  useEffect(() => () => void (previewRef.current && URL.revokeObjectURL(previewRef.current)), []);
  const choose = (next: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next && URL.createObjectURL(next));
  };
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cleanName = name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]/g, "");
  const emoji = theme.customEmoji ?? [];
  return (
    <Card>
      <Card.Header>
        <Card.Title>Team emoji</Card.Title>
        <Card.Description>
          Your own reaction emoji (an image and a name). Anyone in the workspace can add them.
        </Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        {emoji.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {emoji.map(e => (
              <li
                key={e.name}
                className="bg-surface-secondary flex items-center gap-2 rounded-lg py-1 ps-2 pe-1">
                <img src={customEmojiUrl(workspaceSlug, e.fileId)} alt="" className="size-5" />
                <span className="text-sm">:{e.name}:</span>
                <Button
                  size="sm"
                  isIconOnly
                  variant="ghost"
                  aria-label={`Remove :${e.name}:`}
                  onPress={() => remove.mutate({workspaceSlug, name: e.name})}>
                  <TrashIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async event => {
            event.preventDefault();
            if (!file || !cleanName) return;
            setIsUploading(true);
            try {
              const fileId = await uploadImage(
                file,
                id => customEmojiUrl(workspaceSlug, id),
                EMOJI_LIMITS
              );
              await add.mutateAsync({workspaceSlug, name: cleanName, fileId});
              toast.success(`:${cleanName}: added.`);
              setName("");
              choose(null);
              if (fileRef.current) fileRef.current.value = "";
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Couldn't add the emoji.");
            } finally {
              setIsUploading(false);
            }
          }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={event => choose(event.target.files?.[0] ?? null)}
          />
          <Button variant="secondary" onPress={() => fileRef.current?.click()}>
            {file && preview ? <img src={preview} alt="" className="size-5" /> : <ImagePlusIcon />}
            {file ? "Change image" : "Choose image"}
          </Button>
          <TextField variant="secondary" value={name} onChange={setName} className="w-40">
            <Label>Name</Label>
            <Input placeholder="partyparrot" maxLength={32} />
          </TextField>
          <Button type="submit" isDisabled={!file || !cleanName || isUploading}>
            Add
          </Button>
        </form>
      </Card.Content>
    </Card>
  );
}
