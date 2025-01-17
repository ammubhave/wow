import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import { Header } from "@/components/header";
import { Spinner } from "@/components/spinner";
import { trpc } from "@/lib/trpc";

function LayoutInner({
  getIdToken,
}: {
  getIdToken: () => Promise<string | undefined>;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          async headers() {
            return {
              authorization: `Bearer ${await getIdToken()}`,
            };
          },
        }),
      ],
    }),
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Header />
        <main className="bg-gray-50 dark:bg-gray-950 flex h-[calc(100dvh-theme(spacing.16))] flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10 overflow-auto">
          <Outlet />
        </main>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default function Layout() {
  const { isLoading, isAuthenticated, user, getIdToken } = useKindeAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", {
        state: `${location.pathname}${location.search}`,
      });
    }
  }, [isAuthenticated, isLoading]);
  useEffect(() => {
    if (user) {
      // @ts-expect-error error
      window.dataLayer?.push({
        user_id: user.id,
      });
    }
  }, [user]);
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-screen">
        <Spinner />
      </div>
    );
  }
  return <LayoutInner getIdToken={getIdToken} />;
}
