import {PencilIcon} from "lucide-react";
import {useEffect, useState} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {cn} from "@/lib/utils";

import {useAppForm} from "./form";
import {useWorkspace} from "./use-workspace";

const DEFAULT_MESSAGE = "No pinned comment.";

export function CommentBox({
  comment,
  workspaceId,
  puzzleId,
}: {
  comment?: string;
  workspaceId: string;
  puzzleId?: string;
}) {
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [updatedComment, setComment] = useState(comment || DEFAULT_MESSAGE);
  useEffect(() => setComment(comment || DEFAULT_MESSAGE), [comment]);

  const workspace = useWorkspace({workspaceId});

  const updateComment = (text: string) => {
    if (text === updatedComment || (text === "" && updatedComment === DEFAULT_MESSAGE)) {
      return;
    }
    if (text === "") {
      text = DEFAULT_MESSAGE;
    }
    toast.promise(
      puzzleId === undefined
        ? workspace.update.mutateAsync({workspaceId, comment: text})
        : workspace.puzzles.update.mutateAsync({id: puzzleId, comment: text}),
      {
        loading: "Saving comment...",
        success: _data => {
          setComment(text);
          setIsEditingComment(false);
          return "Comment updated!";
        },
        error: "Oops! Something went wrong.",
      }
    );
  };

  const form = useAppForm({
    defaultValues: {comment: updatedComment},
    onSubmit: ({value}) => updateComment(value.comment),
  });

  const onCancel = () => {
    setIsEditingComment(false);
  };

  return (
    <div className="justify-between flex-wrap relative">
      <span>
        {!isEditingComment ? (
          <span>
            <div className="text-sm">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({children, className, node: _node, ...rest}) => (
                    <h1
                      {...rest}
                      className={cn(
                        className,
                        "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl"
                      )}>
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
                    <h3
                      {...rest}
                      className={cn(
                        className,
                        "scroll-m-20 text-2xl font-semibold tracking-tight"
                      )}>
                      {children}
                    </h3>
                  ),
                  h4: ({children, className, node: _node, ...rest}) => (
                    <h4
                      {...rest}
                      className={cn(className, "scroll-m-20 text-xl font-semibold tracking-tight")}>
                      {children}
                    </h4>
                  ),
                  h5: ({children, className, node: _node, ...rest}) => (
                    <h4
                      {...rest}
                      className={cn(className, "scroll-m-20 text-lg font-semibold tracking-tight")}>
                      {children}
                    </h4>
                  ),
                  h6: ({children, className, node: _node, ...rest}) => (
                    <h4
                      {...rest}
                      className={cn(
                        className,
                        "scroll-m-20 text-base font-semibold tracking-tight"
                      )}>
                      {children}
                    </h4>
                  ),
                  p: ({children, className, node: _node, ...rest}) => (
                    <p {...rest} className={cn(className, "leading-7 not-first:mt-6")}>
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
                        "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
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
                    <tr {...rest} className={cn(className, "m-0 border-t p-0 even:bg-muted")}>
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
                }}>
                {updatedComment}
              </Markdown>
            </div>
            <span className="absolute top-0 right-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon">
                      <PencilIcon />
                      <span className="sr-only">Toggle comment settings</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      form.setFieldValue(
                        "comment",
                        updatedComment === DEFAULT_MESSAGE ? "" : updatedComment
                      );
                      setIsEditingComment(true);
                    }}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateComment(DEFAULT_MESSAGE)}>
                    Clear
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </span>
        ) : (
          <form.AppForm>
            <form
              id={form.formId}
              className="space-y-2"
              onSubmit={e => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}>
              <form.AppField
                name="comment"
                children={field => <field.TextareaField label="Comment" rows={10} />}
              />
              <span className="gap-2 flex">
                <form.SubmitButton>Save</form.SubmitButton>
                <Button variant="secondary" onClick={() => onCancel()}>
                  Cancel
                </Button>
              </span>
            </form>
          </form.AppForm>
        )}
      </span>
    </div>
  );
}
