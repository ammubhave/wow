import {Breadcrumbs, Button, buttonVariants, Dropdown, InputGroup, Label} from "@heroui/react";
import {useMutation, useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ChevronDownIcon, PencilIcon} from "lucide-react";
import {Suspense, useState} from "react";
import {toast} from "sonner";

import {ExchangePuzzleHintDialog} from "@/components/exchange-puzzle-hint-dialog";
import {useAppForm} from "@/components/form";
import {PuzzleRichTextEditor} from "@/components/rich-text-editor";
import {celebrate} from "@/lib/confetti";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/puzzles/$huntPuzzleId/")({
  component: KeyedRouteComponent,
});

// Remount per puzzle so the form and the (uncontrolled) rich text editors don't keep showing the
// previous puzzle when navigating directly between puzzles (e.g. via browser history).
function KeyedRouteComponent() {
  const {huntPuzzleId} = Route.useParams();
  return (
    <Suspense key={huntPuzzleId}>
      <RouteComponent />
    </Suspense>
  );
}

function RouteComponent() {
  const {huntPuzzleId} = Route.useParams();
  const puzzle = useSuspenseQuery(
    orpc.exchange.puzzles.get.queryOptions({input: {huntPuzzleId: huntPuzzleId}})
  ).data;
  const submitAnswer = useMutation(
    orpc.exchange.puzzles.submitAnswer.mutationOptions({
      onSuccess: async data => {
        if (data.isCorrect) {
          await celebrate();
        }
      },
      onError: () => {
        toast.error("Oops! Something went wrong.");
      },
    })
  );

  const form = useAppForm({
    defaultValues: {answer: ""},
    onSubmit: async ({value}) => {
      // Errors are reported by `onError`.
      await submitAnswer
        .mutateAsync({huntPuzzleId: huntPuzzleId, answer: value.answer})
        .catch(() => {});
    },
  });

  const isAdmin = useQuery(orpc.exchange.isAdmin.queryOptions()).data ?? false;

  const [activeHintIndex, setActiveHintIndex] = useState<number | null>(null);
  const [isExchangePuzzleHintDialogOpen, setIsExchangePuzzleHintDialogOpen] = useState(false);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <ExchangePuzzleHintDialog
          open={isExchangePuzzleHintDialogOpen}
          setOpen={setIsExchangePuzzleHintDialogOpen}
          title={activeHintIndex !== null ? puzzle.hunt_puzzles.hints![activeHintIndex]!.title : ""}
          message={
            activeHintIndex !== null ? puzzle.hunt_puzzles.hints![activeHintIndex]!.message : ""
          }
        />
        <Breadcrumbs>
          <Breadcrumbs.Item href="/exchange">Hunts</Breadcrumbs.Item>
          <Breadcrumbs.Item href={`/exchange/hunts/${puzzle.hunts.id}`}>
            {puzzle.hunts.name}
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>{puzzle.hunt_puzzles.title}</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
          <div />
          <div className="text-center text-2xl font-bold">{puzzle.hunt_puzzles.title}</div>
          <div className="flex items-center gap-1 justify-self-end">
            {puzzle.hunt_puzzles.hints && puzzle.hunt_puzzles.hints.length > 0 && (
              <Dropdown>
                <Button variant="outline">
                  Hints
                  <ChevronDownIcon />
                </Button>
                <Dropdown.Popover className="w-(--trigger-width) min-w-56" placement="bottom end">
                  <Dropdown.Menu
                    onAction={key => {
                      setActiveHintIndex(Number(key));
                      setIsExchangePuzzleHintDialogOpen(true);
                    }}>
                    {puzzle.hunt_puzzles.hints.map((hint, index) => (
                      // oxlint-disable-next-line react/no-array-index-key -- hints have no id; the index is the hint's identity (it is also the item id / activeHintIndex) and the list is static
                      <Dropdown.Item key={index} id={index} textValue={hint.title}>
                        <Label>{hint.title}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            )}
            <Link
              to="/exchange/puzzles/$huntPuzzleId/solution"
              params={{huntPuzzleId: puzzle.hunt_puzzles.id}}
              className={buttonVariants({variant: "outline"})}>
              Solution
            </Link>
            {isAdmin && (
              <Link
                to="/exchange/puzzles/$huntPuzzleId/edit"
                params={{huntPuzzleId: puzzle.hunt_puzzles.id}}
                className={buttonVariants({variant: "outline"})}>
                <PencilIcon />
                Edit
              </Link>
            )}
          </div>
        </div>

        <form.AppForm>
          <form.Form className="w-full max-w-lg">
            <InputGroup>
              <form.AppField name="answer">
                {field => (
                  <InputGroup.Input
                    aria-label="Answer"
                    className="uppercase"
                    value={field.state.value}
                    onChange={value => field.handleChange(value.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.AppField>
              <InputGroup.Suffix className="pe-0">
                <Button type="submit" isPending={submitAnswer.isPending}>
                  Submit Answer
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
          </form.Form>
        </form.AppForm>

        {submitAnswer.data && (
          <span className="text-xl font-bold">
            {submitAnswer.data.isCorrect
              ? "Correct!"
              : submitAnswer.data.isPartial
                ? submitAnswer.data.message
                : "Incorrect"}
          </span>
        )}
        {submitAnswer.isPending && <span className="text-xl font-bold">Checking answer...</span>}
      </div>
      <div className="dark:bg-surface bg-surface-secondary flex flex-col gap-4">
        <PuzzleRichTextEditor
          huntPuzzleId={huntPuzzleId}
          defaultValue={puzzle.hunt_puzzles.contents ?? undefined}
        />
      </div>
    </div>
  );
}
