import {Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {useState} from "react";
import {toast} from "sonner";
import {z} from "zod";

import {orpc} from "@/lib/orpc";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

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
      mutation
        .mutateAsync(
          {...value, huntId},
          {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
          }
        )
        .catch(() => {
          toast.error("Oops! Something went wrong.");
        }),
  });

  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen} trigger={children}>
      <Modal.Container>
        <Modal.Dialog aria-describedby={undefined} className="sm:max-w-106.25">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Add new puzzle</Modal.Heading>
          </Modal.Header>
          <form.AppForm>
            <Modal.Body>
              <form
                id={form.formId}
                onSubmit={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  void form.handleSubmit();
                }}>
                <div className="flex w-full flex-col gap-4">
                  <form.AppField
                    name="title"
                    validators={{onSubmit: z.string().min(1)}}
                    children={field => (
                      <field.TextField label="Title" autoFocus autoComplete="off" />
                    )}
                  />
                </div>
              </form>
            </Modal.Body>
            <Modal.Footer>
              <form.SubmitButton>Save</form.SubmitButton>
            </Modal.Footer>
          </form.AppForm>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
