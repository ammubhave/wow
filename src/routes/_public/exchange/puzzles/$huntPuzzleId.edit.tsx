import {useMutation, useSuspenseQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {PlusIcon, TrashIcon} from "lucide-react";
import {Suspense} from "react";
import {toast} from "sonner";

import {useAppForm} from "@/components/form";
import {SimpleEditor} from "@/components/tiptap-templates/simple/simple-editor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {Button} from "@/components/ui/button";
import {Table, TableBody, TableCell, TableRow} from "@/components/ui/table";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {orpc} from "@/lib/orpc";

export const Route = createFileRoute("/_public/exchange/puzzles/$huntPuzzleId/edit")({
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
      await mutation.mutateAsync({
        huntPuzzleId: puzzle.hunt_puzzles.id,
        title: value.title,
        contents: value.contents,
        solution: value.solution,
        answer: value.answer,
        partials: value.partials,
        hints: value.hints,
      });
    },
  });

  return (
    <div className="flex flex-1 gap-4 flex-col">
      <div>
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
              <BreadcrumbLink
                render={
                  <Link
                    to="/exchange/puzzles/$huntPuzzleId"
                    params={{huntPuzzleId: puzzle.hunt_puzzles.id}}>
                    {puzzle.hunt_puzzles.title}
                  </Link>
                }
              />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Edit</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <form.AppForm>
        <form.Form className="flex-1 flex flex-col gap-4">
          <div className="flex">
            <form.AppField name="title">
              {field => <field.TextField placeholder="Enter puzzle title" className="flex-1" />}
            </form.AppField>
            <div>
              <form.SubmitButton>Save</form.SubmitButton>
            </div>
          </div>
          <div>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Answer</TableCell>
                  <TableCell>
                    <form.AppField name="answer">
                      {field => <field.TextField placeholder="ANSWER" className="uppercase" />}
                    </form.AppField>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Accordion>
              <AccordionItem>
                <AccordionTrigger>Partials</AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableBody>
                      <form.Field name="partials" mode="array">
                        {field => (
                          <>
                            {field.state.value.map((_, i) => (
                              <TableRow key={i}>
                                <TableCell>
                                  <form.AppField name={`partials[${i}].answer`}>
                                    {subField => (
                                      <subField.TextField
                                        placeholder="PARTIAL ANSWER"
                                        className="uppercase"
                                      />
                                    )}
                                  </form.AppField>
                                </TableCell>
                                <TableCell>
                                  <form.AppField name={`partials[${i}].message`}>
                                    {subField => <subField.TextField placeholder="Message" />}
                                  </form.AppField>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => field.removeValue(i)}>
                                    <TrashIcon />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={2}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    field.pushValue({answer: "", message: ""});
                                  }}>
                                  <PlusIcon />
                                  Add
                                </Button>
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </form.Field>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem>
                <AccordionTrigger>Hints</AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableBody>
                      <form.Field name="hints" mode="array">
                        {field => (
                          <>
                            {field.state.value.map((_, i) => (
                              <TableRow key={i}>
                                <TableCell>
                                  <form.AppField name={`hints[${i}].title`}>
                                    {subField => <subField.TextField placeholder="Title" />}
                                  </form.AppField>
                                </TableCell>
                                <TableCell>
                                  <form.AppField name={`hints[${i}].message`}>
                                    {subField => <subField.TextField placeholder="Message" />}
                                  </form.AppField>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => field.removeValue(i)}>
                                    <TrashIcon />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={2}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    field.pushValue({title: "", message: ""});
                                  }}>
                                  <PlusIcon />
                                  Add
                                </Button>
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </form.Field>
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <Tabs className="flex-1 flex flex-col">
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="solution">Solution</TabsTrigger>
            </TabsList>
            <TabsContent
              value="content"
              className="flex relative flex-col gap-4 flex-1 min-h-[200px]">
              <div className="absolute dark:bg-card bg-muted inset-0 overflow overflow-y-auto">
                <form.AppField name="contents">
                  {field => (
                    <SimpleEditor
                      huntPuzzleId={huntPuzzleId}
                      defaultValue={field.state.value}
                      onChange={value => field.setValue(value)}
                    />
                  )}
                </form.AppField>
              </div>
            </TabsContent>
            <TabsContent
              value="solution"
              className="flex relative flex-col gap-4 flex-1 min-h-[200px]">
              <div className="absolute dark:bg-card bg-muted inset-0 overflow overflow-y-auto">
                <form.AppField name="solution">
                  {field => (
                    <SimpleEditor
                      huntPuzzleId={huntPuzzleId}
                      defaultValue={field.state.value}
                      onChange={value => field.setValue(value)}
                    />
                  )}
                </form.AppField>
              </div>
            </TabsContent>
          </Tabs>
        </form.Form>
      </form.AppForm>
    </div>
  );
}
