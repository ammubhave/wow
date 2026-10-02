import {createFileRoute} from "@tanstack/react-router";

import {
  ActivityFeed,
  ActivityFeedSkeleton,
  activityLogQueryOptions,
} from "@/components/activity-feed";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/activity-log")({
  // Prefetch the first page (also on link hover, via intent preloading) so switching here from the
  // board doesn't suspend the whole layout; the skeleton only shows if it's slow.
  loader: ({context: {queryClient}, params: {workspaceSlug}}) =>
    queryClient.ensureInfiniteQueryData(activityLogQueryOptions(workspaceSlug)),
  pendingComponent: () => (
    <div className="w-full p-4 md:p-8">
      <ActivityFeedSkeleton />
    </div>
  ),
  component: RouteComponent,
  head: () => ({meta: [{title: "Activity Log | WOW"}]}),
});

function RouteComponent() {
  return (
    <div className="w-full p-4 md:p-8">
      <ActivityFeed />
    </div>
  );
}
