import {Accordion, AlertDialog, Breadcrumbs, Button, Tabs} from "@heroui/react";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, useBlocker, useNavigate} from "@tanstack/react-router";
import {PlusIcon, TrashIcon} from "lucide-react";
import {Suspense, useEffect, useRef, useState} from "react";
import {toast} from "sonner";

import {ChangeExchangePuzzleDraftSwitch} from "@/components/change-exchange-puzzle-draft-switch";
import {ControlledAlertDialog} from "@/components/controlled-dialog";
import {ExchangePuzzleSkeleton} from "@/components/exchange-skeletons";
import {ExchangeTopBar} from "@/components/exchange-top-bar";
import {useAppForm} from "@/components/form";
import {PuzzleRichTextEditor} from "@/components/rich-text-editor";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/puzzles/$huntPuzzleId/edit")({
  // Prefetch so the page renders with data instead of suspending (and flashing) on mount.
  loader: ({context: {queryClient}, params: {huntPuzzleId}}) =>
    queryClient.ensureQueryData(orpc.exchange.puzzles.get.queryOptions({input: {huntPuzzleId}})),
  pendingComponent: ExchangePuzzleSkeleton,
  component: KeyedRouteComponent,
});

// Remount per puzzle so the form and the (uncontrolled) rich text editors don't keep showing the
// previous puzzle when navigating directly between puzzles (e.g. via browser history).
function KeyedRouteComponent() {
  const {huntPuzzleId} = Route.useParams();
  return (
    <Suspense key={huntPuzzleId} fallback={<ExchangePuzzleSkeleton />}>
      <RouteComponent />
    </Suspense>
  );
}

function RouteComponent() {
  const {huntPuzzleId} = Route.useParams();
  const puzzle = useSuspenseQuery(
    orpc.exchange.puzzles.get.queryOptions({input: {huntPuzzleId: huntPuzzleId}})
  ).data;
  // Unsaved changes: compare against what was last loaded or saved. The baseline is taken once
  // the editors have settled, as they may normalise the stored document when they first render.
  const savedSnapshot = useRef<string | null>(null);
  const mutation = useMutation(
    orpc.exchange.puzzles.update.mutationOptions({
      onSuccess: () => {
        toast.success("Puzzle updated successfully");
      },
      onError: e => {
        toast.error("Failed to update puzzle: " + e.message);
      },
    })
  );
  const navigate = useNavigate();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deleteMutation = useMutation(
    orpc.exchange.puzzles.delete.mutationOptions({
      onSuccess: () => {
        void navigate({to: "/exchange/hunts/$huntId", params: {huntId: puzzle.hunts.id}});
      },
      onError: e => {
        toast.error("Failed to delete puzzle: " + e.message);
      },
    })
  );

  const form = useAppForm({
    defaultValues: {
      title: puzzle.hunt_puzzles.title,
      contents: puzzle.hunt_puzzles.contents ?? undefined,
      solution: puzzle.hunt_puzzles.solution ?? undefined,
      answer: puzzle.hunt_puzzles.answer,
      partials: puzzle.hunt_puzzles.partials ?? [],
      hints: puzzle.hunt_puzzles.hints ?? [],
    },
    onSubmit: async ({value}) => {
      // Errors are reported by `onError`.
      const saved = await mutation
        .mutateAsync({
          huntPuzzleId: puzzle.hunt_puzzles.id,
          title: value.title,
          contents: value.contents,
          solution: value.solution,
          answer: value.answer,
          partials: value.partials,
          hints: value.hints,
        })
        .then(() => true)
        .catch(() => false);
      if (saved) savedSnapshot.current = JSON.stringify(value);
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      savedSnapshot.current = JSON.stringify(form.state.values);
    }, 500);
    return () => clearTimeout(timer);
  }, [form]);
  const hasUnsavedChanges = () =>
    savedSnapshot.current !== null && JSON.stringify(form.state.values) !== savedSnapshot.current;
  // Leaving with unsaved changes asks first; closing or reloading the tab gets the browser's
  // own prompt.
  const blocker = useBlocker({
    shouldBlockFn: hasUnsavedChanges,
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ExchangeTopBar>
        <Breadcrumbs>
          <Breadcrumbs.Item href="/exchange">Hunts</Breadcrumbs.Item>
          <Breadcrumbs.Item href={`/exchange/hunts/${puzzle.hunts.id}`}>
            {puzzle.hunts.name}
          </Breadcrumbs.Item>
          <Breadcrumbs.Item href={`/exchange/puzzles/${puzzle.hunt_puzzles.id}`}>
            {puzzle.hunt_puzzles.title}
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>Edit</Breadcrumbs.Item>
        </Breadcrumbs>
      </ExchangeTopBar>
      <form.AppForm>
        <form.Form className="flex-1">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <form.AppField name="title">
                {field => <field.TextField aria-label="Title" placeholder="Enter puzzle title" />}
              </form.AppField>
            </div>
            <form.SubmitButton>Save</form.SubmitButton>
            <Button
              variant="outline"
              isPending={deleteMutation.isPending}
              onPress={() => setIsDeleteOpen(true)}>
              Delete
            </Button>
            <ChangeExchangePuzzleDraftSwitch huntPuzzleId={puzzle.hunt_puzzles.id} />
          </div>
          <div>
            <table>
              <tbody>
                <tr>
                  <td className="pe-3">Answer</td>
                  <td className="w-64">
                    <form.AppField name="answer">
                      {field => (
                        <field.TextField
                          aria-label="Answer"
                          placeholder="ANSWER"
                          className="uppercase"
                          fullWidth
                        />
                      )}
                    </form.AppField>
                  </td>
                </tr>
              </tbody>
            </table>
            <Accordion>
              <Accordion.Item id="partials">
                <Accordion.Heading>
                  <Accordion.Trigger>
                    Partials
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body>
                    <table className="w-full border-separate border-spacing-y-1">
                      <tbody>
                        <form.Field name="partials" mode="array">
                          {field => (
                            <>
                              {field.state.value.map((_, i) => (
                                // oxlint-disable-next-line react/no-array-index-key -- TanStack Form array rows are addressed by index (`name[i].field`) and items have no id
                                <tr key={i}>
                                  {/* Short: a single word or phrase. */}
                                  <td className="w-56 pe-2">
                                    <form.AppField name={`partials[${i}].answer`}>
                                      {subField => (
                                        <subField.TextField
                                          aria-label="Partial answer"
                                          fullWidth
                                          placeholder="PARTIAL ANSWER"
                                          className="uppercase"
                                        />
                                      )}
                                    </form.AppField>
                                  </td>
                                  {/* Wide: the nudge shown to the solver is a sentence. */}
                                  <td className="pe-2">
                                    <form.AppField name={`partials[${i}].message`}>
                                      {subField => (
                                        <subField.TextField
                                          aria-label="Partial message"
                                          fullWidth
                                          placeholder="Message"
                                        />
                                      )}
                                    </form.AppField>
                                  </td>
                                  <td className="w-px">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      isIconOnly
                                      aria-label="Remove partial"
                                      onPress={() => field.removeValue(i)}>
                                      <TrashIcon />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                              <tr>
                                <td colSpan={2}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onPress={() => {
                                      field.pushValue({answer: "", message: ""});
                                    }}>
                                    <PlusIcon />
                                    Add
                                  </Button>
                                </td>
                              </tr>
                            </>
                          )}
                        </form.Field>
                      </tbody>
                    </table>
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
              <Accordion.Item id="hints">
                <Accordion.Heading>
                  <Accordion.Trigger>
                    Hints
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body>
                    <table className="w-full border-separate border-spacing-y-1">
                      <tbody>
                        <form.Field name="hints" mode="array">
                          {field => (
                            <>
                              {field.state.value.map((_, i) => (
                                // oxlint-disable-next-line react/no-array-index-key -- TanStack Form array rows are addressed by index (`name[i].field`) and items have no id
                                <tr key={i}>
                                  <td className="w-56 pe-2">
                                    <form.AppField name={`hints[${i}].title`}>
                                      {subField => (
                                        <subField.TextField
                                          aria-label="Hint title"
                                          fullWidth
                                          placeholder="Title"
                                        />
                                      )}
                                    </form.AppField>
                                  </td>
                                  <td className="pe-2">
                                    <form.AppField name={`hints[${i}].message`}>
                                      {subField => (
                                        <subField.TextField
                                          aria-label="Hint message"
                                          fullWidth
                                          placeholder="Message"
                                        />
                                      )}
                                    </form.AppField>
                                  </td>
                                  <td className="w-px">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      isIconOnly
                                      aria-label="Remove hint"
                                      onPress={() => field.removeValue(i)}>
                                      <TrashIcon />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                              <tr>
                                <td colSpan={2}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onPress={() => {
                                      field.pushValue({title: "", message: ""});
                                    }}>
                                    <PlusIcon />
                                    Add
                                  </Button>
                                </td>
                              </tr>
                            </>
                          )}
                        </form.Field>
                      </tbody>
                    </table>
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </div>
          <Tabs defaultSelectedKey="content" className="flex flex-1 flex-col">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Puzzle content">
                <Tabs.Tab id="content">
                  Content
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="solution">
                  Solution
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
            <Tabs.Panel id="content" className="relative flex min-h-[200px] flex-1 flex-col gap-4">
              <div className="dark:bg-surface bg-surface-secondary overflow absolute inset-0 overflow-y-auto">
                <form.AppField name="contents">
                  {field => (
                    <PuzzleRichTextEditor
                      huntPuzzleId={huntPuzzleId}
                      defaultValue={field.state.value}
                      onChange={value => field.setValue(value)}
                    />
                  )}
                </form.AppField>
              </div>
            </Tabs.Panel>
            <Tabs.Panel id="solution" className="relative flex min-h-[200px] flex-1 flex-col gap-4">
              <div className="dark:bg-surface bg-surface-secondary overflow absolute inset-0 overflow-y-auto">
                <form.AppField name="solution">
                  {field => (
                    <PuzzleRichTextEditor
                      huntPuzzleId={huntPuzzleId}
                      defaultValue={field.state.value}
                      onChange={value => field.setValue(value)}
                    />
                  )}
                </form.AppField>
              </div>
            </Tabs.Panel>
          </Tabs>
        </form.Form>
      </form.AppForm>

      <ControlledAlertDialog isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Delete “{puzzle.hunt_puzzles.title}”?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>The puzzle, its hints and its solution will be deleted. This can't be undone.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button
                variant="danger"
                isPending={deleteMutation.isPending}
                onPress={() => {
                  // The puzzle is going: leaving afterwards mustn't ask about its unsaved edits.
                  const snapshot = savedSnapshot.current;
                  savedSnapshot.current = null;
                  deleteMutation.mutate(
                    {huntPuzzleId: puzzle.hunt_puzzles.id},
                    {onError: () => (savedSnapshot.current = snapshot)}
                  );
                }}>
                Delete puzzle
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </ControlledAlertDialog>

      <ControlledAlertDialog
        isOpen={blocker.status === "blocked"}
        onOpenChange={open => {
          if (!open && blocker.status === "blocked") blocker.reset();
        }}>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>Leave without saving?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>Your changes to “{puzzle.hunt_puzzles.title}” haven't been saved.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => blocker.reset?.()}>
                Keep editing
              </Button>
              <Button variant="danger-soft" onPress={() => blocker.proceed?.()}>
                Leave without saving
              </Button>
              <Button
                isPending={mutation.isPending}
                onPress={async () => {
                  await form.handleSubmit();
                  if (!hasUnsavedChanges()) blocker.proceed?.();
                }}>
                Save and leave
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </ControlledAlertDialog>
    </div>
  );
}
