import {Button, Card, Input, Label, TextField, Tooltip} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {CheckIcon, ImagePlusIcon, TrashIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {useWorkspace} from "@/hooks/use-workspace";
import {useIsWorkspaceOwner} from "@/hooks/use-workspace-role";
import {ARCHIVED_MESSAGE_START} from "@/lib/archived";
import {errorMessage} from "@/lib/errors";
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
  const isReadOnly = useIsReadOnly();
  // Owners can change the look, unless the workspace is archived.
  const canEdit = isOwner && !isReadOnly;
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
                    disabled={!canEdit}
                    onClick={() => update.mutate({workspaceSlug, accent: accent.id})}
                    className={cn(
                      "ring-offset-surface flex size-8 items-center justify-center rounded-full ring-offset-2 transition disabled:cursor-not-allowed disabled:opacity-50",
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
            isDisabled={!canEdit}
            className="w-32">
            <Label>Workspace emoji</Label>
            <Input placeholder="🧇" maxLength={16} />
          </TextField>
          {canEdit && (
            <Button type="submit" variant="secondary">
              Save
            </Button>
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
  // Archived: the emoji are shown, with nothing to add or remove.
  const isReadOnly = useIsReadOnly();
  const add = useMutation(orpc.workspaces.customEmoji.add.mutationOptions());
  const remove = useMutation(
    orpc.workspaces.customEmoji.remove.mutationOptions({
      onSuccess: (_data, {name}) => toast.success(`:${name}: removed.`),
      // Archived workspaces are reported once by the global handler (router.tsx).
      onError: (error, {name}) => {
        if (!error.message.startsWith(ARCHIVED_MESSAGE_START)) {
          toast.error(errorMessage(error, `Couldn't remove :${name}:. Try again.`));
        }
      },
    })
  );
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
        <Card.Title>Custom emoji</Card.Title>
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
                className="bg-surface-secondary flex items-center gap-2 py-1 ps-2 pe-1">
                <img src={customEmojiUrl(workspaceSlug, e.fileId)} alt="" className="size-5" />
                <span className="text-sm">:{e.name}:</span>
                {!isReadOnly && (
                  <Button
                    size="sm"
                    isIconOnly
                    variant="ghost"
                    aria-label={`Remove :${e.name}:`}
                    onPress={() => remove.mutate({workspaceSlug, name: e.name})}>
                    <TrashIcon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {isReadOnly && emoji.length === 0 && <p className="text-muted text-sm">No team emoji.</p>}
        {!isReadOnly && (
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
              {file && preview ? (
                <img src={preview} alt="" className="size-5" />
              ) : (
                <ImagePlusIcon />
              )}
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
        )}
      </Card.Content>
    </Card>
  );
}
