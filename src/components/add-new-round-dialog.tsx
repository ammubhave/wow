import {useMutation} from "@tanstack/react-query";
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
import {orpc} from "@/lib/orpc";

import {useAppForm} from "./form";
import {FieldGroup} from "./ui/field";

export function AddNewRoundDialog({
  workspaceSlug,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const mutation = useMutation(orpc.rounds.create.mutationOptions());
  const form = useAppForm({
    defaultValues: {name: ""},
    onSubmit: ({value}) =>
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
      ),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children} />}
      <DialogContent aria-describedby={undefined} className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Add new round</DialogTitle>
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
          <DialogFooter>
            <form.SubmitButton>Save</form.SubmitButton>
          </DialogFooter>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
