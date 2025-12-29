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

import {useAppForm} from "./form";
import {PuzzleStatusOptions} from "./puzzle-status-options";
import {FieldGroup} from "./ui/field";
import {SelectItem} from "./ui/select";
import {useWorkspace} from "./use-workspace";

export function EditPuzzleDialog({
  workspaceId,
  puzzle,
  children,
  open,
  setOpen,
}: {
  workspaceId: string;
  puzzle: {
    id: string;
    parentPuzzleId: string | null;
    name: string;
    answer: string | null;
    status: string | null;
    link: string | null;
    googleSpreadsheetId: string | null;
    googleDrawingId: string | null;
    isMetaPuzzle: boolean;
    tags: string[];
  };
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const workspace = useWorkspace({workspaceId});
  const form = useAppForm({
    defaultValues: {
      parentPuzzleId: puzzle.parentPuzzleId,
      name: puzzle.name,
      answer: puzzle.answer ?? "",
      link: puzzle.link ?? "",
      status: puzzle.status,
      isMetaPuzzle: puzzle.isMetaPuzzle,
      tags: puzzle.tags,
    },
    onSubmit: ({value}) =>
      toast.promise(
        workspace.puzzles.update.mutateAsync(
          {
            id: puzzle.id,
            ...value,
            parentPuzzleId: value.parentPuzzleId,
            answer: value.answer === "" ? null : value.answer.toUpperCase(),
            status: value.status,
            link: value.link === "" ? null : value.link,
            tags: value.tags,
          },
          {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
          }
        ),
        {
          loading: "Updating puzzle...",
          success: "Success! Puzzle updated.",
          error: "Oops! Something went wrong.",
          description: value.name,
        }
      ),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children} />}
      <DialogContent aria-describedby={undefined} className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Edit puzzle</DialogTitle>
        </DialogHeader>
        <form.AppForm>
          <form
            id={form.formId}
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}>
            <FieldGroup>
              <form.AppField
                name="name"
                validators={{onSubmit: z.string().min(1)}}
                children={field => <field.TextField label="Name" autoComplete="off" />}
              />
              <form.AppField
                name="parentPuzzleId"
                children={field => {
                  const items = [
                    {value: null, label: "None"},
                    ...(workspace.get.data?.rounds
                      .flatMap(r => r.metaPuzzles)
                      .map(p => ({value: p.id, label: p.name})) ?? []),
                  ];
                  return (
                    <field.SelectField label="Feeds Into" items={items}>
                      {items.map(item => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </field.SelectField>
                  );
                }}
              />
              <form.AppField
                name="answer"
                children={field => (
                  <field.TextField label="Answer" className="font-mono" autoComplete="off" />
                )}
              />
              <form.AppField
                name="status"
                children={field => {
                  return (
                    <field.SelectField label="Status" items={PuzzleStatusOptions()}>
                      {PuzzleStatusOptions().map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </field.SelectField>
                  );
                }}
              />
              <form.AppField
                name="tags"
                children={field => (
                  <field.ComboboxMultipleField
                    label="Tags"
                    items={(workspace.get.data.tags as string[] | null) ?? []}
                  />
                )}
              />
              <form.AppField
                name="link"
                children={field => (
                  <field.TextField
                    label="Link"
                    description="Link to this puzzle on the hunt website."
                    type="url"
                    autoComplete="off"
                  />
                )}
              />
              <form.AppField
                name="isMetaPuzzle"
                children={field => <field.CheckboxField label="Is this a meta puzzle?" />}
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
