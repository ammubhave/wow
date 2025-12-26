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

export function EditRoundDialog({
  workspaceId,
  round,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  round: {id: string; name: string};
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const workspace = useWorkspace({workspaceId});
  const form = useAppForm({
    defaultValues: {name: round.name},
    onSubmit: ({value}) =>
      toast.promise(
        workspace.rounds.update.mutateAsync(
          {id: round.id, ...value},
          {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
          }
        ),
        {
          loading: "Updating round...",
          success: "Success! Round updated.",
          error: "Oops! Something went wrong.",
          description: value.name,
        }
      ),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children} />}
      <DialogContent aria-describedby={undefined} className="sm:max-w-[425px]">
        <form.AppForm>
          <form
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}>
            <DialogHeader>
              <DialogTitle>Edit round</DialogTitle>
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
