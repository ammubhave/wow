import {createFileRoute, Link, Outlet} from "@tanstack/react-router";
import {cn} from "tailwind-variants";

import {Card} from "@/components/ui/card";

export const Route = createFileRoute("/_public/docs")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Documentation | WOW"}]}),
});

interface NavGroup {
  title: string;
  links: Array<{title: string; href: string}>;
}

function NavLink({
  href,
  children,
  active = false,
  isAnchorLink = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  isAnchorLink?: boolean;
}) {
  return (
    <Link
      to={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex justify-between gap-2 py-1 pr-3 text-sm transition",
        isAnchorLink ? "pl-7" : "pl-4",
        active
          ? "text-zinc-900 dark:text-white"
          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      )}>
      <span className="truncate">{children}</span>
    </Link>
  );
}

function NavigationGroup({group, className}: {group: NavGroup; className?: string}) {
  return (
    <li className={cn("relative mt-6", className)}>
      <h2 className="text-xs font-semibold text-zinc-900 dark:text-white">{group.title}</h2>
      <div className="relative mt-3 pl-2">
        <div className="absolute inset-y-0 left-2 w-px bg-zinc-900/10 dark:bg-white/5" />
        <ul role="list" className="border-l border-transparent">
          {group.links.map(link => (
            <li key={link.href} className="relative">
              <NavLink href={link.href} active={link.href === location.pathname}>
                {link.title}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

const navigation: Array<NavGroup> = [
  {
    title: "Overview",
    links: [
      {title: "Introduction", href: "/docs"},
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

function RouteComponent() {
  return (
    <div className="flex flex-1 items-stretch justify-center">
      <div className="flex max-w-5xl flex-1 gap-8">
        <nav className="min-w-48">
          <ul role="list">
            {navigation.map((group, groupIndex) => (
              <NavigationGroup
                key={group.title}
                group={group}
                className={groupIndex === 0 ? "md:mt-0" : ""}
              />
            ))}
          </ul>
        </nav>
        <div className="flex flex-1 items-stretch justify-center">
          <Card className="flex-1 p-8">
            <div className="prose max-w-full">
              <Outlet />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
