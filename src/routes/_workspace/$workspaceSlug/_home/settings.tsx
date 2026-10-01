import {Tabs} from "@heroui/react";
import {createFileRoute, Outlet, useChildMatches} from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/settings")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Workspace Settings | WOW"}]}),
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const childMatches = useChildMatches();
  const match = childMatches[0]!;
  return (
    <div className="flex justify-center p-8">
      <div className="flex max-w-4xl flex-1 flex-col gap-6">
        <h1 className="text-3xl font-semibold">Workspace Settings</h1>
        <div className="grid items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <Tabs orientation="vertical" selectedKey={match.routeId}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Workspace settings">
                <Tabs.Tab
                  id="/_workspace/$workspaceSlug/_home/settings/"
                  href={`/${workspaceSlug}/settings`}>
                  General
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab
                  id="/_workspace/$workspaceSlug/_home/settings/members"
                  href={`/${workspaceSlug}/settings/members`}>
                  Members
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab
                  id="/_workspace/$workspaceSlug/_home/settings/administration"
                  href={`/${workspaceSlug}/settings/administration`}>
                  Administration
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <div className="flex flex-col gap-4">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
