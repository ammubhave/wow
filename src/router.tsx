import {MutationCache, QueryClient} from "@tanstack/react-query";
import {createRouter} from "@tanstack/react-router";
import {setupRouterSsrQueryIntegration} from "@tanstack/react-router-ssr-query";
import {posthog} from "posthog-js";
import {toast} from "sonner";

import {ErrorPage} from "./components/error-page";
import {NotFoundPage} from "./components/not-found-page";
import {PageSkeleton} from "./components/page-skeletons";
import {pageTransitions} from "./components/page-transition";
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
    // Pages scroll inside these containers, not the window: a new page starts at their top (and
    // Back/Forward restores where you were), as the router already does for the window.
    scrollToTopSelectors: [
      '[data-scroll-restoration-id="public-page"]',
      '[data-scroll-restoration-id="workspace-page"]',
      '[data-scroll-restoration-id="workspace-home"]',
    ],
    // Start loading a route's data when its link is hovered or focused, so navigation is instant.
    defaultPreload: "intent",
    // Changing page cross-fades (see page-transition.tsx).
    defaultViewTransition: pageTransitions,
    // A route without a skeleton of its own shows a generic page outline while it loads.
    defaultPendingComponent: PageSkeleton,
    // Every navigation responds at once: a route that has to wait (its data isn't cached, or its
    // code hasn't loaded) shows its skeleton straight away instead of leaving the old page up
    // (the default waits 1s). A route whose loader resolves from the query cache doesn't flash
    // it: the router only offers the skeleton when a loader actually has to run, and offers it
    // in a React transition, so when the loader settles within the same task (ensureQueryData
    // resolving from the cache in a microtask) the finished page lands in that same render and
    // the skeleton never paints. Hover/focus preloading (above) usually has it cached by the
    // click. No minimum either (the default holds a skeleton for 500ms once shown): content that
    // arrives sooner shows sooner. (See offerPending in @tanstack/router-core's load-client.ts.)
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    // Unknown URLs, workspaces and puzzles.
    defaultNotFoundComponent: () => <NotFoundPage />,
    // A page that failed to load or crashed (instead of the router's developer error screen).
    defaultErrorComponent: ErrorPage,
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
