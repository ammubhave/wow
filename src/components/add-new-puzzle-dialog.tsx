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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function AddNewPuzzleDialog({
  workspaceId,
  children,
  open,
  setOpen,
  roundId,
  parentPuzzleId,
}: {
  workspaceId: string;
  children?: React.ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
  roundId: string;
  parentPuzzleId?: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const FormSchema = z.object({
    name: z.string().min(1),
    link: z.string().url().or(z.string().length(0)),
    worksheetType: z.enum(["google_spreadsheet", "google_drawing"]),
  });
  const form = useForm<z.infer<typeof FormSchema>>({
    defaultValues: {
      name: "",
      link: "",
      worksheetType: "google_spreadsheet",
    },
  });
  const utils = trpc.useUtils();
  const mutation = trpc.puzzles.create.useMutation({
    onMutate: async (variables) => {
      form.reset();
      setOpen(false);
      await utils.rounds.list.cancel({ workspaceId });
      const previousRounds = utils.rounds.list.getData({ workspaceId });
      const newPuzzle = {
        id: "",
        name: variables.name,
        answer: null,
        status: null,
        importance: null,
        link: variables.link,
        googleSpreadsheetId: null,
        googleDrawingId: null,
        childPuzzles: [],
        isMetaPuzzle: false,
        comment: "",
        roundId,
        parentPuzzleId: parentPuzzleId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const newRounds = previousRounds?.map((round) =>
        round.id === roundId
          ? {
              ...round,
              puzzles: [...round.puzzles, newPuzzle],
              unassignedPuzzles: [
                ...round.unassignedPuzzles,
                ...(parentPuzzleId === undefined ? [newPuzzle] : []),
              ],
              metaPuzzles: round.metaPuzzles.map((metaPuzzle) =>
                metaPuzzle.id === parentPuzzleId
                  ? {
                      ...metaPuzzle,
                      childPuzzles: [...metaPuzzle.childPuzzles, newPuzzle],
                    }
                  : metaPuzzle,
              ),
            }
          : round,
      );
      utils.rounds.list.setData({ workspaceId }, newRounds);
      return { previousRounds };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        utils.rounds.list.setData({ workspaceId }, context.previousRounds);
      }
    },
    onSettled: (data, _error, _variables, context) => {
      if (data && context?.previousRounds) {
        const newRounds = context.previousRounds?.map((round) =>
          round.id === roundId
            ? {
                ...round,
                puzzles: [...round.puzzles, data],
                unassignedPuzzles: [
                  ...round.unassignedPuzzles,
                  ...(parentPuzzleId === undefined ? [data] : []),
                ],
                metaPuzzles: round.metaPuzzles.map((metaPuzzle) =>
                  metaPuzzle.id === parentPuzzleId
                    ? {
                        ...metaPuzzle,
                        childPuzzles: [...metaPuzzle.childPuzzles, data],
                      }
                    : metaPuzzle,
                ),
              }
            : round,
        );
        utils.rounds.list.setData({ workspaceId }, newRounds);
      }
      utils.rounds.list.invalidate({ workspaceId });
    },
  });
  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast.promise(
      // @ts-expect-error error
      mutation.mutateAsync({
        type: "puzzle",
        ...data,
        roundId: parentPuzzleId ? undefined : roundId,
        parentPuzzleId,
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
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link</FormLabel>
                    <FormControl>
                      <Input type="url" {...field} />
                    </FormControl>
                    <FormDescription>
                      Link to this puzzle on the hunt website.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="worksheetType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Worksheet Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a worksheet type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="google_spreadsheet">
                          Google Spreadsheet
                        </SelectItem>
                        <SelectItem value="google_drawing">
                          Google Drawing
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The kind of puzzle worksheet you want to use.
                    </FormDescription>
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
