import { PlusIcon } from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { MinusCircledIcon } from "@radix-ui/react-icons";
import { CopyIcon } from "lucide-react";
import { Suspense } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";

export default function Page() {
  return (
    <div className="flex justify-center">
      <div className="flex max-w-4xl flex-1 flex-col gap-4 md:gap-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Workspace Settings</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <nav
            className="text-muted-foreground grid gap-4 text-sm"
            x-chunk="dashboard-04-chunk-0"
          >
            <span className="text-primary font-semibold">General</span>
            <Link to="administration">Administration</Link>
          </nav>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <PageInner />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function UpdateLinksCard() {
  const formSchema = z.object({
    links: z.array(z.object({ name: z.string(), url: z.string().url() })),
  });
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspace = trpc.workspaces.get.useSuspenseQuery(workspaceId!)[0];
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      links: workspace.links,
    },
  });
  const utils = trpc.useUtils();
  const mutation = trpc.workspaces.updateLinks.useMutation({
    onSuccess: () => {
      utils.invalidate();
      form.reset();
    },
  });
  function onSubmit(values: z.infer<typeof formSchema>) {
    toast.promise(
      mutation.mutateAsync({
        id: workspaceId!,
        ...values,
      }),
      {
        loading: "Saving...",
        success: "Success! Your changes have been saved.",
        error: "Oops! Something went wrong.",
      },
    );
  }

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "links",
  });

  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Links</CardTitle>
        <CardDescription>
          Add links to this workspace to be displayed in the navigation bar. For
          example, you can add a link to the puzzle hunt website.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <p className="text-muted-foreground">
                        No links added yet.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
                {fields.map((field, index) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`links.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input className="bg-background" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <FormField
                        control={form.control}
                        name={`links.${index}.url`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input className="bg-background" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                      >
                        <MinusCircledIcon className="size-4" />
                        <span className="sr-only">Remove link</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                onClick={() => append({ name: "", url: "about:blank" })}
              >
                <PlusIcon className="size-4" />
                Add link
              </Button>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit">Save</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function LeaveWorkspaceCard() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const utils = trpc.useUtils();
  const mutation = trpc.workspaces.leave.useMutation({
    onSuccess: () => {
      navigate("/");
      utils.invalidate();
    },
  });

  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Leave Workspace</CardTitle>
        <CardDescription>
          Leave this workspace. You will no longer be able to access it.
        </CardDescription>
      </CardHeader>
      <CardFooter className="border-t px-6 py-4">
        <Button
          onClick={() => {
            toast.promise(mutation.mutateAsync(workspaceId!), {
              loading: "Leaving workspace...",
              success: "Success! You have left the workspace.",
              error: "Oops! Something went wrong.",
            });
          }}
        >
          Leave
        </Button>
      </CardFooter>
    </Card>
  );
}
function DetailsCard({ workspaceId }: { workspaceId: string }) {
  const workspace = trpc.workspaces.get.useSuspenseQuery(workspaceId)[0];

  const formSchema = z.object({
    teamName: z.string(),
    eventName: z.string(),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      teamName: workspace.teamName,
      eventName: workspace.eventName,
    },
  });
  const utils = trpc.useUtils();
  const updateMutation = trpc.workspaces.update.useMutation({
    onSuccess: () => {
      utils.invalidate();
      form.reset();
    },
  });
  function onSubmit(values: z.infer<typeof formSchema>) {
    toast.promise(
      updateMutation.mutateAsync({
        id: workspaceId!,
        ...values,
      }),
      {
        loading: "Saving...",
        success: "Success! Your changes have been saved.",
        error: "Oops! Something went wrong.",
      },
    );
  }

  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Details</CardTitle>
        <CardDescription>
          General information about this workspace.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-8">
            <FormField
              control={form.control}
              name="teamName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eventName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Invitation Link
              </label>
              <p className="text-muted-foreground text-sm flex items-center gap-2">
                https://join.wafflehaus.io/{workspaceId}
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => {
                    toast.promise(
                      navigator.clipboard.writeText(
                        `https://join.wafflehaus.io/${workspaceId}`,
                      ),
                      {
                        loading: "Copying...",
                        success: "Join link copied!",
                        error: "Oops! Something went wrong.",
                      },
                    );
                  }}
                >
                  <CopyIcon className="size-4" />
                </Button>
              </p>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit">Save</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function PageInner() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <div className="flex flex-col gap-8">
      <DetailsCard workspaceId={workspaceId!} />
      <UpdateLinksCard />
      <LeaveWorkspaceCard />
    </div>
  );
}
