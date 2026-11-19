import {Link, useParams} from "@tanstack/react-router";
import {CircleHelpIcon} from "lucide-react";
import {cn} from "tailwind-variants";

/**
 * A link from the app to a docs page: the workspace's Help tab when you're in a workspace (so you
 * don't leave the hunt), the public docs otherwise.
 */
export function HelpLink({
  slug,
  children,
  className,
}: {
  /** The docs page, as in the registry ("guides/guess-queue"), with an optional #section. */
  slug: string;
  children: React.ReactNode;
  className?: string;
}) {
  const {workspaceSlug} = useParams({strict: false});
  const [page = "", hash] = slug.split("#");
  const classes = cn(
    "text-muted hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline",
    className
  );
  const content = (
    <>
      <CircleHelpIcon className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </>
  );
  return workspaceSlug ? (
    <Link
      to="/$workspaceSlug/help/$"
      params={{workspaceSlug, _splat: page}}
      hash={hash}
      className={classes}>
      {content}
    </Link>
  ) : (
    <Link to="/docs/$" params={{_splat: page}} hash={hash} className={classes}>
      {content}
    </Link>
  );
}
