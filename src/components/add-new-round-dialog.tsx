import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export function AddNewRoundDialog({
  workspaceId,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  children?: React.ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<{
    name: string;
  }>();
  const utils = trpc.useUtils();
  const mutation = trpc.rounds.create.useMutation({
    onMutate: async (variables) => {
      reset();
      setOpen(false);
      await utils.rounds.list.cancel({ workspaceId });
      const previousRounds = utils.rounds.list.getData({ workspaceId });
      utils.rounds.list.setData({ workspaceId }, (old) => [
        ...(old ?? []),
        {
          workspaceId: variables.workspaceId,
          name: variables.name,
          id: "",
          puzzles: [],
          unassignedPuzzles: [],
          metaPuzzles: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      return { previousRounds };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        utils.rounds.list.setData({ workspaceId }, context.previousRounds);
      }
    },
    onSettled: (data, _error, _variables, context) => {
      if (data) {
        utils.rounds.list.setData({ workspaceId }, [
          ...(context?.previousRounds ?? []),
          {
            ...data,
            puzzles: [],
            unassignedPuzzles: [],
            metaPuzzles: [],
          },
        ]);
      }
      utils.rounds.list.invalidate({ workspaceId });
    },
  });
  const onSubmit = handleSubmit((data) =>
    toast.promise(
      mutation.mutateAsync({
        ...data,
        workspaceId,
      }),
      {
        loading: "Adding round...",
        success: "Success! Round added.",
        error: "Oops! Something went wrong.",
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[425px]">
        <form
          onSubmit={(event) => {
            onSubmit();
            event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add new round</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <div className="col-span-3">
                <Input
                  id="name"
                  {...register("name", { required: true })}
                  autoComplete="off"
                />
                {errors.name && errors.name.type === "required" && (
                  <span>This is required</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
