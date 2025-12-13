import {toast} from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {useAppForm} from "./form";
import {SelectItem} from "./ui/select";
import {useWorkspace} from "./use-workspace";

export function AssignUnassignedPuzzlesDialog({
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
  const workspace = useWorkspace({workspaceId});
  const form = useAppForm({
    defaultValues: {parentPuzzleId: ""},
    onSubmit: ({value}) =>
      toast.promise(
        workspace.rounds.assignUnassignedPuzzles.mutateAsync(
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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent aria-describedby={undefined} className="sm:max-w-106.25">
        <form.AppForm>
          <form
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}>
            <DialogHeader>
              <DialogTitle>Assign unassigned puzzles</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <form.AppField
                name="parentPuzzleId"
                children={field => (
                  <field.SelectField label="Feeds Into">
                    {workspace.get.data?.rounds
                      .filter(round => round.id === roundId)
                      .flatMap(round => round.metaPuzzles)
                      .map(metaPuzzle => (
                        <SelectItem key={metaPuzzle.id} value={metaPuzzle.id}>
                          {metaPuzzle.name}
                        </SelectItem>
                      ))}
                  </field.SelectField>
                )}
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
