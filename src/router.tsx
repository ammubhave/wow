import {MutationCache, QueryClient} from "@tanstack/react-query";
import {createRouter} from "@tanstack/react-router";
import {setupRouterSsrQueryIntegration} from "@tanstack/react-router-ssr-query";
import {posthog} from "posthog-js";
import {toast} from "sonner";

import {NotFoundPage} from "./components/not-found-page";
import {PageSkeleton} from "./components/page-skeletons";
import {ARCHIVED_MESSAGE_START} from "./lib/archived";
// Import the generated route tree
import {routeTree} from "./routeTree.gen";

// Create a new router (and query client) per request so SSR never shares cache between users.
export const getRouter = () => {
  const queryClient: QueryClient = new QueryClient({
    // > 0 so data fetched during SSR isn't immediately refetched on hydration.
    defaultOptions: {queries: {staleTime: 60 * 1000}},
    // Refresh everything after a mutation, unless it opts out: workspace edits arrive over the
    // websocket (and are optimistic), so refetching every query for them would be wasted work.
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _onMutateResult, mutation) => {
        if (mutation.meta?.invalidates !== false) void queryClient.invalidateQueries();
      },
      // A change refused because the workspace is archived (read-only) says so, once, even where
      // the control forgot to handle it.
      onError: error => {
        if (error.message.startsWith(ARCHIVED_MESSAGE_START)) {
          toast.error(error.message, {id: "workspace-archived"});
        }
      },
    }),
  });
  const router = createRouter({
    routeTree,
    context: {queryClient},
    scrollRestoration: true,
    // Start loading a route's data when its link is hovered or focused, so navigation is instant.
    defaultPreload: "intent",
    // Any route that takes over ~1s to load shows a page outline instead of a blank screen.
    defaultPendingComponent: PageSkeleton,
    // Unknown URLs, workspaces and puzzles.
    defaultNotFoundComponent: () => <NotFoundPage />,
    // Errors that a route's error screen catches never reach the window, so PostHog's exception
    // autocapture misses them: report them here.
    defaultOnCatch: error => {
      if (import.meta.env.PROD) posthog.captureException(error);
    },
    // Let TanStack Query own freshness: the router always calls loaders, which hit the query cache.
    defaultPreloadStaleTime: 0,
  });
  setupRouterSsrQueryIntegration({router, queryClient});

  return router;
};
