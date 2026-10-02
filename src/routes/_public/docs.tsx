import {Typography} from "@heroui/react";
import {createFileRoute, Link, Outlet, useRouterState} from "@tanstack/react-router";
import {ArrowLeftIcon, ArrowRightIcon} from "lucide-react";
import {cn} from "tailwind-variants";

import {NavGroup, NavigationGroup} from "@/components/navigation-group";
import {PROSE_FLOW} from "@/lib/prose";

export const Route = createFileRoute("/_public/docs")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Documentation | WOW"}]}),
});

const navigation: Array<NavGroup> = [
  {
    title: "Overview",
    links: [
      {title: "Getting started", href: "/docs"},
      {title: "Blackboard", href: "/docs/blackboard"},
    ],
  },
  {
    title: "Automations",
    links: [
      {title: "Google Drive", href: "/docs/google-drive"},
      {title: "Discord", href: "/docs/discord"},
    ],
  },
];

const pages = navigation.flatMap(group => group.links);

function RouteComponent() {
  const pathname = useRouterState({
    select: state => state.location.pathname.replace(/\/$/, "") || "/",
  });
  const index = pages.findIndex(page => page.href === pathname);
  const previous = index > 0 ? pages[index - 1] : undefined;
  const next = index >= 0 ? pages[index + 1] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-12">
      <nav aria-label="Documentation" className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-0">
          {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Tailwind preflight sets list-style:none, which makes Safari/VoiceOver drop the implicit list role */}
          <ul role="list">
            {navigation.map((group, groupIndex) => (
              <NavigationGroup
                key={group.title}
                group={group}
                className={groupIndex === 0 ? "md:mt-0" : ""}
              />
            ))}
          </ul>
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        {/* Small screens: the pages as a row of links instead of the sidebar. */}
        <nav aria-label="Documentation pages" className="flex gap-2 overflow-x-auto lg:hidden">
          {pages.map(page => (
            <Link
              key={page.href}
              to={page.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors",
                page.href === pathname
                  ? "bg-accent-soft text-accent-soft-foreground"
                  : "text-muted hover:text-foreground bg-surface-secondary"
              )}>
              {page.title}
            </Link>
          ))}
        </nav>
        <article className="max-w-3xl">
          <span className="text-accent text-xs font-semibold tracking-wider uppercase">
            Documentation
          </span>
          <Typography.Prose
            className={cn(
              "[&_img]:border-separator mt-2 [&_img]:rounded-xl [&_img]:border",
              PROSE_FLOW
            )}>
            <Outlet />
          </Typography.Prose>
        </article>
        {(previous || next) && (
          <div className="border-separator grid max-w-3xl gap-3 border-t pt-6 sm:grid-cols-2">
            {previous ? (
              <PagerLink to={previous.href} title={previous.title} direction="previous" />
            ) : (
              <span />
            )}
            {next && <PagerLink to={next.href} title={next.title} direction="next" />}
          </div>
        )}
      </div>
    </div>
  );
}

function PagerLink({
  to,
  title,
  direction,
}: {
  to: string;
  title: string;
  direction: "previous" | "next";
}) {
  const isNext = direction === "next";
  return (
    <Link
      to={to}
      className={cn(
        "border-separator hover:bg-surface-secondary flex flex-col gap-1 rounded-xl border p-4 transition-colors",
        isNext && "items-end text-end"
      )}>
      <span className="text-muted flex items-center gap-1 text-xs">
        {!isNext && <ArrowLeftIcon className="size-3" />}
        {isNext ? "Next" : "Previous"}
        {isNext && <ArrowRightIcon className="size-3" />}
      </span>
      <span className="font-medium">{title}</span>
    </Link>
  );
}
