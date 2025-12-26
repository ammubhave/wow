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
      parentPuzzleId: puzzle.parentPuzzleId ?? "",
      name: puzzle.name,
      answer: puzzle.answer ?? "",
      link: puzzle.link ?? "",
      status: puzzle.status ?? "none",
      isMetaPuzzle: puzzle.isMetaPuzzle,
      tags: puzzle.tags,
    },
    onSubmit: ({value}) =>
      toast.promise(
        workspace.puzzles.update.mutateAsync(
          {
            id: puzzle.id,
            ...value,
            parentPuzzleId:
              value.parentPuzzleId === "none" || value.parentPuzzleId === ""
                ? null
                : value.parentPuzzleId,
            answer: value.answer === "" ? null : value.answer.toUpperCase(),
            status: value.status === "none" ? null : value.status,
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
        <form.AppForm>
          <form
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}>
            <DialogHeader>
              <DialogTitle>Edit puzzle</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <form.AppField
                name="name"
                validators={{onSubmit: z.string().min(1)}}
                children={field => <field.TextField label="Name" autoComplete="off" />}
              />
              <form.AppField
                name="parentPuzzleId"
                children={field => (
                  <field.SelectField label="Feeds Into">
                    <SelectItem value="none">None</SelectItem>
                    {workspace.get.data?.rounds
                      .flatMap(round => round.metaPuzzles)
                      .map(metaPuzzle => (
                        <SelectItem key={metaPuzzle.id} value={metaPuzzle.id}>
                          {metaPuzzle.name}
                        </SelectItem>
                      ))}
                  </field.SelectField>
                )}
              />
              <form.AppField
                name="answer"
                children={field => (
                  <field.TextField label="Answer" className="font-mono" autoComplete="off" />
                )}
              />
              <form.AppField
                name="status"
                children={field => (
                  <field.SelectField label="Status">
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="solved">Solved</SelectItem>
                    <SelectItem value="backsolved">Backsolved</SelectItem>
                    <SelectItem value="obsolete">Obsolete</SelectItem>
                    <SelectItem value="needs_eyes">Needs Eyes</SelectItem>
                    <SelectItem value="extraction">Extraction</SelectItem>
                    <SelectItem value="stuck">Stuck</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="very_stuck">Very Stuck</SelectItem>
                  </field.SelectField>
                )}
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
            </div>
            <DialogFooter>
              <form.SubmitButton>Save</form.SubmitButton>
            </DialogFooter>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
