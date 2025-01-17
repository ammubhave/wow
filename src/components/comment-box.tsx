import { zodResolver } from "@hookform/resolvers/zod";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const DEFAULT_MESSAGE = "No comment set.";

export function CommentBox({
  comment,
  ...ids
}: {
  comment?: string;
} & ({ workspaceId: string } | { puzzleId: string })) {
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [updatedComment, setComment] = useState(comment || DEFAULT_MESSAGE);
  useEffect(() => setComment(comment || DEFAULT_MESSAGE), [comment]);

  const updateWorkspaceMutation = trpc.workspaces.update.useMutation();
  const updatePuzzleMutation = trpc.puzzles.update.useMutation();

  const utils = trpc.useUtils();
  const updateComment = (text: string) => {
    if (text == updatedComment) {
      return;
    }
    toast.promise(
      "workspaceId" in ids
        ? updateWorkspaceMutation.mutateAsync({
            id: ids.workspaceId,
            comment: text,
          })
        : updatePuzzleMutation.mutateAsync({
            id: ids.puzzleId,
            comment: text,
          }),
      {
        loading: "Saving comment...",
        success: (_data) => {
          setComment(text);
          setIsEditingComment(false);
          if ("workspaceId" in ids) {
            utils.workspaces.get.invalidate();
          } else {
            utils.rounds.list.invalidate();
          }
          return "Comment updated!";
        },
        error: "Oops! Something went wrong.",
      },
    );
  };

  const formSchema = z.object({
    comment: z.string(),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: updatedComment,
    },
  });
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateComment(data.comment);
  };

  const onCancel = (_data: z.infer<typeof formSchema>) => {
    setIsEditingComment(false);
  };

  return (
    <div className="justify-between flex-wrap">
      <span>
        {!isEditingComment ? (
          <span>
            <div className="text-sm">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children, className, node: _node, ...rest }) => (
                    <h1
                      {...rest}
                      className={cn(
                        className,
                        "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
                      )}
                    >
                      {children}
                    </h1>
                  ),
                  h2: ({ children, className, node: _node, ...rest }) => (
                    <h2
                      {...rest}
                      className={cn(
                        className,
                        "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
                      )}
                    >
                      {children}
                    </h2>
                  ),
                  h3: ({ children, className, node: _node, ...rest }) => (
                    <h3
                      {...rest}
                      className={cn(
                        className,
                        "scroll-m-20 text-2xl font-semibold tracking-tight",
                      )}
                    >
                      {children}
                    </h3>
                  ),
                  h4: ({ children, className, node: _node, ...rest }) => (
                    <h4
                      {...rest}
                      className={cn(
                        className,
                        "scroll-m-20 text-xl font-semibold tracking-tight",
                      )}
                    >
                      {children}
                    </h4>
                  ),
                  h5: ({ children, className, node: _node, ...rest }) => (
                    <h4
                      {...rest}
                      className={cn(
                        className,
                        "scroll-m-20 text-lg font-semibold tracking-tight",
                      )}
                    >
                      {children}
                    </h4>
                  ),
                  h6: ({ children, className, node: _node, ...rest }) => (
                    <h4
                      {...rest}
                      className={cn(
                        className,
                        "scroll-m-20 text-base font-semibold tracking-tight",
                      )}
                    >
                      {children}
                    </h4>
                  ),
                  p: ({ children, className, node: _node, ...rest }) => (
                    <p
                      {...rest}
                      className={cn(
                        className,
                        "leading-7 [&:not(:first-child)]:mt-6",
                      )}
                    >
                      {children}
                    </p>
                  ),
                  blockquote: ({
                    children,
                    className,
                    node: _node,
                    ...rest
                  }) => (
                    <blockquote
                      {...rest}
                      className={cn(className, "mt-6 border-l-2 pl-6 italic")}
                    >
                      {children}
                    </blockquote>
                  ),
                  ul: ({ children, className, node: _node, ...rest }) => (
                    <ul
                      {...rest}
                      className={cn(
                        className,
                        "my-6 ml-6 list-disc [&>li]:mt-2",
                      )}
                    >
                      {children}
                    </ul>
                  ),
                  ol: ({ children, className, node: _node, ...rest }) => (
                    <ol
                      {...rest}
                      className={cn(
                        className,
                        "my-6 ml-6 list-decimal [&>li]:mt-2",
                      )}
                    >
                      {children}
                    </ol>
                  ),
                  code: ({ children, className, node: _node, ...rest }) => (
                    <code
                      {...rest}
                      className={cn(
                        className,
                        "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
                      )}
                    >
                      {children}
                    </code>
                  ),
                  table: ({ children, className, node: _node, ...rest }) => (
                    <div className="my-6 w-full overflow-y-auto">
                      <table {...rest} className={cn(className, "w-full")}>
                        {children}
                      </table>
                    </div>
                  ),
                  tr: ({ children, className, node: _node, ...rest }) => (
                    <tr
                      {...rest}
                      className={cn(
                        className,
                        "m-0 border-t p-0 even:bg-muted",
                      )}
                    >
                      {children}
                    </tr>
                  ),
                  td: ({ children, className, node: _node, ...rest }) => (
                    <td
                      {...rest}
                      className={cn(
                        className,
                        "border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",
                      )}
                    >
                      {children}
                    </td>
                  ),
                  th: ({ children, className, node: _node, ...rest }) => (
                    <th
                      {...rest}
                      className={cn(
                        className,
                        "border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
                      )}
                    >
                      {children}
                    </th>
                  ),
                  a: ({ children, className, node: _node, ...rest }) => (
                    <a
                      {...rest}
                      className={cn(
                        className,
                        "font-medium underline underline-offset-4",
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {updatedComment}
              </Markdown>
            </div>
            <span className="float-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="-my-3">
                    <DotsVerticalIcon className="size-4" />
                    <span className="sr-only">Toggle comment settings</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      form.setValue("comment", updatedComment);
                      setIsEditingComment(true);
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateComment(DEFAULT_MESSAGE)}
                  >
                    Clear
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </span>
        ) : (
          <Form {...form}>
            <form className="space-y-2">
              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        className="dark:bg-black"
                        rows={10}
                        {...field}
                        autoFocus
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <span className="gap-2 flex">
                <Button type="submit" onClick={form.handleSubmit(onSubmit)}>
                  Save
                </Button>
                <Button type="submit" onClick={form.handleSubmit(onCancel)}>
                  Cancel
                </Button>
              </span>
            </form>
          </Form>
        )}
      </span>
    </div>
  );
}
