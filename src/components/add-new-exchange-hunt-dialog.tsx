import {Modal} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {useState} from "react";
import {toast} from "sonner";
import {z} from "zod";

import {orpc} from "@/lib/orpc";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

export function AddNewExchangeHuntDialog({children}: {children: React.ReactElement}) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation(orpc.exchange.hunts.create.mutationOptions());
  const form = useAppForm({
    defaultValues: {name: ""},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync(
          {...value},
          {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
          }
        )
        .catch(() => {
          toast.error("Couldn't add the hunt. Please try again.");
        }),
  });

  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen} trigger={children}>
      <Modal.Container>
        <Modal.Dialog aria-describedby={undefined}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Add new hunt</Modal.Heading>
          </Modal.Header>
          <form.AppForm>
            <Modal.Body>
              <form.Form>
                <form.AppField
                  name="name"
                  validators={{onSubmit: z.string().trim().min(1, "Give the hunt a name.")}}
                  children={field => (
                    <field.TextField
                      variant="secondary"
                      label="Name"
                      autoFocus
                      autoComplete="off"
                    />
                  )}
                />
              </form.Form>
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
