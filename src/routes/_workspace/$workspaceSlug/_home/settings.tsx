import {Tabs} from "@heroui/react";
import {createFileRoute, Outlet, useChildMatches} from "@tanstack/react-router";
import {useMediaQuery} from "usehooks-ts";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/settings")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Workspace Settings | WOW"}]}),
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const childMatches = useChildMatches();
  const match = childMatches[0]!;
  // Side tabs on wider screens; a row of tabs above the content on phones.
  const isWide = useMediaQuery("(min-width: 768px)");
  return (
    <div className="flex justify-center p-4 md:p-8">
      <div className="flex max-w-4xl flex-1 flex-col gap-6">
        <h1 className="text-3xl font-semibold">Workspace settings</h1>
        <div className="grid items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <Tabs orientation={isWide ? "vertical" : "horizontal"} selectedKey={match.routeId}>
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
          {/* min-w-0: a grid item otherwise grows to its widest content, past the screen. */}
          <div className="flex min-w-0 flex-col gap-4">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
