import {
  ArrowRightEndOnRectangleIcon,
  PlusIcon,
} from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import type { MetaFunction } from "@remix-run/node";
import { Link, useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
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

import { trpc } from "../lib/trpc";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix SPA" },
    { name: "description", content: "Welcome to Remix (SPA Mode)!" },
  ];
};

export default function Page() {
  const navigate = useNavigate();
  const myWorkspaces = trpc.workspaces.list.useQuery();

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
    toast.promise(joinWorkspaceMutation.mutateAsync(values), {
      loading: "Joining workspace...",
      success: "Success! You have joined the workspace.",
      error: "Oops! Something went wrong.",
    });
  }

  return (
    <div className="lg:p-8">
      <div className="mx-auto flex max-w-lg flex-col justify-center space-y-6">
        <div className="grid gap-6">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              My workspaces
            </h1>
          </div>
          <ul
            role="list"
            className="divide-y divide-gray-100 overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl"
          >
            {!myWorkspaces.data ? (
              <Skeleton className="flex h-36 justify-between gap-x-6 px-4 py-5 sm:px-6" />
            ) : myWorkspaces.data.length === 0 ? (
              <div className="relative block w-full rounded-lg p-12 text-center">
                <p className="mt-1 text-sm text-gray-500">
                  You are not a member of any workspaces. Join an existing one
                  or create a new one to get started.
                </p>
              </div>
            ) : (
              myWorkspaces.data.map((workspace) => (
                <li
                  key={workspace.id}
                  className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6"
                >
                  <div className="flex min-w-0 gap-x-4">
                    <div className="min-w-0 flex-auto">
                      <p className="text-sm leading-6 text-gray-900">
                        <Link
                          to={
                            workspace.isOnboarding
                              ? `/wow/create/${workspace.id}`
                              : `/wow/${workspace.id}`
                          }
                        >
                          <span className="absolute inset-x-0 -top-px bottom-0" />
                          <span className="font-semibold">
                            {workspace.teamName}
                          </span>{" "}
                          • {workspace.eventName}
                        </Link>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-x-4">
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="h-5 w-5 flex-none text-gray-400"
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          </div>
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-lg font-semibold tracking-tight">
              Join an existing workspace
            </h1>
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
              <Button className="gap-2" variant="default">
                <ArrowRightEndOnRectangleIcon className="size-4" />
                Join workspace
              </Button>
            </form>
          </Form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          </div>
          <Button className="gap-2" variant="outline" asChild>
            <Link to="/wow/create">
              <PlusIcon className="size-4" />
              Create a new workspace
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
