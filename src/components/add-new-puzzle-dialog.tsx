import {ListBox, Modal} from "@heroui/react";
import {ORPCError} from "@orpc/client";
import {useMutation} from "@tanstack/react-query";
import {Link} from "@tanstack/react-router";
import {toast} from "sonner";
import {z} from "zod";

import {useWorkspace} from "@/hooks/use-workspace";
import {newest} from "@/lib/board-order";
import {errorMessage} from "@/lib/errors";
import {newId, workspaceMutations} from "@/lib/workspace-mutations";

import {ControlledModal} from "./controlled-dialog";
import {useAppForm} from "./form";
import {isRoundPlacement, PlacementOptions} from "./placement-options";

function PuzzleAddedDescription({
  workspaceSlug,
  puzzleId,
  puzzleName,
}: {
  workspaceSlug: string;
  puzzleId: string;
  puzzleName: string;
}) {
  return (
    <>
      Go to
      <Link
        to="/$workspaceSlug/puzzles/$puzzleId"
        params={{workspaceSlug, puzzleId}}
        className="ml-1 hover:underline">
        {puzzleName}
      </Link>
    </>
  );
}

function showPuzzleAddedToast(workspaceSlug: string, puzzle: {id: string; name: string}) {
  toast.success("Puzzle added", {
    description: (
      <PuzzleAddedDescription
        workspaceSlug={workspaceSlug}
        puzzleId={puzzle.id}
        puzzleName={puzzle.name}
      />
    ),
  });
}

function showAlreadyAddedToast(workspaceSlug: string, puzzle: {id: string; name: string | null}) {
  toast.info("Already on the board", {
    description: (
      <PuzzleAddedDescription
        workspaceSlug={workspaceSlug}
        puzzleId={puzzle.id}
        puzzleName={puzzle.name ?? "the puzzle"}
      />
    ),
  });
}

const duplicateSchema = z.object({puzzleId: z.string().nullable(), name: z.string().nullable()});

/**
 * Says, as you type, when the puzzle seems to be on the board already: one with the same link
 * (the server won't add a second), or with the same name (which can be fine: some hunts reuse
 * names, so it's only a heads-up).
 */
function AlreadyOnBoard({
  workspaceSlug,
  name,
  link,
  onOpen,
}: {
  workspaceSlug: string;
  name: string;
  link: string;
  onOpen: () => void;
}) {
  const {rounds} = useWorkspace();
  const wantedLink = link.trim();
  const wantedName = name.trim().toLowerCase();
  const all = rounds.flatMap(round => round.puzzles.map(puzzle => ({puzzle, round})));
  const byLink = wantedLink
    ? all.find(({puzzle}) => puzzle.link?.trim() === wantedLink)
    : undefined;
  const byName =
    !byLink && wantedName
      ? all.find(({puzzle}) => puzzle.name.trim().toLowerCase() === wantedName)
      : undefined;
  const match = byLink ?? byName;
  if (!match) return null;
  return (
    <output className="bg-warning-soft text-warning-soft-foreground block px-3 py-2 text-sm">
      {byLink ? "This puzzle is already on the board: " : "There's already a puzzle called "}
      <Link
        to="/$workspaceSlug/puzzles/$puzzleId"
        params={{workspaceSlug, puzzleId: match.puzzle.id}}
        onClick={onOpen}
        className="font-medium underline">
        {match.puzzle.name}
      </Link>{" "}
      in {match.round.name}.{byLink ? "" : " Check it isn't the same one."}
    </output>
  );
}

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
  /** Where it goes to start with: a round (unassigned) or a meta; the dialog can change it. */
  roundId?: string;
  parentPuzzleId?: string;
}) {
  const workspace = useWorkspace();
  const mutation = useMutation({
    ...workspaceMutations.puzzles.create(),
    // On the mutation (not the `mutate` call) so it fires for every puzzle added, even if the
    // dialog was used again before the server answered.
    onSuccess: puzzle => showPuzzleAddedToast(workspaceSlug, puzzle),
    onError: error => {
      // A teammate added it first (the server keeps one puzzle per link): point to theirs.
      const duplicate =
        error instanceof ORPCError && error.code === "CONFLICT"
          ? duplicateSchema.safeParse(error.data).data
          : undefined;
      if (duplicate?.puzzleId) {
        showAlreadyAddedToast(workspaceSlug, {id: duplicate.puzzleId, name: duplicate.name});
        return;
      }
      toast.error("Couldn't add the puzzle", {
        description: errorMessage(error, "Please try again."),
      });
    },
  });
  const form = useAppForm({
    defaultValues: {
      // From the toolbar (no round given): the newest round, where new puzzles usually go, even if
      // the team has moved it up the board.
      placement: parentPuzzleId ?? roundId ?? newest(workspace.rounds)?.id ?? "",
      name: "",
      tags: [] as string[],
      link: "",
      worksheetType: "google_spreadsheet" as "google_spreadsheet" | "google_drawing",
    },
    onSubmit: ({value: {placement, ...value}}) => {
      mutation.mutate({
        type: "puzzle",
        ...value,
        // A puzzle goes either under a meta puzzle or straight into a round.
        ...(isRoundPlacement(workspace.rounds, placement)
          ? {roundId: placement}
          : {parentPuzzleId: placement}),
        id: newId(),
        workspaceSlug,
      });
      form.reset();
      setOpen(false);
    },
  });
  return (
    <ControlledModal isOpen={open} onOpenChange={setOpen} trigger={children}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Add a puzzle</Modal.Heading>
          </Modal.Header>
          <form.AppForm>
            <Modal.Body>
              <form.Form>
                <form.AppField
                  name="name"
                  validators={{onSubmit: z.string().trim().min(1, "Give the puzzle a name.")}}
                  children={field => (
                    <field.TextField
                      variant="secondary"
                      label="Name"
                      autoFocus
                      autoComplete="off"
                    />
                  )}
                />
                <form.AppField
                  name="placement"
                  children={field => (
                    <field.SelectField variant="secondary" label="Goes in">
                      <PlacementOptions rounds={workspace.rounds} />
                    </field.SelectField>
                  )}
                />
                <form.AppField
                  name="tags"
                  children={field => (
                    <field.ComboboxMultipleField
                      variant="secondary"
                      label="Tags"
                      items={workspace.tags ?? []}
                    />
                  )}
                />
                <form.AppField
                  name="link"
                  validators={{
                    onSubmit: z
                      .url("Enter a web address, like https://hunt.example/puzzles/name")
                      .or(z.literal("")),
                  }}
                  children={field => (
                    <field.TextField
                      variant="secondary"
                      label="Link"
                      type="url"
                      autoComplete="off"
                      description="Link to this puzzle on the hunt website."
                    />
                  )}
                />
                <form.Subscribe selector={state => [state.values.name, state.values.link] as const}>
                  {([name, link]) => (
                    <AlreadyOnBoard
                      workspaceSlug={workspaceSlug}
                      name={name}
                      link={link}
                      onOpen={() => setOpen(false)}
                    />
                  )}
                </form.Subscribe>
                {/* Only with Drive: without it every puzzle gets the built-in sheet and whiteboard,
                    so offering "Google Spreadsheet" would promise something it doesn't do. */}
                {!workspace.googleConnected ? (
                  <p className="text-muted text-sm">
                    Each puzzle gets a built-in spreadsheet and whiteboard your team edits together.
                  </p>
                ) : (
                  <form.AppField
                    name="worksheetType"
                    children={field => {
                      const items = [
                        {value: "google_spreadsheet", label: "Google Spreadsheet"},
                        {value: "google_drawing", label: "Google Drawing"},
                      ];
                      return (
                        <field.SelectField
                          variant="secondary"
                          label="Worksheet type"
                          description="The kind of puzzle worksheet you want to use."
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
            </Modal.Body>
            <Modal.Footer>
              <form.SubmitButton>Add puzzle</form.SubmitButton>
            </Modal.Footer>
          </form.AppForm>
        </Modal.Dialog>
      </Modal.Container>
    </ControlledModal>
  );
}
