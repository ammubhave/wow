import {ListBox, Modal} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {useState} from "react";
import {toast} from "sonner";
import {z} from "zod";

import {orpc} from "@/lib/orpc";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

export function MakeAccouncementDialog({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const discordTextChannels = useQuery(
    orpc.workspaces.discord.listTextChannels.queryOptions({input: {workspaceSlug}, enabled: open})
  );
  const mutation = useMutation(orpc.workspaces.announce.mutationOptions());
  const form = useAppForm({
    defaultValues: {message: "", channelId: ""},
    onSubmit: ({value}) =>
      mutation
        .mutateAsync(
          {
            workspaceSlug,
            message: value.message,
            channelId: value.channelId.length > 0 ? value.channelId : null,
          },
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
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Make an announcement</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form.AppForm>
              <form.Form>
                <div className="flex w-full flex-col gap-4">
                  <form.AppField
                    name="message"
                    validators={{onSubmit: z.string().min(1)}}
                    children={field => (
                      <field.TextareaField label="Message" autoFocus autoComplete="off" />
                    )}
                  />
                  {discordTextChannels.data && (
                    <form.AppField
                      name="channelId"
                      children={field => {
                        const items = [
                          {value: "", label: "None"},
                          ...discordTextChannels.data!.map(c => ({
                            value: c.id,
                            label: `#${c.name ?? c.id}`,
                          })),
                        ];
                        return (
                          <field.SelectField label="Discord Channel" items={items}>
                            {items.map(item => (
                              <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                                {item.label}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </field.SelectField>
                        );
                      }}
                    />
                  )}
                </div>
              </form.Form>
            </form.AppForm>
          </Modal.Body>
          <Modal.Footer>
            <form.AppForm>
              <form.SubmitButton>Submit</form.SubmitButton>
            </form.AppForm>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
