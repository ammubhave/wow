import {Link} from "@tanstack/react-router";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
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
  workspaceId,
  children,
  open,
  setOpen,
  roundId,
  parentPuzzleId,
}: {
  workspaceId: string;
  children?: React.ReactElement;
  open: boolean;
  setOpen: (open: boolean) => void;
  roundId: string;
  parentPuzzleId?: string;
}) {
  const workspace = useWorkspace({workspaceId});
  const form = useAppForm({
    defaultValues: {name: "", link: "", worksheetType: "google_spreadsheet"},
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
          success: puzzle => (
            <>
              Success! Puzzle added. Go to
              <Link
                to="/$workspaceId/puzzles/$puzzleId"
                params={{workspaceId, puzzleId: puzzle.id}}
                className="-m-2 block p-2 hover:underline">
                {puzzle.name}
              </Link>
            </>
          ),
          error: "Oops! Something went wrong.",
          description: value.name,
        }
      ),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger render={children} />}
      <DialogContent aria-describedby={undefined} className="sm:max-w-[425px]">
        <form.AppForm>
          <form
            onSubmit={e => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}>
            <DialogHeader>
              <DialogTitle>Add new puzzle</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <form.AppField
                name="name"
                children={field => <field.TextField label="Name" autoFocus autoComplete="off" />}
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
                children={field => (
                  <field.SelectField
                    label="Worksheet Type"
                    description="The kind of puzzle worksheet you want to use."
                    placeholder="Select a worksheet type">
                    <SelectItem value="google_spreadsheet">Google Spreadsheet</SelectItem>
                    <SelectItem value="google_drawing">Google Drawing</SelectItem>
                  </field.SelectField>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
