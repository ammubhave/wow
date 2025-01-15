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
import { trpc } from "@/lib/trpc";
import { usePuzzlesUpdateMutation } from "@/lib/usePuzzlesUpdateMutation";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function EditPuzzleDialog({
  workspaceId,
  puzzle,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  puzzle: {
    id: string;
    parentPuzzleId: string | null;
    name: string;
    answer: string | null;
    status: string | null;
    link: string | null;
    googleSpreadsheetId: string | null;
    googleDrawingId: string | null;
  };
  children?: React.ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const metaPuzzles = trpc.rounds.list
    .useQuery({ workspaceId })
    .data?.flatMap((round) => round.metaPuzzles);

  const formSchema = z.object({
    name: z.string().min(1),
    answer: z.string(),
    link: z.string().url().or(z.string().length(0)),
    googleSpreadsheetId: z.string(),
    googleDrawingId: z.string(),
    status: z.string(),
    parentPuzzleId: z.string(),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      parentPuzzleId: puzzle.parentPuzzleId ?? "",
      name: puzzle.name,
      answer: puzzle.answer ?? "",
      link: puzzle.link ?? "",
      googleSpreadsheetId: puzzle.googleSpreadsheetId ?? "",
      googleDrawingId: puzzle.googleDrawingId ?? "",
      status: puzzle.status ?? "none",
    },
  });
  const mutation = usePuzzlesUpdateMutation(
    { workspaceId },
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
        id: puzzle.id,
        ...data,
        parentPuzzleId:
          data.parentPuzzleId === "none" || data.parentPuzzleId === ""
            ? null
            : data.parentPuzzleId,
        answer: data.answer === "" ? null : data.answer.toUpperCase(),
        status: data.status === "none" ? null : data.status,
        link: data.link === "" ? null : data.link,
        googleSpreadsheetId:
          data.googleSpreadsheetId === "" ? null : data.googleSpreadsheetId,
        googleDrawingId:
          data.googleDrawingId === "" ? null : data.googleDrawingId,
      }),
      {
        loading: "Updating puzzle...",
        success: "Success! Puzzle updated.",
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
              <DialogTitle>Edit puzzle</DialogTitle>
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
              <FormField
                control={form.control}
                name="parentPuzzleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feeds Into</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {metaPuzzles?.map((metaPuzzle) => (
                            <SelectItem
                              key={metaPuzzle.id}
                              value={metaPuzzle.id}
                            >
                              {metaPuzzle.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="answer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Answer</FormLabel>
                    <FormControl>
                      <Input className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="solved">Solved</SelectItem>
                          <SelectItem value="backsolved">Backsolved</SelectItem>
                          <SelectItem value="obsolete">Obsolete</SelectItem>
                          <SelectItem value="needs_eyes">Needs Eyes</SelectItem>
                          <SelectItem value="extraction">Extraction</SelectItem>
                          <SelectItem value="stuck">Stuck</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="very_stuck">Very Stuck</SelectItem>
                        </SelectContent>
                      </Select>
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
                name="googleSpreadsheetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google Spreadsheet ID</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Google Spreadsheet ID of the spreadsheet containing the
                      puzzle. You can also use the URL of the spreadsheet.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="googleDrawingId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google Drawing ID</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Google Drawing ID of the drawing containing the puzzle.
                      You can also use the URL of the drawing.
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
