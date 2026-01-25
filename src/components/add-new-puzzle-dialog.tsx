import {Link} from "@tanstack/react-router";
import {toast} from "sonner";

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

export function AddNewPuzzleDialog({
  workspaceSlug,
  children,
  open,
  setOpen,
  roundId,
  parentPuzzleId,
}: {
  workspaceSlug: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
  roundId: string;
  parentPuzzleId?: string;
}) {
  const workspace = useWorkspace({workspaceSlug});
  const form = useAppForm({
    defaultValues: {name: "", tags: [] as string[], link: "", worksheetType: "google_spreadsheet"},
    onSubmit: ({value}) =>
      toast.promise(
        workspace.puzzles.create.mutateAsync(
          // @ts-expect-error error
          {
            type: "puzzle",
            ...value,
            roundId: parentPuzzleId! ? undefined : roundId,
            parentPuzzleId,
          },
          {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
          }
        ),
        {
          loading: "Adding puzzle...",
          success: <>Success! Puzzle added.</>,
          error: "Oops! Something went wrong.",
          description: puzzle => (
            <>
              Go to
              <Link
                to="/$workspaceSlug/puzzles/$puzzleId"
                params={{workspaceSlug, puzzleId: puzzle.id}}
                className="ml-1 hover:underline">
                {puzzle.name}
              </Link>
            </>
          ),
        }
      ),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children} />}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add new puzzle</DialogTitle>
        </DialogHeader>
        <form.AppForm>
          <form
            id={form.formId}
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}>
            <div className="grid gap-4 py-4">
              <form.AppField
                name="name"
                children={field => <field.TextField label="Name" autoFocus autoComplete="off" />}
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
                    type="url"
                    autoComplete="off"
                    description="Link to this puzzle on the hunt website."
                  />
                )}
              />
              <form.AppField
                name="worksheetType"
                children={field => {
                  const items = [
                    {value: "google_spreadsheet", label: "Google Spreadsheet"},
                    {value: "google_drawing", label: "Google Drawing"},
                  ];
                  return (
                    <field.SelectField
                      label="Worksheet Type"
                      description="The kind of puzzle worksheet you want to use."
                      items={items}>
                      {items.map(item => (
                        <SelectItem key={item.value} value={item.value!}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </field.SelectField>
                  );
                }}
              />
            </div>
          </form>
          <DialogFooter>
            <form.SubmitButton>Save</form.SubmitButton>
          </DialogFooter>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
