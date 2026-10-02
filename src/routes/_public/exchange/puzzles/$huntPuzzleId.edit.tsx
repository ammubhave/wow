import {Accordion, Breadcrumbs, Button, Tabs} from "@heroui/react";
import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, useNavigate} from "@tanstack/react-router";
import {PlusIcon, TrashIcon} from "lucide-react";
import {Suspense} from "react";
import {toast} from "sonner";

import {ChangeExchangePuzzleDraftSwitch} from "@/components/change-exchange-puzzle-draft-switch";
import {ExchangePuzzleSkeleton} from "@/components/exchange-skeletons";
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
      await mutation
        .mutateAsync({
          huntPuzzleId: puzzle.hunt_puzzles.id,
          title: value.title,
          contents: value.contents,
          solution: value.solution,
          answer: value.answer,
          partials: value.partials,
          hints: value.hints,
        })
        .catch(() => {});
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
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
      </div>
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
              onPress={() => deleteMutation.mutate({huntPuzzleId: puzzle.hunt_puzzles.id})}>
              Delete
            </Button>
            <ChangeExchangePuzzleDraftSwitch huntPuzzleId={puzzle.hunt_puzzles.id} />
          </div>
          <div>
            <table>
              <tbody>
                <tr>
                  <td>Answer</td>
                  <td>
                    <form.AppField name="answer">
                      {field => (
                        <field.TextField
                          aria-label="Answer"
                          placeholder="ANSWER"
                          className="uppercase"
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
                    <table>
                      <tbody>
                        <form.Field name="partials" mode="array">
                          {field => (
                            <>
                              {field.state.value.map((_, i) => (
                                // oxlint-disable-next-line react/no-array-index-key -- TanStack Form array rows are addressed by index (`name[i].field`) and items have no id
                                <tr key={i}>
                                  <td>
                                    <form.AppField name={`partials[${i}].answer`}>
                                      {subField => (
                                        <subField.TextField
                                          aria-label="Partial answer"
                                          placeholder="PARTIAL ANSWER"
                                          className="uppercase"
                                        />
                                      )}
                                    </form.AppField>
                                  </td>
                                  <td>
                                    <form.AppField name={`partials[${i}].message`}>
                                      {subField => (
                                        <subField.TextField
                                          aria-label="Partial message"
                                          placeholder="Message"
                                        />
                                      )}
                                    </form.AppField>
                                  </td>
                                  <td>
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
                    <table>
                      <tbody>
                        <form.Field name="hints" mode="array">
                          {field => (
                            <>
                              {field.state.value.map((_, i) => (
                                // oxlint-disable-next-line react/no-array-index-key -- TanStack Form array rows are addressed by index (`name[i].field`) and items have no id
                                <tr key={i}>
                                  <td>
                                    <form.AppField name={`hints[${i}].title`}>
                                      {subField => (
                                        <subField.TextField
                                          aria-label="Hint title"
                                          placeholder="Title"
                                        />
                                      )}
                                    </form.AppField>
                                  </td>
                                  <td>
                                    <form.AppField name={`hints[${i}].message`}>
                                      {subField => (
                                        <subField.TextField
                                          aria-label="Hint message"
                                          placeholder="Message"
                                        />
                                      )}
                                    </form.AppField>
                                  </td>
                                  <td>
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
    </div>
  );
}
