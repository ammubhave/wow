import {useMutation} from "@tanstack/react-query";
import {useState} from "react";
import {z} from "zod";

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

export function MakeAccouncementDialog({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation(orpc.workspaces.announce.mutationOptions());
  const form = useAppForm({
    defaultValues: {message: ""},
    onSubmit: ({value}) =>
      mutation.mutateAsync(
        {workspaceId, message: value.message},
        {
          onSuccess: () => {
            form.reset();
            setOpen(false);
          },
        }
      ),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make an announcement</DialogTitle>
        </DialogHeader>
        <form.AppForm>
          <form.Form>
            <FieldGroup>
              <form.AppField
                name="message"
                validators={{onSubmit: z.string().min(1)}}
                children={field => (
                  <field.TextareaField label="Message" autoFocus autoComplete="off" />
                )}
              />
            </FieldGroup>
          </form.Form>
        </form.AppForm>
        <DialogFooter>
          <form.AppForm>
            <form.SubmitButton>Submit</form.SubmitButton>
          </form.AppForm>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
