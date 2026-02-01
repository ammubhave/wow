import {useMutation, useQuery, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {ChevronDownIcon, PencilIcon} from "lucide-react";
import {Suspense, useState} from "react";

import {ExchangePuzzleHintDialog} from "@/components/exchange-puzzle-hint-dialog";
import {useAppForm} from "@/components/form";
import {SimpleEditor} from "@/components/tiptap-templates/simple/simple-editor";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {Button} from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {celebrate} from "@/lib/confetti";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/puzzles/$huntPuzzleId/")({
  component: () => (
    <Suspense>
      <RouteComponent />
    </Suspense>
  ),
});

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
    })
  );

  const form = useAppForm({
    defaultValues: {answer: ""},
    onSubmit: async ({value}) => {
      await submitAnswer.mutateAsync({huntPuzzleId: huntPuzzleId, answer: value.answer});
    },
  });

  const isAdmin = useQuery(orpc.exchange.isAdmin.queryOptions()).data ?? false;

  const [activeHintIndex, setActiveHintIndex] = useState<number | null>(null);
  const [isExchangePuzzleHintDialogOpen, setIsExchangePuzzleHintDialogOpen] = useState(false);
  return (
    <div className="flex flex-1 gap-4 flex-col">
      <div>
        <ExchangePuzzleHintDialog
          open={isExchangePuzzleHintDialogOpen}
          setOpen={setIsExchangePuzzleHintDialogOpen}
          title={activeHintIndex !== null ? puzzle.hunt_puzzles.hints![activeHintIndex]!.title : ""}
          message={
            activeHintIndex !== null ? puzzle.hunt_puzzles.hints![activeHintIndex]!.message : ""
          }
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/exchange">Hunts</Link>} />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <Link to="/exchange/hunts/$huntId" params={{huntId: puzzle.hunts.id}}>
                    {puzzle.hunts.name}
                  </Link>
                }
              />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{puzzle.hunt_puzzles.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex gap-4 flex-col items-center">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
          <div />
          <div className="text-2xl font-bold text-center">{puzzle.hunt_puzzles.title}</div>
          <div className="justify-self-end flex gap-1 items-center">
            {puzzle.hunt_puzzles.hints && puzzle.hunt_puzzles.hints.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline">
                      Hints
                      <ChevronDownIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}>
                  <DropdownMenuGroup>
                    {puzzle.hunt_puzzles.hints.map((hint, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => {
                          setActiveHintIndex(index);
                          setIsExchangePuzzleHintDialogOpen(true);
                        }}>
                        {hint.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="outline"
              render={
                <Link
                  to="/exchange/puzzles/$huntPuzzleId/solution"
                  params={{huntPuzzleId: puzzle.hunt_puzzles.id}}>
                  Solution
                </Link>
              }
            />
            {isAdmin && (
              <Button
                variant="outline"
                render={
                  <Link
                    to="/exchange/puzzles/$huntPuzzleId/edit"
                    params={{huntPuzzleId: puzzle.hunt_puzzles.id}}>
                    <PencilIcon />
                    Edit
                  </Link>
                }
              />
            )}
          </div>
        </div>

        <form.AppForm>
          <form.Form className="max-w-lg w-full">
            <InputGroup>
              <form.AppField name="answer">
                {field => (
                  <InputGroupInput
                    className="uppercase"
                    value={field.state.value}
                    onChange={value => field.handleChange(value.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.AppField>
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="default">
                  Submit Answer
                </InputGroupButton>
              </InputGroupAddon>
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
      <div className="flex flex-col gap-4 dark:bg-card bg-muted">
        <SimpleEditor
          huntPuzzleId={huntPuzzleId}
          defaultValue={puzzle.hunt_puzzles.contents ?? undefined}
        />
      </div>
    </div>
  );
}
