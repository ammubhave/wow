import {toast} from "sonner";
import {z} from "zod";

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

export function AddNewMetaPuzzleDialog({
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
    defaultValues: {name: "", assignUnassignedPuzzles: false, link: ""},
    onSubmit: ({value}) =>
      toast.promise(
        workspace.puzzles.create.mutateAsync(
          {type: "meta-puzzle", ...value, roundId, worksheetType: "google_spreadsheet"},
          {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
          }
        ),
        {
          loading: "Adding meta puzzle...",
          success: "Success! Meta puzzle added.",
          error: "Oops! Something went wrong.",
        }
      ),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children} />}
      <DialogContent aria-describedby={undefined} className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add new meta puzzle</DialogTitle>
        </DialogHeader>
        <form.AppForm>
          <form.Form>
            <div className="grid gap-4 py-4">
              <form.AppField
                name="name"
                validators={{onSubmit: z.string().min(1)}}
                children={field => <field.TextField label="Name" autoFocus autoComplete="off" />}
              />
              <form.AppField
                name="link"
                validators={{onSubmit: z.url().or(z.string().length(0))}}
                children={field => (
                  <field.TextField
                    label="Link"
                    type="url"
                    description="Link to this puzzle on the hunt website."
                  />
                )}
              />
              <form.AppField
                name="assignUnassignedPuzzles"
                validators={{onSubmit: z.boolean()}}
                children={field => <field.CheckboxField label="Assign unassigned puzzles" />}
              />
            </div>
          </form.Form>
          <DialogFooter>
            <form.SubmitButton>Save</form.SubmitButton>
          </DialogFooter>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
