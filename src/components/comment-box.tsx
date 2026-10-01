import {Button, Dropdown, InputGroup, Label} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {PencilIcon} from "lucide-react";
import {useState} from "react";
import Markdown, {type Components} from "react-markdown";
import remarkGfm from "remark-gfm";
import {cn} from "tailwind-variants";

import {workspaceMutations} from "@/lib/workspace-mutations";

import {RelativeTime} from "./activity-log";
import {useAppForm} from "./form";

const DEFAULT_MESSAGE = "No pinned comment.";

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

export function CommentBox({
  comment,
  workspaceSlug,
  puzzleId,
  commentUpdatedAt,
  commentUpdatedBy,
}: {
  comment: string | null;
  commentUpdatedAt: Date | null;
  commentUpdatedBy: string | null;
  workspaceSlug: string;
  puzzleId?: string;
}) {
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [undoComment, setUndoComment] = useState(null as string | null);

  const workspaceUpdateMutation = useMutation(workspaceMutations.workspaces.update());
  const puzzleUpdateMutation = useMutation(workspaceMutations.puzzles.update());

  const updateComment = (newComment: string | null) => {
    if (puzzleId === undefined) {
      workspaceUpdateMutation.mutate({workspaceSlug, comment: newComment});
    } else {
      puzzleUpdateMutation.mutate({workspaceSlug, id: puzzleId, comment: newComment});
    }
    setIsEditingComment(false);
    setUndoComment(comment);
  };

  const form = useAppForm({
    defaultValues: {comment},
    onSubmit: ({value}) => updateComment(value.comment),
  });

  const onCancel = () => {
    setIsEditingComment(false);
  };

  return (
    <div className="relative flex-wrap justify-between">
      {!isEditingComment ? (
        <span>
          <div className="text-sm">
            <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {comment || DEFAULT_MESSAGE}
            </Markdown>
          </div>
          <span className="absolute top-0 right-0">
            <Dropdown>
              <Button variant="ghost" isIconOnly>
                <PencilIcon />
                <span className="sr-only">Toggle comment settings</span>
              </Button>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                  onAction={key => {
                    if (key === "edit") {
                      // Start from the latest comment: once edited, the form is touched and no
                      // longer follows upstream changes on its own.
                      form.reset({comment});
                      setIsEditingComment(true);
                    } else if (key === "clear") {
                      updateComment(DEFAULT_MESSAGE);
                    } else if (key === "undo") {
                      updateComment(undoComment || null);
                    }
                  }}>
                  <Dropdown.Item id="edit" textValue="Edit">
                    <Label>Edit</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="clear" textValue="Clear">
                    <Label>Clear</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="undo" textValue="Undo" isDisabled={undoComment === null}>
                    <Label>Undo</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </span>
          {commentUpdatedAt || commentUpdatedBy ? (
            <span className="text-muted mt-2 block text-xs">
              Updated {commentUpdatedAt ? <RelativeTime date={commentUpdatedAt} /> : ""}{" "}
              {commentUpdatedBy ? "by " + commentUpdatedBy : ""}
            </span>
          ) : null}
        </span>
      ) : (
        <form.AppForm>
          <form.Form>
            <InputGroup fullWidth className="flex flex-col gap-2">
              <form.AppField
                name="comment"
                children={field => (
                  <field.InputGroupTextareaField className="max-h-[360px] min-h-[120px] w-full resize-none px-3.5 py-0" />
                )}
              />
              <InputGroup.Suffix className="flex w-full items-center gap-1.5 px-3 py-0">
                <Button variant="ghost" className="ml-auto" size="sm" onPress={() => onCancel()}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Save
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
          </form.Form>
        </form.AppForm>
      )}
    </div>
  );
}
