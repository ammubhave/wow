import { CheckIcon } from "@heroicons/react/24/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
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
import { trpc } from "@/lib/trpc";

export function TopNav({
  children,
  steps,
}: {
  children: React.ReactNode;
  steps: { name: string; status: "complete" | "current" | "upcoming" }[];
}) {
  return (
    <nav aria-label="Progress">
      <ol
        role="list"
        className="divide-y divide-gray-300 border-b border-gray-300 md:flex md:divide-y-0"
      >
        {steps.map((step, stepIdx) => (
          <li key={stepIdx} className="relative md:flex md:flex-1">
            {step.status === "complete" ? (
              <span className="group flex w-full items-center">
                <span className="flex items-center px-6 py-4 text-sm font-medium">
                  <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600">
                    <CheckIcon
                      aria-hidden="true"
                      className="size-4 text-white"
                    />
                  </span>
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    {step.name}
                  </span>
                </span>
              </span>
            ) : step.status === "current" ? (
              <span
                aria-current="step"
                className="flex items-center px-6 py-4 text-sm font-medium"
              >
                <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-indigo-600">
                  <span className="size-2 rounded-full bg-indigo-600" />
                </span>
                <span className="ml-3 text-sm font-medium text-indigo-600">
                  {step.name}
                </span>
              </span>
            ) : (
              <span className="group flex items-center">
                <span className="flex items-center px-6 py-4 text-sm font-medium">
                  <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-300">
                    <span className="size-2 rounded-full bg-transparent" />
                  </span>
                  <span className="ml-3 text-sm font-medium text-gray-500">
                    {step.name}
                  </span>
                </span>
              </span>
            )}
            {stepIdx !== steps.length - 1 ? (
              <>
                <div
                  aria-hidden="true"
                  className="absolute right-0 top-0 hidden h-full w-5 md:block"
                >
                  <svg
                    fill="none"
                    viewBox="0 0 22 80"
                    preserveAspectRatio="none"
                    className="h-full w-full text-gray-300"
                  >
                    <path
                      d="M0 -2L20 40L0 82"
                      stroke="currentcolor"
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </>
            ) : null}
          </li>
        ))}
      </ol>
      {children}
    </nav>
  );
}

function CreateWorkspaceCard() {
  const formSchema = z.object({
    teamName: z.string(),
    eventName: z.string(),
    password: z.string().min(8),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      teamName: "",
      eventName: "",
      password: "",
    },
  });
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const mutation = trpc.workspaces.create.useMutation({
    onSuccess: (data) => {
      utils.invalidate();
      form.reset();
      navigate(`/wow/create/${data.id}`);
    },
  });
  function onSubmit(values: z.infer<typeof formSchema>) {
    toast.promise(mutation.mutateAsync(values), {
      loading: "Creating workspace...",
      success: "Success! Your workspace has been created.",
      error: "Oops! Something went wrong.",
      description: `${values.teamName} · ${values.eventName}`,
    });
  }

  return (
    <>
      <CardHeader className="px-7">
        <CardTitle>Create workspace</CardTitle>
        <CardDescription>
          You need to provide a team name and an event name to create your
          workspace. You also need to provide a password that other users can
          use to join your workspace.
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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Password</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="justify-end border-t px-6 py-4">
            <Button type="submit">Create</Button>
          </CardFooter>
        </form>
      </Form>
    </>
  );
}

export default function Page() {
  return (
    <div className="flex justify-center">
      <div className="max-w-3xl flex-1">
        <Card>
          <TopNav
            steps={[
              { name: "Create workspace", status: "current" } as const,
              { name: "Configure workspace", status: "upcoming" } as const,
            ]}
          >
            <CreateWorkspaceCard />
          </TopNav>
        </Card>
      </div>
    </div>
  );
}
