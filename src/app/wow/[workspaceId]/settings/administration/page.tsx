import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { Link /* useNavigate, */, useParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { DiscordCardContents } from "@/components/discord-card-contents";
import { GoogleDriveCardContents } from "@/components/google-drive-contents";
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
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
            <Link to="./..">General</Link>
            <Link to="../members">Members</Link>
            <span className="text-primary font-semibold">Administration</span>
          </nav>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <PageInner />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function DeleteWorkspaceCard() {
  // const navigate = useNavigate();
  // const { workspaceId } = useParams<{ workspaceId: string }>();
  // const utils = trpc.useUtils();
  // const mutation = trpc.workspaces.delete.useMutation({
  //   onSuccess: () => {
  //     navigate("/");
  //     utils.invalidate();
  //   },
  // });

  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Delete Workspace</CardTitle>
        <CardDescription>
          This will delete the workspace and all its data. This action is
          irreversible.
        </CardDescription>
      </CardHeader>
      <CardFooter className="border-t px-6 py-4">
        <Button
          variant="destructive"
          disabled
          // onClick={() => {
          //   toast.promise(mutation.mutateAsync(workspaceId!), {
          //     loading: "Deleting workspace...",
          //     success: "Success! Your workspace has been deleted.",
          //     error: "Oops! Something went wrong.",
          //   });
          // }}
        >
          {/* Delete */}
          Contact support to delete your workspace
        </Button>
      </CardFooter>
    </Card>
  );
}

function ArchiveWorkspaceCard() {
  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Archive Workspace</CardTitle>
        <CardDescription>
          This will archive the workspace and all its data. It will not show up
          in the list of active workspace and its contents will become
          read-only. You can unarchive the workspace at any time.
        </CardDescription>
      </CardHeader>
      <CardFooter className="gap-2 border-t px-6 py-4">
        <Button variant="secondary" disabled>
          Coming Soon
        </Button>
      </CardFooter>
    </Card>
  );
}

function WorkspacePasswordCard({
  workspace,
}: {
  workspace: {
    id: string;
    password: string;
  };
}) {
  const formSchema = z.object({
    password: z.string().min(8),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      password: workspace.password,
    },
  });
  const utils = trpc.useUtils();
  const mutation = trpc.workspaces.update.useMutation({
    onSuccess: () => {
      utils.invalidate();
      form.reset();
    },
  });
  function onSubmit(values: z.infer<typeof formSchema>) {
    toast.promise(
      mutation.mutateAsync({
        id: workspace.id,
        ...values,
      }),
      {
        loading: "Saving...",
        success: "Success! The workspace password has been updated.",
        error: "Oops! Something went wrong.",
      },
    );
  }

  return (
    <Card>
      <CardHeader className="px-7">
        <CardTitle>Workspace Password</CardTitle>
        <CardDescription>
          The workspace password is used to join the workspace.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-8">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit">Save</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function GoogleDriveCard({ workspaceId }: { workspaceId: string }) {
  return (
    <Card>
      <GoogleDriveCardContents
        workspaceId={workspaceId}
        redirectUrl={`/wow/${workspaceId}/settings/administration`}
      />
    </Card>
  );
}

function DiscordCard({ workspaceId }: { workspaceId: string }) {
  return (
    <Card>
      <DiscordCardContents
        workspaceId={workspaceId}
        redirectUrl={`/wow/${workspaceId}/settings/administration`}
      />
    </Card>
  );
}

function PageInner() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspace = trpc.workspaces.get.useQuery(workspaceId!);

  return (
    <div className="flex flex-col gap-8">
      {workspace.data ? (
        <WorkspacePasswordCard workspace={workspace.data} />
      ) : (
        <Skeleton className="h-[253px] w-full" />
      )}
      <GoogleDriveCard workspaceId={workspaceId!} />
      <DiscordCard workspaceId={workspaceId!} />
      <ArchiveWorkspaceCard />
      <DeleteWorkspaceCard />
    </div>
  );
}
