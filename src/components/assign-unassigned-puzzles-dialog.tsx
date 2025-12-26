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
  children?: React.ReactElement;
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
      {children && <DialogTrigger render={children} />}
      <DialogContent aria-describedby={undefined} className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Assign unassigned puzzles</DialogTitle>
        </DialogHeader>
        <form.AppForm>
          <form
            id={form.formId}
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}>
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
          </form>
          <DialogFooter>
            <form.SubmitButton>Save</form.SubmitButton>
          </DialogFooter>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
