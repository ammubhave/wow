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
import { trpc } from "@/lib/trpc";

import { Checkbox } from "./ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";

export function AddNewMetaPuzzleDialog({
  workspaceId,
  roundId,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  roundId: string;
  children?: React.ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const FormSchema = z.object({
    name: z.string().min(1),
    assignUnassignedPuzzles: z.boolean(),
  });
  const form = useForm<z.infer<typeof FormSchema>>({
    defaultValues: {
      name: "",
      assignUnassignedPuzzles: false,
    },
  });
  const utils = trpc.useUtils();
  const mutation = trpc.puzzles.create.useMutation({
    onMutate: async (variables) => {
      form.reset();
      setOpen(false);
      await utils.rounds.list.cancel({ workspaceId });
      const previousRounds = utils.rounds.list.getData({ workspaceId });
      let newRounds = structuredClone(previousRounds);
      if (newRounds) {
        for (const round of newRounds) {
          if (round.id === roundId) {
            round.metaPuzzles.push({
              roundId,
              id: "",
              metaPuzzleId: null,
              name: variables.name,
              answer: null,
              status: null,
              link: null,
              googleSpreadsheetId: null,
              puzzles: [],
              metaPuzzles: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            break;
          }
        }
        utils.rounds.list.setData({ workspaceId }, newRounds);
      }
      return { previousRounds };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        utils.rounds.list.setData({ workspaceId }, context.previousRounds);
      }
    },
    onSettled: (data, _error, _variables, context) => {
      if (data && context?.previousRounds) {
        const newRounds = structuredClone(context.previousRounds);
        for (const round of newRounds) {
          if (round.id === roundId) {
            round.metaPuzzles.push({
              ...(data as any),
              puzzles: [],
              metaPuzzles: [],
            });
            break;
          }
        }
        utils.rounds.list.setData({ workspaceId }, newRounds);
      }
      utils.rounds.list.invalidate({ workspaceId });
    },
  });
  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast.promise(
      mutation.mutateAsync({
        type: "meta-puzzle",
        ...data,
        roundId,
      }),
      {
        loading: "Adding meta puzzle...",
        success: "Success! Meta puzzle added.",
        error: "Oops! Something went wrong.",
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
              <DialogTitle>Add new meta puzzle</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel className="text-right">Name</FormLabel>
                    <div className="col-span-3">
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-4 items-center gap-4">
                <div />
                <FormField
                  control={form.control}
                  name="assignUnassignedPuzzles"
                  render={({ field }) => (
                    <FormItem className="col-span-3 flex items-center gap-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Assign unassigned puzzles
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
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
