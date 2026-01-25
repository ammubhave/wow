import {useMutation} from "@tanstack/react-query";
import {toast} from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {useWorkspace} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";

import {useAppForm} from "./form";
import {SelectItem} from "./ui/select";

export function AssignUnassignedPuzzlesDialog({
  workspaceSlug,
  roundId,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  roundId: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const workspace = useWorkspace();
  const mutation = useMutation(orpc.rounds.assignUnassignedPuzzles.mutationOptions());
  const form = useAppForm({
    defaultValues: {parentPuzzleId: ""},
    onSubmit: ({value}) => {
      if (value.parentPuzzleId === "") {
        toast.info("No action taken -- please select a meta puzzle.");
        return;
      }
      toast.promise(
        mutation.mutateAsync(
          {...value, workspaceSlug},
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
      );
    },
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
                children={field => {
                  const items = [
                    {value: "", label: "None"},
                    ...(workspace.rounds
                      .filter(round => round.id === roundId)
                      .flatMap(round => round.metaPuzzles)
                      .map(metaPuzzle => ({value: metaPuzzle.id, label: metaPuzzle.name})) ?? []),
                  ];
                  return (
                    <field.SelectField label="Feeds Into" items={items}>
                      {items.map(item => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </field.SelectField>
                  );
                }}
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
