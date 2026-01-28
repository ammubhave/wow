import {Link} from "@tanstack/react-router";
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
