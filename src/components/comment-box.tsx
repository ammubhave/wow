import { zodResolver } from "@hookform/resolvers/zod";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
            {updatedComment}
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
