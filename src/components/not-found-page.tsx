import {Button, buttonVariants} from "@heroui/react";
import {Link, useRouter} from "@tanstack/react-router";
import {ArrowLeftIcon, LayoutGridIcon} from "lucide-react";
import {cn} from "tailwind-variants";

import FuzzyText from "./fuzzy-text";

/** The router's not-found page: an unknown URL, workspace or puzzle. */
export function NotFoundPage({className}: {className?: string}) {
  const router = useRouter();
  return (
    <main
      className={cn(
        "bg-background flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 p-6 text-center",
        className
      )}>
      <div className="text-foreground" aria-hidden="true">
        <FuzzyText fontSize="clamp(5rem, 18vw, 11rem)" baseIntensity={0.15} hoverIntensity={0.45}>
          404
        </FuzzyText>
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-xl font-semibold">This page is a red herring</h1>
        <p className="text-muted text-sm">
          Nothing lives at this address. The workspace or puzzle may have been renamed or deleted,
          or the link has a typo.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="tertiary" onPress={() => router.history.back()}>
          <ArrowLeftIcon />
          Go back
        </Button>
        <Link to="/workspaces" className={buttonVariants({variant: "primary"})}>
          <LayoutGridIcon />
          My workspaces
        </Link>
      </div>
    </main>
  );
}
