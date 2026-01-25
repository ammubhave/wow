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
import {useWorkspace} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";
import {getPuzzleStatusGroups, getPuzzleStatusOptions} from "@/lib/puzzleStatuses";

import {useAppForm} from "./form";
import {FieldGroup} from "./ui/field";
import {SelectGroup, SelectItem} from "./ui/select";

export function EditPuzzleDialog({
  workspaceSlug,
  puzzle,
  children,
  open,
  setOpen,
}: {
  workspaceSlug: string;
  puzzle: {
    id: string;
    roundId: string;
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
  const workspace = useWorkspace();
  const mutation = useMutation(orpc.puzzles.update.mutationOptions());
  const form = useAppForm({
    defaultValues: {
      parentPuzzleId: puzzle.parentPuzzleId ?? puzzle.roundId,
      name: puzzle.name,
      answer: puzzle.answer ?? "",
      link: puzzle.link ?? "",
      status: puzzle.status,
      isMetaPuzzle: puzzle.isMetaPuzzle,
      tags: puzzle.tags,
    },
    onSubmit: ({value}) =>
      toast.promise(
        mutation.mutateAsync(
          {
            workspaceSlug,
            id: puzzle.id,
            ...value,
            answer: value.answer === "" ? null : value.answer.toUpperCase(),
            link: value.link === "" ? null : value.link,
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
                    ...(workspace.rounds
                      .flatMap(r => [
                        {
                          id: r.id,
                          name:
                            r.metaPuzzles.length > 0 ? r.name : `${r.name} (Unassigned Puzzles)`,
                          disabled: r.metaPuzzles.length > 0,
                        },
                        ...r.metaPuzzles,
                      ])
                      .map(p => ({
                        value: p.id,
                        label: p.name,
                        disabled: "disabled" in p ? p.disabled : false,
                      })) ?? []),
                  ];
                  return (
                    <field.SelectField label="Feeds Into" items={items}>
                      {items.map(item => (
                        <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
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
                    <field.SelectField label="Status" items={getPuzzleStatusOptions()}>
                      {getPuzzleStatusGroups().map(group => (
                        <SelectGroup key={group.groupLabel} className={group.bgColorNoHover}>
                          {group.values.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </field.SelectField>
                  );
                }}
              />
              <form.AppField
                name="tags"
                children={field => (
                  <field.ComboboxMultipleField label="Tags" items={workspace.tags} />
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
