import {Button, buttonVariants} from "@heroui/react";
import {Link, useRouter, type ErrorComponentProps} from "@tanstack/react-router";
import {LayoutGridIcon, RotateCwIcon} from "lucide-react";

/**
 * The router's error page: a page that failed to load or crashed. Reported to PostHog by the
 * router's `defaultOnCatch`.
 */
export function ErrorPage({reset}: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main className="bg-background flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="text-muted text-sm">
          Something went wrong on our end, and we've been told about it. Try again, or head back to
          your workspaces.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="tertiary"
          onPress={() => {
            reset();
            void router.invalidate();
          }}>
          <RotateCwIcon />
          Try again
        </Button>
        <Link to="/workspaces" className={buttonVariants({variant: "primary"})}>
          <LayoutGridIcon />
          My workspaces
        </Link>
      </div>
    </main>
  );
}
