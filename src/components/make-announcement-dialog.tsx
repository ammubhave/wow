import {useMutation, useQuery} from "@tanstack/react-query";
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
import {SelectItem} from "./ui/select";

export function MakeAccouncementDialog({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const discordTextChannels = useQuery(
    orpc.workspaces.discord.listTextChannels.queryOptions({input: {workspaceId}, enabled: open})
  );
  const mutation = useMutation(orpc.workspaces.announce.mutationOptions());
  const form = useAppForm({
    defaultValues: {message: "", channelId: ""},
    onSubmit: ({value}) =>
      mutation.mutateAsync(
        {
          workspaceId,
          message: value.message,
          channelId: value.channelId.length > 0 ? value.channelId : null,
        },
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
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </field.SelectField>
                    );
                  }}
                />
              )}
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
