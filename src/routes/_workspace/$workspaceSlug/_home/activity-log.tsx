import {createFileRoute} from "@tanstack/react-router";

import {
  ActivityFeed,
  ActivityFeedSkeleton,
  activityLogQueryOptions,
} from "@/components/activity-feed";
import {Page} from "@/components/page";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/activity-log")({
  // Prefetch the first page (also on link hover, via intent preloading) so switching here from the
  // board doesn't suspend the whole layout; the skeleton only shows if it's slow.
  loader: ({context: {queryClient}, params: {workspaceSlug}}) =>
    queryClient.ensureInfiniteQueryData(activityLogQueryOptions(workspaceSlug)),
  pendingComponent: () => (
    <Page>
      <ActivityFeedSkeleton />
    </Page>
  ),
  component: RouteComponent,
  head: () => ({meta: [{title: "Activity log | WOW"}]}),
});

function RouteComponent() {
  return (
    <Page>
      <ActivityFeed />
    </Page>
  );
}
