import {useMutation} from "@tanstack/react-query";
import {useState} from "react";
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

export function AddNewExchangePuzzleDialog({
  huntId,
  children,
}: {
  huntId: string;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation(orpc.exchange.puzzles.create.mutationOptions());
  const form = useAppForm({
    defaultValues: {title: ""},
    onSubmit: ({value}) =>
      mutation.mutateAsync(
        {...value, huntId},
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
      <DialogContent aria-describedby={undefined} className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Add new puzzle</DialogTitle>
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
                name="title"
                validators={{onSubmit: z.string().min(1)}}
                children={field => <field.TextField label="Title" autoFocus autoComplete="off" />}
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
