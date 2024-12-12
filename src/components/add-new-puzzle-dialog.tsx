import { useForm } from "react-hook-form";
import { Link } from "react-router";
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

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";

export function AddNewPuzzleDialog({
  workspaceId,
  children,
  open,
  setOpen,
  ...ids
}: {
  workspaceId: string;
  children?: React.ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
} & (
  | {
      roundId: string;
    }
  | {
      metaPuzzleId: string;
    }
)) {
  const FormSchema = z.object({
    name: z.string().min(1),
  });
  const form = useForm<z.infer<typeof FormSchema>>({
    defaultValues: {
      name: "",
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
        (() => {
          const newPuzzle = {
            id: "",
            name: variables.name,
            answer: null,
            status: null,
            link: null,
            googleSpreadsheetId: null,
            puzzles: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          for (const round of newRounds) {
            if ("roundId" in ids) {
              if (round.id === ids.roundId) {
                round.unassignedPuzzles.push({
                  ...newPuzzle,
                  roundId: ids.roundId,
                  metaPuzzleId: null,
                });
                return;
              }
            } else {
              for (const metaPuzzle of round.metaPuzzles) {
                if (metaPuzzle.id === ids.metaPuzzleId) {
                  metaPuzzle.puzzles.push({
                    ...newPuzzle,
                    metaPuzzleId: ids.metaPuzzleId,
                    roundId: null,
                  });
                  return;
                }
              }
            }
          }
        })();
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
        (() => {
          for (const round of newRounds) {
            if ("roundId" in ids) {
              if (round.id === ids.roundId) {
                round.unassignedPuzzles.push({
                  ...(data as any),
                });
                return;
              }
            } else {
              for (const metaPuzzle of round.metaPuzzles) {
                if (metaPuzzle.id === ids.metaPuzzleId) {
                  metaPuzzle.puzzles.push({
                    ...(data as any),
                  });
                  return;
                }
              }
            }
          }
        })();
        utils.rounds.list.setData({ workspaceId }, newRounds);
      }
      utils.rounds.list.invalidate({ workspaceId });
    },
  });
  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast.promise(
      mutation.mutateAsync({
        type: "puzzle",
        ...data,
        ...ids,
      }),
      {
        loading: "Adding puzzle...",
        success: (puzzle) => (
              <>
              Success! Puzzle added. Go to
              <Link
                to={`/wow/${workspaceId}/puzzles/${puzzle.id}`}
                className="-m-2 block p-2 hover:underline"
              >
                {puzzle.name}
              </Link>
              </>
        ),
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
              <DialogTitle>Add new puzzle</DialogTitle>
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
