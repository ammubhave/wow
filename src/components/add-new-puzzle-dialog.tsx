import {useMutation} from "@tanstack/react-query";
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
import {useWorkspace} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";

import {useAppForm} from "./form";
import {SelectItem} from "./ui/select";

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
  const workspace = useWorkspace();
  const mutation = useMutation(orpc.puzzles.create.mutationOptions());
  const form = useAppForm({
    defaultValues: {name: "", tags: [] as string[], link: "", worksheetType: "google_spreadsheet"},
    onSubmit: ({value}) =>
      mutation.mutateAsync(
        // @ts-expect-error error
        {
          type: "puzzle",
          ...value,
          roundId: parentPuzzleId! ? undefined : roundId,
          parentPuzzleId,
          workspaceSlug,
        },
        {
          onSuccess: data => {
            form.reset();
            toast.success("Success! Puzzle added.", {
              description: () => (
                <>
                  Go to
                  <Link
                    to="/$workspaceSlug/puzzles/$puzzleId"
                    params={{workspaceSlug, puzzleId: data.id}}
                    className="ml-1 hover:underline">
                    {data.name}
                  </Link>
                </>
              ),
            });
            setOpen(false);
          },
          onError: () => {
            toast.error("Oops! Something went wrong.");
          },
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
                  <field.ComboboxMultipleField label="Tags" items={workspace.tags ?? []} />
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
