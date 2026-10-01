import {MutationCache, QueryClient} from "@tanstack/react-query";
import {createRouter} from "@tanstack/react-router";
import {setupRouterSsrQueryIntegration} from "@tanstack/react-router-ssr-query";

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
    }),
  });
  const router = createRouter({
    routeTree,
    context: {queryClient},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
  setupRouterSsrQueryIntegration({router, queryClient});

  return router;
};
