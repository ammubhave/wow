import {createFileRoute} from "@tanstack/react-router";

import {ActivityLog} from "@/components/activity-log";

export const Route = createFileRoute("/_workspace/$workspaceId/_home/activity-log")({
  component: RouteComponent,
});

function RouteComponent() {
  const {workspaceId} = Route.useParams();
  return (
    <div className="p-8">
      <ActivityLog workspaceId={workspaceId} />
    </div>
  );
}
