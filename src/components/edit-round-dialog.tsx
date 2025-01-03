import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRoundsUpdateMutation } from "@/lib/useRoundsUpdateMutation";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";

export function EditRoundDialog({
  workspaceId,
  round,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  round: {
    id: string;
    name: string;
  };
  children?: React.ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const formSchema = z.object({
    name: z.string().min(1),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      name: round.name,
    },
  });
  const mutation = useRoundsUpdateMutation(
    {
      workspaceId,
    },
    {
      onMutate: () => {
        setOpen(false);
      },
      onSettled: () => {
        form.reset();
      },
    },
  );

  function onSubmit(data: z.infer<typeof formSchema>) {
    toast.promise(
      mutation.mutateAsync({
        id: round.id,
        ...data,
      }),
      {
        loading: "Updating round...",
        success: "Success! Round updated.",
        error: "Oops! Something went wrong.",
        description: data.name,
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit round</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
