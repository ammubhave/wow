import {Link, useRouterState} from "@tanstack/react-router";
import {cn} from "tailwind-variants";

export interface NavGroup {
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

export function NavigationGroup({group, className}: {group: NavGroup; className?: string}) {
  // From the router, not the `location` global: that doesn't exist during SSR and wouldn't
  // re-render this on client-side navigation.
  const pathname = useRouterState({select: state => state.location.pathname});
  return (
    <li className={cn("relative mt-6", className)}>
      <h2 className="text-xs font-semibold text-zinc-900 dark:text-white">{group.title}</h2>
      <div className="relative mt-3 pl-2">
        <div className="absolute inset-y-0 left-2 w-px bg-zinc-900/10 dark:bg-white/5" />
        {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Tailwind preflight sets list-style: none, which makes Safari/VoiceOver drop implicit list semantics. */}
        <ul role="list" className="border-l border-transparent">
          {group.links.map(link => (
            <li key={link.href} className="relative">
              <NavLink href={link.href} active={link.href === pathname}>
                {link.title}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
