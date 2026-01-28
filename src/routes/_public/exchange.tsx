import {createFileRoute, Outlet} from "@tanstack/react-router";

import {NavGroup, NavigationGroup} from "@/components/navigation-group";

export const Route = createFileRoute("/_public/exchange")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Wafflehaüs Puzzle Exchange | WOW"}]}),
});

const navigation: Array<NavGroup> = [
  {title: "Overview", links: [{title: "Introduction", href: "/exchange"}]},
  {
    title: "February 2026",
    links: [
      {title: "Ladders", href: "/exchange/ladders"},
      {title: "Eulogy Poems", href: "/exchange/eulogy-poems"},
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
        <Outlet />
      </div>
    </div>
  );
}
