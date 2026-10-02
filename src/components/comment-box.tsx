import {Button, InputGroup, Tooltip} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {PencilIcon} from "lucide-react";
import {useState} from "react";
import {toast} from "sonner";

import {workspaceMutations} from "@/lib/workspace-mutations";

import {RelativeTime} from "./activity-log";
import {useAppForm} from "./form";
import {LazyMarkdown} from "./lazy-markdown";

// Placeholders older versions saved as the comment itself when it was cleared; show them as empty.
const LEGACY_EMPTY_COMMENTS = new Set(["No pinned comment.", "No comment set."]);

export function CommentBox({
  comment: rawComment,
  workspaceSlug,
  puzzleId,
  commentUpdatedAt,
  commentUpdatedBy,
  title = "Notes",
}: {
  comment: string | null;
  commentUpdatedAt: Date | null;
  commentUpdatedBy: string | null;
  workspaceSlug: string;
  puzzleId?: string;
  title?: string;
}) {
  const comment = rawComment && !LEGACY_EMPTY_COMMENTS.has(rawComment.trim()) ? rawComment : null;
  const [isEditing, setIsEditing] = useState(false);

  const workspaceUpdateMutation = useMutation(workspaceMutations.workspaces.update());
  const puzzleUpdateMutation = useMutation(workspaceMutations.puzzles.update());

  const saveComment = (newComment: string | null) => {
    if (puzzleId === undefined) {
      workspaceUpdateMutation.mutate({workspaceSlug, comment: newComment});
    } else {
      puzzleUpdateMutation.mutate({workspaceSlug, id: puzzleId, comment: newComment});
    }
  };

  const updateComment = (newComment: string | null) => {
    const previous = comment;
    const next = newComment?.trim() ? newComment : null;
    setIsEditing(false);
    if (next === previous) return;
    saveComment(next);
    toast(next ? `${title} updated` : `${title} cleared`, {
      action: {label: "Undo", onClick: () => saveComment(previous)},
    });
  };

  const form = useAppForm({
    defaultValues: {comment: comment ?? ""},
    onSubmit: ({value}) => updateComment(value.comment),
  });

  const startEditing = () => {
    // Start from the latest comment: once edited, the form is touched and no longer follows
    // upstream changes on its own.
    form.reset({comment: comment ?? ""});
    setIsEditing(true);
  };

  return (
    <section className="flex flex-col gap-1.5" aria-label={title}>
      <div className="flex min-h-8 items-center gap-2">
        <h3 className="text-muted flex-1 text-xs font-medium">{title}</h3>
        {!isEditing && comment && (
          <Tooltip>
            <Tooltip.Trigger>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label={`Edit ${title.toLowerCase()}`}
                onPress={startEditing}>
                <PencilIcon />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Edit {title.toLowerCase()}</Tooltip.Content>
          </Tooltip>
        )}
      </div>
      {isEditing ? (
        <form.AppForm>
          <form.Form className="gap-2">
            <InputGroup fullWidth variant="secondary" className="h-auto">
              <form.AppField
                name="comment"
                children={field => (
                  <field.InputGroupTextareaField
                    aria-label={title}
                    placeholder="Markdown supported"
                    autoFocus
                    className="max-h-90 min-h-30 w-full resize-none"
                    onKeyDown={e => {
                      if (e.key === "Escape") setIsEditing(false);
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void form.handleSubmit();
                      }
                    }}
                  />
                )}
              />
            </InputGroup>
            <div className="flex items-center gap-2">
              {comment && (
                <Button variant="danger-soft" size="sm" onPress={() => updateComment(null)}>
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ms-auto"
                onPress={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit">
                Save
              </Button>
            </div>
          </form.Form>
        </form.AppForm>
      ) : comment ? (
        <>
          <div className="text-sm">
            <LazyMarkdown>{comment}</LazyMarkdown>
          </div>
          {(commentUpdatedAt || commentUpdatedBy) && (
            <p className="text-muted text-xs">
              Updated {commentUpdatedAt ? <RelativeTime date={commentUpdatedAt} /> : ""}
              {commentUpdatedBy ? ` by ${commentUpdatedBy}` : ""}
            </p>
          )}
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted w-full justify-start"
          onPress={startEditing}>
          <PencilIcon />
          Add a note…
        </Button>
      )}
    </section>
  );
}
