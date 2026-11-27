import {ListBox, Modal} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {useState} from "react";
import {toast} from "sonner";
import {z} from "zod";

import {IconTooltip} from "@/components/icon-button";
import {useWorkspace} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";

export function MakeAccouncementDialog({
  workspaceSlug,
  children,
  open: openProp,
  onOpenChange,
}: {
  workspaceSlug: string;
  /** Its trigger button; leave out to open it from elsewhere with `open`. */
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  // Discord is offered only when the team chose it (Settings > Administration > Voice calls).
  const usesDiscord = useWorkspace().voiceTool === "discord";
  const discordTextChannels = useQuery(
    orpc.workspaces.discord.listTextChannels.queryOptions({
      input: {workspaceSlug},
      enabled: open && usesDiscord,
    })
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
              toast.success("Announcement sent");
            },
          }
        )
        .catch(() => {
          toast.error("Couldn't send the announcement. Please try again.");
        }),
  });

  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen} trigger={children}>
      <Modal.Container>
        <Modal.Dialog>
          <IconTooltip label="Close">
            <Modal.CloseTrigger />
          </IconTooltip>
          <Modal.Header>
            <Modal.Heading>Make an announcement</Modal.Heading>
            <p className="text-muted text-sm">
              Everyone in the workspace gets it as a pop-up and in their notifications.
            </p>
          </Modal.Header>
          <Modal.Body>
            <form.AppForm>
              <form.Form>
                <form.AppField
                  name="message"
                  validators={{onSubmit: z.string().trim().min(1, "Write the announcement.")}}
                  children={field => (
                    <field.TextareaField
                      variant="secondary"
                      label="Message"
                      autoFocus
                      autoComplete="off"
                    />
                  )}
                />
                {usesDiscord && discordTextChannels.data && (
                  <form.AppField
                    name="channelId"
                    children={field => {
                      const items = [
                        {value: "", label: "Don't post it to Discord"},
                        ...discordTextChannels.data!.map(c => ({
                          value: c.id,
                          label: `#${c.name ?? c.id}`,
                        })),
                      ];
                      return (
                        <field.SelectField
                          variant="secondary"
                          label="Also post it to Discord"
                          items={items}>
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
              </form.Form>
            </form.AppForm>
          </Modal.Body>
          <Modal.Footer>
            <form.AppForm>
              <form.SubmitButton>Send announcement</form.SubmitButton>
            </form.AppForm>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
