import {Card} from "@heroui/react";
import {createFileRoute, Outlet} from "@tanstack/react-router";

import {NavGroup, NavigationGroup} from "@/components/navigation-group";

export const Route = createFileRoute("/_public/docs")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Documentation | WOW"}]}),
});

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
        </nav>
        <div className="flex flex-1 items-stretch justify-center">
          <Card className="flex-1">
            <div className="prose max-w-full">
              <Outlet />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
