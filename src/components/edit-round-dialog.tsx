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
import {FieldGroup} from "./ui/field";
import {useWorkspace} from "./use-workspace";

export function EditRoundDialog({
  workspaceSlug,
  round,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  round: {id: string; name: string};
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const workspace = useWorkspace({workspaceSlug});
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
        <DialogHeader>
          <DialogTitle>Edit round</DialogTitle>
        </DialogHeader>
        <form.AppForm>
          <form
            id={form.formId}
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}>
            <FieldGroup>
              <form.AppField
                name="name"
                validators={{onSubmit: z.string().min(1)}}
                children={field => <field.TextField label="Name" autoFocus autoComplete="off" />}
              />
            </FieldGroup>
          </form>
        </form.AppForm>
        <DialogFooter>
          <form.AppForm>
            <form.SubmitButton>Save</form.SubmitButton>
          </form.AppForm>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
