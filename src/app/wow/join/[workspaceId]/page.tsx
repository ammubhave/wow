import { ArrowRightEndOnRectangleIcon } from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { trpc } from "@/lib/trpc";

export default function Page() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspace = trpc.workspaces.getBasic.useQuery(workspaceId!);

  const formSchema = z.object({
    password: z.string().min(1),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
    },
  });
  const utils = trpc.useUtils();
  const joinWorkspaceMutation = trpc.workspaces.join.useMutation({
    onSuccess: (data) => {
      utils.invalidate();
      form.reset();
      navigate(`/wow/${data.id}`);
    },
  });
  function onSubmit(values: z.infer<typeof formSchema>) {
    toast.promise(
      joinWorkspaceMutation.mutateAsync({
        workspaceId: workspaceId!,
        password: values.password,
      }),
      {
        loading: "Joining workspace...",
        success: "Success! You have joined the workspace.",
        error: "Oops! Something went wrong.",
      },
    );
  }

  return (
    <div className="lg:p-8">
      <div className="mx-auto flex max-w-lg flex-col justify-center space-y-6">
        {workspace.error ? (
          <>{workspace.error.data?.code}</>
        ) : (
          <div className="grid gap-12">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-lg font-semibold tracking-tight flex items-center justify-center gap-2">
                You've been invited to join the{" "}
                {workspace.data ? (
                  <span className="font-mono font-medium">
                    {workspace.data?.id}
                  </span>
                ) : (
                  <Skeleton className="w-24 h-6 inline-block" />
                )}{" "}
                workspace!
              </h1>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium leading-none">Event Name</h4>
              <p className="text-sm text-muted-foreground">
                {workspace.data?.eventName ?? <Skeleton className="w-40 h-5" />}
              </p>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium leading-none">Team Name</h4>
              <p className="text-sm text-muted-foreground">
                {workspace.data?.teamName ?? <Skeleton className="w-40 h-5" />}
              </p>
            </div>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid items-stretch space-y-8"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace Password</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-background"
                          type="password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  className="gap-2"
                  variant="default"
                  disabled={!workspace.data}
                >
                  <ArrowRightEndOnRectangleIcon className="size-4" />
                  Join workspace
                </Button>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
