import {createFileRoute} from "@tanstack/react-router";

import {ActivityLog} from "@/components/activity-log";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/activity-log")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Activity Log | WOW"}]}),
});

function RouteComponent() {
  return (
    <div className="p-8">
      <ActivityLog />
    </div>
  );
}
