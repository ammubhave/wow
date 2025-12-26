import {toast} from "sonner";
import z from "zod";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {useAppForm} from "./form";
import {useWorkspace} from "./use-workspace";

export function AddNewRoundDialog({
  workspaceId,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const workspace = useWorkspace({workspaceId});
  // const utils = trpc.useUtils();
  // const mutation = trpc.rounds.create.useMutation({
  //   onMutate: async (variables) => {
  //     reset();
  //     setOpen(false);
  //     await utils.rounds.list.cancel({ workspaceId });
  //     const previousRounds = utils.rounds.list.getData({ workspaceId });
  //     utils.rounds.list.setData({ workspaceId }, (old) => [
  //       ...(old ?? []),
  //       {
  //         workspaceId: variables.workspaceId,
  //         name: variables.name,
  //         id: "",
  //         puzzles: [],
  //         unassignedPuzzles: [],
  //         metaPuzzles: [],
  //         createdAt: new Date().toISOString(),
  //         updatedAt: new Date().toISOString(),
  //         status: null,
  //       },
  //     ]);
  //     return { previousRounds };
  //   },
  //   onError: (_error, _variables, context) => {
  //     if (context) {
  //       utils.rounds.list.setData({ workspaceId }, context.previousRounds);
  //     }
  //   },
  //   onSettled: (data, _error, _variables, context) => {
  //     if (data) {
  //       utils.rounds.list.setData({ workspaceId }, [
  //         ...(context?.previousRounds ?? []),
  //         {
  //           ...data,
  //           puzzles: [],
  //           unassignedPuzzles: [],
  //           metaPuzzles: [],
  //         },
  //       ]);
  //     }
  //     utils.rounds.list.invalidate({ workspaceId });
  //   },
  // });
  const form = useAppForm({
    defaultValues: {name: ""},
    onSubmit: ({value}) =>
      toast.promise(
        workspace.rounds.create.mutateAsync(
          {...value, workspaceId},
          {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
          }
        ),
        {
          loading: "Adding round...",
          success: "Success! Round added.",
          error: "Oops! Something went wrong.",
        }
      ),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children} />}
      <DialogContent aria-describedby={undefined} className="sm:max-w-106.25">
        <form.AppForm>
          <form
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}>
            <DialogHeader>
              <DialogTitle>Add new round</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <form.AppField
                name="name"
                validators={{onSubmit: z.string().min(1)}}
                children={field => <field.TextField label="Name" autoFocus autoComplete="off" />}
              />
            </div>
            <DialogFooter>
              <form.SubmitButton>Save</form.SubmitButton>
            </DialogFooter>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
