import { zodResolver } from "@hookform/resolvers/zod";
import { DotsVerticalIcon } from "@radix-ui/react-icons";
import { useState } from "react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export function CommentBox({comment, commentId}: {
    comment: string;
    commentId: { workspaceId: string } | { metaPuzzleId: string } | { puzzleId: string };
  }) {
    const [isEditingComment, setIsEditingComment] = useState(false);
  
    const mutation = trpc.comments.create.useMutation();
    const updateComment = (text: string) => {
      if (text == comment) {
        return;
      }
      toast.promise(
        mutation.mutateAsync({
          text: text,
          ...commentId,
        }),
        {
          loading: "Saving comment...",
          success: "Comment updated!",
          error: "Oops! Something went wrong.",
        });
    }
    
    const formSchema = z.object({
      comment: z.string(),
      button: z.string(),
    });
    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        comment: comment,
        button: "",
      },
    });
    const onSubmit = (data: z.infer<typeof formSchema>) => {
      // TODO implement this to change the comment.
      // TODO also implement canceling changes to comments.
      console.log(JSON.stringify(data));
      updateComment(data.comment);
    }
  
    return (
      <div className="justify-between flex-wrap">
        <span>
          {!isEditingComment ? (
            <span>
                {comment || "No comment set."}
                <span className="float-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="-my-3">
                            <DotsVerticalIcon className="size-4" />
                            <span className="sr-only">Toggle comment settings</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setIsEditingComment(true)}>
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateComment("")}>
                            Clear
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </span>
            </span>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
                <FormField 
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      {comment}
                      <FormControl>
                        <Input className="dark:bg-black" {...field}/>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <span className="gap-2 flex">
                  <Button type="submit" value="save">Save</Button>
                  <Button type="submit" value="cancel">Cancel</Button>
                </span>
              </form>
            </Form>
          )}
        </span>
      </div>
    );
  }
  